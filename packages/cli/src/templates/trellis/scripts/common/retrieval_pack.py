#!/usr/bin/env python3
"""
Orchestrate retrieval evidence scoring and context pack building.

Pure functions only. Does not run Smart Search, artifact search, session memory
search, network calls, MCP tools, or codebase retrieval.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from common.codebase_retrieval_router import resolve_router_envelope
from common.context_pack import build_context_pack
from common.retrieval_adapter_metadata import build_evidence_envelope
from common.retrieval_evidence import ScoredEvidence, resolve_cross_source_conflicts, score_evidence_bundle

ORCHESTRATOR_VERSION = 1
ORCHESTRATOR_SOURCE = "retrieval-pack-orchestrator"


def build_retrieval_pack(
    retrieval_guide: dict[str, Any] | None = None,
    *,
    artifact_search_results: list[dict[str, Any]] | None = None,
    session_memory_results: list[dict[str, Any]] | None = None,
    smart_search_manifests: list[dict[str, Any]] | None = None,
    smart_search_manifest_paths: list[str] | None = None,
    codebase_candidates: list[dict[str, Any]] | None = None,
    repo_root: Path | str | None = None,
    max_items: int | None = None,
    max_estimated_tokens: int | None = None,
    include_diagnostics: bool = False,
    router_envelope: dict[str, Any] | None = None,
    adapter_hints: list[dict[str, Any]] | None = None,
) -> dict[str, object]:
    """Score and pack already-collected retrieval evidence into one payload."""
    warnings: list[str] = []
    guide = dict_value(retrieval_guide)
    recommendations = list_value(guide.get("recommendations"))
    selected_task_artifacts = dict_value(guide.get("selectedTaskArtifacts"))

    artifact_results = normalize_dict_list(artifact_search_results)
    memory_results = normalize_dict_list(session_memory_results)
    candidate_results = normalize_dict_list(codebase_candidates)

    manifests = collect_smart_search_manifests(
        repo_root=resolve_repo_root(repo_root),
        selected_task_artifacts=selected_task_artifacts,
        explicit_manifests=normalize_dict_list(smart_search_manifests),
        manifest_paths=list_value(smart_search_manifest_paths),
        warnings=warnings,
    )

    bundle: dict[str, Any] = {}
    if recommendations:
        bundle["recommendations"] = recommendations
    if selected_task_artifacts:
        bundle["selectedTaskArtifacts"] = selected_task_artifacts
    if artifact_results:
        bundle["artifactSearchResults"] = artifact_results
    if memory_results:
        bundle["sessionMemoryResults"] = memory_results
    if manifests:
        bundle["smartSearchManifests"] = manifests
    if candidate_results:
        bundle["codebaseCandidates"] = candidate_results

    collection = {
        "recommendations": len(recommendations),
        "artifactSearchResults": len(artifact_results),
        "sessionMemoryResults": len(memory_results),
        "smartSearchManifests": len(manifests),
        "codebaseCandidates": len(candidate_results),
    }

    scored_evidence = score_evidence_bundle(bundle)

    # RB-010: Cross-source arbitration
    query_intent = None
    if router_envelope and isinstance(router_envelope, dict):
        intents = router_envelope.get("intents", [])
        if intents and isinstance(intents[0], dict):
            query_intent = intents[0].get("id")

    scored_items = _reconstruct_scored_items(scored_evidence)
    arbitrated_evidence = resolve_cross_source_conflicts(
        scored_items, query_intent=query_intent
    )

    scored_evidence_compat = {
        **scored_evidence,
        "items": arbitrated_evidence.get("items", []),
    }

    context_pack = build_context_pack(
        scored_evidence_compat,
        max_items=max_items,
        max_estimated_tokens=max_estimated_tokens,
        include_diagnostics=include_diagnostics,
    )

    evidence_envelope = build_evidence_envelope(
        bundle=bundle,
        scored_evidence=scored_evidence,
        collection=collection,
        orchestrator_warnings=warnings,
        router_envelope=router_envelope,
        adapter_hints=adapter_hints,
        arbitrated_evidence=arbitrated_evidence,
    )

    return {
        "version": ORCHESTRATOR_VERSION,
        "source": ORCHESTRATOR_SOURCE,
        "bundle": bundle,
        "scoredEvidence": scored_evidence,
        "arbitratedEvidence": arbitrated_evidence,
        "contextPack": context_pack,
        "collection": collection,
        "warnings": warnings,
        "evidenceEnvelope": evidence_envelope,
    }


def _reconstruct_scored_items(scored_evidence: dict[str, Any]) -> list[ScoredEvidence]:
    """Reconstruct ScoredEvidence objects from scored evidence JSON items."""
    items: list[ScoredEvidence] = []
    for item_dict in scored_evidence.get("items", []):
        if not isinstance(item_dict, dict):
            continue
        items.append(
            ScoredEvidence(
                source=item_dict.get("source", ""),
                kind=item_dict.get("kind", ""),
                reference=item_dict.get("reference", ""),
                title=item_dict.get("title", ""),
                status=item_dict.get("status", ""),
                trust=item_dict.get("trust", ""),
                confidence=item_dict.get("confidence", ""),
                relevance=item_dict.get("relevance", 0),
                freshness=item_dict.get("freshness", 0),
                source_authority=item_dict.get("sourceAuthority", 0),
                validation_state=item_dict.get("validationState", ""),
                score=item_dict.get("score", 0),
                reasons=item_dict.get("reasons", []),
                warnings=item_dict.get("warnings", []),
            )
        )
    return items


def collect_smart_search_manifests(
    *,
    repo_root: Path | None,
    selected_task_artifacts: dict[str, Any],
    explicit_manifests: list[dict[str, Any]],
    manifest_paths: list[str],
    warnings: list[str],
) -> list[dict[str, Any]]:
    """Merge caller-provided manifests with read-only path and task discovery."""
    merged: dict[str, dict[str, Any]] = {}

    for manifest in explicit_manifests:
        key = manifest_key(manifest)
        merged[key] = manifest

    if repo_root is not None:
        for manifest_path in manifest_paths:
            loaded = load_manifest_path(repo_root, manifest_path, warnings)
            if loaded is not None:
                merged[manifest_key(loaded)] = loaded

        task_path = string_value(selected_task_artifacts.get("taskPath"))
        for manifest in discover_task_manifests(repo_root, task_path, warnings):
            merged[manifest_key(manifest)] = manifest

    return [merged[key] for key in sorted(merged)]


def discover_task_manifests(
    repo_root: Path,
    task_path: str | None,
    warnings: list[str],
) -> list[dict[str, Any]]:
    if not task_path:
        return []

    evidence_root = resolve_task_evidence_root(repo_root, task_path, warnings)
    if evidence_root is None:
        return []
    if not evidence_root.is_dir():
        return []

    manifests: list[dict[str, Any]] = []
    for run_dir in sorted(evidence_root.iterdir(), key=lambda path: path.name):
        if not run_dir.is_dir():
            continue
        manifest_file = run_dir / "manifest.json"
        if not manifest_file.is_file():
            continue
        loaded = load_manifest_file(repo_root, manifest_file, warnings)
        if loaded is not None:
            manifests.append(loaded)
    return manifests


def resolve_task_evidence_root(
    repo_root: Path,
    task_path: str,
    warnings: list[str],
) -> Path | None:
    candidate = Path(task_path)
    if not candidate.is_absolute():
        candidate = repo_root / candidate
    task_root = candidate.resolve()
    resolved_repo_root = repo_root.resolve()
    try:
        task_root.relative_to(resolved_repo_root)
    except ValueError:
        warnings.append(
            f"selected task path is outside repo_root and was ignored: {task_path}"
        )
        return None
    return task_root / "research" / "smart-search"


def load_manifest_path(
    repo_root: Path,
    manifest_path: str,
    warnings: list[str],
) -> dict[str, Any] | None:
    normalized = manifest_path.strip()
    if not normalized:
        return None

    candidate = Path(normalized)
    if not candidate.is_absolute():
        candidate = repo_root / candidate
    return load_manifest_file(repo_root, candidate, warnings)


def load_manifest_file(
    repo_root: Path,
    manifest_file: Path,
    warnings: list[str],
) -> dict[str, Any] | None:
    try:
        raw = manifest_file.read_text(encoding="utf-8")
    except OSError as error:
        warnings.append(
            f"could not read Smart Search manifest {to_repo_path(manifest_file, repo_root)}: {error}"
        )
        return None

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as error:
        warnings.append(
            f"invalid Smart Search manifest JSON at {to_repo_path(manifest_file, repo_root)}: {error}"
        )
        return None

    if not isinstance(parsed, dict):
        warnings.append(
            f"Smart Search manifest at {to_repo_path(manifest_file, repo_root)} must be a JSON object"
        )
        return None

    manifest = dict(parsed)
    if not string_value(manifest.get("manifestPath")):
        manifest["manifestPath"] = to_repo_path(manifest_file, repo_root)
    return manifest


def manifest_key(manifest: dict[str, Any]) -> str:
    return (
        string_value(manifest.get("manifestPath"))
        or string_value(manifest.get("evidenceDir"))
        or json.dumps(manifest, sort_keys=True, ensure_ascii=False)
    )


def resolve_repo_root(repo_root: Path | str | None) -> Path | None:
    if repo_root is None:
        return None
    return Path(repo_root).resolve()


def to_repo_path(path: Path, repo_root: Path) -> str:
    try:
        return path.resolve().relative_to(repo_root.resolve()).as_posix()
    except ValueError:
        return str(path)


def normalize_dict_list(values: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    if not values:
        return []
    return [item for item in values if isinstance(item, dict)]


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Score and pack already-collected retrieval evidence.",
    )
    parser.add_argument(
        "--input",
        help="Path to orchestrator input JSON. Defaults to stdin when omitted.",
    )
    parser.add_argument(
        "--root",
        help="Repository root for read-only Smart Search manifest discovery.",
    )
    parser.add_argument(
        "--max-items",
        type=int,
        default=None,
        help="Maximum number of selected evidence items.",
    )
    parser.add_argument(
        "--max-estimated-tokens",
        type=int,
        default=None,
        help="Maximum estimated token budget for selected items.",
    )
    parser.add_argument(
        "--include-diagnostics",
        action="store_true",
        help="Include failed/unavailable evidence in selected output when budget allows.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit JSON to stdout.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        payload = read_input_payload(args.input)
    except (OSError, json.JSONDecodeError) as error:
        print(f"retrieval pack error: {error}", file=sys.stderr)
        return 1

    if not isinstance(payload, dict):
        print("retrieval pack error: input must be a JSON object", file=sys.stderr)
        return 1

    result = build_retrieval_pack(
        retrieval_guide=dict_value(payload.get("retrievalGuide")),
        artifact_search_results=normalize_dict_list(
            list_value(payload.get("artifactSearchResults"))
        ),
        session_memory_results=normalize_dict_list(
            list_value(payload.get("sessionMemoryResults"))
        ),
        smart_search_manifests=normalize_dict_list(
            list_value(payload.get("smartSearchManifests"))
        ),
        smart_search_manifest_paths=[
            path
            for path in (string_value(item) for item in list_value(payload.get("smartSearchManifestPaths")))
            if path
        ],
        codebase_candidates=normalize_dict_list(
            list_value(payload.get("codebaseCandidates"))
        ),
        repo_root=args.root,
        max_items=args.max_items,
        max_estimated_tokens=args.max_estimated_tokens,
        include_diagnostics=args.include_diagnostics,
        router_envelope=resolve_router_envelope(
            resolve_repo_root(args.root),
            explicit_router=dict_value(payload.get("routerEnvelope")) or None,
            query=string_value(payload.get("query")) or None,
        ),
        adapter_hints=normalize_dict_list(list_value(payload.get("adapterHints"))),
    )

    if args.json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        print(json.dumps(result, ensure_ascii=False))
    return 0


def read_input_payload(input_path: str | None) -> object:
    if input_path:
        with open(input_path, encoding="utf-8") as handle:
            return json.load(handle)
    if sys.stdin.isatty():
        return {}
    return json.load(sys.stdin)


def dict_value(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def list_value(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def string_value(value: Any) -> str | None:
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return None


if __name__ == "__main__":
    raise SystemExit(main())
