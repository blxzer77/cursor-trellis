#!/usr/bin/env python3
"""Batch route_codebase_retrieval for plan metrics (REC-06: platform-semantic on Cursor)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from common.codebase_retrieval_router import route_codebase_retrieval  # noqa: E402
from common.retrieval_tool_classification import (  # noqa: E402
    platform_semantic_route_order,
    semantic_routes_in_plan,
)


def load_queries(path: Path) -> list[dict]:
    text = path.read_text(encoding="utf-8-sig")
    rows: list[dict] = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        rows.append(json.loads(stripped))
    return rows


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--queries",
        type=Path,
        default=None,
        help="JSONL query file (default: ./queries.jsonl under cwd)",
    )
    parser.add_argument("--pretty", action="store_true")
    args = parser.parse_args(argv)

    root = Path.cwd()
    queries_path = args.queries or (root / "queries.jsonl")
    if not queries_path.is_file():
        print(f"error: queries file not found: {queries_path}", file=sys.stderr)
        return 1

    rows = load_queries(queries_path)
    out: list[dict] = []
    plan_sem = 0
    platform_sem = 0
    fast_context_sem = 0

    for row in rows:
        query = str(row.get("query", ""))
        plan = route_codebase_retrieval(query)
        routes = plan.get("routes") or []
        route_ids = [str(r.get("id", "")) for r in routes if isinstance(r, dict)]
        sem_in_plan = semantic_routes_in_plan(route_ids)
        if sem_in_plan:
            plan_sem += 1
        if "platform-semantic" in route_ids:
            platform_sem += 1
        if "semantic-fast-context" in route_ids:
            fast_context_sem += 1

        out.append(
            {
                "id": row.get("id"),
                "intents": [i["id"] for i in plan.get("intents", []) if isinstance(i, dict)],
                "route_ids": route_ids,
                "semantic_in_plan": sem_in_plan,
                "platform_semantic_order": platform_semantic_route_order(
                    [r for r in routes if isinstance(r, dict)]
                ),
                "fallback_rg_empty": any(
                    "corroborated" in str(f.get("when", ""))
                    for f in (plan.get("fallback") or [])
                    if isinstance(f, dict)
                ),
            }
        )

    n = len(rows)
    summary = {
        "n": n,
        "semantic_plan_rate": plan_sem / n if n else 0.0,
        "platform_semantic_plan_rate": platform_sem / n if n else 0.0,
        "semantic_fast_context_plan_rate": fast_context_sem / n if n else 0.0,
        "fallback_hint_rate": sum(1 for x in out if x["fallback_rg_empty"]) / n if n else 0.0,
        "note": (
            "Plan rates only. semantic_exec_rate must come from session tool logs "
            "and classify_tool_calls(platform=cursor)."
        ),
    }
    payload = {"summary": summary, "queries": out}
    indent = 2 if args.pretty else None
    print(json.dumps(payload, ensure_ascii=False, indent=indent))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())