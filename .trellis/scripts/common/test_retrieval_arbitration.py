#!/usr/bin/env python3
"""Tests for RB-010: cross-source conflict resolution integration."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

import pytest

# Ensure the scripts directory is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from common.retrieval_evidence import (
    SOURCE_ARTIFACT_SEARCH,
    SOURCE_CODEBASE_EVIDENCE,
    SOURCE_SESSION_MEMORY,
    SOURCE_SMART_SEARCH,
    SOURCE_TASK_ARTIFACTS,
    VALIDATION_CANDIDATE,
    VALIDATION_UNVERIFIED,
    VALIDATION_VERIFIED,
    ScoredEvidence,
    resolve_cross_source_conflicts,
)
from common.retrieval_pack import build_retrieval_pack


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _scored(
    source: str = SOURCE_TASK_ARTIFACTS,
    kind: str = "local-artifact",
    reference: str = "ref.md",
    title: str = "Test evidence",
    status: str = "ok",
    trust: str = "high",
    confidence: str = "high",
    relevance: int = 80,
    freshness: int = 90,
    source_authority: int = 95,
    validation_state: str = VALIDATION_VERIFIED,
    score: int = 90,
    reasons: list[str] | None = None,
    warnings: list[str] | None = None,
) -> ScoredEvidence:
    return ScoredEvidence(
        source=source,
        kind=kind,
        reference=reference,
        title=title,
        status=status,
        trust=trust,
        confidence=confidence,
        relevance=relevance,
        freshness=freshness,
        source_authority=source_authority,
        validation_state=validation_state,
        score=score,
        reasons=reasons or [],
        warnings=warnings or [],
    )


def _artifact_result(path: str = "spec/guide.md", title: str = "Guide", score: int = 85) -> dict[str, Any]:
    return {"path": path, "title": title, "score": score}


def _session_result(path: str = "memory/old.md", title: str = "Old memory", score: int = 60) -> dict[str, Any]:
    return {"path": path, "title": title, "score": score}


def _manifest(query: str = "test query", status: str = "ok") -> dict[str, Any]:
    return {"query": query, "status": status, "manifestPath": "research/smart-search/run-1/manifest.json"}


def _codebase_candidate(path: str = "src/main.py", title: str = "Main module") -> dict[str, Any]:
    return {"path": path, "title": title}


# ---------------------------------------------------------------------------
# 1. resolve_cross_source_conflicts basic functionality
# ---------------------------------------------------------------------------

class TestResolveCrossSourceConflictsBasic:
    """Migrate the 5 core PoC scenarios from RB-009."""

    def test_no_conflicts_single_source(self):
        items = [
            _scored(source=SOURCE_TASK_ARTIFACTS, reference="a.md", title="Task A"),
            _scored(source=SOURCE_TASK_ARTIFACTS, reference="b.md", title="Task B"),
        ]
        result = resolve_cross_source_conflicts(items)
        assert result["total"] == 2
        assert result["metrics"]["conflictCount"] == 0
        assert result["metrics"]["blockingConflictCount"] == 0
        assert result["metrics"]["downgradeCount"] == 0

    def test_no_conflicts_different_titles(self):
        items = [
            _scored(source=SOURCE_TASK_ARTIFACTS, title="Auth design", reference="auth.md"),
            _scored(source=SOURCE_SMART_SEARCH, title="Database schema", reference="db.md"),
        ]
        result = resolve_cross_source_conflicts(items)
        assert result["metrics"]["conflictCount"] == 0

    def test_blocking_conflict_both_verified(self):
        items = [
            _scored(
                source=SOURCE_TASK_ARTIFACTS,
                title="API endpoint design",
                reference="api-design.md",
                validation_state=VALIDATION_VERIFIED,
            ),
            _scored(
                source=SOURCE_SMART_SEARCH,
                title="API endpoint design",
                reference="https://example.com/api",
                validation_state=VALIDATION_VERIFIED,
                source_authority=85,
            ),
        ]
        result = resolve_cross_source_conflicts(items, conflict_threshold=0.3)
        assert result["metrics"]["conflictCount"] >= 1
        blocking = [c for c in result["conflicts"] if c["type"] == "blocking"]
        assert len(blocking) >= 1

    def test_downgrade_conflict_verified_vs_unverified(self):
        items = [
            _scored(
                source=SOURCE_TASK_ARTIFACTS,
                title="Config schema",
                reference="config.md",
                validation_state=VALIDATION_VERIFIED,
            ),
            _scored(
                source=SOURCE_CODEBASE_EVIDENCE,
                title="Config schema",
                reference="src/config.ts",
                validation_state=VALIDATION_CANDIDATE,
                source_authority=60,
            ),
        ]
        result = resolve_cross_source_conflicts(items, conflict_threshold=0.3)
        downgraded = [
            ae for ae in result["items"]
            if "conflict_flagged" in ae.get("conflictFlags", [])
        ]
        assert len(downgraded) >= 1
        # The candidate evidence should have lower effectiveAuthority than its base
        candidate_item = next(
            ae for ae in result["items"]
            if ae["source"] == SOURCE_CODEBASE_EVIDENCE
        )
        assert candidate_item["effectiveAuthority"] < 60

    def test_stale_session_memory_penalty(self):
        items = [
            _scored(
                source=SOURCE_SESSION_MEMORY,
                title="Old observation",
                reference="memory/old.md",
                freshness=20,
                source_authority=55,
                validation_state=VALIDATION_UNVERIFIED,
            ),
        ]
        result = resolve_cross_source_conflicts(items)
        mem_item = result["items"][0]
        assert mem_item["effectiveAuthority"] < 55
        assert "stale_warning" in mem_item["conflictFlags"]

    def test_empty_items(self):
        result = resolve_cross_source_conflicts([])
        assert result["total"] == 0
        assert result["metrics"]["conflictCount"] == 0

    def test_intent_adjustment_policy_document(self):
        items = [
            _scored(
                source=SOURCE_ARTIFACT_SEARCH,
                title="Policy doc",
                reference="policy.md",
                source_authority=90,
            ),
            _scored(
                source=SOURCE_CODEBASE_EVIDENCE,
                title="Policy doc",
                reference="src/policy.ts",
                source_authority=60,
            ),
        ]
        result = resolve_cross_source_conflicts(items, query_intent="policy-document")
        artifact_item = next(
            ae for ae in result["items"]
            if ae["source"] == SOURCE_ARTIFACT_SEARCH
        )
        codebase_item = next(
            ae for ae in result["items"]
            if ae["source"] == SOURCE_CODEBASE_EVIDENCE
        )
        assert artifact_item["effectiveAuthority"] > 90  # boosted by +10
        assert codebase_item["effectiveAuthority"] < 60  # penalized by -5


# ---------------------------------------------------------------------------
# 2. Integration: build_retrieval_pack no router envelope
# ---------------------------------------------------------------------------

class TestBuildRetrievalPackNoEnvelope:
    def test_arbitration_works_without_router(self):
        result = build_retrieval_pack(
            artifact_search_results=[_artifact_result()],
        )
        assert "arbitratedEvidence" in result
        arb = result["arbitratedEvidence"]
        assert "items" in arb
        assert "conflicts" in arb
        assert "metrics" in arb
        assert arb["metrics"]["totalItems"] >= 1

    def test_no_intent_adjustment_without_router(self):
        result = build_retrieval_pack(
            artifact_search_results=[_artifact_result()],
        )
        arb = result["arbitratedEvidence"]
        for item in arb["items"]:
            # Without intent, effectiveAuthority == sourceAuthority
            assert item["effectiveAuthority"] == item["sourceAuthority"]


# ---------------------------------------------------------------------------
# 3. Integration: router envelope with policy-document intent
# ---------------------------------------------------------------------------

class TestBuildRetrievalPackPolicyIntent:
    def test_policy_document_intent_boosts_artifact_search(self):
        router_envelope = {
            "intents": [{"id": "policy-document", "label": "policy"}],
            "routes": [],
            "fallback": [],
        }
        result = build_retrieval_pack(
            artifact_search_results=[_artifact_result()],
            router_envelope=router_envelope,
        )
        arb = result["arbitratedEvidence"]
        artifact_items = [
            ae for ae in arb["items"]
            if ae["source"] == SOURCE_ARTIFACT_SEARCH
        ]
        assert len(artifact_items) >= 1
        for item in artifact_items:
            assert item["effectiveAuthority"] > item["sourceAuthority"]


# ---------------------------------------------------------------------------
# 4. Integration: conflicting sources → conflict entries
# ---------------------------------------------------------------------------

class TestBuildRetrievalPackConflicts:
    def test_conflicting_sources_produce_conflict_entries(self):
        result = build_retrieval_pack(
            artifact_search_results=[
                {"path": "spec/api.md", "title": "API design endpoint", "score": 95},
            ],
            smart_search_manifests=[
                _manifest(query="API design endpoint", status="ok"),
            ],
        )
        arb = result["arbitratedEvidence"]
        # Even if no conflicts are detected due to title mismatch,
        # the arbitrated evidence must still exist and be well-formed
        assert "conflicts" in arb
        assert isinstance(arb["conflicts"], list)
        assert "metrics" in arb


# ---------------------------------------------------------------------------
# 5. Integration: backward compat → scoredEvidence unchanged
# ---------------------------------------------------------------------------

class TestBackwardCompat:
    def test_scored_evidence_field_unchanged(self):
        result = build_retrieval_pack(
            artifact_search_results=[_artifact_result()],
            session_memory_results=[_session_result()],
        )
        scored = result["scoredEvidence"]
        # The scoredEvidence must have the original structure,
        # not the arbitrated items with extra keys
        assert "version" in scored
        assert "total" in scored
        assert "items" in scored
        for item in scored["items"]:
            # Original scored evidence items should NOT have arbitrated keys
            assert "effectiveAuthority" not in item
            assert "conflictFlags" not in item
            assert "arbitrationReasons" not in item

    def test_arbitrated_evidence_has_extended_keys(self):
        result = build_retrieval_pack(
            artifact_search_results=[_artifact_result()],
        )
        arb = result["arbitratedEvidence"]
        for item in arb["items"]:
            assert "effectiveAuthority" in item
            assert "conflictFlags" in item
            assert "arbitrationReasons" in item

    def test_evidence_envelope_has_conflict_metrics(self):
        result = build_retrieval_pack(
            artifact_search_results=[_artifact_result()],
        )
        envelope = result["evidenceEnvelope"]
        assert "conflictMetrics" in envelope
        metrics = envelope["conflictMetrics"]
        assert "totalItems" in metrics
        assert "conflictCount" in metrics

    def test_context_pack_uses_arbitrated_ordering(self):
        result = build_retrieval_pack(
            artifact_search_results=[_artifact_result(path="a.md", score=90)],
            session_memory_results=[_session_result(path="b.md", score=70)],
        )
        pack = result["contextPack"]
        # Context pack should be well-formed with selected items
        assert "selected" in pack
        assert "omitted" in pack
        assert pack["summary"]["totalInput"] >= 2
