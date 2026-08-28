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


class AdapterMiddlewareError(RuntimeError):
    """Event Bridge / Middleware contract rejected a request."""


def default_event_bridge() -> dict[str, Any]:
    return {
        "schema_version": STAGE6_SCHEMA_VERSION,
        "source": STAGE6_SOURCE,
        "subscriptions": [],
    }


def default_middleware_providers() -> dict[str, Any]:
    return {
        "schema_version": STAGE6_SCHEMA_VERSION,
        "source": STAGE6_SOURCE,
        "registered": [SMART_SEARCH_PROVIDER],
        "required": [SMART_SEARCH_PROVIDER],
        "active": [],
        "degraded": [],
        "readiness": {
            SMART_SEARCH_PROVIDER: {
                "status": "unknown",
                "capability": EXTERNAL_KNOWLEDGE_CAPABILITY,
                "evidence": None,
            }
        },
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


def probe_smart_search_readiness(*, available: bool | None = None, status: str | None = None) -> dict[str, Any]:
    resolved = status
    if resolved not in {"ready", "missing", "failed", "unknown"}:
        if available is True:
            resolved = "ready"
        elif available is False:
            resolved = "missing"
        else:
            resolved = "unknown"
    return {
        "status": resolved,
        "capability": EXTERNAL_KNOWLEDGE_CAPABILITY,
        "evidence": None,
    }


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
