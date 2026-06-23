#!/usr/bin/env python3
"""
Adapter availability, freshness, fallback, and verification metadata for retrieval.

Pure functions only. Does not invoke rg, MCP, CodeGraph, Smart Search, browser,
or network tools.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from common.cursor_retrieval_env import ENV_BYOK, detect_cursor_retrieval_env
from common.retrieval_evidence import (
    SOURCE_ARTIFACT_SEARCH,
    SOURCE_CODEBASE_EVIDENCE,
    SOURCE_SESSION_MEMORY,
    SOURCE_SMART_SEARCH,
    SOURCE_TASK_ARTIFACTS,
    STATUS_DEGRADED,
    STATUS_FAILED,
    STATUS_MISSING,
    STATUS_NOT_CONFIGURED,
    STATUS_OK,
    list_value,
    string_value,
)

EVIDENCE_ENVELOPE_VERSION = 1

ADAPTER_RG = "rg"
ADAPTER_CODEGRAPH = "codegraph"
ADAPTER_LSP = "language-server"
ADAPTER_FAST_CONTEXT = "fast-context-mcp"
ADAPTER_PLATFORM_SEMANTIC = "platform-semantic"
ADAPTER_SMART_SEARCH = "smart-search"
ADAPTER_ARTIFACT_SEARCH = "artifact-search"
ADAPTER_SESSION_MEMORY = "session-memory"
ADAPTER_TASK_ARTIFACTS = "task-artifacts"
ADAPTER_CODEBASE_EVIDENCE = "codebase-evidence"
ADAPTER_MCP = "mcp"
ADAPTER_BROWSER = "browser"
ADAPTER_NETWORK = "network"
ADAPTER_VERIFICATION = "source-git-tests"

STATE_AVAILABLE = "available"
STATE_UNAVAILABLE = "unavailable"
STATE_UNVERIFIED = "unverified"
STATE_STALE = "stale"
STATE_FAILED = "failed"
STATE_SKIPPED = "skipped"

ROLE_BY_ADAPTER = {
    ADAPTER_RG: "exact",
    ADAPTER_CODEGRAPH: "ast",
    ADAPTER_LSP: "lsp",
    ADAPTER_FAST_CONTEXT: "semantic",
    ADAPTER_PLATFORM_SEMANTIC: "semantic",
    ADAPTER_SMART_SEARCH: "external",
    ADAPTER_ARTIFACT_SEARCH: "local-artifact",
    ADAPTER_SESSION_MEMORY: "historical-context",
    ADAPTER_TASK_ARTIFACTS: "local-artifact",
    ADAPTER_CODEBASE_EVIDENCE: "candidate-evidence",
    ADAPTER_MCP: "integration",
    ADAPTER_BROWSER: "integration",
    ADAPTER_NETWORK: "integration",
    ADAPTER_VERIFICATION: "verification",
}

REQUIRED_ADAPTERS = frozenset({ADAPTER_RG, ADAPTER_VERIFICATION})
OPTIONAL_INTEGRATION_ADAPTERS = (
    ADAPTER_CODEGRAPH,
    ADAPTER_LSP,
    ADAPTER_MCP,
    ADAPTER_BROWSER,
    ADAPTER_NETWORK,
)


def empty_evidence_envelope() -> dict[str, object]:
    return {
        "version": EVIDENCE_ENVELOPE_VERSION,
        "intents": [],
        "routes": [],
        "adapterState": [],
        "freshness": [],
        "fallback": [],
        "warnings": [],
        "verification": [],
    }


def build_evidence_envelope(
    *,
    bundle: dict[str, Any],
    scored_evidence: dict[str, object],
    collection: dict[str, int],
    orchestrator_warnings: list[str],
    router_envelope: dict[str, Any] | None = None,
    adapter_hints: list[dict[str, Any]] | None = None,
    arbitrated_evidence: dict[str, Any] | None = None,
) -> dict[str, object]:
    """Build the shared parent evidence envelope for retrieval pack output."""
    envelope = empty_evidence_envelope()
    router = dict_value(router_envelope)
    if router:
        envelope["intents"] = normalize_envelope_list(router.get("intents"))
        envelope["routes"] = normalize_envelope_list(router.get("routes"))
        envelope["fallback"] = normalize_envelope_list(router.get("fallback"))
        envelope["warnings"] = normalize_warning_list(router.get("warnings"))
        envelope["verification"] = normalize_envelope_list(router.get("verification"))

    if arbitrated_evidence:
        envelope["conflictMetrics"] = arbitrated_evidence.get("metrics", {})

    hints = index_adapter_hints(adapter_hints)
    recommendations = list_value(bundle.get("recommendations"))
    recommended_sources = {
        string_value(item.get("source"))
        for item in recommendations
        if isinstance(item, dict) and string_value(item.get("source"))
    }

    adapter_states = build_adapter_states(
        bundle=bundle,
        collection=collection,
        scored_items=list_value(scored_evidence.get("items")),
        recommended_sources=recommended_sources,
        hints=hints,
        router=router,
    )
    freshness = build_freshness_signals(adapter_states, scored_items=list_value(scored_evidence.get("items")))
    fallback = build_fallback_decisions(adapter_states, hints=hints)
    adapter_warnings = build_adapter_warnings(adapter_states, orchestrator_warnings)
    verification = build_verification_requirements(adapter_states, scored_items=list_value(scored_evidence.get("items")))

    envelope["adapterState"] = adapter_states
    envelope["freshness"] = freshness
    envelope["fallback"] = merge_envelope_records(
        list_value(envelope.get("fallback")),
        fallback,
        key_fields=("fromAdapter", "toAdapter", "reason", "when", "action", "replacesRole"),
    )
    envelope["warnings"] = merge_warning_strings(
        list_value(envelope.get("warnings")),
        adapter_warnings + list(orchestrator_warnings),
    )
    envelope["verification"] = merge_envelope_records(
        list_value(envelope.get("verification")),
        verification,
        key_fields=("adapter", "requirement"),
    )
    return envelope


def build_adapter_states(
    *,
    bundle: dict[str, Any],
    collection: dict[str, int],
    scored_items: list[Any],
    recommended_sources: set[str | None],
    hints: dict[str, dict[str, Any]],
    router: dict[str, Any] | None = None,
) -> list[dict[str, object]]:
    states: list[dict[str, object]] = []

    states.append(
        adapter_state_entry(
            adapter=ADAPTER_RG,
            state=resolve_hint_state(hints, ADAPTER_RG, default=STATE_AVAILABLE),
            required=True,
            invoked=bool(hints.get(ADAPTER_RG, {}).get("invoked")),
            reason=string_value(hints.get(ADAPTER_RG, {}).get("reason"))
            or "baseline exact search; optional adapters never replace rg",
        )
    )

    states.append(
        local_source_adapter_state(
            adapter=ADAPTER_TASK_ARTIFACTS,
            source=SOURCE_TASK_ARTIFACTS,
            collection_key="recommendations",
            collection=collection,
            bundle=bundle,
            recommended_sources=recommended_sources,
            hints=hints,
            present=bool(dict_value(bundle.get("selectedTaskArtifacts"))),
        )
    )
    states.append(
        local_source_adapter_state(
            adapter=ADAPTER_ARTIFACT_SEARCH,
            source=SOURCE_ARTIFACT_SEARCH,
            collection_key="artifactSearchResults",
            collection=collection,
            bundle=bundle,
            recommended_sources=recommended_sources,
            hints=hints,
            present=collection.get("artifactSearchResults", 0) > 0,
        )
    )
    states.append(
        local_source_adapter_state(
            adapter=ADAPTER_SESSION_MEMORY,
            source=SOURCE_SESSION_MEMORY,
            collection_key="sessionMemoryResults",
            collection=collection,
            bundle=bundle,
            recommended_sources=recommended_sources,
            hints=hints,
            present=collection.get("sessionMemoryResults", 0) > 0,
        )
    )

    states.append(
        smart_search_adapter_state(
            collection=collection,
            manifests=list_value(bundle.get("smartSearchManifests")),
            recommended=SOURCE_SMART_SEARCH in recommended_sources,
            scored_items=scored_items,
            hints=hints,
        )
    )
    states.append(
        codebase_adapter_state(
            collection=collection,
            recommended=SOURCE_CODEBASE_EVIDENCE in recommended_sources,
            scored_items=scored_items,
            hints=hints,
        )
    )

    for adapter in OPTIONAL_INTEGRATION_ADAPTERS:
        states.append(
            optional_integration_adapter_state(adapter=adapter, hints=hints)
        )

    states.append(
        platform_semantic_adapter_state(router=router, hints=hints)
    )
    states.append(
        fast_context_adapter_state(router=router, hints=hints)
    )

    states.append(
        adapter_state_entry(
            adapter=ADAPTER_VERIFICATION,
            state=STATE_AVAILABLE,
            required=True,
            invoked=False,
            reason="source/Git/test validation is required before final technical claims",
        )
    )

    return sort_adapter_states(states)


def local_source_adapter_state(
    *,
    adapter: str,
    source: str,
    collection_key: str,
    collection: dict[str, int],
    bundle: dict[str, Any],
    recommended_sources: set[str | None],
    hints: dict[str, dict[str, Any]],
    present: bool,
) -> dict[str, object]:
    hint = hints.get(adapter, {})
    if hint:
        return adapter_state_entry(
            adapter=adapter,
            state=resolve_hint_state(hints, adapter, default=STATE_SKIPPED),
            required=False,
            invoked=bool(hint.get("invoked")),
            reason=string_value(hint.get("reason")) or f"{adapter} adapter hint",
            source=source,
        )

    if present:
        return adapter_state_entry(
            adapter=adapter,
            state=STATE_AVAILABLE,
            required=False,
            invoked=True,
            reason=f"{adapter} evidence payload was supplied to the retrieval pack",
            source=source,
        )

    if source in recommended_sources:
        return adapter_state_entry(
            adapter=adapter,
            state=STATE_UNAVAILABLE,
            required=False,
            invoked=False,
            reason=(
                f"{source} recommended in retrieval guide but no "
                f"{collection_key} payload was collected"
            ),
            source=source,
        )

    return adapter_state_entry(
        adapter=adapter,
        state=STATE_SKIPPED,
        required=False,
        invoked=False,
        reason=f"{adapter} was not recommended and no evidence payload was provided",
        source=source,
    )


def smart_search_adapter_state(
    *,
    collection: dict[str, int],
    manifests: list[dict[str, Any]],
    recommended: bool,
    scored_items: list[Any],
    hints: dict[str, dict[str, Any]],
) -> dict[str, object]:
    hint = hints.get(ADAPTER_SMART_SEARCH, {})
    if hint and not manifests:
        return adapter_state_entry(
            adapter=ADAPTER_SMART_SEARCH,
            state=resolve_hint_state(hints, ADAPTER_SMART_SEARCH, default=STATE_SKIPPED),
            required=False,
            invoked=bool(hint.get("invoked")),
            reason=string_value(hint.get("reason")) or "smart-search adapter hint",
            source=SOURCE_SMART_SEARCH,
        )

    if not manifests:
        if recommended:
            return adapter_state_entry(
                adapter=ADAPTER_SMART_SEARCH,
                state=STATE_UNAVAILABLE,
                required=False,
                invoked=False,
                reason="smart-search recommended but no manifest payload was collected",
                source=SOURCE_SMART_SEARCH,
            )
        return adapter_state_entry(
            adapter=ADAPTER_SMART_SEARCH,
            state=STATE_SKIPPED,
            required=False,
            invoked=False,
            reason="smart-search was not invoked for this retrieval pack",
            source=SOURCE_SMART_SEARCH,
        )

    statuses = [
        string_value(manifest.get("status")) or STATUS_FAILED for manifest in manifests
    ]
    if any(status == STATUS_FAILED for status in statuses):
        state = STATE_FAILED
        reason = "one or more Smart Search manifests report failed status"
    elif any(status == STATUS_NOT_CONFIGURED for status in statuses):
        state = STATE_UNAVAILABLE
        reason = "Smart Search is not configured for this project"
    elif any(status == STATUS_DEGRADED for status in statuses):
        state = STATE_UNVERIFIED
        reason = "Smart Search returned degraded evidence; confirm with durable sources"
    elif all(status == STATUS_OK for status in statuses):
        state = STATE_UNVERIFIED
        reason = (
            f"{collection.get('smartSearchManifests', 0)} manifest(s) collected; "
            "external evidence still requires source validation"
        )
    else:
        state = STATE_UNVERIFIED
        reason = "Smart Search manifests present with mixed status"

    scored = find_scored_item(scored_items, SOURCE_SMART_SEARCH)
    if scored and string_value(scored.get("status")) == STATUS_MISSING:
        state = STATE_UNAVAILABLE
        reasons = scored.get("reasons")
        first_reason = reasons[0] if isinstance(reasons, list) and reasons else ""
        reason = string_value(first_reason) or reason

    return adapter_state_entry(
        adapter=ADAPTER_SMART_SEARCH,
        state=state,
        required=False,
        invoked=True,
        reason=reason,
        source=SOURCE_SMART_SEARCH,
        detail={"manifestCount": len(manifests), "statuses": statuses},
    )


def codebase_adapter_state(
    *,
    collection: dict[str, int],
    recommended: bool,
    scored_items: list[Any],
    hints: dict[str, dict[str, Any]],
) -> dict[str, object]:
    hint = hints.get(ADAPTER_CODEBASE_EVIDENCE, {})
    if hint and collection.get("codebaseCandidates", 0) == 0:
        return adapter_state_entry(
            adapter=ADAPTER_CODEBASE_EVIDENCE,
            state=resolve_hint_state(hints, ADAPTER_CODEBASE_EVIDENCE, default=STATE_SKIPPED),
            required=False,
            invoked=bool(hint.get("invoked")),
            reason=string_value(hint.get("reason")) or "codebase-evidence adapter hint",
            source=SOURCE_CODEBASE_EVIDENCE,
        )

    if collection.get("codebaseCandidates", 0) > 0:
        return adapter_state_entry(
            adapter=ADAPTER_CODEBASE_EVIDENCE,
            state=STATE_UNVERIFIED,
            required=False,
            invoked=True,
            reason="codebase candidate payload supplied; confirm with current source or Git",
            source=SOURCE_CODEBASE_EVIDENCE,
        )

    if recommended:
        return adapter_state_entry(
            adapter=ADAPTER_CODEBASE_EVIDENCE,
            state=STATE_UNAVAILABLE,
            required=False,
            invoked=False,
            reason="codebase-evidence recommended but no candidate payload was collected",
            source=SOURCE_CODEBASE_EVIDENCE,
        )

    return adapter_state_entry(
        adapter=ADAPTER_CODEBASE_EVIDENCE,
        state=STATE_SKIPPED,
        required=False,
        invoked=False,
        reason="codebase-evidence was not collected for this retrieval pack",
        source=SOURCE_CODEBASE_EVIDENCE,
    )


def resolve_cursor_env_for_adapter_metadata(
    router: dict[str, Any] | None,
) -> str:
    """native | byok | unknown for retrieval-pack adapter reasons."""
    router = router or {}
    env = string_value(router.get("cursorEnv"))
    if env in ("native", "byok", "unknown"):
        return env
    return detect_cursor_retrieval_env()


def platform_semantic_adapter_state(
    *,
    router: dict[str, Any] | None,
    hints: dict[str, dict[str, Any]],
) -> dict[str, object]:
    hint = hints.get(ADAPTER_PLATFORM_SEMANTIC, {})
    if hint:
        return adapter_state_entry(
            adapter=ADAPTER_PLATFORM_SEMANTIC,
            state=resolve_hint_state(hints, ADAPTER_PLATFORM_SEMANTIC, default=STATE_SKIPPED),
            required=False,
            invoked=bool(hint.get("invoked")),
            reason=string_value(hint.get("reason")) or "platform-semantic adapter hint",
        )
    env = resolve_cursor_env_for_adapter_metadata(router)
    if env == ENV_BYOK:
        reason = (
            "Cursor++ BYOK: built-in codebase semantic often absent (Experiment D); "
            "concept recall Primary is fast-context MCP per router cursorEnv"
        )
        state = STATE_UNAVAILABLE
    elif env == "native":
        reason = (
            "Cursor Native: built-in codebase semantic (e.g. SemanticSearch / @codebase) "
            "is Primary for concept recall"
        )
        state = STATE_AVAILABLE
    else:
        reason = (
            "Cursor platform-semantic: Native uses built-in search; BYOK uses fast-context "
            "when cursorEnv is byok (see cursor_retrieval_env)"
        )
        state = STATE_UNVERIFIED
    return adapter_state_entry(
        adapter=ADAPTER_PLATFORM_SEMANTIC,
        state=state,
        required=False,
        invoked=False,
        reason=reason,
    )


def fast_context_adapter_state(
    *,
    router: dict[str, Any] | None,
    hints: dict[str, dict[str, Any]],
) -> dict[str, object]:
    hint = hints.get(ADAPTER_FAST_CONTEXT, {})
    if hint:
        return adapter_state_entry(
            adapter=ADAPTER_FAST_CONTEXT,
            state=resolve_hint_state(hints, ADAPTER_FAST_CONTEXT, default=STATE_SKIPPED),
            required=False,
            invoked=bool(hint.get("invoked")),
            reason=string_value(hint.get("reason")) or "fast-context-mcp adapter hint",
        )
    env = resolve_cursor_env_for_adapter_metadata(router)
    if env == ENV_BYOK:
        reason = (
            "Cursor++ BYOK: fast_context_search is compliant Primary for concept recall "
            "(select codebase-retrieval at init for .cursor/mcp.json fast-context entry)"
        )
        state = STATE_AVAILABLE
    elif env == "native":
        reason = (
            "Cursor Native: prefer built-in platform-semantic; fast-context is optional "
            "and misuse when plan requires native semantic"
        )
        state = STATE_SKIPPED
    else:
        reason = (
            "fast-context MCP: required for BYOK concept recall on Cursor when "
            "codebase-retrieval capability is selected"
        )
        state = STATE_UNVERIFIED
    return adapter_state_entry(
        adapter=ADAPTER_FAST_CONTEXT,
        state=state,
        required=False,
        invoked=False,
        reason=reason,
    )


def optional_integration_adapter_state(
    *,
    adapter: str,
    hints: dict[str, dict[str, Any]],
) -> dict[str, object]:
    hint = hints.get(adapter, {})
    if hint:
        return adapter_state_entry(
            adapter=adapter,
            state=resolve_hint_state(hints, adapter, default=STATE_SKIPPED),
            required=False,
            invoked=bool(hint.get("invoked")),
            reason=string_value(hint.get("reason")) or f"{adapter} adapter hint",
        )

    return adapter_state_entry(
        adapter=adapter,
        state=STATE_SKIPPED,
        required=False,
        invoked=False,
        reason=(
            f"{adapter} is optional and was not invoked by the retrieval pack orchestrator"
        ),
    )


def build_freshness_signals(
    adapter_states: list[dict[str, object]],
    *,
    scored_items: list[Any],
) -> list[dict[str, object]]:
    signals: list[dict[str, object]] = []
    now = utc_now_iso()

    for entry in adapter_states:
        adapter = string_value(entry.get("adapter")) or ""
        state = string_value(entry.get("state")) or STATE_SKIPPED
        score, stale, note = freshness_for_adapter(adapter, state, scored_items)
        signals.append(
            {
                "adapter": adapter,
                "role": ROLE_BY_ADAPTER.get(adapter, "adapter"),
                "freshnessScore": score,
                "stale": stale,
                "checkedAt": now,
                "state": state,
                "note": note,
            }
        )
    return signals


def freshness_for_adapter(
    adapter: str,
    state: str,
    scored_items: list[Any],
) -> tuple[int, bool, str]:
    if state in {STATE_UNAVAILABLE, STATE_FAILED, STATE_SKIPPED}:
        return 0, state == STATE_STALE, "freshness not applicable while adapter is not usable"

    if adapter == ADAPTER_RG:
        return 100, False, "exact search baseline assumed available without host probe"

    if adapter == ADAPTER_VERIFICATION:
        return 90, False, "verification layer is always required for final claims"

    scored = scored_item_for_adapter(adapter, scored_items)
    if scored is not None:
        freshness = int(scored.get("freshness", 50))
        stale = freshness < 40 or state == STATE_STALE
        note = (
            f"derived from scored evidence freshness={freshness} "
            f"validationState={string_value(scored.get('validationState')) or 'unknown'}"
        )
        return freshness, stale, note

    if state == STATE_STALE:
        return 25, True, "adapter marked stale without scored evidence payload"

    if state == STATE_UNVERIFIED:
        return 45, False, "adapter output is present but unverified"

    return 60, False, "default freshness for collected local evidence"


def build_fallback_decisions(
    adapter_states: list[dict[str, object]],
    *,
    hints: dict[str, dict[str, Any]],
) -> list[dict[str, object]]:
    decisions: list[dict[str, object]] = []
    by_adapter = {string_value(item.get("adapter")): item for item in adapter_states}

    for adapter in (
        ADAPTER_CODEGRAPH,
        ADAPTER_LSP,
        ADAPTER_FAST_CONTEXT,
        ADAPTER_SMART_SEARCH,
        ADAPTER_CODEBASE_EVIDENCE,
        ADAPTER_MCP,
        ADAPTER_BROWSER,
        ADAPTER_NETWORK,
    ):
        entry = by_adapter.get(adapter)
        if entry is None:
            continue
        state = string_value(entry.get("state")) or STATE_SKIPPED
        if state in {STATE_AVAILABLE, STATE_UNVERIFIED} and adapter in OPTIONAL_INTEGRATION_ADAPTERS:
            continue
        if adapter in {ADAPTER_SMART_SEARCH, ADAPTER_CODEBASE_EVIDENCE}:
            if state == STATE_UNVERIFIED and adapter == ADAPTER_CODEBASE_EVIDENCE:
                decisions.append(
                    fallback_entry(
                        from_adapter=adapter,
                        to_adapter=ADAPTER_RG,
                        reason="codebase candidates require rg and file-range confirmation",
                    )
                )
                continue
            if state == STATE_UNVERIFIED and adapter == ADAPTER_SMART_SEARCH:
                decisions.append(
                    fallback_entry(
                        from_adapter=adapter,
                        to_adapter=ADAPTER_TASK_ARTIFACTS,
                        reason=(
                            "Smart Search unverified; prefer durable task artifacts"
                        ),
                    )
                )
                decisions.append(
                    fallback_entry(
                        from_adapter=adapter,
                        to_adapter=ADAPTER_RG,
                        reason="Smart Search gaps require exact search and source reads",
                    )
                )
                continue
            if adapter == ADAPTER_SMART_SEARCH and state in {STATE_UNAVAILABLE, STATE_FAILED}:
                decisions.append(
                    fallback_entry(
                        from_adapter=adapter,
                        to_adapter=ADAPTER_TASK_ARTIFACTS,
                        reason=(
                            "Smart Search unavailable or failed; prefer durable task artifacts"
                        ),
                    )
                )
                decisions.append(
                    fallback_entry(
                        from_adapter=adapter,
                        to_adapter=ADAPTER_RG,
                        reason="Smart Search gaps require exact search and source reads",
                    )
                )
                continue
        if state == STATE_SKIPPED and adapter in OPTIONAL_INTEGRATION_ADAPTERS:
            decisions.append(
                fallback_entry(
                    from_adapter=adapter,
                    to_adapter=ADAPTER_RG,
                    reason=(
                        f"{adapter} skipped; continue with rg and direct source reads"
                    ),
                )
            )
            continue
        if state in {STATE_UNAVAILABLE, STATE_FAILED, STATE_STALE}:
            decisions.append(
                fallback_entry(
                    from_adapter=adapter,
                    to_adapter=ADAPTER_RG,
                    reason=(
                        f"{adapter} {state}; label evidence unverified and fall back to rg"
                    ),
                )
            )
            continue
    for adapter, hint in sorted(hints.items()):
        explicit = list_value(hint.get("fallback"))
        for item in explicit:
            if not isinstance(item, dict):
                continue
            from_adapter = string_value(item.get("fromAdapter")) or adapter
            to_adapter = string_value(item.get("toAdapter")) or ADAPTER_RG
            reason = string_value(item.get("reason")) or "caller-provided fallback"
            decisions.append(
                fallback_entry(
                    from_adapter=from_adapter,
                    to_adapter=to_adapter,
                    reason=reason,
                )
            )

    return merge_envelope_records(
        decisions,
        [],
        key_fields=("fromAdapter", "toAdapter", "reason", "when", "action", "replacesRole"),
    )


def build_adapter_warnings(
    adapter_states: list[dict[str, object]],
    orchestrator_warnings: list[str],
) -> list[str]:
    warnings: list[str] = []
    for entry in adapter_states:
        adapter = string_value(entry.get("adapter")) or ""
        state = string_value(entry.get("state")) or ""
        required = bool(entry.get("required"))
        if required and state in {STATE_UNAVAILABLE, STATE_FAILED}:
            warnings.append(f"required adapter {adapter} is {state}")
        if state == STATE_STALE:
            warnings.append(f"adapter {adapter} evidence is stale; confirm with current source")
        if state == STATE_FAILED:
            warnings.append(f"adapter {adapter} failed; do not treat its output as evidence")
        if adapter in OPTIONAL_INTEGRATION_ADAPTERS and state == STATE_SKIPPED:
            warnings.append(
                f"optional adapter {adapter} was not invoked; retrieval pack remains offline-safe"
            )
    return merge_warning_strings([], warnings)


def build_verification_requirements(
    adapter_states: list[dict[str, object]],
    *,
    scored_items: list[Any],
) -> list[dict[str, object]]:
    requirements: list[dict[str, object]] = [
        {
            "adapter": ADAPTER_VERIFICATION,
            "requirement": "confirm final claims with current source reads and focused validation",
            "blocking": True,
        },
        {
            "adapter": ADAPTER_RG,
            "requirement": "corroborate identifiers and literals with rg before relying on semantic recall",
            "blocking": False,
        },
    ]

    for entry in adapter_states:
        adapter = string_value(entry.get("adapter")) or ""
        state = string_value(entry.get("state")) or ""
        if adapter == ADAPTER_SMART_SEARCH and state in {
            STATE_UNVERIFIED,
            STATE_FAILED,
            STATE_UNAVAILABLE,
        }:
            requirements.append(
                {
                    "adapter": adapter,
                    "requirement": "do not treat Smart Search output as confirmed without durable validation",
                    "blocking": state in {STATE_FAILED, STATE_UNAVAILABLE},
                }
            )
        if adapter == ADAPTER_CODEBASE_EVIDENCE and state == STATE_UNVERIFIED:
            requirements.append(
                {
                    "adapter": adapter,
                    "requirement": "promote codebase candidates only after Git or source-range confirmation",
                    "blocking": False,
                }
            )
        if adapter == ADAPTER_CODEGRAPH and state in {STATE_UNVERIFIED, STATE_STALE}:
            requirements.append(
                {
                    "adapter": adapter,
                    "requirement": "confirm CodeGraph structural output against current source before impact claims",
                    "blocking": False,
                }
            )

    for item in scored_items:
        if not isinstance(item, dict):
            continue
        if string_value(item.get("validationState")) == "candidate":
            requirements.append(
                {
                    "adapter": string_value(item.get("source")) or ADAPTER_CODEBASE_EVIDENCE,
                    "requirement": "candidate scored evidence requires explicit validation",
                    "blocking": False,
                }
            )
    return merge_envelope_records(requirements, [], key_fields=("adapter", "requirement"))


def adapter_state_entry(
    *,
    adapter: str,
    state: str,
    required: bool,
    invoked: bool,
    reason: str,
    source: str | None = None,
    detail: dict[str, object] | None = None,
) -> dict[str, object]:
    payload: dict[str, object] = {
        "adapter": adapter,
        "role": ROLE_BY_ADAPTER.get(adapter, "adapter"),
        "state": state,
        "required": required,
        "invoked": invoked,
        "reason": reason[:240],
    }
    if source:
        payload["source"] = source
    if detail:
        payload["detail"] = detail
    return payload


def fallback_entry(
    *,
    from_adapter: str,
    to_adapter: str,
    reason: str,
) -> dict[str, object]:
    return {
        "fromAdapter": from_adapter,
        "toAdapter": to_adapter,
        "reason": reason[:240],
        "origin": "adapter-metadata",
    }


def resolve_hint_state(
    hints: dict[str, dict[str, Any]],
    adapter: str,
    *,
    default: str,
) -> str:
    hint = hints.get(adapter, {})
    state = string_value(hint.get("state"))
    if state in {
        STATE_AVAILABLE,
        STATE_UNAVAILABLE,
        STATE_UNVERIFIED,
        STATE_STALE,
        STATE_FAILED,
        STATE_SKIPPED,
    }:
        return state
    return default


def index_adapter_hints(
    adapter_hints: list[dict[str, Any]] | None,
) -> dict[str, dict[str, Any]]:
    indexed: dict[str, dict[str, Any]] = {}
    for item in adapter_hints or []:
        if not isinstance(item, dict):
            continue
        adapter = string_value(item.get("adapter"))
        if adapter:
            indexed[adapter] = item
    return indexed


def scored_item_for_adapter(adapter: str, scored_items: list[Any]) -> dict[str, Any] | None:
    source = {
        ADAPTER_TASK_ARTIFACTS: SOURCE_TASK_ARTIFACTS,
        ADAPTER_ARTIFACT_SEARCH: SOURCE_ARTIFACT_SEARCH,
        ADAPTER_SESSION_MEMORY: SOURCE_SESSION_MEMORY,
        ADAPTER_SMART_SEARCH: SOURCE_SMART_SEARCH,
        ADAPTER_CODEBASE_EVIDENCE: SOURCE_CODEBASE_EVIDENCE,
    }.get(adapter)
    if not source:
        return None
    return find_scored_item(scored_items, source)


def find_scored_item(scored_items: list[Any], source: str) -> dict[str, Any] | None:
    for item in scored_items:
        if isinstance(item, dict) and string_value(item.get("source")) == source:
            return item
    return None


def sort_adapter_states(states: list[dict[str, object]]) -> list[dict[str, object]]:
    order = [
        ADAPTER_RG,
        ADAPTER_TASK_ARTIFACTS,
        ADAPTER_ARTIFACT_SEARCH,
        ADAPTER_SESSION_MEMORY,
        ADAPTER_SMART_SEARCH,
        ADAPTER_CODEBASE_EVIDENCE,
        *OPTIONAL_INTEGRATION_ADAPTERS,
        ADAPTER_VERIFICATION,
    ]
    rank = {name: index for index, name in enumerate(order)}
    return sorted(states, key=lambda item: rank.get(string_value(item.get("adapter")) or "", 99))


def normalize_envelope_list(value: Any) -> list[dict[str, object]]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def normalize_warning_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [text for text in (string_value(item) for item in value) if text]


def merge_envelope_records(
    primary: list[Any],
    secondary: list[Any],
    *,
    key_fields: tuple[str, ...],
) -> list[dict[str, object]]:
    merged: list[dict[str, object]] = []
    seen: set[tuple[str, ...]] = set()
    for bucket in (primary, secondary):
        for item in bucket:
            if not isinstance(item, dict):
                continue
            key = tuple(string_value(item.get(field)) or "" for field in key_fields)
            if key in seen:
                continue
            seen.add(key)
            merged.append(dict(item))
    return merged


def merge_warning_strings(primary: list[Any], secondary: list[str]) -> list[str]:
    merged: list[str] = []
    seen: set[str] = set()
    for bucket in (primary, secondary):
        for item in bucket:
            text = string_value(item) if not isinstance(item, str) else item.strip()
            if not text or text in seen:
                continue
            seen.add(text)
            merged.append(text[:240])
    return merged


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def dict_value(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}
