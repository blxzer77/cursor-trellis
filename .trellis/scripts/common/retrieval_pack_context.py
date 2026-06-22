#!/usr/bin/env python3
"""
Retrieval pack context output for get_context.py --mode retrieval-pack.

Uses session retrievalGuide and optional caller-supplied evidence input.
Does not run Smart Search, artifact search, session memory search, MCP,
browser, network, or codebase retrieval automatically.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from .codebase_retrieval_router import resolve_router_envelope
from .paths import get_repo_root, get_selected_task
from .retrieval_pack import (
    build_retrieval_pack,
    dict_value,
    list_value,
    normalize_dict_list,
    string_value,
)
from .session_context import _get_retrieval_guide


def read_evidence_input(input_path: str | None) -> dict[str, Any]:
    """Read optional evidence JSON from --input or stdin."""
    if input_path:
        with open(input_path, encoding="utf-8") as handle:
            parsed = json.load(handle)
    elif sys.stdin.isatty():
        return {}
    else:
        raw = sys.stdin.read()
        if not raw.strip():
            return {}
        parsed = json.loads(raw)

    if not isinstance(parsed, dict):
        raise ValueError("evidence input must be a JSON object")
    return parsed


def get_context_retrieval_pack_json(
    repo_root: Path | None = None,
    *,
    evidence_input: dict[str, Any] | None = None,
    max_items: int | None = None,
    max_estimated_tokens: int | None = None,
    include_diagnostics: bool = False,
    project_file_count: int | None = None,
) -> dict[str, object]:
    """Build a retrieval pack from session guidance and optional evidence input."""
    if repo_root is None:
        repo_root = get_repo_root()

    payload = evidence_input or {}
    selected_task = get_selected_task(repo_root)
    retrieval_guide = _get_retrieval_guide(repo_root, selected_task)

    return build_retrieval_pack(
        retrieval_guide=retrieval_guide,
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
            for path in (
                string_value(item)
                for item in list_value(payload.get("smartSearchManifestPaths"))
            )
            if path
        ],
        codebase_candidates=normalize_dict_list(
            list_value(payload.get("codebaseCandidates"))
        ),
        repo_root=repo_root,
        max_items=max_items,
        max_estimated_tokens=max_estimated_tokens,
        include_diagnostics=include_diagnostics,
        router_envelope=resolve_router_envelope(
            repo_root,
            explicit_router=dict_value(payload.get("routerEnvelope")) or None,
            query=string_value(payload.get("query")) or None,
            project_file_count=project_file_count,
        ),
        adapter_hints=normalize_dict_list(list_value(payload.get("adapterHints"))),
    )


def output_retrieval_pack_json(
    *,
    repo_root: Path | None = None,
    evidence_input: dict[str, Any] | None = None,
    max_items: int | None = None,
    max_estimated_tokens: int | None = None,
    include_diagnostics: bool = False,
    pretty: bool = False,
    project_file_count: int | None = None,
) -> None:
    """Print retrieval pack JSON to stdout."""
    result = get_context_retrieval_pack_json(
        repo_root,
        evidence_input=evidence_input,
        max_items=max_items,
        max_estimated_tokens=max_estimated_tokens,
        include_diagnostics=include_diagnostics,
        project_file_count=project_file_count,
    )
    if pretty:
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        print(json.dumps(result, ensure_ascii=False))
