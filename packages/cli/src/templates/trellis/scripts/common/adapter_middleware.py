"""Stage 6 Event Bridge + Middleware Provider projection.

Kernel extras remain authoritative. This module mirrors the contract for
hooks and tests. It does not write a second store or invent Command ops.
"""

from __future__ import annotations

from typing import Any

STAGE6_SOURCE = "stage6-adapter-middleware"
STAGE6_SCHEMA_VERSION = 1
SMART_SEARCH_PROVIDER = "smart-search"
EXTERNAL_KNOWLEDGE_CAPABILITY = "external-knowledge"
RETRIEVAL_INTENTS = ("exact", "semantic", "structural", "external")
OPTIONAL_CODE_INTEL_PROVIDERS = ("codegraph", "fast-context")
SHIPPED_MIDDLEWARE_PROVIDERS = (
    "smart-search",
    "codegraph",
    "fast-context",
    "chrome-cdp",
    "playwright",
    "github",
    "cursor-ide-browser",
)
DEFAULT_REQUIRED_MIDDLEWARE_PROVIDERS = (SMART_SEARCH_PROVIDER,)
SHIPPED_PROVIDER_CAPABILITY = {
    "smart-search": EXTERNAL_KNOWLEDGE_CAPABILITY,
    "codegraph": "structural",
    "fast-context": "semantic",
    "chrome-cdp": "browser-session",
    "playwright": "browser-automation",
    "github": "vcs-host",
    "cursor-ide-browser": "ide-browser",
}
SHIPPED_PROVIDER_PROBE = {
    "smart-search": "cli",
    "codegraph": "mcp",
    "fast-context": "mcp",
    "chrome-cdp": "cli",
    "playwright": "mcp",
    "github": "mcp",
    "cursor-ide-browser": "host",
}


class AdapterMiddlewareError(RuntimeError):
    """Event Bridge / Middleware contract rejected a request."""


PROFILE_BASELINE_MODULES = (
    "intake-basic",
    "define-basic",
    "approval-personal",
    "execute-agent",
    "verify-basic",
    "close-basic",
    "context-progressive",
    "observability-local",
)

# Hook subscriptions filled/cleared with Profile activation. Unsubscribed
# hooks stay no-op and must not crash.
MODULE_HOOK_SUBSCRIPTIONS: dict[str, tuple[dict[str, str], ...]] = {
    "context-progressive": (
        {
            "event": "sessionStart",
            "module": "context-progressive",
            "hook": "session-start.py",
        },
        {
            "event": "beforeShellExecution",
            "module": "context-progressive",
            "hook": "inject-shell-session-context.py",
        },
    ),
    "worker-orchestration": (
        {
            "event": "preToolUse",
            "module": "worker-orchestration",
            "hook": "inject-subagent-context.py",
        },
    ),
    "retrieval-extended": (
        {
            "event": "beforeSubmitPrompt",
            "module": "retrieval-extended",
            "hook": "inject-retrieval-plan.py",
        },
        {
            "event": "stop",
            "module": "retrieval-extended",
            "hook": "research-end-retrieval-pack.py",
        },
    ),
}


def default_event_bridge() -> dict[str, Any]:
    return {
        "schema_version": STAGE6_SCHEMA_VERSION,
        "source": STAGE6_SOURCE,
        "subscriptions": [],
    }


def _unique_ids(values: list[Any]) -> list[str]:
    out: list[str] = []
    for value in values:
        if not isinstance(value, str):
            continue
        item = value.strip()
        if item and item not in out:
            out.append(item)
    return out


def _baseline_active_ids(extras: dict[str, Any]) -> list[str]:
    block = extras.get("baseline_modules")
    if not isinstance(block, dict) or "active" not in block:
        return list(PROFILE_BASELINE_MODULES)
    raw = block.get("active")
    if not isinstance(raw, list):
        return []
    allowed = set(PROFILE_BASELINE_MODULES)
    return _unique_ids([item for item in raw if isinstance(item, str) and item in allowed])


