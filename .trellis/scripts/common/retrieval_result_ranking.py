#!/usr/bin/env python3
"""Result-layer ranking for B/E/D intents (mirrors retrieval-result-ranking.ts)."""

from __future__ import annotations

import re
from typing import Any

RankingIntent = str

INTENT_CALLER = "caller-chain"
INTENT_TRAP = "trap-package-disambiguation"
INTENT_ENV = "env-config-literal"
INTENT_EXACT = "exact-symbol-path"
INTENT_PRESERVE = "protocol-platform-preserve"


def _norm(path: str) -> str:
    return path.replace("\\", "/").lower()


def _includes(intents: list[str], target: str) -> bool:
    return target in intents


def _is_assembly_only(candidate: dict[str, Any]) -> bool:
    path = _norm(str(candidate.get("path", "")))
    role = str(candidate.get("sourceRole") or candidate.get("source_role") or "")
    evidence = str(candidate.get("evidenceType") or candidate.get("evidence_type") or "")
    if evidence == "assembly":
        return True
    if re.search(r"(?:facade|loader|barrel|runtime|registry|snapshot)", role, re.I):
        return True
    return bool(re.search(r"(?:facade|loader|barrel|runtime|registry|snapshot)", path, re.I))


def _is_concrete_caller(candidate: dict[str, Any]) -> bool:
    evidence = str(candidate.get("evidenceType") or candidate.get("evidence_type") or "")
    role = str(candidate.get("sourceRole") or candidate.get("source_role") or "")
    if evidence == "caller-callsite":
        return True
    return bool(re.search(r"caller|callsite", role, re.I))


def _is_trap(candidate: dict[str, Any]) -> bool:
    path = _norm(str(candidate.get("path", "")))
    if candidate.get("trapHint") is True or candidate.get("trap_hint") is True:
        return True
    evidence = str(candidate.get("evidenceType") or candidate.get("evidence_type") or "")
    if evidence == "trap":
        return True
    if re.search(r"plugin-registry-snapshot|registry-snapshot|snapshot\.ts$", path):
        return True
    return "/src/agents/" in path


def _is_env_priority(candidate: dict[str, Any]) -> bool:
    path = _norm(str(candidate.get("path", "")))
    return bool(
        re.search(
            r"(^|/)(scripts|e2e|bench|benches|\.github|ci|config|configs|test|tests)(/|$)",
            path,
        )
    )


def _is_generic_env_impl(candidate: dict[str, Any]) -> bool:
    path = _norm(str(candidate.get("path", "")))
    return bool(re.search(r"(^|/)src/(auth|paths?|state|config)(/|\.|$)", path))


def _base_score(candidate: dict[str, Any]) -> float:
    if isinstance(candidate.get("score"), (int, float)):
        return float(candidate["score"])
    base_rank = int(candidate.get("baseRank") or candidate.get("base_rank") or 0)
    return float(1000 - base_rank)


def score_candidate(
    candidate: dict[str, Any],
    intents: list[str],
) -> dict[str, Any]:
    adjusted = _base_score(candidate)
    reasons: list[str] = []
    matched = candidate.get("matchedIntents") or candidate.get("matched_intents") or []
    if not isinstance(matched, list):
        matched = []

    exact_preserve = (
        candidate.get("exactPreserve") is True
        or candidate.get("exact_preserve") is True
        or INTENT_PRESERVE in matched
        or INTENT_EXACT in matched
    )

    if exact_preserve:
        adjusted += 1000
        reasons.append("exact-preserve-protected")

    if not exact_preserve and _includes(intents, INTENT_CALLER):
        evidence = str(candidate.get("evidenceType") or candidate.get("evidence_type") or "")
        if evidence == "codegraph-caller":
            adjusted += 30
            reasons.append("codegraph-caller-boost")
        if _is_concrete_caller(candidate):
            adjusted += 150
            reasons.append("concrete-caller-boost")
        if _is_assembly_only(candidate):
            adjusted -= 120
            reasons.append("assembly-only-demotion")

    if not exact_preserve and _includes(intents, INTENT_TRAP):
        if _is_trap(candidate) and not candidate.get("expectedHint") and not candidate.get(
            "expected_hint"
        ):
            adjusted -= 250
            reasons.append("trap-demotion")
        if candidate.get("corroborated") and not _is_trap(candidate):
            adjusted += 80
            reasons.append("corroborated-non-trap-boost")

    if not exact_preserve and _includes(intents, INTENT_ENV):
        if _is_env_priority(candidate):
            adjusted += 140
            reasons.append("env-script-priority")
        if _is_generic_env_impl(candidate):
            adjusted -= 100
            reasons.append("generic-env-implementation-demotion")

    out = dict(candidate)
    out["adjustedScore"] = adjusted
    out["adjusted_score"] = adjusted
    out["rankingReasons"] = reasons
    out["ranking_reasons"] = reasons
    return out


