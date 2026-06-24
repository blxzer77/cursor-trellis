#!/usr/bin/env python3
"""Gate whether to inject a per-turn codebase retrieval plan block."""

from __future__ import annotations

import re

from .codebase_retrieval_router import (
    INTENT_CALLER,
    INTENT_CONCEPTUAL,
    INTENT_ENV,
    INTENT_EXTENSION,
    INTENT_POLICY,
    INTENT_TRAP,
    classify_codebase_retrieval_intents,
)

_SKIP_EXACT = frozenset(
    {
        "继续",
        "continue",
        "yes",
        "y",
        "ok",
        "好的",
        "是的",
        "可以",
        "thanks",
        "thank you",
    }
)

_META_PREFIXES = (
    "[triage:",
    "/trellis",
    "/shell",
)


def extract_user_prompt(hook_input: dict[str, object]) -> str:
    """Best-effort user text from a per-turn hook stdin payload."""
    for key in ("prompt", "user_message", "text", "message", "content"):
        raw = hook_input.get(key)
        if isinstance(raw, str) and raw.strip():
            return raw.strip()
    return ""


def should_inject_retrieval_plan(query: str) -> bool:
    """Return True when router-backed plan injection is worth the tokens."""
    text = (query or "").strip()
    if not text:
        return False
    lowered = text.lower()
    if lowered in _SKIP_EXACT:
        return False
    if any(lowered.startswith(prefix) for prefix in _META_PREFIXES):
        return False
    if len(text) < 8 and not re.search(r"[\u4e00-\u9fff]", text):
        return False

    intents = classify_codebase_retrieval_intents(text)
    intent_ids = {str(item.get("id", "")) for item in intents}
    structural = {
        INTENT_CALLER,
        INTENT_TRAP,
        INTENT_EXTENSION,
        INTENT_ENV,
        INTENT_POLICY,
        INTENT_CONCEPTUAL,
    }
    if intent_ids & structural:
        return True
    if len(text) >= 12:
        return True
    return bool(re.search(r"[\u4e00-\u9fff]{3,}", text) and len(text) >= 6)