#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Thin Cursor Event Bridge hook.

Records one standard hook event. Unsubscribed modules must never fail the hook.
Does not write Kernel store primitives; optional Kernel patch is best-effort.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

DIR_WORKFLOW = ".cstl"


def _event_name(argv: list[str], hook_input: dict) -> str:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--event", default="")
    args, _unknown = parser.parse_known_args(argv)
    if args.event.strip():
        return args.event.strip()
    for key in ("hook_event_name", "event", "eventName"):
        value = hook_input.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return "sessionStart"


def _safe_payload() -> dict:
    raw = sys.stdin.read() if not sys.stdin.isatty() else ""
    if not raw.strip():
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def find_repo_root(start_path: str) -> str | None:
    current = Path(start_path).resolve()
    while current != current.parent:
        if (current / DIR_WORKFLOW).is_dir():
            return str(current)
        if (current / ".git").exists():
            return str(current)
        current = current.parent
    return None


def _load_extras(hook_input: dict) -> dict:
    try:
        repo = find_repo_root(os.getcwd())
        if not repo:
            repo = find_repo_root(str(Path(__file__).resolve().parents[2]))
        if not repo:
            return {}
        scripts_dir = Path(repo) / DIR_WORKFLOW / "scripts"
        if str(scripts_dir) not in sys.path:
            sys.path.insert(0, str(scripts_dir))
        from common.active_task import resolve_selected_task  # type: ignore[import-not-found]
        from common.ondemand_topology import extras_from_task_dir  # type: ignore[import-not-found]

        selected = resolve_selected_task(Path(repo), hook_input, platform="cursor")
        path = getattr(selected, "task_path", None)
        if not path:
            return {}
        candidate = Path(path)
        task_dir = candidate if candidate.is_absolute() else Path(repo) / candidate
        extras = extras_from_task_dir(task_dir)
        return extras if isinstance(extras, dict) else {}
    except Exception:
        return {}


def main() -> int:
    # Fail-closed for the Agent session: never break the hook.
    try:
        hook_input = _safe_payload()
        event = _event_name(sys.argv[1:], hook_input)
        sys.path.insert(0, str(Path(__file__).resolve().parents[2] / ".cstl" / "scripts"))
        try:
            from common.adapter_middleware import (  # type: ignore[import-not-found]
                dispatch_hook_event,
                event_bridge_for_dispatch,
            )
        except Exception:
            print(json.dumps({"permission": "allow"}))
            return 0
        extras = _load_extras(hook_input)
        bridge = event_bridge_for_dispatch(extras)
        _ = dispatch_hook_event(bridge, event, source="cursor-hooks")
    except Exception:
        pass
    print(json.dumps({"permission": "allow"}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
