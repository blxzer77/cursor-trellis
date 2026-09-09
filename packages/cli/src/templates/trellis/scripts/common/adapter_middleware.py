"""Stage 6 Event Bridge + Middleware Provider projection.

Kernel extras remain authoritative. This module mirrors the contract for
hooks and tests. It does not write a second store or invent Command ops.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from datetime import datetime
from typing import Any

STAGE6_SOURCE = "stage6-adapter-middleware"
STAGE6_SCHEMA_VERSION = 1
SMART_SEARCH_PROVIDER = "legacy.external"
EXTERNAL_KNOWLEDGE_CAPABILITY = "external-knowledge"
RETRIEVAL_INTENTS = ("exact", "semantic", "structural", "external")
OPTIONAL_CODE_INTEL_PROVIDERS: tuple[str, ...] = ()
SHIPPED_MIDDLEWARE_PROVIDERS: tuple[str, ...] = ()
DEFAULT_REQUIRED_MIDDLEWARE_PROVIDERS: tuple[str, ...] = ()
SHIPPED_PROVIDER_CAPABILITY: dict[str, str] = {}
SHIPPED_PROVIDER_PROBE: dict[str, str] = {}


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
    "spec-learning": (
        {
            "event": "preToolUse",
            "module": "spec-learning",
            "hook": "spec-write-audit.py",
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


def event_bridge_for_dispatch(extras: dict[str, Any] | None) -> dict[str, Any]:
    """Hook-safe view: missing extras still default Baseline eight on."""
    payload: dict[str, Any] = dict(extras or {})
    sync_event_bridge_subscriptions(payload)
    bridge = payload.get("event_bridge")
    return bridge if isinstance(bridge, dict) else default_event_bridge()


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
    source: str = "host-hooks",
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
    safe_evidence = evidence if _valid_evidence_reference(evidence) else None
    if status in {"ready", "missing", "failed", "unknown"}:
        return {"status": status, "evidence": safe_evidence}
    resolved_present = present if present is not None else available
    if resolved_present is False:
        return {"status": "missing", "evidence": safe_evidence}
    if resolved_present is True and reachable is False:
        return {"status": "failed", "evidence": safe_evidence}
    if resolved_present is True:
        return {"status": "ready", "evidence": safe_evidence}
    return {"status": "unknown", "evidence": safe_evidence}


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
    capability: str | None = None,
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
        "capability": capability or SHIPPED_PROVIDER_CAPABILITY.get(
            provider_id,
            EXTERNAL_KNOWLEDGE_CAPABILITY if provider_id == SMART_SEARCH_PROVIDER else "unknown",
        ),
        "evidence": classified["evidence"] if _valid_evidence_reference(classified["evidence"]) else None,
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
            capability=value.get("capability") if isinstance(value.get("capability"), str) else None,
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
    allowed = {"schema_version", "source", *RETRIEVAL_INTENTS}
    for key in list(raw.keys()):
        if key not in allowed:
            raise AdapterMiddlewareError(
                "capability_router must contain only retrieval intent keys"
            )
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
        "required external capability has no ready authorized Provider"
    )


# Pactile Provider Resolver v1 -------------------------------------------------
#
# This is the shipped Python mirror of the host-neutral TypeScript resolver.
# It consumes caller-supplied facts only: no clock, filesystem, process,
# network, environment, credential, host config, or probe is read here.

PROVIDER_RESOLUTION_REASON_CODES_V1 = (
    "provider-selected",
    "provider-unsupported",
    "provider-input-invalid",
    "provider-manifest-invalid",
    "provider-manifest-duplicate",
    "provider-runtime-fact-duplicate",
    "provider-binding-duplicate",
    "provider-not-authorized",
    "provider-intent-mismatch",
    "provider-capability-mismatch",
    "provider-policy-filesystem-exceeded",
    "provider-policy-process-exceeded",
    "provider-policy-network-exceeded",
    "provider-policy-credentials-exceeded",
    "provider-policy-privacy-exceeded",
    "provider-policy-egress-exceeded",
    "provider-policy-telemetry-exceeded",
    "provider-policy-cost-exceeded",
    "provider-policy-exceeded",
    "provider-binding-missing",
    "provider-binding-capability-mismatch",
    "provider-binding-intent-mismatch",
    "provider-binding-readiness-unknown",
    "provider-binding-unavailable",
    "provider-runtime-fact-missing",
    "provider-runtime-version-mismatch",
    "provider-readiness-unknown",
    "provider-readiness-unavailable",
    "provider-probe-unexpected",
    "provider-probe-not-run",
    "provider-probe-failed",
    "provider-probe-time-invalid",
    "provider-probe-from-future",
    "provider-probe-expired",
    "provider-freshness-unknown",
    "provider-freshness-stale",
    "provider-assurance-exceeds-manifest",
    "provider-assurance-insufficient",
    "provider-evidence-missing",
    "provider-degraded-without-evidence",
    "provider-active-missing",
    "provider-fallback-disabled",
    "provider-not-preferred",
    "provider-not-selected",
    "provider-eligible",
    "provider-selected-active",
    "provider-selected-fallback",
    "provider-selected-stable",
)

_ASSURANCE_LEVELS = ("best-effort", "evidence-backed", "verified")
_INTENTS = ("exact", "semantic", "structural", "external")
_ORIGINS = ("native", "provider", "heuristic")
_READINESS = ("ready", "degraded", "unavailable")
_FRESHNESS = ("fresh", "stale", "unknown", "not-applicable")
_PROBE_RESULTS = ("passed", "failed", "not-run")
_FILESYSTEM = ("none", "read", "write")
_PROCESS = ("none", "execute")
_NETWORK = ("forbidden", "project-authorized")
_CREDENTIALS = ("forbidden", "project-authorized")
_PRIVACY = ("local-only", "project-approved-egress", "external")
_TELEMETRY = ("forbidden", "local-only", "project-authorized")
_COST = ("none", "free", "low", "medium", "high")
_LOGICAL_ID = re.compile(r"^[a-z][a-z0-9]*(?:[._:-][a-z0-9]+)*$")
_SEMVER = re.compile(
    r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)"
    r"(?:-[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)?"
    r"(?:\+[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)?$"
)
_EVIDENCE_REFERENCE = re.compile(
    r"^evidence://[a-z0-9]+(?:[._-][a-z0-9]+)*"
    r"(?:/[a-z0-9]+(?:[._-][a-z0-9]+)*)*$"
)
_POLICY_DESTINATION = re.compile(
    r"^[a-z0-9]+(?:[._-][a-z0-9]+)*(?::[0-9]+)?$"
)
_OPAQUE_REFERENCE = re.compile(
    r"^([a-z][a-z0-9-]{0,31})://"
    r"([a-z0-9]+(?:[._-][a-z0-9]+)*(?:/[a-z0-9]+(?:[._-][a-z0-9]+)*)*)$"
)
_FINGERPRINT = re.compile(r"^sha256:[0-9a-f]{64}$")
_RFC3339 = re.compile(
    r"^(?P<year>[0-9]{4})-(?P<month>[0-9]{2})-(?P<day>[0-9]{2})"
    r"T(?P<hour>[0-9]{2}):(?P<minute>[0-9]{2}):(?P<second>[0-9]{2})"
    r"(?:\.(?P<fraction>[0-9]{1,9}))?"
    r"(?:Z|(?P<offset_sign>[+-])(?P<offset_hour>[0-9]{2}):(?P<offset_minute>[0-9]{2}))$"
)
_SENSITIVE_REFERENCE_TERMS = {
    "credential",
    "credentials",
    "passwd",
    "password",
    "secret",
    "token",
}
_POLICY_KEYS = {
    "filesystem",
    "process",
    "network",
    "credentials",
    "privacy",
    "egressDestinations",
    "telemetry",
    "cost",
}
_INVALID_JSON_VALUE = object()
_FORBIDDEN_JSON_RECORD_KEYS = {"__proto__", "constructor", "prototype"}


def _snapshot_plain_json_value(value: Any, seen: set[int] | None = None) -> Any:
    if value is None or type(value) in {bool, int, str}:
        return value
    if type(value) is float:
        return value if math.isfinite(value) else _INVALID_JSON_VALUE
    if type(value) not in {dict, list}:
        return _INVALID_JSON_VALUE

    if seen is None:
        seen = set()
    identity = id(value)
    if identity in seen:
        return _INVALID_JSON_VALUE
    seen.add(identity)

    if type(value) is list:
        result = []
        for item in value:
            snapshot = _snapshot_plain_json_value(item, seen)
            if snapshot is _INVALID_JSON_VALUE:
                seen.remove(identity)
                return _INVALID_JSON_VALUE
            result.append(snapshot)
        seen.remove(identity)
        return result

    result = {}
    for key, item in value.items():
        if type(key) is not str or key in _FORBIDDEN_JSON_RECORD_KEYS:
            seen.remove(identity)
            return _INVALID_JSON_VALUE
        snapshot = _snapshot_plain_json_value(item, seen)
        if snapshot is _INVALID_JSON_VALUE:
            seen.remove(identity)
            return _INVALID_JSON_VALUE
        result[key] = snapshot
    seen.remove(identity)
    return result


def _is_leap_year(year: int) -> bool:
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)


def _parse_timestamp_ms(value: Any) -> int | None:
    if not isinstance(value, str):
        return None
    match = _RFC3339.fullmatch(value)
    if match is None:
        return None
    year = int(match.group("year"))
    month = int(match.group("month"))
    day = int(match.group("day"))
    hour = int(match.group("hour"))
    minute = int(match.group("minute"))
    second = int(match.group("second"))
    offset_hour = int(match.group("offset_hour") or 0)
    offset_minute = int(match.group("offset_minute") or 0)
    days_in_month = (
        31,
        29 if _is_leap_year(year) else 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    )
    if (
        year == 0
        or month < 1
        or month > 12
        or day < 1
        or day > days_in_month[month - 1]
        or hour > 23
        or minute > 59
        or second > 59
        or offset_hour > 23
        or offset_minute > 59
    ):
        return None

    local = datetime(year, month, day, hour, minute, second)
    epoch = datetime(1970, 1, 1)
    delta = local - epoch
    fraction_ms = int(((match.group("fraction") or "") + "000")[:3])
    offset_minutes = offset_hour * 60 + offset_minute
    if match.group("offset_sign") == "-":
        offset_minutes = -offset_minutes
    return (
        (delta.days * 86_400 + delta.seconds) * 1_000
        + fraction_ms
        - offset_minutes * 60_000
    )


def _valid_timestamp(value: Any) -> bool:
    return _parse_timestamp_ms(value) is not None


def _timestamp_ms(value: str) -> int:
    parsed = _parse_timestamp_ms(value)
    if parsed is None:
        raise ValueError("invalid RFC3339 timestamp")
    return parsed


def _valid_evidence_reference(value: Any) -> bool:
    if (
        not isinstance(value, str)
        or len(value) > 256
        or _EVIDENCE_REFERENCE.fullmatch(value) is None
    ):
        return False
    payload = value[len("evidence://") :].replace("/", ".")
    return not any(
        term in _SENSITIVE_REFERENCE_TERMS for term in re.split(r"[_.-]", payload)
    )


def _valid_policy_destination(value: Any) -> bool:
    if (
        not isinstance(value, str)
        or len(value) > 253
        or _POLICY_DESTINATION.fullmatch(value) is None
    ):
        return False
    return not any(
        term in _SENSITIVE_REFERENCE_TERMS
        for term in re.split(r"[_.:-]", value)
    )


def _valid_opaque_reference(value: Any, allowed_schemes: set[str]) -> bool:
    if not isinstance(value, str) or len(value) > 256:
        return False
    match = _OPAQUE_REFERENCE.fullmatch(value)
    if match is None or match.group(1) not in allowed_schemes:
        return False
    return not any(
        term in _SENSITIVE_REFERENCE_TERMS
        for term in re.split(r"[_.\-/]", match.group(2))
    )


def _normalize_install_hint(value: Any) -> dict[str, Any] | None:
    keys = {
        "schemaVersion",
        "mechanism",
        "label",
        "reference",
        "requiresAuthentication",
    }
    if not isinstance(value, dict) or set(value) != keys or value.get("schemaVersion") != 1:
        return None
    label = value.get("label")
    reference = value.get("reference")
    if (
        value.get("mechanism") not in {"host-native", "package-manager", "manual"}
        or not isinstance(label, str)
        or len(label) > 128
        or _LOGICAL_ID.fullmatch(label) is None
        or not (
            reference is None
            or _valid_opaque_reference(
                reference, {"docs", "host-native", "package-manager"}
            )
        )
        or not isinstance(value.get("requiresAuthentication"), bool)
    ):
        return None
    return dict(value)


def _sorted_unique_strings(value: Any, *, logical_ids: bool = False) -> list[str] | None:
    if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
        return None
    if logical_ids and not all(_LOGICAL_ID.fullmatch(item) for item in value):
        return None
    return sorted(set(value))


def _normalize_policy(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict) or set(value) != _POLICY_KEYS:
        return None
    destinations = value.get("egressDestinations")
    if (
        not isinstance(destinations, list)
        or not all(_valid_policy_destination(item) for item in destinations)
        or len(set(destinations)) != len(destinations)
        or value.get("filesystem") not in _FILESYSTEM
        or value.get("process") not in _PROCESS
        or value.get("network") not in _NETWORK
        or value.get("credentials") not in _CREDENTIALS
        or value.get("privacy") not in _PRIVACY
        or value.get("telemetry") not in _TELEMETRY
        or value.get("cost") not in _COST
    ):
        return None
    if value["network"] == "forbidden" and (
        value["privacy"] != "local-only" or destinations
    ):
        return None
    if (
        value["network"] == "project-authorized"
        and value["privacy"] != "local-only"
        and not destinations
    ):
        return None
    if value["network"] == "forbidden" and value["telemetry"] == "project-authorized":
        return None
    return {
        "filesystem": value["filesystem"],
        "process": value["process"],
        "network": value["network"],
        "credentials": value["credentials"],
        "privacy": value["privacy"],
        "egressDestinations": sorted(destinations),
        "telemetry": value["telemetry"],
        "cost": value["cost"],
    }


def _normalize_manifest(value: Any) -> dict[str, Any] | None:
    keys = {
        "schemaVersion",
        "id",
        "version",
        "origin",
        "intents",
        "capabilityIds",
        "maximumAssurance",
        "policyCeiling",
        "evidenceKinds",
        "probe",
    }
    if not isinstance(value, dict) or set(value) != keys or value.get("schemaVersion") != 1:
        return None
    intents = _sorted_unique_strings(value.get("intents"))
    capability_ids = _sorted_unique_strings(value.get("capabilityIds"))
    evidence_kinds = _sorted_unique_strings(value.get("evidenceKinds"))
    policy = _normalize_policy(value.get("policyCeiling"))
    probe = value.get("probe")
    if (
        not isinstance(value.get("id"), str)
        or _LOGICAL_ID.fullmatch(value["id"]) is None
        or not isinstance(value.get("version"), str)
        or _SEMVER.fullmatch(value["version"]) is None
        or value.get("origin") not in _ORIGINS
        or intents is None
        or not intents
        or len(intents) != len(value["intents"])
        or not all(intent in _INTENTS for intent in intents)
        or capability_ids is None
        or len(capability_ids) != len(value["capabilityIds"])
        or not all(_LOGICAL_ID.fullmatch(item) for item in capability_ids)
        or value.get("maximumAssurance") not in _ASSURANCE_LEVELS
        or policy is None
        or evidence_kinds is None
        or len(evidence_kinds) != len(value["evidenceKinds"])
        or not all(evidence_kinds)
        or not isinstance(probe, dict)
        or set(probe) != {"supported", "maxAgeSeconds"}
        or not isinstance(probe.get("supported"), bool)
    ):
        return None
    max_age = probe.get("maxAgeSeconds")
    if probe["supported"]:
        if not isinstance(max_age, int) or isinstance(max_age, bool) or max_age < 1:
            return None
    elif max_age is not None:
        return None
    if value["maximumAssurance"] in {"evidence-backed", "verified"} and not evidence_kinds:
        return None
    if value["maximumAssurance"] == "verified" and not probe["supported"]:
        return None
    return {
        "schemaVersion": 1,
        "id": value["id"],
        "version": value["version"],
        "origin": value["origin"],
        "intents": intents,
        "capabilityIds": capability_ids,
        "maximumAssurance": value["maximumAssurance"],
        "policyCeiling": policy,
        "evidenceKinds": evidence_kinds,
        "probe": {"supported": probe["supported"], "maxAgeSeconds": max_age},
    }


def _normalize_binding(value: Any) -> dict[str, Any] | None:
    keys = {
        "schemaVersion",
        "id",
        "capabilityId",
        "mode",
        "control",
        "deleteBoundary",
        "asset",
        "intents",
        "providerId",
    }
    if not isinstance(value, dict) or set(value) != keys or value.get("schemaVersion") != 1:
        return None
    asset = value.get("asset")
    owner = asset.get("owner") if isinstance(asset, dict) else None
    asset_keys = {
        "schemaVersion",
        "id",
        "kind",
        "source",
        "scope",
        "owner",
        "locator",
        "fingerprint",
        "readiness",
        "installHint",
    }
    if (
        not isinstance(value.get("id"), str)
        or _LOGICAL_ID.fullmatch(value["id"]) is None
        or not isinstance(value.get("capabilityId"), str)
        or _LOGICAL_ID.fullmatch(value["capabilityId"]) is None
        or value.get("mode") not in {"native", "adopted", "composed"}
        or value.get("control") not in {"borrowed", "pactile-owned"}
        or value.get("deleteBoundary") not in {"preserve", "remove-when-unclaimed"}
        or not isinstance(asset, dict)
        or set(asset) != asset_keys
        or asset.get("schemaVersion") != 1
        or not isinstance(asset.get("id"), str)
        or _LOGICAL_ID.fullmatch(asset["id"]) is None
        or asset.get("kind") not in {"skill", "mcp", "plugin", "executable", "service"}
        or asset.get("source") not in {
            "host-native",
            "user-installed",
            "pactile-bundled",
            "project-vendored",
        }
        or asset.get("scope") not in {"project", "user", "host"}
        or not isinstance(owner, dict)
        or set(owner) != {"kind", "id"}
        or owner.get("kind") not in {"user", "host", "pactile", "third-party"}
        or asset.get("readiness") not in {"ready", "degraded", "missing", "unknown"}
    ):
        return None
    owner_id = owner.get("id")
    fingerprint = asset.get("fingerprint")
    hint_value = asset.get("installHint")
    hint = None if hint_value is None else _normalize_install_hint(hint_value)
    if (
        not (owner_id is None or isinstance(owner_id, str) and bool(owner_id))
        or owner["kind"] in {"pactile", "third-party"} and owner_id is None
        or asset["source"] == "pactile-bundled" and owner["kind"] != "pactile"
        or asset["source"] == "host-native" and owner["kind"] != "host"
        or not _valid_opaque_reference(asset.get("locator"), {asset["source"]})
        or not (
            fingerprint is None
            or isinstance(fingerprint, str) and _FINGERPRINT.fullmatch(fingerprint)
        )
        or hint_value is not None and hint is None
        or asset["readiness"] == "missing" and hint is None
    ):
        return None
    intents = _sorted_unique_strings(value.get("intents"))
    provider_id = value.get("providerId")
    if (
        intents is None
        or len(intents) != len(value["intents"])
        or not all(intent in _INTENTS for intent in intents)
        or not (
            provider_id is None
            or isinstance(provider_id, str) and _LOGICAL_ID.fullmatch(provider_id)
        )
        or asset["kind"] == "mcp" and provider_id is None
        or value["control"] == "borrowed" and value["deleteBoundary"] != "preserve"
        or value["mode"] in {"native", "adopted"} and value["control"] != "borrowed"
        or value["mode"] == "native"
        and asset["source"] not in {"host-native", "user-installed"}
        or value["mode"] == "adopted" and asset["source"] == "pactile-bundled"
        or value["control"] == "pactile-owned"
        and (
            owner["kind"] != "pactile"
            or value["deleteBoundary"] != "remove-when-unclaimed"
            or value["mode"] != "composed"
            or asset["source"] not in {"pactile-bundled", "project-vendored"}
        )
    ):
        return None
    normalized = dict(value)
    normalized["asset"] = {
        **asset,
        "owner": dict(owner),
        "installHint": hint,
    }
    normalized["intents"] = intents
    return normalized


def _normalize_runtime_fact(value: Any) -> dict[str, Any] | None:
    keys = {
        "providerId",
        "providerVersion",
        "readiness",
        "assurance",
        "freshness",
        "probedAt",
        "probeResult",
        "evidenceRefs",
    }
    if not isinstance(value, dict) or set(value) != keys:
        return None
    refs = value.get("evidenceRefs")
    probed_at = value.get("probedAt")
    if (
        not isinstance(value.get("providerId"), str)
        or _LOGICAL_ID.fullmatch(value["providerId"]) is None
        or not isinstance(value.get("providerVersion"), str)
        or _SEMVER.fullmatch(value["providerVersion"]) is None
        or value.get("readiness") not in {*_READINESS, "unknown"}
        or value.get("assurance") not in {*_ASSURANCE_LEVELS, None}
        or value.get("freshness") not in _FRESHNESS
        or value.get("probeResult") not in _PROBE_RESULTS
        or not isinstance(refs, list)
        or not all(_valid_evidence_reference(ref) for ref in refs)
        or not (probed_at is None or _valid_timestamp(probed_at))
        or value["probeResult"] == "not-run" and probed_at is not None
        or value["probeResult"] != "not-run" and probed_at is None
    ):
        return None
    normalized = dict(value)
    normalized["evidenceRefs"] = sorted(set(refs))
    return normalized


def _invalid_resolution(reason: str) -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "status": "invalid",
        "resolution": None,
        "fingerprint": None,
        "explain": {
            "schemaVersion": 1,
            "decision": "invalid",
            "reasonCode": reason,
            "selectedProviderId": None,
            "fallbackFromProviderId": None,
            "effectivePolicy": None,
            "evidenceRefs": [],
            "candidates": [],
        },
    }


def _normalize_resolver_input(value: Any) -> tuple[dict[str, Any] | None, str | None]:
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
    if (
        not isinstance(value, dict)
        or set(value) != keys
        or value.get("schemaVersion") != 1
    ):
        return None, "provider-input-invalid"
    policy = _normalize_policy(value.get("requestedPolicy"))
    authorized = _sorted_unique_strings(value.get("authorizedProviderIds"), logical_ids=True)
    active = _sorted_unique_strings(value.get("activeProviderIds"), logical_ids=True)
    standby = _sorted_unique_strings(value.get("standbyProviderIds"), logical_ids=True)
    capability_id = value.get("capabilityId")
    if (
        policy is None
        or authorized is None
        or active is None
        or standby is None
        or any(item in standby for item in active)
        or not isinstance(value.get("fallbackAllowed"), bool)
        or value.get("intent") not in _INTENTS
        or value.get("minimumAssurance") not in _ASSURANCE_LEVELS
        or not (
            capability_id is None
            or isinstance(capability_id, str) and _LOGICAL_ID.fullmatch(capability_id)
        )
        or not _valid_timestamp(value.get("now"))
        or not isinstance(value.get("manifests"), list)
        or not isinstance(value.get("bindings"), list)
        or not isinstance(value.get("runtimeFacts"), list)
    ):
        return None, "provider-input-invalid"

    manifests: list[dict[str, Any]] = []
    for item in value["manifests"]:
        manifest = _normalize_manifest(item)
        if manifest is None:
            return None, "provider-manifest-invalid"
        manifests.append(manifest)
    manifests.sort(key=lambda item: (item["id"], item["version"]))
    identities = [(item["id"], item["version"]) for item in manifests]
    if len(set(identities)) != len(identities):
        return None, "provider-manifest-duplicate"

    bindings: list[dict[str, Any]] = []
    for item in value["bindings"]:
        binding = _normalize_binding(item)
        if binding is None:
            return None, "provider-input-invalid"
        bindings.append(binding)
    bindings.sort(key=lambda item: item["id"])
    if len({item["id"] for item in bindings}) != len(bindings):
        return None, "provider-binding-duplicate"

    runtime_facts: list[dict[str, Any]] = []
    for item in value["runtimeFacts"]:
        fact = _normalize_runtime_fact(item)
        if fact is None:
            return None, "provider-input-invalid"
        runtime_facts.append(fact)
    runtime_facts.sort(key=lambda item: (item["providerId"], item["providerVersion"]))
    fact_ids = [(item["providerId"], item["providerVersion"]) for item in runtime_facts]
    if len(set(fact_ids)) != len(fact_ids):
        return None, "provider-runtime-fact-duplicate"

    return {
        "schemaVersion": 1,
        "intent": value["intent"],
        "capabilityId": capability_id,
        "minimumAssurance": value["minimumAssurance"],
        "requestedPolicy": policy,
        "authorizedProviderIds": authorized,
        "activeProviderIds": active,
        "standbyProviderIds": standby,
        "fallbackAllowed": value["fallbackAllowed"],
        "manifests": manifests,
        "bindings": bindings,
        "runtimeFacts": runtime_facts,
        "nowEpochMs": _timestamp_ms(value["now"]),
    }, None


def _policy_rejection(requested: dict[str, Any], ceiling: dict[str, Any]) -> str | None:
    ordered = (
        ("filesystem", _FILESYSTEM, "provider-policy-filesystem-exceeded"),
        ("process", _PROCESS, "provider-policy-process-exceeded"),
        ("network", _NETWORK, "provider-policy-network-exceeded"),
        ("credentials", _CREDENTIALS, "provider-policy-credentials-exceeded"),
        ("privacy", _PRIVACY, "provider-policy-privacy-exceeded"),
    )
    for field, levels, reason in ordered:
        if levels.index(requested[field]) > levels.index(ceiling[field]):
            return reason
    if any(item not in ceiling["egressDestinations"] for item in requested["egressDestinations"]):
        return "provider-policy-egress-exceeded"
    if _TELEMETRY.index(requested["telemetry"]) > _TELEMETRY.index(ceiling["telemetry"]):
        return "provider-policy-telemetry-exceeded"
    if _COST.index(requested["cost"]) > _COST.index(ceiling["cost"]):
        return "provider-policy-cost-exceeded"
    return None


def _candidate_role(provider_id: str, value: dict[str, Any]) -> str:
    if provider_id in value["activeProviderIds"]:
        return "active"
    if provider_id in value["standbyProviderIds"]:
        return "standby"
    return "default"


def _evaluate_candidate(manifest: dict[str, Any], value: dict[str, Any]) -> dict[str, Any]:
    role = _candidate_role(manifest["id"], value)

    def rejected(reason: str, fact: dict[str, Any] | None = None) -> dict[str, Any]:
        return {"manifest": manifest, "fact": fact, "role": role, "rejection": reason}

    if manifest["id"] not in value["authorizedProviderIds"]:
        return rejected("provider-not-authorized")
    if value["intent"] not in manifest["intents"]:
        return rejected("provider-intent-mismatch")
    if value["capabilityId"] is not None and value["capabilityId"] not in manifest["capabilityIds"]:
        return rejected("provider-capability-mismatch")
    policy_reason = _policy_rejection(value["requestedPolicy"], manifest["policyCeiling"])
    if policy_reason is not None:
        return rejected(policy_reason)

    provider_bindings = [
        item for item in value["bindings"] if item["providerId"] == manifest["id"]
    ]
    if not provider_bindings:
        return rejected("provider-binding-missing")
    capability_bindings = [
        item
        for item in provider_bindings
        if (
            item["capabilityId"] in manifest["capabilityIds"]
            if value["capabilityId"] is None
            else item["capabilityId"] == value["capabilityId"]
        )
    ]
    if not capability_bindings:
        return rejected("provider-binding-capability-mismatch")
    intent_bindings = [
        item for item in capability_bindings if value["intent"] in item["intents"]
    ]
    if not intent_bindings:
        return rejected("provider-binding-intent-mismatch")
    ready_bindings = [
        item for item in intent_bindings if item["asset"]["readiness"] in {"ready", "degraded"}
    ]
    if not ready_bindings:
        reason = (
            "provider-binding-readiness-unknown"
            if any(item["asset"]["readiness"] == "unknown" for item in intent_bindings)
            else "provider-binding-unavailable"
        )
        return rejected(reason)

    fact = next(
        (
            item
            for item in value["runtimeFacts"]
            if item["providerId"] == manifest["id"]
            and item["providerVersion"] == manifest["version"]
        ),
        None,
    )
    if fact is None:
        reason = (
            "provider-runtime-version-mismatch"
            if any(item["providerId"] == manifest["id"] for item in value["runtimeFacts"])
            else "provider-runtime-fact-missing"
        )
        return rejected(reason)
    if fact["readiness"] == "unknown":
        return rejected("provider-readiness-unknown", fact)
    if fact["readiness"] == "unavailable":
        return rejected("provider-readiness-unavailable", fact)

    if manifest["probe"]["supported"]:
        if fact["probeResult"] == "not-run":
            return rejected("provider-probe-not-run", fact)
        if fact["probeResult"] == "failed":
            return rejected("provider-probe-failed", fact)
        if fact["freshness"] in {"unknown", "not-applicable"}:
            return rejected("provider-freshness-unknown", fact)
        if fact["freshness"] == "stale":
            return rejected("provider-freshness-stale", fact)
        if fact["probedAt"] is None or manifest["probe"]["maxAgeSeconds"] is None:
            return rejected("provider-probe-time-invalid", fact)
        probed_at_ms = _timestamp_ms(fact["probedAt"])
        if probed_at_ms > value["nowEpochMs"]:
            return rejected("provider-probe-from-future", fact)
        if value["nowEpochMs"] - probed_at_ms > manifest["probe"]["maxAgeSeconds"] * 1000:
            return rejected("provider-probe-expired", fact)
    elif (
        fact["probeResult"] != "not-run"
        or fact["probedAt"] is not None
        or fact["freshness"] not in {"unknown", "not-applicable"}
    ):
        return rejected("provider-probe-unexpected", fact)

    assurance = fact["assurance"]
    if assurance is None:
        return rejected("provider-assurance-insufficient", fact)
    if _ASSURANCE_LEVELS.index(assurance) > _ASSURANCE_LEVELS.index(manifest["maximumAssurance"]):
        return rejected("provider-assurance-exceeds-manifest", fact)
    if _ASSURANCE_LEVELS.index(assurance) < _ASSURANCE_LEVELS.index(value["minimumAssurance"]):
        return rejected("provider-assurance-insufficient", fact)
    if _ASSURANCE_LEVELS.index(assurance) >= 1 and not fact["evidenceRefs"]:
        return rejected("provider-evidence-missing", fact)
    if (
        fact["readiness"] == "degraded"
        or all(item["asset"]["readiness"] == "degraded" for item in ready_bindings)
    ) and (_ASSURANCE_LEVELS.index(assurance) < 1 or not fact["evidenceRefs"]):
        return rejected("provider-degraded-without-evidence", fact)
    return {"manifest": manifest, "fact": fact, "role": role, "rejection": None}


def _resolver_fingerprint(value: dict[str, Any]) -> str:
    payload = {
        "schemaVersion": value["schemaVersion"],
        "intent": value["intent"],
        "capabilityId": value["capabilityId"],
        "minimumAssurance": value["minimumAssurance"],
        "requestedPolicy": value["requestedPolicy"],
        "authorizedProviderIds": value["authorizedProviderIds"],
        "activeProviderIds": value["activeProviderIds"],
        "standbyProviderIds": value["standbyProviderIds"],
        "fallbackAllowed": value["fallbackAllowed"],
        "manifests": value["manifests"],
        "bindings": value["bindings"],
        "runtimeFacts": value["runtimeFacts"],
    }
    canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return "sha256:" + hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _unsupported_resolution(value: dict[str, Any]) -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "intent": value["intent"],
        "minimumAssurance": value["minimumAssurance"],
        "origin": "unsupported",
        "providerId": None,
        "providerVersion": None,
        "assurance": None,
        "readiness": "unavailable",
        "requestedPolicy": value["requestedPolicy"],
        "effectivePolicy": None,
        "evidenceRefs": [],
        "freshness": "not-applicable",
        "probedAt": None,
        "probeResult": "not-run",
        "fallbackFromProviderId": None,
    }


def _resolve_plain_provider_v1(raw: Any) -> dict[str, Any]:
    value, invalid_reason = _normalize_resolver_input(raw)
    if value is None:
        return _invalid_resolution(invalid_reason or "provider-input-invalid")
    fingerprint = _resolver_fingerprint(value)
    evaluated = [_evaluate_candidate(manifest, value) for manifest in value["manifests"]]
    eligible = [item for item in evaluated if item["rejection"] is None]

    selected: dict[str, Any] | None = None
    fallback_from: str | None = None
    if value["activeProviderIds"]:
        selected = next((item for item in eligible if item["role"] == "active"), None)
        if selected is None and value["fallbackAllowed"]:
            selected = next((item for item in eligible if item["role"] == "standby"), None)
            if selected is not None:
                fallback_from = value["activeProviderIds"][0]
    elif not value["standbyProviderIds"]:
        selected = eligible[0] if eligible else None

    candidates: list[dict[str, Any]] = []
    for item in evaluated:
        if item["rejection"] is not None:
            candidates.append(
                {
                    "providerId": item["manifest"]["id"],
                    "providerVersion": item["manifest"]["version"],
                    "role": item["role"],
                    "accepted": False,
                    "selected": False,
                    "reasonCodes": [item["rejection"]],
                    "effectivePolicy": None,
                    "evidenceRefs": [],
                }
            )
            continue
        if item is selected:
            selected_reason = {
                "active": "provider-selected-active",
                "standby": "provider-selected-fallback",
                "default": "provider-selected-stable",
            }[item["role"]]
            candidates.append(
                {
                    "providerId": item["manifest"]["id"],
                    "providerVersion": item["manifest"]["version"],
                    "role": item["role"],
                    "accepted": True,
                    "selected": True,
                    "reasonCodes": [selected_reason],
                    "effectivePolicy": value["requestedPolicy"],
                    "evidenceRefs": item["fact"]["evidenceRefs"],
                }
            )
            continue
        if item["role"] == "standby" and not value["fallbackAllowed"]:
            reason = "provider-fallback-disabled"
        elif value["activeProviderIds"] and item["role"] == "default":
            reason = "provider-not-preferred"
        else:
            reason = "provider-not-selected"
        candidates.append(
            {
                "providerId": item["manifest"]["id"],
                "providerVersion": item["manifest"]["version"],
                "role": item["role"],
                "accepted": False,
                "selected": False,
                "reasonCodes": [reason],
                "effectivePolicy": None,
                "evidenceRefs": [],
            }
        )

    if selected is None or selected["fact"] is None:
        if not value["activeProviderIds"] and value["standbyProviderIds"]:
            reason = "provider-active-missing"
        elif value["activeProviderIds"] and not value["fallbackAllowed"]:
            reason = "provider-fallback-disabled"
        elif candidates:
            reason = candidates[0]["reasonCodes"][0]
        else:
            reason = "provider-unsupported"
        return {
            "schemaVersion": 1,
            "status": "unsupported",
            "resolution": _unsupported_resolution(value),
            "fingerprint": fingerprint,
            "explain": {
                "schemaVersion": 1,
                "decision": "unsupported",
                "reasonCode": reason,
                "selectedProviderId": None,
                "fallbackFromProviderId": None,
                "effectivePolicy": None,
                "evidenceRefs": [],
                "candidates": candidates,
            },
        }

    fact = selected["fact"]
    manifest = selected["manifest"]
    resolution = {
        "schemaVersion": 1,
        "intent": value["intent"],
        "minimumAssurance": value["minimumAssurance"],
        "origin": manifest["origin"],
        "providerId": manifest["id"],
        "providerVersion": manifest["version"],
        "assurance": fact["assurance"],
        "readiness": fact["readiness"],
        "requestedPolicy": value["requestedPolicy"],
        "effectivePolicy": value["requestedPolicy"],
        "evidenceRefs": fact["evidenceRefs"],
        "freshness": fact["freshness"],
        "probedAt": fact["probedAt"],
        "probeResult": fact["probeResult"],
        "fallbackFromProviderId": fallback_from,
    }
    return {
        "schemaVersion": 1,
        "status": "supported",
        "resolution": resolution,
        "fingerprint": fingerprint,
        "explain": {
            "schemaVersion": 1,
            "decision": "supported",
            "reasonCode": "provider-selected",
            "selectedProviderId": manifest["id"],
            "fallbackFromProviderId": fallback_from,
            "effectivePolicy": value["requestedPolicy"],
            "evidenceRefs": fact["evidenceRefs"],
            "candidates": candidates,
        },
    }


def resolve_provider_v1(raw: Any) -> dict[str, Any]:
    """Resolve plain JSON Provider facts with the redacted TypeScript ABI."""
    try:
        snapshot = _snapshot_plain_json_value(raw)
        if snapshot is _INVALID_JSON_VALUE or type(snapshot) is not dict:
            return _invalid_resolution("provider-input-invalid")
        return _resolve_plain_provider_v1(snapshot)
    except Exception:
        return _invalid_resolution("provider-input-invalid")
