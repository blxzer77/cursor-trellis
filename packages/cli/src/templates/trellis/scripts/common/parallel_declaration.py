"""Planning-declaration Check helper (P38).

Full / Parent planning must declare isolatable groups XOR a serial_reason.
Check workers call ``evaluate_parallel_declaration``. This is not a
``start-execution --check`` hard gate and not a scheduler.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from .full_quality import rigor_from_required_controls
from .task_map import load_task_map

PARALLEL_DECLARATION_SOURCE = "parallel-declaration-check"
PARALLEL_DECLARATION_SCHEMA_VERSION = 1

SERIAL_REASONS = (
    "shared write-set",
    "HITL or reviewer gate",
    "depends_on unmet",
    "user asked serial",
    "conflict surface cannot isolate",
)
LITE_SERIAL_REASON = "single write-set"

_SERIAL_ALIASES: tuple[tuple[str, tuple[str, ...]], ...] = (
    (
        "shared write-set",
        ("shared write-set", "shared write set", "共享写集"),
    ),
    (
        "HITL or reviewer gate",
        ("hitl or reviewer gate", "hitl", "reviewer gate", "reviewer", "门禁"),
    ),
    (
        "depends_on unmet",
        ("depends_on unmet", "depends_on", "依赖未满足"),
    ),
    (
        "user asked serial",
        ("user asked serial", "用户要求串行"),
    ),
    (
        "conflict surface cannot isolate",
        ("conflict surface cannot isolate", "conflict surface", "冲突面无法隔离"),
    ),
    (
        LITE_SERIAL_REASON,
        ("single write-set", "single write set", "真·单写集", "真单写集"),
    ),
)

_KEY_LINE_RE = re.compile(
    r"^(?:[-*]\s+)?`?([A-Za-z_][A-Za-z0-9_]*)`?\s*:\s*(.+?)\s*$"
)
_HOST_FORBIDDEN = ("Multitask", "SwitchMode", "CreateGoal")


def evaluate_parallel_declaration(
    task_dir: Path | str,
    task_data: dict[str, Any] | None = None,
    *,
    inline_only: bool | None = None,
) -> dict[str, Any]:
    """Return a Check verdict for the P38 declaration XOR.

    ``result`` is PASS / FAIL / SKIP. Lite without a fake-parallel claim is SKIP.
    """
    path = Path(task_dir)
    data = dict(task_data or {})
    if not data:
        loaded = _read_json(path / "task.json")
        if loaded:
            data = loaded

    declaration = load_planning_declaration(path)
    profile = resolve_declaration_profile(path, data, declaration)
    units = extract_parallel_units(declaration)
    serial_reason = extract_serial_reason(declaration)
    mode = declaration.get("execution_mode")
    inferred_inline = mode == "inline" if inline_only is None else bool(inline_only)
    errors: list[str] = []

    overlap = overlapping_write_sets(
        units,
        declaration.get("children") if isinstance(declaration.get("children"), list) else [],
        group_isolation=declaration.get("isolation"),
    )
    if overlap:
        errors.append(
            "write-sets overlap without isolation (fake parallel): "
            + "; ".join(f"{touch} → {', '.join(ids)}" for touch, ids in overlap)
        )

    if profile == "lite":
        if errors:
            return _verdict(
                False,
                "FAIL",
                profile,
                errors,
                units,
                serial_reason,
                declaration,
            )
        return _verdict(True, "SKIP", profile, [], units, serial_reason, declaration)

    has_groups = bool(units)
    has_reason = bool(serial_reason)
    if not has_groups and not has_reason:
        errors.append(
            "Full/Parent planning must declare parallel_groups (or stages) or serial_reason"
        )
    if serial_reason and normalize_serial_reason(serial_reason) is None:
        errors.append(f"serial_reason is not in the P18/P38 set: {serial_reason}")
    if has_groups and inferred_inline and not has_reason:
        errors.append(
            "isolatable groups declared but write-set work stayed inline without serial_reason"
        )

    ok = not errors
    return _verdict(
        ok,
        "PASS" if ok else "FAIL",
        profile,
        errors,
        units,
        serial_reason,
        declaration,
    )


def load_planning_declaration(task_dir: Path | str) -> dict[str, Any]:
    """Merge task-map.md (wins) with implement.md gap-fill."""
    path = Path(task_dir)
    merged: dict[str, Any] = {}
    map_data, _body = load_task_map(path)
    if isinstance(map_data, dict):
        merged.update(map_data)
    implement = path / "implement.md"
    if implement.is_file():
        try:
            impl = parse_declaration_text(implement.read_text(encoding="utf-8"))
        except OSError:
            impl = {}
        for key, value in impl.items():
            current = merged.get(key)
            if current in (None, "", [], {}) or key not in merged:
                merged[key] = value
    return merged


def parse_declaration_text(text: str) -> dict[str, Any]:
    """Parse YAML frontmatter plus body ``key: value`` lines (implement.md)."""
    data: dict[str, Any] = {}
    frontmatter, body = _split_frontmatter(text)
    if frontmatter:
        data.update(_parse_simple_mapping(frontmatter))
    data.update(_parse_simple_mapping(body if frontmatter else text))
    return data


def extract_parallel_units(declaration: dict[str, Any]) -> list[str]:
    units: list[str] = []
    groups = declaration.get("parallel_groups")
    if isinstance(groups, list):
        units.extend(_unique_strings(groups))
    elif isinstance(groups, str) and groups.strip():
        units.extend(_unique_strings(_parse_inline_list(groups)))
    stages = declaration.get("stages")
    if isinstance(stages, list):
        for stage in stages:
            if not isinstance(stage, dict):
                continue
            stage_units = stage.get("units")
            if isinstance(stage_units, list):
                units.extend(_unique_strings(stage_units))
            elif isinstance(stage_units, str) and stage_units.strip():
                units.extend(_unique_strings(_parse_inline_list(stage_units)))
    return _unique_strings(units)


def extract_serial_reason(declaration: dict[str, Any]) -> str | None:
    raw = declaration.get("serial_reason")
    if isinstance(raw, str) and raw.strip():
        return raw.strip()
    return None


def normalize_serial_reason(raw: str) -> str | None:
    text = raw.strip().lower()
    for canonical, aliases in _SERIAL_ALIASES:
        for alias in aliases:
            if alias.lower() in text or text == alias.lower():
                return canonical
    return None


def overlapping_write_sets(
    units: list[str],
    children: list[Any],
    *,
    group_isolation: str | None = None,
) -> list[tuple[str, list[str]]]:
    """Return (touch, unit-ids) for shared write-sets that are not isolated."""
    if group_isolation == "git-worktree":
        return []
    by_id = {
        child.get("id"): child
        for child in children
        if isinstance(child, dict) and isinstance(child.get("id"), str)
    }
    owners: dict[str, list[str]] = {}
    for unit in units:
        child = by_id.get(unit) or {}
        isolation = child.get("isolation")
        if isolation == "git-worktree":
            continue
        touches = child.get("touches")
        if not isinstance(touches, list):
            continue
        for touch in touches:
            if not isinstance(touch, str) or not touch.strip():
                continue
            owners.setdefault(touch.strip(), []).append(unit)
    return [
        (touch, ids)
        for touch, ids in owners.items()
        if len(_unique_strings(ids)) > 1
    ]


def resolve_declaration_profile(
    task_dir: Path | str,
    task_data: dict[str, Any],
    declaration: dict[str, Any],
) -> str:
    topology = task_data.get("topology")
    if isinstance(topology, dict) and topology.get("kind") == "parent-child":
        return "parent"
    children = task_data.get("children")
    if isinstance(children, list) and children:
        return "parent"
    map_children = declaration.get("children")
    if isinstance(map_children, list) and any(
        isinstance(child, dict) and child.get("id") for child in map_children
    ):
        return "parent"
    if (Path(task_dir) / "task-map.md").is_file() and extract_parallel_units(declaration):
        return "parent"
    if rigor_from_required_controls(task_data) == "full":
        return "full"
    return "lite"


def host_forbidden_terms() -> tuple[str, ...]:
    return _HOST_FORBIDDEN


def _verdict(
    ok: bool,
    result: str,
    profile: str,
    errors: list[str],
    units: list[str],
    serial_reason: str | None,
    declaration: dict[str, Any],
) -> dict[str, Any]:
    return {
        "schema_version": PARALLEL_DECLARATION_SCHEMA_VERSION,
        "source": PARALLEL_DECLARATION_SOURCE,
        "readonly": True,
        "ok": ok,
        "result": result,
        "profile": profile,
        "errors": list(errors),
        "has_parallel_groups": bool(units),
        "has_serial_reason": bool(serial_reason),
        "units": list(units),
        "serial_reason": serial_reason,
        "execution_mode": declaration.get("execution_mode"),
    }


def _split_frontmatter(content: str) -> tuple[str | None, str]:
    lines = content.splitlines(keepends=True)
    if not lines or lines[0].strip() != "---":
        return None, content
    for idx in range(1, len(lines)):
        if lines[idx].strip() == "---":
            return "".join(lines[1:idx]), "".join(lines[idx + 1 :])
    return None, content


def _parse_simple_mapping(text: str) -> dict[str, Any]:
    data: dict[str, Any] = {}
    for raw in text.splitlines():
        stripped = raw.strip()
        if not stripped or stripped.startswith("#"):
            continue
        match = _KEY_LINE_RE.match(stripped)
        if not match:
            continue
        key = match.group(1)
        value = _parse_scalar(match.group(2).strip().strip("`"))
        if key in data and data[key] not in (None, "", [], {}):
            continue
        data[key] = value
    return data


def _parse_scalar(value: str) -> Any:
    if value == "null":
        return None
    if value == "[]":
        return []
    if value.startswith("[") and value.endswith("]"):
        return _parse_inline_list(value)
    return value.strip("'\"")


def _parse_inline_list(value: str) -> list[str]:
    inner = value.strip()
    if inner.startswith("[") and inner.endswith("]"):
        inner = inner[1:-1]
    if not inner.strip():
        return []
    return [item.strip().strip("'\"") for item in inner.split(",") if item.strip()]


def _unique_strings(values: list[Any]) -> list[str]:
    out: list[str] = []
    for value in values:
        if not isinstance(value, str):
            continue
        item = value.strip()
        if item and item not in out:
            out.append(item)
    return out


def _read_json(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {}
    try:
        parsed = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


def main(argv: list[str] | None = None) -> int:
    import sys

    args = list(sys.argv[1:] if argv is None else argv)
    if not args:
        sys.stderr.write("usage: parallel_declaration.py <task-dir>\n")
        return 2
    payload = evaluate_parallel_declaration(Path(args[0]))
    sys.stdout.write(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    return 0 if payload.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