def rank_retrieval_result_candidates(
    candidates: list[dict[str, Any]],
    *,
    intents: list[str],
    top_k: int = 5,
    expanded_pool_size: int | None = None,
    caller_pool_expansion: dict[str, Any] | None = None,
) -> dict[str, Any]:
    top_k = max(1, top_k)
    pool_size = expanded_pool_size if expanded_pool_size is not None else max(top_k * 3, top_k)
    warnings: list[str] = []

    ranked = [
        score_candidate(c, intents)
        for c in candidates
    ]
    ranked.sort(
        key=lambda c: (
            -float(c.get("adjustedScore") or c.get("adjusted_score") or 0),
            int(c.get("baseRank") or c.get("base_rank") or 0),
        ),
    )

    expanded_pool = ranked[:pool_size]

    expansion = caller_pool_expansion or {}
    if expansion.get("enabled") and _includes(intents, INTENT_CALLER):
        min_concrete = int(expansion.get("minConcreteCallers") or expansion.get("min_concrete_callers") or 0)
        concrete_in_pool = [c for c in expanded_pool if _is_concrete_caller(c)]
        seen_paths = {_norm(str(c.get("path", ""))) for c in concrete_in_pool}

        if min_concrete > 0 and len(concrete_in_pool) < min_concrete:
            for candidate in ranked[pool_size:]:
                if not _is_concrete_caller(candidate):
                    continue
                key = _norm(str(candidate.get("path", "")))
                if key in seen_paths:
                    continue
                expanded_pool.append(candidate)
                seen_paths.add(key)
                if len([c for c in expanded_pool if _is_concrete_caller(c)]) >= min_concrete:
                    break

        final_count = len([c for c in expanded_pool if _is_concrete_caller(c)])
        if min_concrete > 0 and final_count < min_concrete:
            warnings.append(
                f"caller-pool-expansion: only {final_count} concrete callers found, "
                f"below minConcreteCallers={min_concrete}"
            )

    return {
        "expandedPoolSize": pool_size,
        "expanded_pool_size": pool_size,
        "expandedPool": expanded_pool,
        "expanded_pool": expanded_pool,
        "topCandidates": expanded_pool[:top_k],
        "top_candidates": expanded_pool[:top_k],
        "warnings": warnings,
    }


def intent_ids_from_router_envelope(plan: dict[str, Any]) -> list[str]:
    raw = plan.get("intents")
    if not isinstance(raw, list):
        return []
    ids: list[str] = []
    for item in raw:
        if isinstance(item, dict) and item.get("id"):
            ids.append(str(item["id"]))
    return ids


def result_layer_ranking_hint(intents: list[str], *, locale: str = "zh") -> str:
    """Short agent guidance appended to retrieval plans when B/E/D intents fire."""
    lines: list[str] = []
    if locale != "zh":
        lines.append("**Result-layer ranking (before Top-1 / Top-5):**")
    else:
        lines.append("**结果层排序（定 Top-1 / Top-5 前）：**")

    if INTENT_CALLER in intents:
        if locale != "zh":
            lines.append(
                "- Caller-chain: keep an expanded pool (codegraph callers + rg); "
                "prefer concrete call sites over facade/barrel/runtime/registry assembly files."
            )
        else:
            lines.append(
                "- 调用链：先扩大候选池（codegraph callers + rg），"
                "具体调用点优先于 facade/barrel/runtime/registry 等装配文件。"
            )
    if INTENT_TRAP in intents:
        if locale != "zh":
            lines.append(
                "- Trap: demote snapshot/registry overlay and cross-package name collisions "
                "unless Read confirms the asked layer."
            )
        else:
            lines.append(
                "- 干扰项：压低 snapshot/registry/overlay 与跨包同名；"
                "除非 Read 确认就是所问层级。"
            )
    if INTENT_ENV in intents:
        if locale != "zh":
            lines.append(
                "- Env literals: prefer scripts/e2e/bench/test harness paths over generic src/auth/paths."
            )
        else:
            lines.append(
                "- 环境变量/配置字面量：优先 scripts/e2e/bench/test 等路径，"
                "低于泛化 src/auth/paths 实现文件。"
            )

    if len(lines) <= 1:
        return ""
    return "\n".join(lines) + "\n"