#!/usr/bin/env python3
"""
Emit a deterministic codebase retrieval plan JSON envelope for a query string.
"""

from __future__ import annotations

import argparse
import json
import sys
from common.codebase_retrieval_router import route_codebase_retrieval
from common.retrieval_agent_instructions import render_agent_instructions


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Route a codebase retrieval question to a structured plan envelope.",
    )
    parser.add_argument("query", nargs="?", default="", help="Natural-language retrieval question.")
    parser.add_argument(
        "--capabilities",
        help="Deprecated compatibility option; capability binding is resolver-owned.",
    )
    parser.add_argument(
        "--no-codebase-retrieval",
        action="store_true",
        help="Deprecated compatibility option; does not change the V3 plan.",
    )
    parser.add_argument(
        "--project-file-count",
        default="auto",
        metavar="N|auto",
        help="Deprecated compatibility option; does not change the V3 plan.",
    )
    parser.add_argument(
        "--locale",
        default="zh",
        choices=["zh", "en"],
        help="Language for agent instructions (default: zh).",
    )
    parser.add_argument(
        "--instructions",
        action="store_true",
        help="Print agent-executable instructions only (no JSON).",
    )
    parser.add_argument("--json", action="store_true", help="Emit JSON to stdout (default).")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        plan = route_codebase_retrieval(args.query)
    except ValueError as error:
        print(f"route_codebase_retrieval: {error}", file=sys.stderr)
        return 2
    instructions = render_agent_instructions(
        plan,
        locale=args.locale,
    )
    if args.instructions:
        sys.stdout.write(instructions)
        return 0
    payload: dict[str, object] = {**plan, "agentInstructions": instructions}
    indent = 2 if args.pretty else None
    print(json.dumps(payload, indent=indent, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
