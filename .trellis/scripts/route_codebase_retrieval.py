#!/usr/bin/env python3
"""
Emit a deterministic codebase retrieval plan JSON envelope for a query string.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from common.codebase_retrieval_router import (
    codebase_retrieval_selected_from_capabilities,
    route_codebase_retrieval,
)


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
        "--platform",
        default="generic",
        choices=["cursor", "claude-code", "codex", "generic"],
        help="Host platform for platform-adaptive routing (default: generic).",
    )
    parser.add_argument(
        "--project-file-count",
        type=int,
        default=None,
        help="Total file count in project for token economy signals (e.g. 5000).",
    )
    parser.add_argument("--json", action="store_true", help="Emit JSON to stdout (default).")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    caps = load_capabilities(Path(args.capabilities) if args.capabilities else None)
    selected = (
        False
        if args.no_codebase_retrieval
        else codebase_retrieval_selected_from_capabilities(caps)
    )
    plan = route_codebase_retrieval(
        args.query,
        codebase_retrieval_selected=selected,
        platform=args.platform,
        project_file_count=args.project_file_count,
    )
    indent = 2 if args.pretty else None
    print(json.dumps(plan, indent=indent, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())