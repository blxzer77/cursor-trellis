#!/usr/bin/env python3
"""Stage 6 Event Bridge / Middleware Python projection."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from common.adapter_middleware import (
    EXTERNAL_KNOWLEDGE_CAPABILITY,
    RETRIEVAL_INTENTS,
    AdapterMiddlewareError,
    assert_external_knowledge,
    dispatch_hook_event,
    normalize_capability_router,
    probe_smart_search_readiness,
)


def test_dispatch_skips_unsubscribed_modules() -> None:
    last = dispatch_hook_event(
        {
            "subscriptions": [
                {"event": "sessionStart", "module": "observability-local"},
                {"event": "stop", "module": "retrieval-extended"},
            ]
        },
        "sessionStart",
        source="cursor-hooks",
    )
    assert last["delivered"] == ["observability-local"]
    assert last["skipped"] == ["retrieval-extended"]


def test_missing_smart_search_is_not_ready() -> None:
    readiness = probe_smart_search_readiness(available=False)
    assert readiness["status"] == "missing"
    assert readiness["capability"] == EXTERNAL_KNOWLEDGE_CAPABILITY
    extras = {"required_capabilities": [EXTERNAL_KNOWLEDGE_CAPABILITY]}
    with pytest.raises(AdapterMiddlewareError, match="not ready"):
        assert_external_knowledge(extras, readiness, phase="start")
    extras["external_knowledge_policy"] = "degrade"
    assert_external_knowledge(extras, readiness, phase="start")
    assert extras["profile_health"] == "degraded"
    assert_external_knowledge({}, readiness, phase="archive")


def test_capability_router_rejects_optional_tool_names() -> None:
    router = normalize_capability_router(None)
    assert tuple(key for key in RETRIEVAL_INTENTS if router.get(key)) == RETRIEVAL_INTENTS
    with pytest.raises(AdapterMiddlewareError, match="Optional tool"):
        normalize_capability_router({"codegraph": True})
