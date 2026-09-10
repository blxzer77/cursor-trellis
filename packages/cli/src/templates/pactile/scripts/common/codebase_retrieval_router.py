#!/usr/bin/env python3
"""Host-neutral Pactile retrieval request, plan, and evidence contract.

This is the Python mirror of the TypeScript V3 planner.  It describes intent,
assurance, policy, evidence, budgets, and stop conditions; concrete capability
binding belongs to the project resolver and its adapters.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Any, cast


ROUTER_VERSION = 3
RETRIEVAL_ABI_VERSION = ROUTER_VERSION

INTENT_ORDER = ("exact", "semantic", "structural", "external")
PROVIDER_INTENTS = ("semantic", "structural", "external")
ASSURANCE_LEVELS = ("best-effort", "evidence-backed", "verified")
PROVIDER_STATUSES = (
    "resolution-required",
    "ready",
    "degraded",
    "unavailable",
    "unsupported",
)
PROVIDER_READINESS = ("ready", "degraded", "unavailable")
CORROBORATION_KINDS = (
    "source-reference",
    "git-evidence",
    "repeatable-test",
)
REASON_CODES = (
    "invalid-plan",
    "invalid-evidence",
    "query-empty",
    "provider-resolution-required",
    "provider-degraded",
    "provider-unavailable",
    "provider-unsupported",
    "candidate-missing",
    "corroboration-required",
    "required-evidence-missing",
    "minimum-assurance-not-met",
    "verified-provider-proof-required",
    "repeatable-verification-required",
    "budget-exhausted",
)

FILESYSTEM_CEILINGS = ("none", "read", "write")
PROCESS_CEILINGS = ("none", "execute")
NETWORK_CEILINGS = ("forbidden", "project-authorized")
CREDENTIAL_CEILINGS = ("forbidden", "project-authorized")
PRIVACY_CEILINGS = ("local-only", "project-approved-egress", "external")
TELEMETRY_CEILINGS = ("forbidden", "local-only", "project-authorized")
COST_CEILINGS = ("none", "free", "low", "medium", "high")

DEFAULT_RETRIEVAL_BUDGET_V3: dict[str, int] = {
    "maxSteps": 16,
    "maxCandidatesPerStep": 50,
}
DEFAULT_RETRIEVAL_POLICY_V3: dict[str, object] = {
    "filesystem": "read",
    "process": "execute",
    "network": "forbidden",
    "credentials": "forbidden",
    "privacy": "local-only",
    "egressDestinations": [],
    "telemetry": "local-only",
    "cost": "free",
}

MAX_QUERY_BYTES = 16 * 1024
MAX_SCOPE_HINTS = 128
MAX_SCOPE_HINT_BYTES = 512
MAX_EVIDENCE_KINDS = 64
MAX_LOGICAL_ID_BYTES = 128
LOGICAL_ID = re.compile(r"^[a-z][a-z0-9]*(?:[._:-][a-z0-9]+)*$")
SEMVER = re.compile(
    r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)"
    r"(?:-[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)?"
    r"(?:\+[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)?$"
)
RFC3339 = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$"
)
LOGICAL_REF = re.compile(
    r"^(?:artifact|evidence|source|git|test)://"
    r"([a-z0-9]+(?:[._-][a-z0-9]+)*(?:/[a-z0-9]+(?:[._-][a-z0-9]+)*)*)$"
)
SENSITIVE_REFERENCE_TERMS = frozenset(
    {"credential", "credentials", "passwd", "password", "secret", "token"}
)
FORBIDDEN_JSON_KEYS = frozenset({"__proto__", "constructor", "prototype"})
_MISSING_CONTEXT = object()

EXACT_SIGNALS = (
    "where is",
    "defined",
    "definition",
    "symbol",
    "path",
    "file",
    "literal",
    "identifier",
    "exact",
    "grep",
    "rg ",
    "在哪里",
    "定义",
    "路径",
    "文件",
    "字面量",
)
SEMANTIC_SIGNALS = (
    "concept",
    "conceptual",
    "semantic",
    "behavior",
    "behaviour",
    "how does",
    "unknown name",
    "概念",
    "语义",
    "行为",
    "如何工作",
)
STRUCTURAL_SIGNALS = (
    "caller",
    "callee",
    "call graph",
    "dependency",
    "dependencies",
    "impact",
    "blast radius",
    "structural",
    "architecture",
    "调用者",
    "调用链",
    "依赖",
    "影响面",
    "结构",
    "架构",
)
EXTERNAL_SIGNALS = (
    "latest",
    "current version",
    "release note",
    "official docs",
    "web",
    "cve",
    "external",
    "remote system",
    "最新",
    "当前版本",
    "发布说明",
    "官方文档",
    "外部",
    "远端系统",
)


def _utf8_key(value: str) -> bytes:
    return value.encode("utf-8")


def _copy_policy(policy: dict[str, object]) -> dict[str, object]:
    destinations = cast(list[str], policy["egressDestinations"])
    return {**policy, "egressDestinations": list(destinations)}


def _canonical_json(value: object) -> str:
    return json.dumps(
        value,
        sort_keys=True,
        ensure_ascii=False,
        separators=(",", ":"),
        allow_nan=False,
    )


def _is_plain_json_tree(
    value: object,
    *,
    active: set[int] | None = None,
    depth: int = 0,
    counter: list[int] | None = None,
) -> bool:
    """Accept only finite builtin JSON trees and reject cycles/subclasses."""
    if active is None:
        active = set()
    if counter is None:
        counter = [0]
    counter[0] += 1
    if counter[0] > 100_000 or depth > 64:
        return False
    if value is None or type(value) in (str, bool, int):
        return True
    if type(value) is float:
        return math.isfinite(value)
    if type(value) not in (dict, list):
        return False
    identity = id(value)
    if identity in active:
        return False
    active.add(identity)
    try:
        if type(value) is list:
            items = cast(list[object], value)
            return all(
                _is_plain_json_tree(
                    item, active=active, depth=depth + 1, counter=counter
                )
                for item in items
            )
        mapping = cast(dict[object, object], value)
        if any(
            type(key) is not str or key in FORBIDDEN_JSON_KEYS
            for key in mapping
        ):
            return False
        return all(
            _is_plain_json_tree(
                item, active=active, depth=depth + 1, counter=counter
            )
            for item in mapping.values()
        )
    finally:
        active.remove(identity)


def fingerprint_pactile_contract_v1(value: object) -> str:
    digest = hashlib.sha256(_canonical_json(value).encode("utf-8")).hexdigest()
    return f"sha256:{digest}"


def _issue(
    issues: list[dict[str, str]], code: str, path: str, message: str
) -> None:
    issues.append({"code": code, "path": path, "message": message})


def _sorted_issues(issues: list[dict[str, str]]) -> list[dict[str, str]]:
    return sorted(issues, key=lambda item: (_utf8_key(item["path"]), _utf8_key(item["code"])))


def _record(
    value: object,
    path: str,
    allowed: tuple[str, ...],
    issues: list[dict[str, str]],
) -> dict[str, object] | None:
    if type(value) is not dict:
        _issue(issues, "invalid-type", path, "must be an object")
        return None
    allowed_set = set(allowed)
    output: dict[str, object] = {}
    for key in sorted(value, key=_utf8_key):
        if type(key) is not str:
            _issue(issues, "unknown-field", path, "must contain only string fields")
        elif key not in allowed_set:
            _issue(issues, "unknown-field", path, "contains an unknown field")
        else:
            output[key] = value[key]
    return output


def _required(
    record: dict[str, object] | None,
    key: str,
    path: str,
    issues: list[dict[str, str]],
) -> object:
    if record is None or key not in record:
        _issue(issues, "missing-field", f"{path}.{key}", "is required")
        return None
    return record[key]


def _array(
    value: object,
    path: str,
    issues: list[dict[str, str]],
    max_items: int,
) -> list[object]:
    if type(value) is not list:
        _issue(issues, "invalid-type", path, "must be an array")
        return []
    if len(value) > max_items:
        _issue(issues, "limit-exceeded", path, f"must contain at most {max_items} items")
    return list(value[:max_items])


def _text(
    value: object,
    path: str,
    issues: list[dict[str, str]],
    *,
    max_bytes: int,
    collapse_whitespace: bool = False,
    logical_id: bool = False,
) -> str:
    if type(value) is not str:
        _issue(issues, "invalid-type", path, "must be a string")
        return ""
    try:
        value.encode("utf-8")
    except UnicodeEncodeError:
        _issue(issues, "invalid-value", path, "must contain valid Unicode scalar values")
        return ""
    normalized = (
        re.sub(r"\s+", " ", value).strip() if collapse_whitespace else value.strip()
    )
    normalized = unicodedata.normalize("NFC", normalized)
    if not normalized:
        _issue(issues, "invalid-value", path, "must not be empty")
    if any(unicodedata.category(character) == "Cc" for character in normalized):
        _issue(issues, "invalid-value", path, "must not contain control characters")
    if len(normalized.encode("utf-8")) > max_bytes:
        _issue(issues, "limit-exceeded", path, f"must be at most {max_bytes} UTF-8 bytes")
    if logical_id and normalized and LOGICAL_ID.fullmatch(normalized) is None:
        _issue(issues, "invalid-value", path, "must be a lowercase logical id")
    return normalized


def _enum(
    value: object,
    values: tuple[str, ...],
    path: str,
    issues: list[dict[str, str]],
) -> str:
    if type(value) is not str or value not in values:
        _issue(issues, "invalid-value", path, f"must be one of: {', '.join(values)}")
        return values[0]
    return value


def _integer(
    value: object,
    path: str,
    issues: list[dict[str, str]],
    minimum: int,
    maximum: int,
) -> int:
    if type(value) is not int or value < minimum or value > maximum:
        _issue(
            issues,
            "invalid-value",
            path,
            f"must be a safe integer from {minimum} through {maximum}",
        )
        return minimum
    return value


def _string_set(
    value: object,
    path: str,
    issues: list[dict[str, str]],
    *,
    max_items: int,
    max_bytes: int,
    logical_id: bool = False,
) -> list[str]:
    raw = _array(value, path, issues, max_items)
    normalized = [
        _text(
            item,
            f"{path}[{index}]",
            issues,
            max_bytes=max_bytes,
            logical_id=logical_id,
        )
        for index, item in enumerate(raw)
    ]
    seen: set[str] = set()
    for index, item in enumerate(normalized):
        if item in seen:
            _issue(
                issues,
                "duplicate-value",
                f"{path}[{index}]",
                "must be unique after normalization",
            )
        seen.add(item)
    return sorted(normalized, key=_utf8_key)


def _policy(
    value: object, path: str, issues: list[dict[str, str]]
) -> dict[str, object]:
    allowed = (
        "filesystem",
        "process",
        "network",
        "credentials",
        "privacy",
        "egressDestinations",
        "telemetry",
        "cost",
    )
    record = _record(value, path, allowed, issues)
    policy: dict[str, object] = {
        "filesystem": _enum(
            _required(record, "filesystem", path, issues),
            FILESYSTEM_CEILINGS,
            f"{path}.filesystem",
            issues,
        ),
        "process": _enum(
            _required(record, "process", path, issues),
            PROCESS_CEILINGS,
            f"{path}.process",
            issues,
        ),
        "network": _enum(
            _required(record, "network", path, issues),
            NETWORK_CEILINGS,
            f"{path}.network",
            issues,
        ),
        "credentials": _enum(
            _required(record, "credentials", path, issues),
            CREDENTIAL_CEILINGS,
            f"{path}.credentials",
            issues,
        ),
        "privacy": _enum(
            _required(record, "privacy", path, issues),
            PRIVACY_CEILINGS,
            f"{path}.privacy",
            issues,
        ),
        "egressDestinations": _string_set(
            _required(record, "egressDestinations", path, issues),
            f"{path}.egressDestinations",
            issues,
            max_items=64,
            max_bytes=256,
        ),
        "telemetry": _enum(
            _required(record, "telemetry", path, issues),
            TELEMETRY_CEILINGS,
            f"{path}.telemetry",
            issues,
        ),
        "cost": _enum(
            _required(record, "cost", path, issues),
            COST_CEILINGS,
            f"{path}.cost",
            issues,
        ),
    }
    if policy["network"] == "forbidden" and (
        policy["privacy"] != "local-only" or policy["egressDestinations"]
    ):
        _issue(
            issues,
            "policy-violation",
            f"{path}.privacy",
            "network-forbidden policy cannot permit egress",
        )
    if (
        policy["network"] == "project-authorized"
        and policy["privacy"] != "local-only"
        and not policy["egressDestinations"]
    ):
        _issue(
            issues,
            "policy-violation",
            f"{path}.egressDestinations",
            "external egress requires at least one destination",
        )
    if policy["network"] == "forbidden" and policy["telemetry"] == "project-authorized":
        _issue(
            issues,
            "policy-violation",
            f"{path}.telemetry",
            "network-forbidden policy cannot permit remote telemetry",
        )
    return policy


def _budget(
    value: object, path: str, issues: list[dict[str, str]]
) -> dict[str, int]:
    record = _record(value, path, ("maxSteps", "maxCandidatesPerStep"), issues)
    return {
        "maxSteps": _integer(
            _required(record, "maxSteps", path, issues),
            f"{path}.maxSteps",
            issues,
            1,
            32,
        ),
        "maxCandidatesPerStep": _integer(
            _required(record, "maxCandidatesPerStep", path, issues),
            f"{path}.maxCandidatesPerStep",
            issues,
            1,
            1000,
        ),
    }


def _intents(
    value: object, path: str, issues: list[dict[str, str]]
) -> list[str]:
    raw = _array(value, path, issues, len(INTENT_ORDER))
    if not raw:
        _issue(issues, "invalid-value", path, "must contain at least one intent")
    values = [
        _enum(item, INTENT_ORDER, f"{path}[{index}]", issues)
        for index, item in enumerate(raw)
    ]
    seen: set[str] = set()
    for index, item in enumerate(values):
        if item in seen:
            _issue(issues, "duplicate-value", f"{path}[{index}]", "must be unique")
        seen.add(item)
    return [intent for intent in INTENT_ORDER if intent in seen]


def parse_retrieval_request_v3(value: object) -> dict[str, object]:
    """Strictly parse and canonicalize a V3 request."""
    if type(value) is not dict or not _is_plain_json_tree(value):
        return {
            "success": False,
            "issues": [
                {
                    "code": "invalid-type",
                    "path": "$",
                    "message": "must be a plain data value",
                }
            ],
        }
    issues: list[dict[str, str]] = []
    try:
        record = _record(
            value,
            "$",
            (
                "schemaVersion",
                "query",
                "intents",
                "scopeHints",
                "minimumAssurance",
                "requestedPolicy",
                "requiredEvidenceKinds",
                "budget",
            ),
            issues,
        )
        schema_version = _required(record, "schemaVersion", "$", issues)
        if type(schema_version) is not int or schema_version != RETRIEVAL_ABI_VERSION:
            _issue(issues, "invalid-value", "$.schemaVersion", "must equal 3")
        query = _text(
            _required(record, "query", "$", issues),
            "$.query",
            issues,
            max_bytes=MAX_QUERY_BYTES,
            collapse_whitespace=True,
        )
        intents = _intents(_required(record, "intents", "$", issues), "$.intents", issues)
        scope_hints = _string_set(
            _required(record, "scopeHints", "$", issues),
            "$.scopeHints",
            issues,
            max_items=MAX_SCOPE_HINTS,
            max_bytes=MAX_SCOPE_HINT_BYTES,
        )
        minimum_assurance = _enum(
            _required(record, "minimumAssurance", "$", issues),
            ASSURANCE_LEVELS,
            "$.minimumAssurance",
            issues,
        )
        requested_policy = _policy(
            _required(record, "requestedPolicy", "$", issues),
            "$.requestedPolicy",
            issues,
        )
        required_evidence_kinds = _string_set(
            _required(record, "requiredEvidenceKinds", "$", issues),
            "$.requiredEvidenceKinds",
            issues,
            max_items=MAX_EVIDENCE_KINDS,
            max_bytes=MAX_LOGICAL_ID_BYTES,
            logical_id=True,
        )
        if minimum_assurance != "best-effort" and not required_evidence_kinds:
            _issue(
                issues,
                "policy-violation",
                "$.requiredEvidenceKinds",
                "evidence-backed and verified requests require evidence kinds",
            )
        budget = _budget(_required(record, "budget", "$", issues), "$.budget", issues)
        if issues:
            return {"success": False, "issues": _sorted_issues(issues)}
        return {
            "success": True,
            "data": {
                "schemaVersion": RETRIEVAL_ABI_VERSION,
                "query": query,
                "intents": intents,
                "scopeHints": scope_hints,
                "minimumAssurance": minimum_assurance,
                "requestedPolicy": requested_policy,
                "requiredEvidenceKinds": required_evidence_kinds,
                "budget": budget,
            },
        }
    except (AttributeError, KeyError, TypeError, UnicodeError, ValueError):
        return {
            "success": False,
            "issues": [
                {
                    "code": "invalid-type",
                    "path": "$",
                    "message": "must be a plain data value",
                }
            ],
        }


def classify_codebase_retrieval_intents(query: str) -> list[str]:
    """Return the four canonical intents in frozen order."""
    normalized = unicodedata.normalize("NFC", re.sub(r"\s+", " ", query).strip()).lower()
    matched: set[str] = set()
    if any(signal in normalized for signal in EXACT_SIGNALS):
        matched.add("exact")
    if any(signal in normalized for signal in SEMANTIC_SIGNALS):
        matched.add("semantic")
    if any(signal in normalized for signal in STRUCTURAL_SIGNALS):
        matched.add("structural")
    if any(signal in normalized for signal in EXTERNAL_SIGNALS):
        matched.add("external")
    if not matched:
        matched.add("exact")
    return [intent for intent in INTENT_ORDER if intent in matched]


def build_retrieval_request_v3(
    query: str,
    *,
    intents: list[str] | tuple[str, ...] | None = None,
    scope_hints: list[str] | tuple[str, ...] | None = None,
    minimum_assurance: str = "evidence-backed",
    requested_policy: dict[str, object] | None = None,
    required_evidence_kinds: list[str] | tuple[str, ...] | None = None,
    budget: dict[str, int] | None = None,
) -> dict[str, object]:
    candidate: dict[str, object] = {
        "schemaVersion": RETRIEVAL_ABI_VERSION,
        "query": query,
        "intents": list(intents) if intents is not None else classify_codebase_retrieval_intents(query),
        "scopeHints": list(scope_hints if scope_hints is not None else []),
        "minimumAssurance": minimum_assurance,
        "requestedPolicy": _copy_policy(
            requested_policy
            if requested_policy is not None
            else DEFAULT_RETRIEVAL_POLICY_V3
        ),
        "requiredEvidenceKinds": list(
            required_evidence_kinds
            if required_evidence_kinds is not None
            else ("source-reference",)
        ),
        "budget": dict(budget if budget is not None else DEFAULT_RETRIEVAL_BUDGET_V3),
    }
    parsed = parse_retrieval_request_v3(candidate)
    if not parsed["success"]:
        raise ValueError(
            "PACTILE_RETRIEVAL_REQUEST_INVALID:" + _canonical_json(parsed["issues"])
        )
    return dict(cast(dict[str, object], parsed["data"]))


def _parse_planning_context(value: object) -> dict[str, object]:
    if type(value) is not dict or not _is_plain_json_tree(value):
        return {
            "success": False,
            "issues": [
                {
                    "code": "invalid-type",
                    "path": "$context",
                    "message": "must be a plain data value",
                }
            ],
        }
    issues: list[dict[str, str]] = []
    try:
        record = _record(value, "$context", ("providerAvailability",), issues)
        raw = record.get("providerAvailability", []) if record is not None else []
        entries = _array(raw, "$context.providerAvailability", issues, 3)
        output: list[dict[str, object]] = []
        seen: set[str] = set()
        for index, entry in enumerate(entries):
            path = f"$context.providerAvailability[{index}]"
            item = _record(entry, path, ("intent", "status", "readiness"), issues)
            intent = _enum(
                _required(item, "intent", path, issues),
                PROVIDER_INTENTS,
                f"{path}.intent",
                issues,
            )
            status = _enum(
                _required(item, "status", path, issues),
                PROVIDER_STATUSES[1:],
                f"{path}.status",
                issues,
            )
            readiness_raw = item.get("readiness") if item is not None else None
            readiness = (
                None
                if readiness_raw is None
                else _enum(readiness_raw, PROVIDER_READINESS, f"{path}.readiness", issues)
            )
            if intent in seen:
                _issue(issues, "duplicate-value", f"{path}.intent", "must be unique")
            seen.add(intent)
            if readiness is not None and status != "unsupported" and status != readiness:
                _issue(
                    issues,
                    "policy-violation",
                    f"{path}.readiness",
                    "must agree with the neutral provider status",
                )
            if status == "unsupported" and readiness not in (None, "unavailable"):
                _issue(
                    issues,
                    "policy-violation",
                    f"{path}.readiness",
                    "unsupported intent may only report unavailable readiness",
                )
            value_out: dict[str, object] = {"intent": intent, "status": status}
            if readiness is not None:
                value_out["readiness"] = readiness
            output.append(value_out)
        if issues:
            return {"success": False, "issues": _sorted_issues(issues)}
        ordered = [
            entry
            for intent in PROVIDER_INTENTS
            for entry in output
            if entry["intent"] == intent
        ]
        return {"success": True, "data": ordered}
    except (AttributeError, KeyError, TypeError, UnicodeError, ValueError):
        return {
            "success": False,
            "issues": [
                {
                    "code": "invalid-type",
                    "path": "$context",
                    "message": "must be a plain data value",
                }
            ],
        }


def _status_reason(intent: str, status: str) -> dict[str, object] | None:
    codes = {
        "resolution-required": "provider-resolution-required",
        "degraded": "provider-degraded",
        "unavailable": "provider-unavailable",
        "unsupported": "provider-unsupported",
    }
    code = codes.get(status)
    return None if code is None else {"code": code, "intent": intent, "blocking": True}


def _build_plan(
    request: dict[str, object], availability: list[dict[str, object]]
) -> dict[str, object]:
    request_intents = cast(list[str], request["intents"])
    request_scope_hints = cast(list[str], request["scopeHints"])
    requested_policy = cast(dict[str, object], request["requestedPolicy"])
    required_evidence_kinds = cast(list[str], request["requiredEvidenceKinds"])
    request_budget = cast(dict[str, int], request["budget"])
    statuses = {str(entry["intent"]): str(entry["status"]) for entry in availability}
    all_steps: list[dict[str, object]] = []
    for index, raw_intent in enumerate(request_intents):
        intent = str(raw_intent)
        if intent == "exact":
            all_steps.append(
                {
                    "order": index + 1,
                    "intent": intent,
                    "kind": "local-exact",
                    "localToolHint": "rg",
                    "providerRequirement": None,
                    "outputRole": "candidate",
                }
            )
            continue
        status = statuses.get(intent, "resolution-required")
        all_steps.append(
            {
                "order": index + 1,
                "intent": intent,
                "kind": "provider-request",
                "localToolHint": None,
                "providerRequirement": {
                    "intent": intent,
                    "minimumAssurance": request["minimumAssurance"],
                    "requestedPolicy": _copy_policy(requested_policy),
                    "requiredEvidenceKinds": list(required_evidence_kinds),
                    "status": status,
                },
                "outputRole": "candidate",
            }
        )
    steps = [
        {**step, "order": index + 1}
        for index, step in enumerate(all_steps[: request_budget["maxSteps"]])
    ]
    stop_reasons: list[dict[str, object]] = []
    if len(steps) < len(all_steps):
        stop_reasons.append({"code": "budget-exhausted", "intent": None, "blocking": True})
    for step in steps:
        requirement = step["providerRequirement"]
        if type(requirement) is dict:
            reason = _status_reason(str(requirement["intent"]), str(requirement["status"]))
            if reason is not None:
                stop_reasons.append(reason)
    plan: dict[str, object] = {
        "schemaVersion": RETRIEVAL_ABI_VERSION,
        "query": request["query"],
        "intents": list(request_intents),
        "scopeHints": list(request_scope_hints),
        "minimumAssurance": request["minimumAssurance"],
        "requestedPolicy": _copy_policy(requested_policy),
        "requiredEvidenceKinds": list(required_evidence_kinds),
        "budget": dict(request_budget),
        "steps": steps,
        "verificationChain": [
            {
                "order": 1,
                "stage": "candidate",
                "required": True,
                "acceptableEvidenceKinds": [],
            },
            *[
                {
                    "order": order,
                    "stage": stage,
                    "required": True,
                    "acceptableEvidenceKinds": list(CORROBORATION_KINDS),
                }
                for order, stage in (
                    (2, "corroborate"),
                    (3, "classify-evidence"),
                    (4, "check-assurance"),
                    (5, "accept-or-stop"),
                )
            ],
        ],
        "stopReasons": stop_reasons,
    }
    plan["fingerprint"] = fingerprint_pactile_contract_v1(plan)
    return plan


def plan_retrieval_v3(
    request: object, context: object = _MISSING_CONTEXT
) -> dict[str, object]:
    parsed = parse_retrieval_request_v3(request)
    if not parsed["success"]:
        return parsed
    context_value: object = {} if context is _MISSING_CONTEXT else context
    availability = _parse_planning_context(context_value)
    if not availability["success"]:
        return availability
    return {
        "success": True,
        "data": _build_plan(
            dict(cast(dict[str, object], parsed["data"])),
            list(cast(list[dict[str, object]], availability["data"])),
        ),
    }


def route_codebase_retrieval(
    query: str,
    *,
    intents: list[str] | tuple[str, ...] | None = None,
    scope_hints: list[str] | tuple[str, ...] | None = None,
    minimum_assurance: str = "evidence-backed",
    requested_policy: dict[str, object] | None = None,
    required_evidence_kinds: list[str] | tuple[str, ...] | None = None,
    budget: dict[str, int] | None = None,
    provider_availability: list[dict[str, object]] | None = None,
    **_compatibility_metadata: object,
) -> dict[str, object]:
    """Build a deterministic V3 plan; compatibility metadata has no effect."""
    request = build_retrieval_request_v3(
        query,
        intents=intents,
        scope_hints=scope_hints,
        minimum_assurance=minimum_assurance,
        requested_policy=requested_policy,
        required_evidence_kinds=required_evidence_kinds,
        budget=budget,
    )
    result = plan_retrieval_v3(
        request,
        {
            "providerAvailability": list(provider_availability)
            if provider_availability is not None
            else []
        },
    )
    if not result["success"]:
        raise ValueError("PACTILE_RETRIEVAL_PLAN_INVALID:" + _canonical_json(result["issues"]))
    return dict(cast(dict[str, object], result["data"]))


def _normalized_refs(values: object) -> list[str] | None:
    if type(values) is not list or len(values) > 1024:
        return None
    output: list[str] = []
    for value in values:
        if type(value) is not str or not _valid_logical_ref(value):
            return None
        output.append(value)
    return sorted(set(output), key=_utf8_key)


def _normalized_facts(values: object) -> list[dict[str, str]] | None:
    if type(values) is not list or len(values) > 1024:
        return None
    output: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for value in values:
        if type(value) is not dict or set(value) != {"kind", "ref"}:
            return None
        kind = value["kind"]
        ref = value["ref"]
        if (
            type(kind) is not str
            or LOGICAL_ID.fullmatch(kind) is None
            or type(ref) is not str
            or not _valid_logical_ref(ref)
        ):
            return None
        identity = (kind, ref)
        if identity not in seen:
            seen.add(identity)
            output.append({"kind": kind, "ref": ref})
    return sorted(output, key=lambda item: (_utf8_key(item["kind"]), _utf8_key(item["ref"])))


def _valid_plan(plan: object, intent: str) -> bool:
    expected_keys = {
        "schemaVersion",
        "query",
        "intents",
        "scopeHints",
        "minimumAssurance",
        "requestedPolicy",
        "requiredEvidenceKinds",
        "budget",
        "steps",
        "verificationChain",
        "stopReasons",
        "fingerprint",
    }
    if (
        type(plan) is not dict
        or not _is_plain_json_tree(plan)
        or set(plan) != expected_keys
        or type(plan.get("intents")) is not list
        or intent not in plan["intents"]
        or type(plan.get("steps")) is not list
    ):
        return False
    request = {
        key: plan[key]
        for key in (
            "schemaVersion",
            "query",
            "intents",
            "scopeHints",
            "minimumAssurance",
            "requestedPolicy",
            "requiredEvidenceKinds",
            "budget",
        )
    }
    availability: list[dict[str, object]] = []
    for candidate in cast(list[object], plan["steps"]):
        if type(candidate) is not dict:
            return False
        requirement = candidate.get("providerRequirement")
        if requirement is None:
            continue
        if type(requirement) is not dict:
            return False
        provider_intent = requirement.get("intent")
        status = requirement.get("status")
        if provider_intent not in PROVIDER_INTENTS or status not in PROVIDER_STATUSES:
            return False
        if status != "resolution-required":
            availability.append(
                {
                    "intent": provider_intent,
                    "status": status,
                    "readiness": "unavailable" if status == "unsupported" else status,
                }
            )
    replanned = plan_retrieval_v3(
        request, {"providerAvailability": availability}
    )
    return bool(replanned.get("success") and replanned.get("data") == plan)


def _valid_logical_ref(value: str) -> bool:
    if len(value) > 256:
        return False
    match = LOGICAL_REF.fullmatch(value)
    if match is None:
        return False
    return not any(
        term in SENSITIVE_REFERENCE_TERMS
        for term in re.split(r"[._/-]", match.group(1))
    )


def _valid_core_string_array(value: object) -> bool:
    return (
        type(value) is list
        and all(type(item) is str and bool(item.strip()) for item in value)
        and len(value) == len(set(value))
    )


def _valid_timestamp(value: object) -> bool:
    if type(value) is not str or RFC3339.fullmatch(value) is None:
        return False
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return False
    return True


def _parsed_policy(value: object) -> dict[str, object] | None:
    issues: list[dict[str, str]] = []
    parsed = _policy(value, "$policy", issues)
    return None if issues else parsed


def _policy_within(requested: dict[str, object], ceiling: dict[str, object]) -> bool:
    dimensions = (
        ("filesystem", FILESYSTEM_CEILINGS),
        ("process", PROCESS_CEILINGS),
        ("network", NETWORK_CEILINGS),
        ("credentials", CREDENTIAL_CEILINGS),
        ("privacy", PRIVACY_CEILINGS),
        ("telemetry", TELEMETRY_CEILINGS),
        ("cost", COST_CEILINGS),
    )
    try:
        if any(
            values.index(str(requested[key])) > values.index(str(ceiling[key]))
            for key, values in dimensions
        ):
            return False
        requested_destinations = cast(list[str], requested["egressDestinations"])
        ceiling_destinations = cast(list[str], ceiling["egressDestinations"])
        return all(destination in ceiling_destinations for destination in requested_destinations)
    except (KeyError, TypeError, ValueError):
        return False


def _valid_resolution(plan: dict[str, object], intent: str, value: object) -> bool:
    required_keys = {
        "schemaVersion",
        "intent",
        "minimumAssurance",
        "origin",
        "providerId",
        "providerVersion",
        "assurance",
        "readiness",
        "requestedPolicy",
        "effectivePolicy",
        "evidenceRefs",
        "freshness",
        "probedAt",
        "probeResult",
        "fallbackFromProviderId",
    }
    if (
        type(value) is not dict
        or not _is_plain_json_tree(value)
        or set(value) != required_keys
    ):
        return False
    origin = value["origin"]
    provider_id = value["providerId"]
    provider_version = value["providerVersion"]
    assurance = value["assurance"]
    readiness = value["readiness"]
    requested_policy = _parsed_policy(value["requestedPolicy"])
    effective_policy = _parsed_policy(value["effectivePolicy"])
    freshness = value["freshness"]
    probed_at = value["probedAt"]
    probe_result = value["probeResult"]
    fallback = value["fallbackFromProviderId"]
    if (
        type(value["schemaVersion"]) is not int
        or value["schemaVersion"] != 1
        or value["intent"] not in INTENT_ORDER
        or value["intent"] != intent
        or value["minimumAssurance"] not in ASSURANCE_LEVELS
        or value["minimumAssurance"] != plan["minimumAssurance"]
        or origin not in ("native", "provider", "heuristic", "unsupported")
        or readiness not in PROVIDER_READINESS
        or freshness not in ("fresh", "stale", "unknown", "not-applicable")
        or probe_result not in ("passed", "failed", "not-run")
        or (provider_id is not None and (type(provider_id) is not str or LOGICAL_ID.fullmatch(provider_id) is None))
        or (provider_version is not None and (type(provider_version) is not str or SEMVER.fullmatch(provider_version) is None))
        or (assurance is not None and assurance not in ASSURANCE_LEVELS)
        or (fallback is not None and (type(fallback) is not str or LOGICAL_ID.fullmatch(fallback) is None))
        or requested_policy is None
        or fingerprint_pactile_contract_v1(requested_policy)
        != fingerprint_pactile_contract_v1(plan["requestedPolicy"])
        or not _valid_core_string_array(value["evidenceRefs"])
    ):
        return False
    if origin == "unsupported":
        return False
    if (
        provider_id is None
        or provider_version is None
        or assurance is None
        or effective_policy is None
        or readiness != "ready"
        or not _policy_within(effective_policy, requested_policy)
        or ASSURANCE_LEVELS.index(assurance)
        < ASSURANCE_LEVELS.index(str(plan["minimumAssurance"]))
    ):
        return False
    if assurance in ("evidence-backed", "verified") and not value["evidenceRefs"]:
        return False
    if assurance == "verified" and (
        freshness != "fresh"
        or probe_result != "passed"
        or not _valid_timestamp(probed_at)
    ):
        return False
    if probed_at is not None and not _valid_timestamp(probed_at):
        return False
    if probe_result == "not-run" and probed_at is not None:
        return False
    if probe_result != "not-run" and probed_at is None:
        return False
    if provider_id is not None and fallback == provider_id:
        return False
    return True


def _rejected(intent: str, reasons: list[str], evidence_refs: list[str] | None = None) -> dict[str, object]:
    unique = set(reasons)
    return {
        "schemaVersion": RETRIEVAL_ABI_VERSION,
        "intent": intent,
        "accepted": False,
        "achievedAssurance": None,
        "evidenceRefs": list(evidence_refs or []),
        "reasonCodes": [code for code in REASON_CODES if code in unique],
    }


def assess_retrieval_claim_v3(value: object) -> dict[str, object]:
    """Assess facts without treating ranking confidence as evidence."""
    intent = "exact"
    try:
        if (
            type(value) is not dict
            or not _is_plain_json_tree(value)
            or any(
                key
                not in {
                    "plan",
                    "intent",
                    "candidateRefs",
                    "corroboration",
                    "resolution",
                    "providerScore",
                }
                for key in value
            )
        ):
            return _rejected(intent, ["invalid-evidence"])
        raw_intent = value.get("intent")
        if raw_intent not in INTENT_ORDER:
            return _rejected(intent, ["invalid-evidence"])
        intent = cast(str, raw_intent)
        plan = value.get("plan")
        if intent not in INTENT_ORDER or not _valid_plan(plan, intent):
            return _rejected(intent, ["invalid-plan"])
        plan = cast(dict[str, object], plan)
        required_evidence_kinds = cast(list[str], plan["requiredEvidenceKinds"])
        plan_steps = cast(list[dict[str, object]], plan["steps"])
        candidate_refs = _normalized_refs(value.get("candidateRefs"))
        facts = _normalized_facts(value.get("corroboration"))
        if candidate_refs is None or facts is None:
            return _rejected(intent, ["invalid-evidence"])
        evidence_refs = sorted(
            set(candidate_refs + [fact["ref"] for fact in facts]), key=_utf8_key
        )
        reasons: list[str] = []
        if not candidate_refs:
            reasons.append("candidate-missing")
        fact_kinds = {fact["kind"] for fact in facts}
        if any(kind not in fact_kinds for kind in required_evidence_kinds):
            reasons.append("required-evidence-missing")
        has_corroboration = any(kind in CORROBORATION_KINDS for kind in fact_kinds)
        has_repeatable_test = "repeatable-test" in fact_kinds
        if intent != "exact" and not has_corroboration:
            reasons.append("corroboration-required")
        step = next((item for item in plan_steps if item.get("intent") == intent), None)
        requirement = step.get("providerRequirement") if type(step) is dict else None
        status = (
            requirement.get("status")
            if type(requirement) is dict
            else None
        )
        status_reasons = {
            "degraded": "provider-degraded",
            "unavailable": "provider-unavailable",
            "unsupported": "provider-unsupported",
        }
        if status in status_reasons:
            reasons.append(status_reasons[status])
        resolution_valid = intent == "exact" or _valid_resolution(
            plan, intent, value.get("resolution")
        )
        if intent != "exact" and not resolution_valid:
            reasons.append("minimum-assurance-not-met")
        minimum = str(plan["minimumAssurance"])
        achieved: str | None
        if minimum == "best-effort":
            achieved = "best-effort"
        elif not has_corroboration:
            achieved = None
        elif minimum == "evidence-backed":
            achieved = "evidence-backed"
        else:
            achieved = "verified" if has_repeatable_test else None
        if achieved is None:
            reasons.append(
                "repeatable-verification-required"
                if minimum == "verified"
                else "minimum-assurance-not-met"
            )
        resolution = value.get("resolution")
        if minimum == "verified" and intent != "exact" and (
            not resolution_valid
            or type(resolution) is not dict
            or resolution.get("assurance") != "verified"
        ):
            reasons.append("verified-provider-proof-required")
        if reasons or achieved is None:
            return _rejected(intent, reasons, evidence_refs)
        return {
            "schemaVersion": RETRIEVAL_ABI_VERSION,
            "intent": intent,
            "accepted": True,
            "achievedAssurance": achieved,
            "evidenceRefs": evidence_refs,
            "reasonCodes": [],
        }
    except (AttributeError, KeyError, TypeError, UnicodeError, ValueError):
        return _rejected(intent, ["invalid-evidence"])


def codebase_retrieval_selected_from_capabilities(
    _capabilities: dict[str, Any] | None,
) -> bool:
    """Compatibility helper; V3 capability resolution is deferred."""
    return True


def load_capabilities_json(repo_root: Path | None) -> dict[str, Any] | None:
    """Compatibility reader retained for callers that inspect project metadata."""
    if repo_root is None:
        return None
    path = repo_root / ".pactile" / "capabilities.json"
    if not path.is_file():
        return None
    try:
        parsed = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError):
        return None
    return parsed if type(parsed) is dict else None


def resolve_router_envelope(
    _repo_root: Path | None,
    *,
    explicit_router: dict[str, Any] | None = None,
    query: str | None = None,
    **_compatibility_metadata: object,
) -> dict[str, object] | None:
    """Validate an explicit V3 request/plan or build a plan from a query."""
    if type(explicit_router) is dict:
        explicit_intents = explicit_router.get("intents")
        first_intent = (
            explicit_intents[0]
            if type(explicit_intents) is list and explicit_intents
            else "exact"
        )
        if _valid_plan(explicit_router, str(first_intent)):
            return dict(explicit_router)
        parsed = parse_retrieval_request_v3(explicit_router)
        if parsed["success"]:
            planned = plan_retrieval_v3(parsed["data"])
            return (
                dict(cast(dict[str, object], planned["data"]))
                if planned["success"]
                else None
            )
        explicit_query = explicit_router.get("query")
        if type(explicit_query) is str and explicit_query.strip():
            return route_codebase_retrieval(explicit_query)
    normalized = re.sub(r"\s+", " ", query or "").strip()
    return route_codebase_retrieval(normalized) if normalized else None
