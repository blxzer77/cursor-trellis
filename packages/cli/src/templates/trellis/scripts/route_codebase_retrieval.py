#!/usr/bin/env python3
"""
Emit a deterministic codebase retrieval plan JSON envelope for a query string.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from common.codebase_retrieval_router import (
    codebase_retrieval_selected_from_capabilities,
    route_codebase_retrieval,
)
from common.paths import get_repo_root
from common.project_file_stats import resolve_project_file_count_arg
from common.retrieval_agent_instructions import render_agent_instructions


def load_capabilities(path: Path | None) -> dict[str, object] | None:
    if path is None or not path.is_file():
        return None
    with path.open(encoding="utf-8") as handle:
        parsed = json.load(handle)
    return parsed if isinstance(parsed, dict) else None


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Route a codebase retrieval question to a structured plan envelope.",
    )
    parser.add_argument("query", nargs="?", default="", help="Natural-language retrieval question.")
    parser.add_argument(
        "--capabilities",
        help="Path to .trellis/capabilities.json for optional adapter gating.",
    )
    parser.add_argument(
        "--no-codebase-retrieval",
        action="store_true",
        help="Treat codebase-retrieval as unselected (omit optional adapter routes).",
    )
    parser.add_argument(
        "--project-file-count",
        default="auto",
        metavar="N|auto",
        help=(
            "File count for large-repo routing (>2000 promotes codegraph). "
            "Default auto: git ls-files or walk from repo root. Example: 5000."
        ),
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
        project_file_count = resolve_project_file_count_arg(
            args.project_file_count,
            repo_root=get_repo_root(),
        )
    except ValueError as error:
        print(f"route_codebase_retrieval: {error}", file=sys.stderr)
        return 2
    caps = load_capabilities(Path(args.capabilities) if args.capabilities else None)
    selected = (
        False
        if args.no_codebase_retrieval
        else codebase_retrieval_selected_from_capabilities(caps)
    )
    plan = route_codebase_retrieval(
        args.query,
        codebase_retrieval_selected=selected,
        project_file_count=project_file_count,
    )
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