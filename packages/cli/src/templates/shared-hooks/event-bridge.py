#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Thin Cursor Event Bridge hook.

Records one standard hook event. Unsubscribed modules must never fail the hook.
Does not write Kernel store primitives; optional Kernel patch is best-effort.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


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


def main() -> int:
    # Fail-closed for the Agent session: never break the hook.
    try:
        hook_input = _safe_payload()
        event = _event_name(sys.argv[1:], hook_input)
        sys.path.insert(0, str(Path(__file__).resolve().parents[2] / ".cstl" / "scripts"))
        try:
            from common.adapter_middleware import dispatch_hook_event
        except Exception:
            print(json.dumps({"permission": "allow"}))
            return 0
        result = dispatch_hook_event({"subscriptions": []}, event, source="cursor-hooks")
        _ = result
    except Exception:
        pass
    print(json.dumps({"permission": "allow"}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
