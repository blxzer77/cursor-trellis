#!/usr/bin/env python3
"""Quality-layer CLI: pack already-collected evidence. Does not search.

Three-layer retrieval ABI (frozen; do not merge back into workflow.md):

| Layer    | Owner                 | This script                          |
| -------- | --------------------- | ------------------------------------ |
| Intent   | context-progressive   | does not own; does not emit intents  |
| Provider | Middleware            | does not take smart-search as Kernel  |
| Quality  | retrieval-extended    | owner: score/pack collected-evidence |

Input role: ``collected-evidence`` (path + provider label + optional freshness).
Output role: ``retrieval-pack``. Missing collection yields empty + explicit
reason. A retrieval-pack is never Close / AC Evidence (that is verify-basic).

This wrapper does not change the scoring algorithm in ``common.retrieval_pack``.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from common.retrieval_pack import (  # noqa: E402
    build_retrieval_pack,
    dict_value,
    list_value,
    normalize_dict_list,
    read_input_payload,
    resolve_repo_root,
    string_value,
)
from common.codebase_retrieval_router import resolve_router_envelope  # noqa: E402

ABI_INTENT_OWNER = "context-progressive"
ABI_PROVIDER_OWNER = "middleware"
ABI_QUALITY_OWNER = "retrieval-extended"
ABI_LAYER = "quality"
INPUT_ROLE = "collected-evidence"
OUTPUT_ROLE = "retrieval-pack"

MISSING_COLLECTION_REASON = (
    "pack requires collected-evidence (path + provider label); "
    "missing collection is not AC Evidence"
)
EMPTY_COLLECTION_REASON = (
    "collected-evidence items were present but none mapped to pack sources; "
    "empty retrieval-pack is not AC Evidence"
)
COLLECTED_NOT_AC_REASON = (
    "quality-layer retrieval-pack of collected-evidence; "
    "not AC Evidence and not Close Evidence"
)

_SMART_PROVIDERS = frozenset(
    {"smart-search", "smart_search", "external-knowledge"}
)
_MEMORY_PROVIDERS = frozenset({"session-memory", "personal-memory", "journal"})
_CODE_PROVIDERS = frozenset(
    {"codebase", "codegraph", "rg", "grep", "exact", "semantic", "structural"}
)


def stamp_retrieval_pack_abi(
    pack: dict[str, Any],
    *,
    collection_status: str,
    reason: str,
) -> dict[str, Any]:
    """Mark pack ownership. Never eligible as AC / Close Evidence."""
    stamped = dict(pack)
    stamped["inputRole"] = INPUT_ROLE
    stamped["outputRole"] = OUTPUT_ROLE
    stamped["abiLayer"] = ABI_LAYER
    stamped["abiOwner"] = ABI_QUALITY_OWNER
    stamped["abiIntentOwner"] = ABI_INTENT_OWNER
    stamped["abiProviderOwner"] = ABI_PROVIDER_OWNER
    stamped["collectionStatus"] = collection_status
    stamped["closeEvidenceEligible"] = False
    stamped["notAcEvidence"] = True
    stamped["reason"] = reason
    return stamped


def _first_str(record: dict[str, Any], *keys: str) -> str | None:
    for key in keys:
        value = string_value(record.get(key))
        if value:
            return value
    return None


def _legacy_items(payload: dict[str, Any]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for raw in normalize_dict_list(list_value(payload.get("smartSearchManifests"))):
        path = _first_str(raw, "manifestPath", "evidenceDir", "path", "reference")
        items.append(
            {
                **raw,
                "path": path or "",
                "provider": _first_str(raw, "provider", "source") or "smart-search",
                "freshness": raw.get("freshness") or raw.get("createdAt"),
            }
        )
    for path in list_value(payload.get("smartSearchManifestPaths")):
        text = string_value(path)
        if text:
            items.append({"path": text, "provider": "smart-search"})
    for raw in normalize_dict_list(list_value(payload.get("artifactSearchResults"))):
        path = _first_str(raw, "path", "reference")
        items.append(
            {
                **raw,
                "path": path or "",
                "provider": _first_str(raw, "provider", "source") or "artifact-search",
                "freshness": raw.get("freshness"),
            }
        )
    for raw in normalize_dict_list(list_value(payload.get("sessionMemoryResults"))):
        path = _first_str(raw, "path", "reference")
        items.append(
            {
                **raw,
                "path": path or "",
                "provider": _first_str(raw, "provider", "source") or "session-memory",
                "freshness": raw.get("freshness") or raw.get("date"),
            }
        )
    for raw in normalize_dict_list(list_value(payload.get("codebaseCandidates"))):
        path = _first_str(raw, "path", "reference")
        items.append(
            {
                **raw,
                "path": path or "",
                "provider": _first_str(raw, "provider", "source") or "codebase",
                "freshness": raw.get("freshness"),
            }
        )
    return items


def extract_collected_items(payload: dict[str, Any]) -> list[dict[str, Any]]:
    """Normalize payload to collected-evidence items (path + provider)."""
    explicit = payload.get("items")
    if not isinstance(explicit, list):
        explicit = payload.get("collectedEvidence")
    source = explicit if isinstance(explicit, list) else _legacy_items(payload)

    items: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for raw in source:
        if not isinstance(raw, dict):
            continue
        path = _first_str(raw, "path", "reference", "manifestPath", "evidenceDir")
        provider = _first_str(raw, "provider", "source")
        if not path or not provider:
            continue
        key = (path, provider)
        if key in seen:
            continue
        seen.add(key)
        record = dict(raw)
        record["path"] = path
        record["provider"] = provider
        freshness = raw.get("freshness")
        if freshness is not None and freshness != "":
            record["freshness"] = freshness
        items.append(record)
    return items


def _looks_like_manifest(item: dict[str, Any]) -> bool:
    if any(key in item for key in ("status", "query", "citations", "doctor")):
        return True
    path = str(item.get("path") or "")
    return path.endswith("manifest.json") and any(
        key in item for key in ("manifestPath", "evidenceDir", "source")
    )


def _items_to_inner_kwargs(
    items: list[dict[str, Any]],
    payload: dict[str, Any],
    repo_root: Path | str | None,
) -> dict[str, Any]:
    artifact_search_results: list[dict[str, Any]] = []
    session_memory_results: list[dict[str, Any]] = []
    smart_search_manifests: list[dict[str, Any]] = []
    smart_search_manifest_paths: list[str] = []
    codebase_candidates: list[dict[str, Any]] = []

    for item in items:
        provider = str(item.get("provider") or "")
        path = str(item.get("path") or "")
        record = dict(item)
        record.setdefault("reference", path)
        if provider in _SMART_PROVIDERS:
            if _looks_like_manifest(item) and ("status" in item or "query" in item):
                smart_search_manifests.append(record)
            else:
                smart_search_manifest_paths.append(path)
        elif provider in _MEMORY_PROVIDERS:
            session_memory_results.append(record)
        elif provider in _CODE_PROVIDERS:
            codebase_candidates.append(record)
        else:
            artifact_search_results.append(record)

    guide = dict_value(payload.get("retrievalGuide")) if _legacy_items(payload) else {}

    return {
        "retrieval_guide": guide or None,
        "artifact_search_results": artifact_search_results,
        "session_memory_results": session_memory_results,
        "smart_search_manifests": smart_search_manifests,
        "smart_search_manifest_paths": smart_search_manifest_paths,
        "codebase_candidates": codebase_candidates,
        "repo_root": repo_root,
        "router_envelope": resolve_router_envelope(
            resolve_repo_root(repo_root),
            explicit_router=dict_value(payload.get("routerEnvelope")) or None,
            query=string_value(payload.get("query")) or None,
        ),
        "adapter_hints": normalize_dict_list(list_value(payload.get("adapterHints"))),
    }


def _status_and_reason(
    items: list[dict[str, Any]], collection: dict[str, Any]
) -> tuple[str, str]:
    if not items:
        return "missing", MISSING_COLLECTION_REASON
    total = 0
    for value in collection.values():
        if isinstance(value, int):
            total += value
    if total <= 0:
        return "empty", EMPTY_COLLECTION_REASON
    return "collected", COLLECTED_NOT_AC_REASON


def pack_from_collected_evidence(
    items: list[dict[str, Any]] | None = None,
    *,
    payload: dict[str, Any] | None = None,
    repo_root: Path | str | None = None,
    max_items: int | None = None,
    max_estimated_tokens: int | None = None,
    include_diagnostics: bool = False,
) -> dict[str, Any]:
    """Build a retrieval-pack from collected-evidence. Never AC Evidence."""
    data = dict(payload) if isinstance(payload, dict) else {}
    collected = list(items) if items is not None else extract_collected_items(data)
    empty_collection = {
        "recommendations": 0,
        "artifactSearchResults": 0,
        "sessionMemoryResults": 0,
        "smartSearchManifests": 0,
        "codebaseCandidates": 0,
    }
    if not collected:
        router_envelope = resolve_router_envelope(
            resolve_repo_root(repo_root),
            explicit_router=dict_value(data.get("routerEnvelope")) or None,
            query=string_value(data.get("query")) or None,
        )
        if router_envelope:
            inner = build_retrieval_pack(
                None,
                repo_root=repo_root,
                max_items=max_items,
                max_estimated_tokens=max_estimated_tokens,
                include_diagnostics=include_diagnostics,
                router_envelope=router_envelope,
                adapter_hints=normalize_dict_list(
                    list_value(data.get("adapterHints"))
                ),
            )
            warnings = list(list_value(inner.get("warnings")))
            if "missing-collected-evidence" not in warnings:
                warnings.insert(0, "missing-collected-evidence")
            inner = dict(inner)
            inner["warnings"] = warnings
            return stamp_retrieval_pack_abi(
                inner,
                collection_status="missing",
                reason=MISSING_COLLECTION_REASON,
            )
        return stamp_retrieval_pack_abi(
            {
                "version": 1,
                "source": "retrieval-pack-orchestrator",
                "bundle": {},
                "scoredEvidence": {"version": 1, "total": 0, "items": []},
                "contextPack": {"selected": [], "omitted": []},
                "collection": empty_collection,
                "warnings": ["missing-collected-evidence"],
            },
            collection_status="missing",
            reason=MISSING_COLLECTION_REASON,
        )
    kwargs = _items_to_inner_kwargs(collected, data, repo_root)
    inner = build_retrieval_pack(
        kwargs.get("retrieval_guide"),
        artifact_search_results=kwargs.get("artifact_search_results"),
        session_memory_results=kwargs.get("session_memory_results"),
        smart_search_manifests=kwargs.get("smart_search_manifests"),
        smart_search_manifest_paths=kwargs.get("smart_search_manifest_paths"),
        codebase_candidates=kwargs.get("codebase_candidates"),
        repo_root=repo_root,
        max_items=max_items,
        max_estimated_tokens=max_estimated_tokens,
        include_diagnostics=include_diagnostics,
        router_envelope=kwargs.get("router_envelope"),
        adapter_hints=kwargs.get("adapter_hints"),
    )
    collection = dict_value(inner.get("collection"))
    status, reason = _status_and_reason(collected, collection)
    return stamp_retrieval_pack_abi(inner, collection_status=status, reason=reason)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Quality layer: pack collected-evidence into a retrieval-pack. "
            "Does not search. Output is not AC Evidence."
        ),
    )
    parser.add_argument(
        "--input",
        help="Path to collected-evidence JSON. Defaults to stdin when omitted.",
    )
    parser.add_argument(
        "--root",
        help="Repository root for read-only Smart Search manifest discovery.",
    )
    parser.add_argument("--max-items", type=int, default=None)
    parser.add_argument("--max-estimated-tokens", type=int, default=None)
    parser.add_argument("--include-diagnostics", action="store_true")
    parser.add_argument("--json", action="store_true", help="Pretty-print JSON.")
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

    result = pack_from_collected_evidence(
        payload=payload,
        repo_root=args.root,
        max_items=args.max_items,
        max_estimated_tokens=args.max_estimated_tokens,
        include_diagnostics=args.include_diagnostics,
    )
    indent = 2 if args.json else None
    print(json.dumps(result, indent=indent, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