def _ondemand_active_ids(extras: dict[str, Any]) -> list[str]:
    block = extras.get("ondemand_modules")
    if not isinstance(block, dict):
        return []
    raw = block.get("active") or []
    if not isinstance(raw, list):
        return []
    return _unique_ids([item for item in raw if isinstance(item, str)])


def subscriptions_for_active_modules(
    *,
    baseline_active: list[str] | None = None,
    ondemand_active: list[str] | None = None,
) -> list[dict[str, str]]:
    ids = _unique_ids(list(baseline_active or []) + list(ondemand_active or []))
    seen: set[tuple[str, str]] = set()
    out: list[dict[str, str]] = []
    for module_id in ids:
        for item in MODULE_HOOK_SUBSCRIPTIONS.get(module_id, ()):
            key = (item.get("event", ""), item.get("module", ""))
            if key in seen:
                continue
            seen.add(key)
            out.append(dict(item))
    return out


def sync_event_bridge_subscriptions(extras: dict[str, Any]) -> dict[str, Any]:
    """Fill or clear `event_bridge.subscriptions` from still-active modules."""
    bridge = extras.get("event_bridge")
    if not isinstance(bridge, dict):
        bridge = default_event_bridge()
        extras["event_bridge"] = bridge
    bridge["subscriptions"] = subscriptions_for_active_modules(
        baseline_active=_baseline_active_ids(extras),
        ondemand_active=_ondemand_active_ids(extras),
    )
    return extras


def _default_readiness() -> dict[str, Any]:
    return {
        provider_id: {
            "status": "unknown",
            "capability": SHIPPED_PROVIDER_CAPABILITY[provider_id],
            "evidence": None,
        }
        for provider_id in SHIPPED_MIDDLEWARE_PROVIDERS
    }


def default_middleware_providers() -> dict[str, Any]:
    return {
        "schema_version": STAGE6_SCHEMA_VERSION,
        "source": STAGE6_SOURCE,
        "registered": list(SHIPPED_MIDDLEWARE_PROVIDERS),
        "required": list(DEFAULT_REQUIRED_MIDDLEWARE_PROVIDERS),
        "active": [],
        "degraded": [],
        "readiness": _default_readiness(),
    }


def default_capability_router() -> dict[str, Any]:
    return {
        "schema_version": STAGE6_SCHEMA_VERSION,
        "source": STAGE6_SOURCE,
        "exact": True,
        "semantic": True,
        "structural": True,
        "external": True,
    }


def dispatch_hook_event(
    event_bridge: dict[str, Any],
    event: str,
    *,
    source: str = "cursor-hooks",
    at: str | None = None,
) -> dict[str, Any]:
    name = (event or "").strip()
    if not name:
        raise AdapterMiddlewareError("event_bridge.last_event.event must be a non-empty string")
    delivered: list[str] = []
    skipped: list[str] = []
    for item in event_bridge.get("subscriptions") or []:
        if not isinstance(item, dict):
            continue
        module = str(item.get("module") or "").strip()
        if not module:
            continue
        if item.get("event") == name:
            if module not in delivered:
                delivered.append(module)
        else:
            skipped.append(module)
    return {
        "event": name,
        "at": at or "",
        "source": source,
        "delivered": delivered,
        "skipped": skipped,
    }


def classify_transport_probe(
    *,
    present: bool | None = None,
    reachable: bool | None = None,
    available: bool | None = None,
    status: str | None = None,
    evidence: str | None = None,
) -> dict[str, Any]:
    if status in {"ready", "missing", "failed", "unknown"}:
        return {"status": status, "evidence": evidence}
    resolved_present = present if present is not None else available
    if resolved_present is False:
        return {"status": "missing", "evidence": evidence}
    if resolved_present is True and reachable is False:
        return {"status": "failed", "evidence": evidence}
    if resolved_present is True:
        return {"status": "ready", "evidence": evidence}
    return {"status": "unknown", "evidence": evidence}


