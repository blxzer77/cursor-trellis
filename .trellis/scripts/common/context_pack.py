#!/usr/bin/env python3
"""
Build bounded retrieval context packs from scored evidence.

Pure functions only. Does not run retrieval commands, Smart Search, network
calls, MCP tools, or codebase search.
"""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any

from common.retrieval_evidence import (
    STATUS_DEGRADED,
    STATUS_FAILED,
    STATUS_MISSING,
    STATUS_NOT_CONFIGURED,
    STATUS_OK,
    VALIDATION_CANDIDATE,
    VALIDATION_FAILED,
    VALIDATION_UNAVAILABLE,
)

PACK_VERSION = 1
PACK_SOURCE = "retrieval-context-pack"

METADATA_ONLY_TOKENS = 80
MIN_CONTENT_TOKENS = 40
CHARS_PER_TOKEN = 4

SELECTABLE_STATUSES = frozenset({STATUS_OK, STATUS_DEGRADED})
UNAVAILABLE_STATUSES = frozenset(
    {STATUS_FAILED, STATUS_NOT_CONFIGURED, STATUS_MISSING}
)

OMIT_UNAVAILABLE = "unavailable evidence excluded from pack body"
OMIT_BUDGET = "outside budget after higher-ranked evidence"
OMIT_CANDIDATE_BUDGET = "candidate evidence skipped due to budget"
OMIT_DIAGNOSTICS_ONLY = "diagnostic-only evidence excluded from pack body"


def build_context_pack(
    scored_evidence: dict[str, Any],
    *,
    max_items: int | None = None,
    max_estimated_tokens: int | None = None,
    include_diagnostics: bool = False,
) -> dict[str, object]:
    """Partition scored evidence into selected and omitted pack items."""
    items = list_value(scored_evidence.get("items"))
    normalized_items = [item for item in items if isinstance(item, dict)]

    budget_limits = {
        "maxItems": max_items,
        "maxEstimatedTokens": max_estimated_tokens,
    }

    if not normalized_items:
        return _empty_pack(budget_limits)

    selected: list[dict[str, object]] = []
    omitted: list[dict[str, object]] = []
    warnings: list[str] = []
    estimated_tokens = 0
    budget_exceeded = False

    for item in normalized_items:
        status = string_value(item.get("status")) or STATUS_MISSING
        validation_state = string_value(item.get("validationState")) or ""
        estimate = estimate_item_tokens(item)
        selectable = _is_selectable(
            status=status,
            validation_state=validation_state,
            include_diagnostics=include_diagnostics,
        )

        if not selectable:
            omitted.append(
                _build_omitted_item(
                    item,
                    reason=_unavailable_reason(status, validation_state),
                )
            )
            warnings.extend(_collect_item_warnings(item, status))
            continue

        if _would_exceed_budget(
            selected_count=len(selected),
            estimated_tokens=estimated_tokens,
            next_item_tokens=estimate["estimatedTokens"],
            max_items=max_items,
            max_estimated_tokens=max_estimated_tokens,
        ):
            budget_exceeded = True
            reason = (
                OMIT_CANDIDATE_BUDGET
                if validation_state == VALIDATION_CANDIDATE
                else OMIT_BUDGET
            )
            omitted.append(_build_omitted_item(item, reason=reason))
            continue

        selected.append(_build_selected_item(item, estimate))
        estimated_tokens += int(estimate["estimatedTokens"])

    if budget_exceeded:
        warnings.append("budget limits caused evidence omission")

    return {
        "version": PACK_VERSION,
        "source": PACK_SOURCE,
        "budget": {
            **budget_limits,
            "estimatedTokens": estimated_tokens,
            "itemsUsed": len(selected),
        },
        "selected": selected,
        "omitted": omitted,
        "warnings": normalize_messages(warnings),
        "summary": {
            "totalInput": len(normalized_items),
            "selectedCount": len(selected),
            "omittedCount": len(omitted),
            "budgetExceeded": budget_exceeded,
        },
    }


