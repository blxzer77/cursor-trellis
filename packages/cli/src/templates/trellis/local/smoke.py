#!/usr/bin/env python3
"""Cursor++ local bundle smoke check — whitelist metadata only, no secret reads."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from patch_wpelc8 import (
    MARKER,
    _load_config,
    configured_slot_map,
    probe_wpelc8_compat,
    try_resolve_extension_js,
)

CAVEATS = [
    "Cursor++ is third-party; reverse-engineering is version-bound",
    "Never reads BYOK provider catalog file contents",
    "Patch is operator-only; not part of CI or default Trellis workflow",
    "Re-verify after any Cursor or Cursor++ upgrade",
]


def detect_env() -> tuple[str, str | None]:
    env_flag = os.environ.get("TRELLIS_CURSOR_BYOK", "").strip()
    if env_flag == "1":
        return "byok", "TRELLIS_CURSOR_BYOK=1"
    if env_flag == "0":
        return "native", "TRELLIS_CURSOR_BYOK=0"

    routes = Path.home() / ".ccursor" / "routes.json"
    if routes.is_file():
        try:
            data = json.loads(routes.read_text(encoding="utf-8"))
            byok = data.get("byokMode")
            if byok in (1, "1", True):
                return "byok", "routes.json:byokMode"
            if byok in (0, "0", False):
                return "native", "routes.json:byokMode"
        except (OSError, json.JSONDecodeError, TypeError):
            pass
    return "unknown", None


def detect_patch_status(bundle_dir: Path, config: dict) -> tuple[str, dict[str, object]]:
    extension = try_resolve_extension_js(bundle_dir, config)
    meta: dict[str, object] = {"extension": str(extension) if extension else None}
    if extension is None:
        return "not-applied", meta

    source = extension.read_text(encoding="utf-8", errors="ignore")
    marker_present = MARKER in source
    meta["patch_marker_present"] = marker_present
    probe = probe_wpelc8_compat(source)
    meta.update(probe)

    if not marker_present:
        return "not-applied", meta

    if probe["wpelc8"] == "not_locatable" or probe["inject_anchor"] == "missing":
        return "stale", meta
    if probe["wpelc8"] == "unknown" or probe["inject_anchor"] == "unknown":
        return "stale", meta
    return "applied", meta


def main() -> int:
    bundle_dir = Path(__file__).resolve().parent
    config = _load_config(bundle_dir)
    env, env_source = detect_env()
    patch_status, patch_meta = detect_patch_status(bundle_dir, config)
    slots = configured_slot_map(bundle_dir, config)

    report = {
        "env": env,
        "env_source": env_source,
        "patch_status": patch_status,
        "patch_meta": patch_meta,
        "current_map": {
            "configured_roles": {
                role: {"candidates": names} for role, names in sorted(slots.items())
            },
            "note": "Role names from user JSON5 config only; slugs not resolved (no provider catalog read)",
        },
        "caveats": CAVEATS,
    }
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
