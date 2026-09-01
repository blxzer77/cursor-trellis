"""Pool-slice Check helper (P40).

Full / Parent planning must declare ``touches``. Multi-link tasks must list
per-item obligations in the PRD. This is not a ``start-execution --check``
hard gate, not ``task.py create`` blocking, and not a ``pool.py validate``
rule for a missing ``## 切片`` heading.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from .parallel_declaration import (
    extract_serial_reason,
    load_planning_declaration,
    resolve_declaration_profile,
)

POOL_SLICE_SOURCE = "pool-slice-check"
POOL_SLICE_SCHEMA_VERSION = 1

UNRELATED_PREFIX_PAIRS: tuple[tuple[str, str], ...] = (
    ("packages/core", "packages/cli/src/templates/cursor"),
    ("packages/core", "smart-search"),
    ("cursor-trellis/", "smart-search/"),
)

OBLIGATION_HEADINGS = ("## 池义务", "## Pool obligations")
POOL_ID_RE = re.compile(r"\bP\d+\b")
_TRUE = frozenset({"true", "yes", "1", "on"})


def evaluate_pool_slice(
    task_dir: Path | str,
    task_data: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Return a Check verdict for P40 slice / multi-link rules.

    ``result`` is PASS / FAIL / SKIP. Lite without ``touches`` is SKIP.
    """
    path = Path(task_dir)
    data = dict(task_data or {})
    if not data:
        loaded = _read_json(path / "task.json")
        if loaded:
            data = loaded

    declaration = load_planning_declaration(path)
    profile = resolve_declaration_profile(path, data, declaration)
    touches = extract_touches(declaration)
    serial_reason = extract_serial_reason(declaration)
    oversized_ok = _truthy(declaration.get("oversized_accepted"))
    pool_items = _pool_items(data)
    errors: list[str] = []

    if profile in {"full", "parent"} and not touches:
        errors.append("Full/Parent planning must declare touches")
    if touches and not serial_reason and not oversized_ok:
        unrelated = unrelated_module_pairs(touches)
        if unrelated:
            errors.append(
                "touches span unrelated modules without serial_reason or oversized_accepted: "
                + "; ".join(f"{left} ↔ {right}" for left, right in unrelated)
            )

    if len(pool_items) > 1:
        prd_text = _read_text(path / "prd.md")
        missing = missing_pool_obligations(prd_text, pool_items)
        if missing == "missing-section":
            errors.append(
                "multi-link PRD must include ## 池义务 (or ## Pool obligations) "
                "with per-item duties"
            )
        elif missing:
            errors.append(
                "multi-link PRD obligations omit pool items: " + ", ".join(missing)
            )

    if profile == "lite" and not errors:
        return _verdict(
            True,
            "SKIP" if not touches else "PASS",
            profile,
            [],
            touches,
            pool_items,
            serial_reason,
        )

    ok = not errors
    return _verdict(
        ok,
        "PASS" if ok else "FAIL",
        profile,
        errors,
        touches,
        pool_items,
        serial_reason,
    )


def extract_touches(declaration: dict[str, Any]) -> list[str]:
    """Collect ``touches`` from implement.md / task-map children."""
    out: list[str] = []
    raw = declaration.get("touches")
    if isinstance(raw, list):
        out.extend(_unique_strings(raw))
    elif isinstance(raw, str) and raw.strip():
        out.extend(_unique_strings(_parse_touch_list(raw)))
    children = declaration.get("children")
    if isinstance(children, list):
        for child in children:
            if not isinstance(child, dict):
                continue
            child_touches = child.get("touches")
            if isinstance(child_touches, list):
                out.extend(_unique_strings(child_touches))
            elif isinstance(child_touches, str) and child_touches.strip():
                out.extend(_unique_strings(_parse_touch_list(child_touches)))
    return _unique_strings(out)


def unrelated_module_pairs(touches: list[str]) -> list[tuple[str, str]]:
    """Return prefix pairs that both appear in ``touches``."""
    hits: list[tuple[str, str]] = []
    normalized = [_normalize_touch(item) for item in touches]
    for left, right in UNRELATED_PREFIX_PAIRS:
        if _any_prefix(normalized, left) and _any_prefix(normalized, right):
            hits.append((left, right))
    return hits


def missing_pool_obligations(prd_text: str, pool_items: list[str]) -> list[str] | str:
    """Return missing pool ids, or ``missing-section`` if the heading is absent."""
    section = _obligation_section(prd_text)
    if section is None:
        return "missing-section"
    present = set(POOL_ID_RE.findall(section))
    return [item for item in pool_items if item not in present]


def _obligation_section(prd_text: str) -> str | None:
    lines = prd_text.splitlines()
    start: int | None = None
    for index, line in enumerate(lines):
        stripped = line.strip()
        if stripped in OBLIGATION_HEADINGS:
            start = index + 1
            break
    if start is None:
        return None
    collected: list[str] = []
    for line in lines[start:]:
        if line.startswith("## ") and line.strip() not in OBLIGATION_HEADINGS:
            break
        collected.append(line)
    return "\n".join(collected)


def _pool_items(task_data: dict[str, Any]) -> list[str]:
    meta = task_data.get("meta")
    if not isinstance(meta, dict):
        return []
    raw = meta.get("pool_items")
    if not isinstance(raw, list):
        return []
    return _unique_strings(raw)


def _truthy(value: Any) -> bool:
    if value is True:
        return True
    if isinstance(value, str) and value.strip().lower() in _TRUE:
        return True
    return False


def _normalize_touch(touch: str) -> str:
    return touch.replace("\\", "/").lstrip("./")


def _any_prefix(touches: list[str], prefix: str) -> bool:
    needle = prefix.replace("\\", "/")
    if not needle.endswith("/") and not needle.endswith("\\"):
        folder = needle + "/"
    else:
        folder = needle
    return any(item == needle.rstrip("/") or item.startswith(folder) for item in touches)


def _parse_touch_list(value: str) -> list[str]:
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


def _read_text(path: Path) -> str:
    if not path.is_file():
        return ""
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        return ""


def _verdict(
    ok: bool,
    result: str,
    profile: str,
    errors: list[str],
    touches: list[str],
    pool_items: list[str],
    serial_reason: str | None,
) -> dict[str, Any]:
    return {
        "schema_version": POOL_SLICE_SCHEMA_VERSION,
        "source": POOL_SLICE_SOURCE,
        "readonly": True,
        "ok": ok,
        "result": result,
        "profile": profile,
        "errors": list(errors),
        "touches": list(touches),
        "pool_items": list(pool_items),
        "serial_reason": serial_reason,
    }


def main(argv: list[str] | None = None) -> int:
    import sys

    args = list(sys.argv[1:] if argv is None else argv)
    if not args:
        sys.stderr.write("usage: pool_slice.py <task-dir>\n")
        return 2
    payload = evaluate_pool_slice(Path(args[0]))
    sys.stdout.write(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    return 0 if payload.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
