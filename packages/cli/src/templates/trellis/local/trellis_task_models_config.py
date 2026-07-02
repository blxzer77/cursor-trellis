"""Load trellis-task-models (JSON5) and resolve primary/fallback against providers.json."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

KNOWN_SUBAGENT_TYPES = (
    "cstl-research",
    "cstl-implement",
    "cstl-check",
    "generalPurpose",
    "shell",
    "best-of-n-runner",
)

SUBAGENT_TYPE_HELP: dict[str, str] = {
    "cstl-research": "Trellis 调研 Task（cstl-research）",
    "cstl-implement": "Trellis 实现 Task；Parent/Child 默认派发类型",
    "cstl-check": "Trellis 验收 Task（cstl-check）",
    "generalPurpose": "Cursor 内置 Task：generalPurpose",
    "shell": "Cursor 内置 Task：shell",
    "best-of-n-runner": "Cursor 内置 Task：best-of-n-runner",
}


def strip_json5_comments(text: str) -> str:
    out: list[str] = []
    i = 0
    n = len(text)
    in_string = False
    escape = False
    while i < n:
        c = text[i]
        if in_string:
            out.append(c)
            if escape:
                escape = False
            elif c == "\\":
                escape = True
            elif c == '"':
                in_string = False
            i += 1
            continue
        if c == '"':
            in_string = True
            out.append(c)
            i += 1
            continue
        if c == "/" and i + 1 < n:
            nxt = text[i + 1]
            if nxt == "/":
                while i < n and text[i] != "\n":
                    i += 1
                continue
            if nxt == "*":
                i += 2
                while i + 1 < n and not (text[i] == "*" and text[i + 1] == "/"):
                    i += 1
                i = min(i + 2, n)
                continue
        out.append(c)
        i += 1
    return "".join(out)


def load_providers_catalog(
    providers_path: Path,
) -> tuple[dict[str, dict], dict[str, str]]:
    by_slug: dict[str, dict] = {}
    alias_to_slug: dict[str, str] = {}
    if not providers_path.is_file():
        return by_slug, alias_to_slug
    try:
        root = json.loads(providers_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return by_slug, alias_to_slug
    for prov in root.get("providers") or []:
        if not isinstance(prov, dict):
            continue
        pname = prov.get("name") or prov.get("id") or "?"
        for m in prov.get("models") or []:
            if not isinstance(m, dict):
                continue
            slug = m.get("id")
            if not isinstance(slug, str) or not slug.strip():
                continue
            slug = slug.strip()
            row = {
                "slug": slug,
                "apiModel": m.get("apiModel") or "",
                "displayName": m.get("displayName") or "",
                "provider": pname,
            }
            by_slug[slug] = row
            for field in ("id", "apiModel", "displayName"):
                val = m.get(field)
                if isinstance(val, str) and val.strip():
                    key = val.strip().lower()
                    if key not in alias_to_slug:
                        alias_to_slug[key] = slug
    return by_slug, alias_to_slug


def resolve_one_alias(
    raw: str,
    by_slug: dict[str, dict],
    alias_to_slug: dict[str, str],
) -> str | None:
    if raw in by_slug:
        return raw
    key = raw.strip().lower()
    if key in alias_to_slug:
        return alias_to_slug[key]
    return None


def _coerce_slot(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    if isinstance(value, list):
        out: list[str] = []
        for item in value:
            if isinstance(item, str) and item.strip():
                out.append(item.strip())
        return out
    return []


def load_task_models_document(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {}
    text = path.read_text(encoding="utf-8")
    try:
        data = json.loads(strip_json5_comments(text))
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}


def extract_raw_slots(doc: dict[str, Any]) -> dict[str, list[str]]:
    """subagent_type -> ordered candidates [primary, fallback, ...]."""
    slots: dict[str, list[str]] = {}
    for key, value in doc.items():
        if not isinstance(key, str) or key.startswith("_"):
            continue
        if key == "models" and isinstance(value, dict):
            for st, spec in value.items():
                if not isinstance(st, str) or st.startswith("_"):
                    continue
                if isinstance(spec, dict):
                    candidates = _coerce_slot(spec.get("primary"))
                    candidates.extend(_coerce_slot(spec.get("fallback")))
                    candidates.extend(_coerce_slot(spec.get("fallbacks")))
                else:
                    candidates = _coerce_slot(spec)
                if candidates:
                    slots[st] = candidates
            continue
        candidates = _coerce_slot(value)
        if candidates:
            slots[key] = candidates
    return slots


def resolve_slots_to_slugs(
    slots: dict[str, list[str]],
    providers_path: Path,
) -> tuple[dict[str, str], list[str]]:
    by_slug, alias_to_slug = load_providers_catalog(providers_path)
    resolved: dict[str, str] = {}
    notes: list[str] = []
    for subagent_type, candidates in sorted(slots.items()):
        chosen_slug: str | None = None
        used_label: str | None = None
        for idx, cand in enumerate(candidates):
            slug = resolve_one_alias(cand, by_slug, alias_to_slug)
            if slug:
                chosen_slug = slug
                used_label = cand
                if idx > 0:
                    notes.append(
                        f"  WARN {subagent_type}: primary unavailable; using fallback "
                        f"{cand!r} → {slug}"
                    )
                elif len(candidates) > 1:
                    row = by_slug.get(slug, {})
                    label = row.get("displayName") or row.get("apiModel") or cand
                    notes.append(f"  OK {subagent_type}: {cand!r} → {slug} ({label})")
                break
        if chosen_slug:
            resolved[subagent_type] = chosen_slug
        else:
            tried = ", ".join(repr(c) for c in candidates)
            notes.append(
                f"  ERROR {subagent_type}: no match for [{tried}] in providers.json"
            )
    return resolved, notes