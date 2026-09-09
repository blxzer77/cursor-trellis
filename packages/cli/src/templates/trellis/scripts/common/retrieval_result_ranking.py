#!/usr/bin/env python3
"""Deterministic quality-layer ranking for the four V3 retrieval intents."""

from __future__ import annotations

import math
import unicodedata
from typing import Any


INTENTS = ("exact", "semantic", "structural", "external")


def _clamp(value: object, minimum: float = 0, maximum: float = 1) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        return minimum
    return max(minimum, min(maximum, float(value)))


def _normalized_path(value: str) -> str:
    return unicodedata.normalize("NFC", value.replace("\\", "/")).lower()


def score_candidate(candidate: dict[str, Any], intents: list[str]) -> dict[str, Any]:
    selected = set(intents)
    score = _clamp(candidate.get("baseScore"), -1000, 1000)
    reasons: list[str] = []
    if "exact" in selected and candidate.get("exactMatch") is True:
        score += 100
        reasons.append("exact-match")
    if "semantic" in selected and "semanticScore" in candidate:
        score += _clamp(candidate.get("semanticScore")) * 40
        reasons.append("semantic-candidate")
    if "structural" in selected and candidate.get("structuralMatch") is True:
        score += 60
        reasons.append("structural-match")
    if "external" in selected and "externalFreshness" in candidate:
        score += _clamp(candidate.get("externalFreshness")) * 30
        reasons.append("external-freshness-candidate")
    if candidate.get("sourceReference"):
        score += 10
        reasons.append("source-reference-present")
    if candidate.get("assemblyOnly") is True:
        score -= 30 if "structural" in selected else 10
        reasons.append("assembly-only-demotion")
    return {**candidate, "score": score, "reasons": reasons}


def rank_retrieval_result_candidates(
    candidates: list[dict[str, Any]],
    *,
    intents: list[str],
    top_k: int | None = None,
    **_compatibility_options: object,
) -> dict[str, Any]:
    limit = len(candidates) if top_k is None else max(0, min(top_k, len(candidates)))
    ranked = [score_candidate(candidate, intents) for candidate in candidates]
    ranked.sort(
        key=lambda candidate: (
            -float(candidate["score"]),
            _normalized_path(str(candidate.get("path", ""))).encode("utf-8"),
            int(candidate.get("line", 0)) if isinstance(candidate.get("line", 0), int) else 0,
        )
    )
    return {"ranked": ranked[:limit], "total": len(candidates)}


def paged_caller_aggregation(
    pages: list[dict[str, Any]],
    *,
    intents: list[str] | None = None,
    top_k: int | None = None,
) -> dict[str, Any]:
    unique: dict[str, dict[str, Any]] = {}
    for page in sorted(pages, key=lambda item: int(item.get("page", 0))):
        candidates = page.get("candidates")
        if not isinstance(candidates, list):
            continue
        for candidate in candidates:
            if not isinstance(candidate, dict):
                continue
            key = f"{_normalized_path(str(candidate.get('path', '')))}:{candidate.get('line', 0)}"
            unique.setdefault(key, candidate)
    return rank_retrieval_result_candidates(
        list(unique.values()), intents=intents or ["structural"], top_k=top_k
    )


def intent_ids_from_router_envelope(plan: dict[str, Any]) -> list[str]:
    raw = plan.get("intents")
    if not isinstance(raw, list):
        return []
    return [item for item in raw if isinstance(item, str) and item in INTENTS]


def result_layer_ranking_hint(intents: list[str], *, locale: str = "zh") -> str:
    if not any(intent in INTENTS for intent in intents):
        return ""
    if locale != "zh":
        return (
            "**Result quality:** ranking scores only order candidates; source, Git, or "
            "repeatable-test corroboration is still required.\n"
        )
    return "**结果质量：** 排序分数只用于候选排序，仍必须用源码、Git 或可重复测试佐证。\n"
