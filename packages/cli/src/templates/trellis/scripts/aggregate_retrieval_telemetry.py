#!/usr/bin/env python3
"""Aggregate per-query retrieval telemetry JSONL into summary metrics (schema v2)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from common.retrieval_tool_classification import (  # noqa: E402
    classify_tool_calls,
    semantic_routes_in_plan,
    structural_routes_in_plan,
)

SCHEMA_VERSION = 2

SEMANTIC_OUTCOMES = (
    "success",
    "partial",
    "resource_exhausted",
    "timeout",
    "not_configured",
    "unavailable",
    "not_run",
    "unknown",
)

SEMANTIC_SKIP_REASONS = (
    "rg_corrob_sufficient",
    "rg_empty_semantic_required",
    "trap_only_semantic_required",
    "not_in_plan",
    "not_applicable",
    "adapter_unavailable",
    "agent_stopped_early",
    "unknown",
    "manual_not_recorded",
)


def _rate(count: int, total: int) -> float:
    return 0.0 if total == 0 else count / total


def _avg(values: list[float]) -> float:
    return 0.0 if not values else sum(values) / len(values)


def compute_compliance_score(record: dict[str, Any]) -> float:
    earned = 0.0
    possible = 0.0

    if record.get("structural_in_plan"):
        possible += 1.0
        if record.get("codegraph_executed"):
            earned += 1.0

    if record.get("semantic_in_plan"):
        possible += 1.0
        if record.get("semantic_executed") or record.get("semantic_skip_reason") == "rg_corrob_sufficient":
            earned += 1.0

    possible += 1.0
    if record.get("read_verification_done"):
        earned += 1.0

    if record.get("plan_block_in_prompt"):
        possible += 0.25
        if record.get("router_cli_invoked"):
            earned += 0.25

    return 1.0 if possible == 0 else earned / possible


def migrate_record(raw: dict[str, Any]) -> dict[str, Any]:
    routes = raw.get("routes") or raw.get("routes_in_plan") or []
    if not isinstance(routes, list):
        routes = []
    tools = raw.get("tools_called") or []
    if not isinstance(tools, list):
        tools = []
    platform = str(raw.get("platform", "cursor"))
    classified = classify_tool_calls([str(t) for t in tools], platform=platform)

    structural_in = raw.get("structural_in_plan")
    if not isinstance(structural_in, bool):
        structural_in = structural_routes_in_plan([str(r) for r in routes])

    semantic_in = raw.get("semantic_in_plan")
    if not isinstance(semantic_in, bool):
        semantic_in = semantic_routes_in_plan([str(r) for r in routes])

    record: dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "query_id": str(raw.get("query_id", "")),
        "dataset": str(raw.get("dataset", "unknown")),
        "query_text": str(raw.get("query_text", "")),
        "run_id": str(raw.get("run_id", "")),
        "platform": platform,
        "semantic_in_plan": bool(semantic_in),
        "semantic_order": raw.get("semantic_order")
        if isinstance(raw.get("semantic_order"), int)
        else None,
        "structural_in_plan": bool(structural_in),
        "codegraph_in_plan": bool(raw.get("codegraph_in_plan", structural_in)),
        "fallback_hint_present": bool(raw.get("fallback_hint_present")),
        "intents": list(raw.get("intents") or []),
        "routes": [str(r) for r in routes],
        "routes_in_plan": [str(r) for r in routes],
        "project_file_count": raw.get("project_file_count")
        if isinstance(raw.get("project_file_count"), int)
        else None,
        "tools_called": classified.tools_called,
        "grep_count": raw.get("grep_count")
        if isinstance(raw.get("grep_count"), int)
        else classified.grep_count,
        "read_count": raw.get("read_count")
        if isinstance(raw.get("read_count"), int)
        else classified.read_count,
        "codegraph_attempted": bool(
            raw.get("codegraph_attempted", classified.codegraph_attempted)
        ),
        "codegraph_executed": bool(
            raw.get("codegraph_executed", classified.codegraph_executed)
        ),
        "router_cli_invoked": bool(
            raw.get("router_cli_invoked", classified.router_cli_invoked)
        ),
        "plan_block_in_prompt": bool(raw.get("plan_block_in_prompt")),
        "read_verification_done": bool(
            raw.get("read_verification_done", classified.read_count > 0)
        ),
        "semantic_attempted": bool(
            raw.get("semantic_attempted", classified.semantic_attempted)
        ),
        "semantic_executed": bool(
            raw.get("semantic_executed", classified.semantic_executed)
        ),
        "semantic_outcome": str(raw.get("semantic_outcome", "unknown")),
        "semantic_success": bool(raw.get("semantic_success")),
        "semantic_skip_reason": raw.get("semantic_skip_reason"),
        "rg_candidate_count": raw.get("rg_candidate_count")
        if isinstance(raw.get("rg_candidate_count"), int)
        else None,
        "rg_corrob_status": str(raw.get("rg_corrob_status", "unknown")),
        "trap_only": bool(raw.get("trap_only")),
        "corroborated_files": list(raw.get("corroborated_files") or []),
        "adapter_errors": list(raw.get("adapter_errors") or []),
        "candidate_pool_recall": raw.get("candidate_pool_recall")
        if isinstance(raw.get("candidate_pool_recall"), (int, float))
        else None,
        "final_top_k_recall": raw.get("final_top_k_recall")
        if isinstance(raw.get("final_top_k_recall"), (int, float))
        else None,
        "answer_score": raw.get("answer_score")
        if isinstance(raw.get("answer_score"), (int, float))
        else None,
        "compliance_score": raw.get("compliance_score")
        if isinstance(raw.get("compliance_score"), (int, float))
        else None,
        "platform_semantic_executed": bool(
            raw.get("platform_semantic_executed", classified.platform_semantic_executed)
        ),
        "fast_context_count": int(raw.get("fast_context_count", classified.fast_context_count)),
        "cursor_fast_context_misuse": bool(
            raw.get("cursor_fast_context_misuse", classified.cursor_fast_context_misuse)
        ),
    }
    if record["compliance_score"] is None:
        record["compliance_score"] = compute_compliance_score(record)
    return record


def derive_metrics(records: list[dict[str, Any]]) -> dict[str, Any]:
    total = len(records)
    outcome_counts = {k: 0 for k in SEMANTIC_OUTCOMES}
    skip_counts = {k: 0 for k in SEMANTIC_SKIP_REASONS}

    semantic_plan = semantic_exec = semantic_attempt = semantic_success = 0
    platform_sem_exec = fast_context_total = fast_context_misuse = 0
    codegraph_plan = codegraph_exec = router_cli = plan_block = read_verify = 0
    compliance_scores: list[float] = []
    answer_scores: list[float] = []
    pool_recalls: list[float] = []
    topk_recalls: list[float] = []

    for rec in records:
        if rec.get("semantic_in_plan"):
            semantic_plan += 1
        if rec.get("semantic_executed"):
            semantic_exec += 1
        if rec.get("platform_semantic_executed"):
            platform_sem_exec += 1
        fc = rec.get("fast_context_count")
        if isinstance(fc, int) and fc > 0:
            fast_context_total += fc
        if rec.get("cursor_fast_context_misuse"):
            fast_context_misuse += 1
        if rec.get("semantic_attempted"):
            semantic_attempt += 1
        if rec.get("semantic_success") and rec.get("semantic_outcome") == "success":
            semantic_success += 1
        if rec.get("codegraph_in_plan"):
            codegraph_plan += 1
        if rec.get("codegraph_executed"):
            codegraph_exec += 1
        if rec.get("router_cli_invoked"):
            router_cli += 1
        if rec.get("plan_block_in_prompt"):
            plan_block += 1
        if rec.get("read_verification_done"):
            read_verify += 1

        outcome = str(rec.get("semantic_outcome", "unknown"))
        if outcome in outcome_counts:
            outcome_counts[outcome] += 1
        skip = rec.get("semantic_skip_reason")
        if skip and skip in skip_counts:
            skip_counts[skip] += 1

        cs = rec.get("compliance_score")
        if isinstance(cs, (int, float)):
            compliance_scores.append(float(cs))
        ans = rec.get("answer_score")
        if isinstance(ans, (int, float)):
            answer_scores.append(float(ans))
        cpr = rec.get("candidate_pool_recall")
        if isinstance(cpr, (int, float)):
            pool_recalls.append(float(cpr))
        ftr = rec.get("final_top_k_recall")
        if isinstance(ftr, (int, float)):
            topk_recalls.append(float(ftr))

    avg_pool = _avg(pool_recalls)
    avg_topk = _avg(topk_recalls)
    recall_drop = 0.0 if avg_pool <= 0 else 1.0 - avg_topk / avg_pool

    return {
        "schema_version": SCHEMA_VERSION,
        "total_queries": total,
        "semantic_plan_count": semantic_plan,
        "semantic_exec_count": semantic_exec,
        "semantic_attempt_count": semantic_attempt,
        "semantic_exec_success_count": semantic_success,
        "semantic_plan_rate": _rate(semantic_plan, total),
        "semantic_exec_rate": _rate(semantic_exec, total),
        "platform_semantic_exec_count": platform_sem_exec,
        "platform_semantic_exec_rate": _rate(platform_sem_exec, total),
        "fast_context_invocation_total": fast_context_total,
        "cursor_fast_context_misuse_count": fast_context_misuse,
        "cursor_fast_context_misuse_rate": _rate(fast_context_misuse, total),
        "semantic_attempt_rate": _rate(semantic_attempt, total),
        "semantic_exec_success_rate": _rate(semantic_success, total),
        "codegraph_plan_count": codegraph_plan,
        "codegraph_exec_count": codegraph_exec,
        "codegraph_plan_rate": _rate(codegraph_plan, total),
        "codegraph_exec_rate": _rate(codegraph_exec, total),
        "router_cli_count": router_cli,
        "router_cli_rate": _rate(router_cli, total),
        "plan_block_count": plan_block,
        "plan_block_rate": _rate(plan_block, total),
        "read_verification_count": read_verify,
        "read_verification_rate": _rate(read_verify, total),
        "avg_compliance_score": _avg(compliance_scores),
        "avg_answer_score": _avg(answer_scores),
        "semantic_outcome_counts": outcome_counts,
        "semantic_skip_reason_counts": skip_counts,
        "avg_candidate_pool_recall": avg_pool,
        "avg_final_top_k_recall": avg_topk,
        "recall_drop_rate": recall_drop,
    }


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        try:
            raw = json.loads(stripped)
        except json.JSONDecodeError as exc:
            raise ValueError(f"{path}:{line_no}: invalid JSON: {exc}") from exc
        if not isinstance(raw, dict):
            raise ValueError(f"{path}:{line_no}: expected JSON object per line")
        records.append(migrate_record(raw))
    return records


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "jsonl",
        type=Path,
        help="Per-query telemetry JSONL (one object per line)",
    )
    parser.add_argument(
        "--markdown",
        action="store_true",
        help="Print a short markdown summary for eval reports",
    )
    args = parser.parse_args()

    if not args.jsonl.is_file():
        print(f"error: file not found: {args.jsonl}", file=sys.stderr)
        return 1

    records = load_jsonl(args.jsonl)
    metrics = derive_metrics(records)
    payload = {"metrics": metrics, "record_count": len(records)}

    if args.markdown:
        m = metrics
        print("## Retrieval telemetry (derived from JSONL)\n")
        print("| Metric | Value |")
        print("| --- | ---: |")
        print(f"| total_queries | {m['total_queries']} |")
        print(f"| semantic_plan_rate | {m['semantic_plan_rate']:.1%} |")
        print(f"| semantic_exec_rate | {m['semantic_exec_rate']:.1%} |")
        print(f"| platform_semantic_exec_rate | {m.get('platform_semantic_exec_rate', 0):.1%} |")
        print(f"| cursor_fast_context_misuse_rate | {m.get('cursor_fast_context_misuse_rate', 0):.1%} |")
        print(f"| codegraph_plan_rate | {m['codegraph_plan_rate']:.1%} |")
        print(f"| codegraph_exec_rate | {m['codegraph_exec_rate']:.1%} |")
        print(f"| router_cli_rate | {m['router_cli_rate']:.1%} |")
        print(f"| avg_compliance_score | {m['avg_compliance_score']:.3f} |")
        print(f"| avg_answer_score | {m['avg_answer_score']:.3f} |")
        print("\nDo not hand-copy plan/exec rates; regenerate from JSONL with this script.")
    else:
        print(json.dumps(payload, indent=2, ensure_ascii=False))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())