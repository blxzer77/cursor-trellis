#!/usr/bin/env python3
"""Stage 6 Event Bridge / Middleware Python projection."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

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
    classify_transport_probe,
    default_event_bridge,
    default_middleware_providers,
    dispatch_hook_event,
    event_bridge_for_dispatch,
    mcp_server_ids_from_config,
    normalize_capability_router,
    probe_smart_search_readiness,
    resolve_provider_v1,
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


def test_event_bridge_for_dispatch_defaults_baseline_then_honors_empty() -> None:
    bridge = event_bridge_for_dispatch({})
    modules = {item.get("module") for item in bridge["subscriptions"]}
    assert "context-progressive" in modules
    last = dispatch_hook_event(bridge, "sessionStart", source="cursor-hooks")
    assert "context-progressive" in last["delivered"]
    empty = event_bridge_for_dispatch({"baseline_modules": {"active": []}})
    assert empty["subscriptions"] == []


def test_missing_smart_search_is_not_ready() -> None:
    readiness = probe_smart_search_readiness(available=False)
    assert readiness["status"] == "missing"
    assert readiness["capability"] == EXTERNAL_KNOWLEDGE_CAPABILITY
    extras: dict[str, Any] = {
        "required_capabilities": [EXTERNAL_KNOWLEDGE_CAPABILITY]
    }
    with pytest.raises(AdapterMiddlewareError, match="no ready authorized Provider"):
        assert_external_knowledge(extras, readiness, phase="start")
    extras["external_knowledge_policy"] = "degrade"
    assert_external_knowledge(extras, readiness, phase="start")
    assert extras["profile_health"] == "degraded"
    assert_external_knowledge({}, readiness, phase="archive")


def test_capability_router_rejects_optional_tool_names() -> None:
    router = normalize_capability_router(None)
    assert tuple(key for key in RETRIEVAL_INTENTS if router.get(key)) == RETRIEVAL_INTENTS
    with pytest.raises(AdapterMiddlewareError, match="retrieval intent keys"):
        normalize_capability_router({"codegraph": True})


def test_default_catalog_is_empty_and_does_not_claim_a_concrete_provider() -> None:
    providers = default_middleware_providers()
    assert providers["registered"] == list(SHIPPED_MIDDLEWARE_PROVIDERS)
    assert providers["registered"] == []
    assert providers["required"] == []
    assert set(SHIPPED_PROVIDER_PROBE) == set(SHIPPED_MIDDLEWARE_PROVIDERS)
    assert set(SHIPPED_PROVIDER_PROBE.values()) <= {"cli", "mcp", "host"}


def test_optional_mcp_missing_does_not_block_unrelated_assert() -> None:
    providers = apply_middleware_probes(
        {
            **default_middleware_providers(),
            "registered": ["provider.alpha"],
        },
        {
            "provider.alpha": {
                "present": False,
                "capability": EXTERNAL_KNOWLEDGE_CAPABILITY,
            },
            "random-extra-mcp": {"present": True},
        },
    )
    assert providers["readiness"]["provider.alpha"]["status"] == "missing"
    assert "random-extra-mcp" not in providers["readiness"]
    extras: dict = {}
    assert_external_knowledge(
        extras,
        providers["readiness"]["provider.alpha"],
        phase="archive",
    )
    configured = mcp_server_ids_from_config(
        {"mcpServers": {"codegraph": {}, "random-extra-mcp": {}, "playwright": {}}},
    )
    assert select_registered_mcp_servers(configured) == []
    assert select_registered_mcp_servers(
        configured,
        registered=["random-extra-mcp"],
    ) == ["random-extra-mcp"]


def test_probe_evidence_is_logical_and_secret_safe() -> None:
    safe = "evidence://probe/provider.alpha/1"
    assert classify_transport_probe(present=True, evidence=safe)["evidence"] == safe
    canary = "TOKEN=do-not-print"
    result = classify_transport_probe(present=True, evidence=canary)
    assert result["evidence"] is None
    assert canary not in str(result)


def test_resolver_rejects_non_plain_mapping_containers_without_reading_them() -> None:
    canary = "TOKEN=hostile-mapping-canary"

    class ThrowingDict(dict[str, Any]):
        def get(self, key: str, default: Any = None) -> Any:
            raise RuntimeError(canary)

    keys = {
        "schemaVersion",
        "intent",
        "capabilityId",
        "minimumAssurance",
        "requestedPolicy",
        "authorizedProviderIds",
        "activeProviderIds",
        "standbyProviderIds",
        "fallbackAllowed",
        "manifests",
        "bindings",
        "runtimeFacts",
        "now",
    }
    top_level = ThrowingDict({key: None for key in keys})
    nested: dict[str, Any] = {key: None for key in keys}
    nested["schemaVersion"] = 1
    nested["requestedPolicy"] = ThrowingDict()

    expected = {
        "schemaVersion": 1,
        "status": "invalid",
        "resolution": None,
        "fingerprint": None,
        "explain": {
            "schemaVersion": 1,
            "decision": "invalid",
            "reasonCode": "provider-input-invalid",
            "selectedProviderId": None,
            "fallbackFromProviderId": None,
            "effectivePolicy": None,
            "evidenceRefs": [],
            "candidates": [],
        },
    }
    for value in (top_level, nested):
        result = resolve_provider_v1(value)
        assert result == expected
        assert canary not in str(result)