def mcp_server_ids_from_config(raw: Any) -> list[str]:
    if not isinstance(raw, dict):
        return []
    servers = raw.get("mcpServers")
    if not isinstance(servers, dict):
        return []
    return [str(name) for name in servers.keys()]


def select_registered_mcp_servers(
    configured: list[str] | tuple[str, ...],
    registered: list[str] | tuple[str, ...] | None = None,
) -> list[str]:
    allow = list(registered if registered is not None else SHIPPED_MIDDLEWARE_PROVIDERS)
    out: list[str] = []
    for name in configured:
        if name in allow and name not in out:
            out.append(name)
    return out


def probe_shipped_provider_readiness(
    provider_id: str,
    *,
    present: bool | None = None,
    reachable: bool | None = None,
    available: bool | None = None,
    status: str | None = None,
    evidence: str | None = None,
) -> dict[str, Any]:
    classified = classify_transport_probe(
        present=present,
        reachable=reachable,
        available=available,
        status=status,
        evidence=evidence,
    )
    return {
        "status": classified["status"],
        "capability": SHIPPED_PROVIDER_CAPABILITY.get(
            provider_id,
            EXTERNAL_KNOWLEDGE_CAPABILITY if provider_id == SMART_SEARCH_PROVIDER else "unknown",
        ),
        "evidence": classified["evidence"],
    }


def apply_middleware_probes(
    providers: dict[str, Any],
    probes: dict[str, Any],
) -> dict[str, Any]:
    registered = providers.get("registered") or []
    readiness = dict(providers.get("readiness") or {})
    if not isinstance(probes, dict):
        return providers
    for provider_id, value in probes.items():
        if provider_id not in registered or not isinstance(value, dict):
            continue
        readiness[provider_id] = probe_shipped_provider_readiness(
            provider_id,
            present=value.get("present"),
            reachable=value.get("reachable"),
            available=value.get("available"),
            status=value.get("status"),
            evidence=value.get("evidence") if isinstance(value.get("evidence"), str) else None,
        )
    next_providers = {**providers, "readiness": readiness}
    return next_providers


def probe_smart_search_readiness(*, available: bool | None = None, status: str | None = None) -> dict[str, Any]:
    return probe_shipped_provider_readiness(
        SMART_SEARCH_PROVIDER,
        available=available,
        status=status,
    )


def normalize_capability_router(raw: Any) -> dict[str, Any]:
    if raw is None:
        return default_capability_router()
    if not isinstance(raw, dict):
        raise AdapterMiddlewareError("capability_router must be a JSON object")
    for key in list(raw.keys()):
        if key in OPTIONAL_CODE_INTEL_PROVIDERS or key in {
            "fast_context_search",
            "codegraph_explore",
            "codegraph_search",
            "codegraph_callers",
        }:
            raise AdapterMiddlewareError("capability_router must not bind Optional tool names")
    next_router = default_capability_router()
    for intent in RETRIEVAL_INTENTS:
        if raw.get(intent) is False:
            next_router.pop(intent, None)
        else:
            next_router[intent] = True
    return next_router


def required_capabilities(extras: dict[str, Any]) -> list[str]:
    raw = extras.get("required_capabilities") or []
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    for item in raw:
        if isinstance(item, str) and item.strip() and item not in out:
            out.append(item.strip())
    return out


def assert_external_knowledge(
    extras: dict[str, Any],
    readiness: dict[str, Any],
    *,
    phase: str,
) -> None:
    if phase in {"create", "patch"}:
        return
    if EXTERNAL_KNOWLEDGE_CAPABILITY not in required_capabilities(extras):
        return
    if readiness.get("status") == "ready":
        return
    if extras.get("external_knowledge_policy") == "degrade":
        extras["profile_health"] = "degraded"
        return
    raise AdapterMiddlewareError(
        "external-knowledge required but smart-search Provider is not ready"
    )