def estimate_item_tokens(item: dict[str, Any]) -> dict[str, object]:
    """Estimate conservative token usage for one scored evidence item."""
    text_parts: list[str] = []
    for key in ("content", "summary", "snippet"):
        value = string_value(item.get(key))
        if value:
            text_parts.append(value)

    snippets = list_value(item.get("snippets"))
    for snippet in snippets:
        if isinstance(snippet, str):
            text_parts.append(snippet)
        elif isinstance(snippet, dict):
            for field in ("text", "body", "content"):
                value = string_value(snippet.get(field))
                if value:
                    text_parts.append(value)

    if not text_parts:
        title = string_value(item.get("title")) or ""
        reasons = list_value(item.get("reasons"))
        text_parts.extend(str(reason) for reason in reasons if reason)
        if title:
            text_parts.append(title)
        metadata_only = True
        estimated = METADATA_ONLY_TOKENS
    else:
        metadata_only = False
        combined = "\n".join(text_parts)
        estimated = max(MIN_CONTENT_TOKENS, len(combined) // CHARS_PER_TOKEN + 20)

    return {
        "estimatedTokens": estimated,
        "metadataOnly": metadata_only,
    }


def _is_selectable(
    *,
    status: str,
    validation_state: str,
    include_diagnostics: bool,
) -> bool:
    if status in UNAVAILABLE_STATUSES:
        return include_diagnostics
    if validation_state in {VALIDATION_UNAVAILABLE, VALIDATION_FAILED}:
        return include_diagnostics
    if status in SELECTABLE_STATUSES:
        return True
    if validation_state == VALIDATION_CANDIDATE:
        return status == STATUS_OK or status == STATUS_DEGRADED
    return False


def _would_exceed_budget(
    *,
    selected_count: int,
    estimated_tokens: int,
    next_item_tokens: int,
    max_items: int | None,
    max_estimated_tokens: int | None,
) -> bool:
    if max_items is not None and selected_count >= max_items:
        return True
    if max_estimated_tokens is not None:
        return estimated_tokens + next_item_tokens > max_estimated_tokens
    return False


def _build_selected_item(
    item: dict[str, Any],
    estimate: dict[str, object],
) -> dict[str, object]:
    reasons = list_value(item.get("reasons"))
    top_reason = string_value(reasons[0]) if reasons else None
    selected: dict[str, object] = {
        "source": string_value(item.get("source")) or "",
        "reference": string_value(item.get("reference")) or "",
        "title": string_value(item.get("title")) or "",
        "score": int_value(item.get("score")),
        "status": string_value(item.get("status")) or "",
        "validationState": string_value(item.get("validationState")) or "",
        "estimatedTokens": estimate["estimatedTokens"],
        "metadataOnly": estimate["metadataOnly"],
        "reason": top_reason or "selected as highest-ranked usable evidence",
    }
    return selected


def _build_omitted_item(item: dict[str, Any], *, reason: str) -> dict[str, object]:
    reasons = list_value(item.get("reasons"))
    warnings = list_value(item.get("warnings"))
    omitted: dict[str, object] = {
        "source": string_value(item.get("source")) or "",
        "reference": string_value(item.get("reference")) or "",
        "title": string_value(item.get("title")) or "",
        "score": int_value(item.get("score")),
        "status": string_value(item.get("status")) or "",
        "validationState": string_value(item.get("validationState")) or "",
        "reason": reason,
    }
    if reasons:
        omitted["reasons"] = [str(value) for value in reasons[:3]]
    if warnings:
        omitted["warnings"] = [str(value) for value in warnings[:3]]
    return omitted


def _unavailable_reason(status: str, validation_state: str) -> str:
    if status in UNAVAILABLE_STATUSES:
        return f"{OMIT_UNAVAILABLE}: status {status}"
    if validation_state in {VALIDATION_UNAVAILABLE, VALIDATION_FAILED}:
        return f"{OMIT_UNAVAILABLE}: validationState {validation_state}"
    return OMIT_DIAGNOSTICS_ONLY


def _collect_item_warnings(item: dict[str, Any], status: str) -> list[str]:
    warnings = [str(value) for value in list_value(item.get("warnings")) if value]
    if status in UNAVAILABLE_STATUSES and not warnings:
        warnings.append(f"omitted unavailable evidence with status {status}")
    return warnings


def _empty_pack(budget_limits: dict[str, int | None]) -> dict[str, object]:
    return {
        "version": PACK_VERSION,
        "source": PACK_SOURCE,
        "budget": {
            **budget_limits,
            "estimatedTokens": 0,
            "itemsUsed": 0,
        },
        "selected": [],
        "omitted": [],
        "warnings": [],
        "summary": {
            "totalInput": 0,
            "selectedCount": 0,
            "omittedCount": 0,
            "budgetExceeded": False,
        },
    }


def normalize_messages(values: list[str]) -> list[str]:
    seen: set[str] = set()
    normalized: list[str] = []
    for value in values:
        text = " ".join(str(value).split()).strip()
        if not text or text in seen:
            continue
        seen.add(text)
        normalized.append(text[:200])
    return normalized


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a bounded retrieval context pack from scored evidence JSON.",
    )
    parser.add_argument(
        "--input",
        required=True,
        help="Path to scored evidence JSON (score_evidence_bundle output).",
    )
    parser.add_argument(
        "--max-items",
        type=int,
        default=None,
        help="Maximum number of selected evidence items.",
    )
    parser.add_argument(
        "--max-estimated-tokens",
        type=int,
        default=None,
        help="Maximum estimated token budget for selected items.",
    )
    parser.add_argument(
        "--include-diagnostics",
        action="store_true",
        help="Include failed/unavailable evidence in selected output when budget allows.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit JSON to stdout.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        with open(args.input, encoding="utf-8") as handle:
            scored_evidence = json.load(handle)
    except (OSError, json.JSONDecodeError) as error:
        print(f"context pack error: {error}", file=sys.stderr)
        return 1

    if not isinstance(scored_evidence, dict):
        print("context pack error: input must be a JSON object", file=sys.stderr)
        return 1

    pack = build_context_pack(
        scored_evidence,
        max_items=args.max_items,
        max_estimated_tokens=args.max_estimated_tokens,
        include_diagnostics=args.include_diagnostics,
    )

    if args.json:
        print(json.dumps(pack, indent=2, ensure_ascii=False))
    else:
        print(json.dumps(pack, ensure_ascii=False))
    return 0


def list_value(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def string_value(value: Any) -> str | None:
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return None


def int_value(value: Any, default: int = 0) -> int:
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    return default


if __name__ == "__main__":
    raise SystemExit(main())
