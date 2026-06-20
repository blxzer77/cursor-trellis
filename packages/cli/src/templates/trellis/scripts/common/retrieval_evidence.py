#!/usr/bin/env python3
"""
Normalize Phase 2 retrieval evidence into comparable scored evidence.

This module exposes pure functions only. It does not run Smart Search,
network calls, MCP tools, or codebase search.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

EVIDENCE_VERSION = 1

SOURCE_TASK_ARTIFACTS = "task-artifacts"
SOURCE_ARTIFACT_SEARCH = "artifact-search"
SOURCE_SESSION_MEMORY = "session-memory"
SOURCE_SMART_SEARCH = "smart-search"
SOURCE_CODEBASE_EVIDENCE = "codebase-evidence"

SOURCES = (
    SOURCE_TASK_ARTIFACTS,
    SOURCE_ARTIFACT_SEARCH,
    SOURCE_SESSION_MEMORY,
    SOURCE_SMART_SEARCH,
    SOURCE_CODEBASE_EVIDENCE,
)

STATUS_OK = "ok"
STATUS_DEGRADED = "degraded"
STATUS_FAILED = "failed"
STATUS_NOT_CONFIGURED = "not_configured"
STATUS_MISSING = "missing"

STATUSES = (
    STATUS_OK,
    STATUS_DEGRADED,
    STATUS_FAILED,
    STATUS_NOT_CONFIGURED,
    STATUS_MISSING,
)

VALIDATION_VERIFIED = "verified"
VALIDATION_UNVERIFIED = "unverified"
VALIDATION_CANDIDATE = "candidate"
VALIDATION_UNAVAILABLE = "unavailable"
VALIDATION_FAILED = "failed"

VALIDATION_STATES = (
    VALIDATION_VERIFIED,
    VALIDATION_UNVERIFIED,
    VALIDATION_CANDIDATE,
    VALIDATION_UNAVAILABLE,
    VALIDATION_FAILED,
)

SOURCE_ORDER = {
    SOURCE_TASK_ARTIFACTS: 0,
    SOURCE_ARTIFACT_SEARCH: 1,
    SOURCE_SESSION_MEMORY: 2,
    SOURCE_SMART_SEARCH: 3,
    SOURCE_CODEBASE_EVIDENCE: 4,
}

KIND_BY_SOURCE = {
    SOURCE_TASK_ARTIFACTS: "local-artifact",
    SOURCE_ARTIFACT_SEARCH: "local-artifact",
    SOURCE_SESSION_MEMORY: "historical-context",
    SOURCE_SMART_SEARCH: "external-evidence",
    SOURCE_CODEBASE_EVIDENCE: "candidate-evidence",
}

SOURCE_AUTHORITY = {
    SOURCE_TASK_ARTIFACTS: 95,
    SOURCE_ARTIFACT_SEARCH: 90,
    SOURCE_SESSION_MEMORY: 55,
    SOURCE_SMART_SEARCH: 85,
    SOURCE_CODEBASE_EVIDENCE: 60,
}

BASE_TRUST = {
    SOURCE_TASK_ARTIFACTS: "high",
    SOURCE_ARTIFACT_SEARCH: "high",
    SOURCE_SESSION_MEMORY: "medium",
    SOURCE_SMART_SEARCH: "high",
    SOURCE_CODEBASE_EVIDENCE: "medium",
}

TRUST_SCORE = {"high": 100, "medium": 70, "low": 40}

MAX_UPSTREAM_SCORE = 100
MAX_RECOMMENDATION_PRIORITY = 100


@dataclass
class ScoredEvidence:
    source: str
    kind: str
    reference: str
    title: str
    status: str
    trust: str
    confidence: str
    relevance: int
    freshness: int
    source_authority: int
    validation_state: str
    score: int
    reasons: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def to_json(self) -> dict[str, object]:
        return {
            "version": EVIDENCE_VERSION,
            "source": self.source,
            "kind": self.kind,
            "reference": self.reference,
            "title": self.title,
            "status": self.status,
            "trust": self.trust,
            "confidence": self.confidence,
            "relevance": self.relevance,
            "freshness": self.freshness,
            "sourceAuthority": self.source_authority,
            "validationState": self.validation_state,
            "score": self.score,
            "reasons": list(self.reasons),
            "warnings": list(self.warnings),
        }


def score_evidence_bundle(bundle: dict[str, Any]) -> dict[str, object]:
    """Score all evidence inputs in a retrieval bundle and return stable JSON."""
    items: list[ScoredEvidence] = []

    selected_artifacts = dict_value(bundle.get("selectedTaskArtifacts"))
    recommendations = list_value(bundle.get("recommendations"))
    recommendation_by_source = index_recommendations(recommendations)

    if selected_artifacts or recommendation_by_source.get(SOURCE_TASK_ARTIFACTS):
        items.extend(
            score_task_artifacts(
                selected_artifacts,
                recommendation_by_source.get(SOURCE_TASK_ARTIFACTS),
            )
        )

    for result in list_value(bundle.get("artifactSearchResults")):
        if isinstance(result, dict):
            items.append(
                score_artifact_search_result(
                    result,
                    recommendation_by_source.get(SOURCE_ARTIFACT_SEARCH),
                )
            )

    for result in list_value(bundle.get("sessionMemoryResults")):
        if isinstance(result, dict):
            items.append(
                score_session_memory_result(
                    result,
                    recommendation_by_source.get(SOURCE_SESSION_MEMORY),
                )
            )

    for manifest in list_value(bundle.get("smartSearchManifests")):
        if isinstance(manifest, dict):
            items.append(
                score_smart_search_manifest(
                    manifest,
                    recommendation_by_source.get(SOURCE_SMART_SEARCH),
                )
            )

    for candidate in list_value(bundle.get("codebaseCandidates")):
        if isinstance(candidate, dict):
            items.append(
                score_codebase_candidate(
                    candidate,
                    recommendation_by_source.get(SOURCE_CODEBASE_EVIDENCE),
                )
            )

    # Availability / missing signals for recommended sources without evidence.
    consumed_sources = {item.source for item in items}
    items.extend(
        score_missing_recommendations(
            recommendations,
            consumed_sources,
            has_smart_search_manifests=bool(bundle.get("smartSearchManifests")),
        )
    )

    sorted_items = sort_scored_evidence(items)
    return {
        "version": EVIDENCE_VERSION,
        "total": len(sorted_items),
        "items": [item.to_json() for item in sorted_items],
    }


def score_task_artifacts(
    artifacts: dict[str, Any],
    recommendation: dict[str, Any] | None,
) -> list[ScoredEvidence]:
    if not artifacts and not recommendation:
        return []

    task_path = string_value(artifacts.get("taskPath")) or string_value(
        (recommendation or {}).get("reference")
    ) or ""
    if not task_path:
        return []

    present_labels: list[str] = []
    for key, label in (
        ("prd", "prd.md"),
        ("design", "design.md"),
        ("implement", "implement.md"),
        ("verify", "verify.md"),
    ):
        if artifacts.get(key):
            present_labels.append(label)
    if artifacts.get("research"):
        count = int_value(artifacts.get("researchCount"))
        if count:
            present_labels.append(f"research/ ({count} file(s))")
        else:
            present_labels.append("research/")

    if not present_labels:
        if recommendation:
            return [
                _build_scored(
                    source=SOURCE_TASK_ARTIFACTS,
                    reference=task_path,
                    title="Selected task artifacts",
                    status=STATUS_MISSING,
                    trust="high",
                    confidence=string_value(recommendation.get("confidence")) or "high",
                    relevance=scale_priority(int_value(recommendation.get("priority"))),
                    freshness=90,
                    source_authority=SOURCE_AUTHORITY[SOURCE_TASK_ARTIFACTS],
                    validation_state=VALIDATION_UNAVAILABLE,
                    reasons=[
                        "task-artifacts recommended but no local artifacts are present",
                    ],
                    warnings=["missing selected-task artifacts"],
                )
            ]
        return []

    relevance = scale_priority(int_value((recommendation or {}).get("priority"), 100))
    confidence = string_value((recommendation or {}).get("confidence")) or "high"
    title = f"Task artifacts: {', '.join(present_labels)}"
    return [
        _build_scored(
            source=SOURCE_TASK_ARTIFACTS,
            reference=task_path,
            title=title,
            status=STATUS_OK,
            trust=BASE_TRUST[SOURCE_TASK_ARTIFACTS],
            confidence=confidence,
            relevance=relevance,
            freshness=95,
            source_authority=SOURCE_AUTHORITY[SOURCE_TASK_ARTIFACTS],
            validation_state=VALIDATION_VERIFIED,
            reasons=[
                "durable selected-task artifacts are present",
                "local planning and verification files outrank memory and candidates",
            ],
            warnings=[],
        )
    ]


def score_artifact_search_result(
    result: dict[str, Any],
    recommendation: dict[str, Any] | None,
) -> ScoredEvidence:
    reference = string_value(result.get("path")) or ""
    title = string_value(result.get("title")) or reference or "Artifact search result"
    upstream_score = int_value(result.get("score"))
    relevance = scale_upstream_score(upstream_score)
    if recommendation:
        relevance = max(relevance, scale_priority(int_value(recommendation.get("priority"), 90)))

    confidence = string_value((recommendation or {}).get("confidence")) or "high"
    reasons = ["durable Trellis markdown artifact match"]
    matched_fields = list_value(result.get("matched_fields"))
    if matched_fields:
        reasons.append(f"matched fields: {', '.join(str(item) for item in matched_fields)}")

    return _build_scored(
        source=SOURCE_ARTIFACT_SEARCH,
        reference=reference,
        title=title,
        status=STATUS_OK,
        trust=BASE_TRUST[SOURCE_ARTIFACT_SEARCH],
        confidence=confidence,
        relevance=relevance,
        freshness=80,
        source_authority=SOURCE_AUTHORITY[SOURCE_ARTIFACT_SEARCH],
        validation_state=VALIDATION_VERIFIED,
        reasons=reasons,
        warnings=[],
    )


def score_session_memory_result(
    result: dict[str, Any],
    recommendation: dict[str, Any] | None,
) -> ScoredEvidence:
    reference = string_value(result.get("path")) or ""
    line = int_value(result.get("line"))
    if line:
        reference = f"{reference}:{line}"
    title = string_value(result.get("title")) or "Session memory"
    upstream_score = int_value(result.get("score"))
    relevance = scale_upstream_score(upstream_score)
    if recommendation:
        relevance = max(relevance, scale_priority(int_value(recommendation.get("priority"), 80)))

    confidence = string_value((recommendation or {}).get("confidence")) or "medium"
    freshness = freshness_from_date(string_value(result.get("date")))
    reason = string_value(result.get("reason"))
    reasons = ["local session memory is historical context, not authoritative proof"]
    if reason:
        reasons.append(reason)

    return _build_scored(
        source=SOURCE_SESSION_MEMORY,
        reference=reference,
        title=title,
        status=STATUS_OK,
        trust=BASE_TRUST[SOURCE_SESSION_MEMORY],
        confidence=confidence,
        relevance=relevance,
        freshness=freshness,
        source_authority=SOURCE_AUTHORITY[SOURCE_SESSION_MEMORY],
        validation_state=VALIDATION_UNVERIFIED,
        reasons=reasons,
        warnings=["confirm against durable task artifacts and current source"],
    )


def score_smart_search_manifest(
    manifest: dict[str, Any],
    recommendation: dict[str, Any] | None,
) -> ScoredEvidence:
    reference = (
        string_value(manifest.get("manifestPath"))
        or string_value(manifest.get("evidenceDir"))
        or ""
    )
    title = string_value(manifest.get("query")) or "Smart Search evidence"
    manifest_status = string_value(manifest.get("status")) or STATUS_FAILED
    confidence = string_value((recommendation or {}).get("confidence")) or "medium"
    relevance = scale_priority(int_value((recommendation or {}).get("priority"), 70))
    freshness = freshness_from_iso(string_value(manifest.get("createdAt")))

    if manifest_status == STATUS_OK:
        return _build_scored(
            source=SOURCE_SMART_SEARCH,
            reference=reference,
            title=title,
            status=STATUS_OK,
            trust=BASE_TRUST[SOURCE_SMART_SEARCH],
            confidence=confidence,
            relevance=max(relevance, 75),
            freshness=freshness,
            source_authority=SOURCE_AUTHORITY[SOURCE_SMART_SEARCH],
            validation_state=VALIDATION_UNVERIFIED,
            reasons=[
                "source-backed external evidence",
                "manifest status ok",
                "current source validation still required",
            ],
            warnings=[],
        )

    if manifest_status == STATUS_DEGRADED:
        summary = string_value(manifest.get("summary"))
        reasons = [
            "source-backed external evidence with gaps",
            "manifest status degraded",
        ]
        if summary:
            reasons.append(summary[:120])
        return _build_scored(
            source=SOURCE_SMART_SEARCH,
            reference=reference,
            title=title,
            status=STATUS_DEGRADED,
            trust="medium",
            confidence="low",
            relevance=max(relevance, 55),
            freshness=freshness,
            source_authority=SOURCE_AUTHORITY[SOURCE_SMART_SEARCH] - 15,
            validation_state=VALIDATION_UNVERIFIED,
            reasons=reasons,
            warnings=["degraded Smart Search evidence; review gap explanation"],
            status_penalty=15,
        )

    if manifest_status == STATUS_NOT_CONFIGURED:
        error = string_value(manifest.get("error")) or "Smart Search is not configured"
        return _build_scored(
            source=SOURCE_SMART_SEARCH,
            reference=reference,
            title=title,
            status=STATUS_NOT_CONFIGURED,
            trust="low",
            confidence="low",
            relevance=min(relevance, 20),
            freshness=freshness,
            source_authority=20,
            validation_state=VALIDATION_UNAVAILABLE,
            reasons=[
                "availability signal only; Smart Search is not configured",
                error[:120],
            ],
            warnings=["not_configured Smart Search must not be treated as evidence"],
            score_cap=12,
        )

    error = string_value(manifest.get("error")) or "Smart Search run failed"
    return _build_scored(
        source=SOURCE_SMART_SEARCH,
        reference=reference,
        title=title,
        status=STATUS_FAILED,
        trust="low",
        confidence="low",
        relevance=min(relevance, 15),
        freshness=freshness,
        source_authority=15,
        validation_state=VALIDATION_FAILED,
        reasons=[
            "availability signal only; Smart Search run failed",
            error[:120],
        ],
        warnings=["failed Smart Search must not be treated as positive evidence"],
        score_cap=8,
    )


def score_codebase_candidate(
    candidate: dict[str, Any],
    recommendation: dict[str, Any] | None,
) -> ScoredEvidence:
    reference = (
        string_value(candidate.get("reference"))
        or string_value(candidate.get("path"))
        or string_value((recommendation or {}).get("reference"))
        or "current source tree"
    )
    title = string_value(candidate.get("title")) or "Codebase candidate evidence"
    upstream_score = int_value(candidate.get("score"))
    relevance = scale_upstream_score(upstream_score) if upstream_score else 50
    if recommendation:
        relevance = max(relevance, scale_priority(int_value(recommendation.get("priority"), 60)))

    confidence = string_value(candidate.get("confidence")) or string_value(
        (recommendation or {}).get("confidence")
    ) or "medium"
    status = string_value(candidate.get("status")) or STATUS_OK
    validation_state = VALIDATION_CANDIDATE
    warnings = ["candidate evidence requires current source, Git, or validation confirmation"]
    reasons = [
        string_value(candidate.get("reason"))
        or string_value((recommendation or {}).get("reason"))
        or "codebase retrieval is candidate evidence until validated",
    ]

    return _build_scored(
        source=SOURCE_CODEBASE_EVIDENCE,
        reference=reference,
        title=title,
        status=status,
        trust=BASE_TRUST[SOURCE_CODEBASE_EVIDENCE],
        confidence=confidence,
        relevance=relevance,
        freshness=int_value(candidate.get("freshness"), 50),
        source_authority=SOURCE_AUTHORITY[SOURCE_CODEBASE_EVIDENCE],
        validation_state=validation_state,
        reasons=reasons,
        warnings=warnings,
        status_penalty=10 if status != STATUS_OK else 0,
    )


def score_missing_recommendations(
    recommendations: list[dict[str, Any]],
    consumed_sources: set[str],
    has_smart_search_manifests: bool,
) -> list[ScoredEvidence]:
    items: list[ScoredEvidence] = []
    for recommendation in recommendations:
        if not isinstance(recommendation, dict):
            continue
        source = string_value(recommendation.get("source")) or ""
        if source not in SOURCES or source in consumed_sources:
            continue
        if source == SOURCE_SMART_SEARCH and has_smart_search_manifests:
            continue
        if source == SOURCE_TASK_ARTIFACTS:
            continue

        reference = string_value(recommendation.get("reference")) or source
        title = f"Missing {source} evidence"
        items.append(
            _build_scored(
                source=source,
                reference=reference,
                title=title,
                status=STATUS_MISSING,
                trust="low",
                confidence=string_value(recommendation.get("confidence")) or "low",
                relevance=scale_priority(int_value(recommendation.get("priority"))),
                freshness=30,
                source_authority=max(20, SOURCE_AUTHORITY.get(source, 30) - 40),
                validation_state=VALIDATION_UNAVAILABLE,
                reasons=[
                    f"{source} recommended but no scored evidence payload was provided",
                    string_value(recommendation.get("reason")) or "awaiting explicit retrieval",
                ],
                warnings=[f"missing {source} evidence"],
                score_cap=18,
            )
        )
    return items


def sort_scored_evidence(items: list[ScoredEvidence]) -> list[ScoredEvidence]:
    return sorted(
        items,
        key=lambda item: (
            -item.score,
            SOURCE_ORDER.get(item.source, 99),
            item.reference,
            item.title,
        ),
    )


def _build_scored(
    *,
    source: str,
    reference: str,
    title: str,
    status: str,
    trust: str,
    confidence: str,
    relevance: int,
    freshness: int,
    source_authority: int,
    validation_state: str,
    reasons: list[str],
    warnings: list[str],
    status_penalty: int = 0,
    score_cap: int | None = None,
) -> ScoredEvidence:
    trust_value = TRUST_SCORE.get(trust, 70)
    raw_score = round(
        relevance * 0.45
        + source_authority * 0.25
        + freshness * 0.15
        + trust_value * 0.15
        - status_penalty
    )
    if score_cap is not None:
        raw_score = min(raw_score, score_cap)
    score = clamp(raw_score, 0, 100)

    return ScoredEvidence(
        source=source,
        kind=KIND_BY_SOURCE.get(source, "evidence"),
        reference=reference,
        title=title,
        status=status,
        trust=trust,
        confidence=confidence,
        relevance=clamp(relevance, 0, 100),
        freshness=clamp(freshness, 0, 100),
        source_authority=clamp(source_authority, 0, 100),
        validation_state=validation_state,
        score=score,
        reasons=normalize_reasons(reasons),
        warnings=normalize_reasons(warnings),
    )


def index_recommendations(
    recommendations: list[Any],
) -> dict[str, dict[str, Any]]:
    indexed: dict[str, dict[str, Any]] = {}
    for item in recommendations:
        if not isinstance(item, dict):
            continue
        source = string_value(item.get("source"))
        if source:
            indexed[source] = item
    return indexed


def scale_priority(priority: int, default: int = 50) -> int:
    value = priority if priority > 0 else default
    return clamp(round(value / MAX_RECOMMENDATION_PRIORITY * 100), 0, 100)


def scale_upstream_score(score: int, default: int = 40) -> int:
    if score <= 0:
        return default
    return clamp(round(score / MAX_UPSTREAM_SCORE * 100), 0, 100)


def freshness_from_date(value: str | None) -> int:
    if not value:
        return 50
    try:
        parsed = datetime.strptime(value[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        return 50
    age_days = (datetime.now(timezone.utc) - parsed).days
    if age_days <= 0:
        return 95
    if age_days <= 7:
        return 85
    if age_days <= 30:
        return 70
    if age_days <= 90:
        return 55
    return 35


def freshness_from_iso(value: str | None) -> int:
    if not value:
        return 60
    normalized = value.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return freshness_from_date(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    age_days = (datetime.now(timezone.utc) - parsed).days
    if age_days <= 0:
        return 90
    if age_days <= 3:
        return 85
    if age_days <= 14:
        return 75
    if age_days <= 60:
        return 60
    return 40


def normalize_reasons(values: list[str]) -> list[str]:
    seen: set[str] = set()
    normalized: list[str] = []
    for value in values:
        text = normalize_space(value)
        if not text or text in seen:
            continue
        seen.add(text)
        normalized.append(text[:200])
    return normalized


def normalize_space(value: str) -> str:
    return " ".join(value.split()).strip()


def clamp(value: int, lower: int, upper: int) -> int:
    return max(lower, min(upper, value))


# ---------------------------------------------------------------------------
# RB-009: Cross-source conflict resolution PoC
# ---------------------------------------------------------------------------

INTENT_AUTHORITY_ADJUSTMENTS: dict[str, dict[str, int]] = {
    "policy-document": {SOURCE_ARTIFACT_SEARCH: 10, SOURCE_CODEBASE_EVIDENCE: -5},
    "caller-chain": {SOURCE_CODEBASE_EVIDENCE: 20},
    "trap-package-disambiguation": {SOURCE_CODEBASE_EVIDENCE: 15},
    "extension-shared-symbol": {SOURCE_CODEBASE_EVIDENCE: 15},
    "env-config-literal": {SOURCE_CODEBASE_EVIDENCE: 5, SOURCE_SMART_SEARCH: -10},
    "cross-cutting-discovery": {SOURCE_SMART_SEARCH: 10, SOURCE_CODEBASE_EVIDENCE: -5},
}

STALE_FRESHNESS_THRESHOLD = 50
CONFLICT_PENALTY_CANDIDATE = 5
STALE_PENALTY = 10


def _title_tokens(title: str) -> set[str]:
    return set(normalize_space(title).lower().split())


def _jaccard_similarity(tokens_a: set[str], tokens_b: set[str]) -> float:
    if not tokens_a or not tokens_b:
        return 0.0
    intersection = tokens_a & tokens_b
    union = tokens_a | tokens_b
    return len(intersection) / len(union)


def _effective_authority(
    item: ScoredEvidence,
    query_intent: str | None,
) -> int:
    base = item.source_authority
    if not query_intent:
        return base
    adjustments = INTENT_AUTHORITY_ADJUSTMENTS.get(query_intent, {})
    return clamp(base + adjustments.get(item.source, 0), 0, 100)


@dataclass
class ConflictDescriptor:
    source_a: str
    reference_a: str
    source_b: str
    reference_b: str
    conflict_type: str  # "blocking" | "downgrade" | "stale"
    resolution: str


@dataclass
class ArbitratedEvidence:
    item: ScoredEvidence
    effective_authority: int
    conflict_flags: list[str]
    arbitration_reasons: list[str]

    def to_json(self) -> dict[str, Any]:
        result = self.item.to_json()
        result["effectiveAuthority"] = self.effective_authority
        result["conflictFlags"] = list(self.conflict_flags)
        result["arbitrationReasons"] = list(self.arbitration_reasons)
        return result


def resolve_cross_source_conflicts(
    items: list[ScoredEvidence],
    *,
    query_intent: str | None = None,
    conflict_threshold: float = 0.5,
    freshness_threshold: int = STALE_FRESHNESS_THRESHOLD,
) -> dict[str, Any]:
    """Resolve cross-source conflicts in scored evidence.

    Returns dict with:
      - items: list of ArbitratedEvidence, sorted by effective authority then score
      - conflicts: list of ConflictDescriptor
      - metrics: conflict/arbitration summary
    """
    conflicts: list[ConflictDescriptor] = []
    arbitrated: list[ArbitratedEvidence] = []

    for item in items:
        effective = _effective_authority(item, query_intent)
        flags: list[str] = []
        reasons: list[str] = []

        # Stale session-memory penalty
        if item.source == SOURCE_SESSION_MEMORY and item.freshness < freshness_threshold:
            effective = clamp(effective - STALE_PENALTY, 0, 100)
            flags.append("stale_warning")
            reasons.append(
                f"session-memory freshness {item.freshness} < {freshness_threshold}; authority penalty -{STALE_PENALTY}"
            )

        arbitrated.append(
            ArbitratedEvidence(
                item=item,
                effective_authority=effective,
                conflict_flags=flags,
                arbitration_reasons=reasons,
            )
        )

    # Pairwise conflict detection
    n = len(arbitrated)
    for i in range(n):
        for j in range(i + 1, n):
            a = arbitrated[i]
            b = arbitrated[j]
            if a.item.source == b.item.source:
                continue

            tokens_a = _title_tokens(a.item.title)
            tokens_b = _title_tokens(b.item.title)
            similarity = _jaccard_similarity(tokens_a, tokens_b)
            if similarity < conflict_threshold:
                continue

            # Potential conflict detected
            a_verified = a.item.validation_state == VALIDATION_VERIFIED
            b_verified = b.item.validation_state == VALIDATION_VERIFIED

            if a_verified and b_verified:
                conflict_type = "blocking"
                resolution = (
                    f"Both sources verified and overlapping (sim={similarity:.2f}); "
                    "requires human resolution"
                )
                a.conflict_flags.append("blocking_conflict")
                b.conflict_flags.append("blocking_conflict")
                a.arbitration_reasons.append(
                    f"blocking conflict with {b.item.source}: {b.item.reference}"
                )
                b.arbitration_reasons.append(
                    f"blocking conflict with {a.item.source}: {a.item.reference}"
                )
            elif a_verified and not b_verified:
                conflict_type = "downgrade"
                resolution = (
                    f"{a.item.source} verified vs {b.item.source} {b.item.validation_state}; "
                    f"downgrading {b.item.source}"
                )
                b.effective_authority = clamp(
                    b.effective_authority - CONFLICT_PENALTY_CANDIDATE, 0, 100
                )
                b.conflict_flags.append("conflict_flagged")
                b.arbitration_reasons.append(
                    f"downgraded due to conflict with verified {a.item.source}"
                )
            elif b_verified and not a_verified:
                conflict_type = "downgrade"
                resolution = (
                    f"{b.item.source} verified vs {a.item.source} {a.item.validation_state}; "
                    f"downgrading {a.item.source}"
                )
                a.effective_authority = clamp(
                    a.effective_authority - CONFLICT_PENALTY_CANDIDATE, 0, 100
                )
                a.conflict_flags.append("conflict_flagged")
                a.arbitration_reasons.append(
                    f"downgraded due to conflict with verified {b.item.source}"
                )
            else:
                continue

            conflicts.append(
                ConflictDescriptor(
                    source_a=a.item.source,
                    reference_a=a.item.reference,
                    source_b=b.item.source,
                    reference_b=b.item.reference,
                    conflict_type=conflict_type,
                    resolution=resolution,
                )
            )

    # Re-sort by effective authority (desc) then score (desc) then source order
    arbitrated.sort(
        key=lambda ae: (
            -ae.effective_authority,
            -ae.item.score,
            SOURCE_ORDER.get(ae.item.source, 99),
        )
    )

    blocking_count = sum(1 for c in conflicts if c.conflict_type == "blocking")
    downgrade_count = sum(1 for ae in arbitrated if "conflict_flagged" in ae.conflict_flags)

    return {
        "version": 1,
        "total": len(arbitrated),
        "items": [ae.to_json() for ae in arbitrated],
        "conflicts": [
            {
                "sourceA": c.source_a,
                "referenceA": c.reference_a,
                "sourceB": c.source_b,
                "referenceB": c.reference_b,
                "type": c.conflict_type,
                "resolution": c.resolution,
            }
            for c in conflicts
        ],
        "metrics": {
            "totalItems": len(arbitrated),
            "conflictCount": len(conflicts),
            "blockingConflictCount": blocking_count,
            "downgradeCount": downgrade_count,
        },
    }


def dict_value(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


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
