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
    SHIPPED_MIDDLEWARE_PROVIDERS,
    SHIPPED_PROVIDER_PROBE,
    AdapterMiddlewareError,
    apply_middleware_probes,
    assert_external_knowledge,
    default_event_bridge,
    default_middleware_providers,
    dispatch_hook_event,
    mcp_server_ids_from_config,
    normalize_capability_router,
    probe_smart_search_readiness,
    select_registered_mcp_servers,
    sync_event_bridge_subscriptions,
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


def test_empty_subscriptions_do_not_crash_dispatch() -> None:
    last = dispatch_hook_event(default_event_bridge(), "sessionStart")
    assert last["delivered"] == []
    assert last["skipped"] == []
    extras: dict = {
        "ondemand_modules": {"active": ["worker-orchestration"]},
        "baseline_modules": {"active": ["context-progressive"]},
    }
    sync_event_bridge_subscriptions(extras)
    hooks = {item.get("hook") for item in extras["event_bridge"]["subscriptions"]}
    assert "inject-subagent-context.py" in hooks
    assert "session-start.py" in hooks
    extras["ondemand_modules"]["active"] = []
    extras["baseline_modules"]["active"] = []
    sync_event_bridge_subscriptions(extras)
    assert extras["event_bridge"]["subscriptions"] == []
    last = dispatch_hook_event(extras["event_bridge"], "preToolUse")
    assert last["delivered"] == []


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


def test_default_catalog_is_seven_providers_with_smart_search_required() -> None:
    providers = default_middleware_providers()
    assert providers["registered"] == list(SHIPPED_MIDDLEWARE_PROVIDERS)
    assert providers["required"] == ["smart-search"]
    assert set(SHIPPED_PROVIDER_PROBE) == set(SHIPPED_MIDDLEWARE_PROVIDERS)
    assert set(SHIPPED_PROVIDER_PROBE.values()) <= {"cli", "mcp", "host"}


def test_optional_mcp_missing_does_not_block_unrelated_assert() -> None:
    providers = apply_middleware_probes(
        default_middleware_providers(),
        {
            "codegraph": {"present": False},
            "random-extra-mcp": {"present": True},
        },
    )
    assert providers["readiness"]["codegraph"]["status"] == "missing"
    assert "random-extra-mcp" not in providers["readiness"]
    extras: dict = {}
    assert_external_knowledge(
        extras,
        providers["readiness"]["smart-search"],
        phase="archive",
    )
    configured = mcp_server_ids_from_config(
        {"mcpServers": {"codegraph": {}, "random-extra-mcp": {}, "playwright": {}}},
    )
    assert select_registered_mcp_servers(configured) == ["codegraph", "playwright"]
