#!/usr/bin/env python3
"""CLI: rank codebase path candidates for B/E/D intents (eval / dogfood)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from common.retrieval_result_ranking import rank_retrieval_result_candidates


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Rank retrieval path candidates (caller / trap / env intents).",
    )
    parser.add_argument(
        "--candidates",
        help="Path to JSON array of candidate objects, or '-' for stdin.",
    )
    parser.add_argument(
        "--intents",
        required=True,
        help="Comma-separated intent ids (e.g. caller-chain,env-config-literal).",
    )
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument("--expanded-pool-size", type=int, default=None)
    parser.add_argument(
        "--caller-pool-expansion",
        action="store_true",
        help="Enable caller pool expansion (caller-chain intent).",
    )
    parser.add_argument("--min-concrete-callers", type=int, default=3)
    parser.add_argument("--json", action="store_true", help="Emit JSON (default).")
    parser.add_argument("--pretty", action="store_true")
    return parser.parse_args(argv)


def load_candidates(source: str | None) -> list[dict]:
    if source is None or source == "-":
        raw = sys.stdin.read()
    else:
        raw = Path(source).read_text(encoding="utf-8")
    parsed = json.loads(raw)
    if not isinstance(parsed, list):
        raise ValueError("candidates must be a JSON array")
    return [item for item in parsed if isinstance(item, dict)]


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        candidates = load_candidates(args.candidates)
    except (OSError, json.JSONDecodeError, ValueError) as error:
        print(f"rank_retrieval_candidates: {error}", file=sys.stderr)
        return 2

    intents = [part.strip() for part in args.intents.split(",") if part.strip()]
    expansion = None
    if args.caller_pool_expansion:
        expansion = {
            "enabled": True,
            "minConcreteCallers": args.min_concrete_callers,
        }

    result = rank_retrieval_result_candidates(
        candidates,
        intents=intents,
        top_k=args.top_k,
        expanded_pool_size=args.expanded_pool_size,
        caller_pool_expansion=expansion,
    )
    indent = 2 if args.pretty else None
    print(json.dumps(result, indent=indent, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())