#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Research-end / stop hook: quality-layer retrieval-pack for collected evidence.

Three-layer retrieval ABI (frozen; do not merge back into workflow.md):

| Layer    | Owner                 | This hook                                         |
| -------- | --------------------- | ------------------------------------------------- |
| Intent   | context-progressive   | does not own intents                              |
| Provider | Middleware            | does not take smart-search as a Kernel dependency |
| Quality  | retrieval-extended    | owner: pack only when collected-evidence exists   |

Runs after an agent turn (Cursor ``stop``, Claude ``Stop``). No research
artifacts → no-op exit 0 (do not fail, do not write a pack, do not inject
教战). Collected evidence present → pack via ``build_retrieval_pack.py``
(input role ``collected-evidence``). The written JSON is not AC Evidence.

Does not change default ``get_context --json`` behavior.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import warnings
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

warnings.filterwarnings("ignore")

if sys.platform.startswith("win"):
    import io as _io

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
    elif hasattr(sys.stdout, "detach"):
        sys.stdout = _io.TextIOWrapper(  # type: ignore[union-attr]
            sys.stdout.detach(), encoding="utf-8", errors="replace"
        )

DIR_WORKFLOW = ".cstl"
OUTPUT_BASENAME = "retrieval-pack-latest.json"
MARKER = "<!-- cstl-research-end-pack -->"

ABI_INTENT_OWNER = "context-progressive"
ABI_PROVIDER_OWNER = "middleware"
ABI_QUALITY_OWNER = "retrieval-extended"
ABI_LAYER = "quality"
INPUT_ROLE = "collected-evidence"


def _repo_root(cwd: str) -> Path | None:
    current = Path(cwd).resolve()
    for _ in range(32):
        if (current / DIR_WORKFLOW / "scripts").is_dir():
            return current
        if current.parent == current:
            break
        current = current.parent
    return None


def _detect_platform(input_data: dict) -> str | None:
    if isinstance(input_data.get("cursor_version"), str):
        return "cursor"
    env_map = {
        "CLAUDE_PROJECT_DIR": "claude",
        "CURSOR_PROJECT_DIR": "cursor",
    }
    for env_name, platform in env_map.items():
        if os.environ.get(env_name):
            return platform
    script_parts = set(Path(sys.argv[0]).parts)
    if ".cursor" in script_parts:
        return "cursor"
    if ".claude" in script_parts:
        return "claude"
    return None


def _selected_task(repo_root: Path, input_data: dict) -> str | None:
    scripts_dir = repo_root / DIR_WORKFLOW / "scripts"
    if str(scripts_dir) not in sys.path:
        sys.path.insert(0, str(scripts_dir))
    try:
        from common.active_task import resolve_selected_task  # type: ignore[import-not-found]
    except Exception:
        return None
    selected = resolve_selected_task(
        repo_root,
        input_data,
        platform=_detect_platform(input_data),
    )
    return selected.task_path if selected else None


def _relpath(path: Path, repo_root: Path) -> str:
    try:
        return path.resolve().relative_to(repo_root.resolve()).as_posix()
    except ValueError:
        return str(path)


def _freshness(path: Path) -> str | None:
    try:
        return datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat()
    except OSError:
        return None


def collect_evidence_items(task_dir: Path, repo_root: Path) -> list[dict[str, Any]]:
    """Build collected-evidence items (path + provider + optional freshness)."""
    items: list[dict[str, Any]] = []
    research = task_dir / "research"
    if not research.is_dir():
        return items

    for child in sorted(research.iterdir(), key=lambda path: path.name):
        if child.name == OUTPUT_BASENAME:
            continue
        if child.is_file() and child.suffix.lower() in {".md", ".json"}:
            record: dict[str, Any] = {
                "path": _relpath(child, repo_root),
                "provider": "task-research",
            }
            stamp = _freshness(child)
            if stamp:
                record["freshness"] = stamp
            items.append(record)
            continue
        if child.is_dir() and child.name == "smart-search":
            for run_dir in sorted(child.iterdir(), key=lambda path: path.name):
                manifest = run_dir / "manifest.json"
                if not manifest.is_file():
                    continue
                record = {
                    "path": _relpath(manifest, repo_root),
                    "provider": "smart-search",
                }
                stamp = _freshness(manifest)
                if stamp:
                    record["freshness"] = stamp
                items.append(record)
    return items


def _stamp_pack(pack: dict[str, Any], collection_status: str, reason: str) -> dict[str, Any]:
    stamped = dict(pack)
    stamped["inputRole"] = INPUT_ROLE
    stamped["outputRole"] = "retrieval-pack"
    stamped["abiLayer"] = ABI_LAYER
    stamped["abiOwner"] = ABI_QUALITY_OWNER
    stamped["abiIntentOwner"] = ABI_INTENT_OWNER
    stamped["abiProviderOwner"] = ABI_PROVIDER_OWNER
    stamped["collectionStatus"] = collection_status
    stamped["closeEvidenceEligible"] = False
    stamped["notAcEvidence"] = True
    stamped["reason"] = reason
    return stamped


def _pack_via_quality_cli(
    repo_root: Path, items: list[dict[str, Any]]
) -> dict[str, Any] | None:
    scripts_dir = repo_root / DIR_WORKFLOW / "scripts"
    if str(scripts_dir) not in sys.path:
        sys.path.insert(0, str(scripts_dir))
    try:
        from build_retrieval_pack import pack_from_collected_evidence
    except Exception:
        return None
    try:
        return pack_from_collected_evidence(
            items,
            payload={"inputRole": INPUT_ROLE, "items": items},
            repo_root=repo_root,
        )
    except Exception:
        return None


def _pack_via_get_context(repo_root: Path) -> dict[str, Any] | None:
    script = repo_root / DIR_WORKFLOW / "scripts" / "get_context.py"
    if not script.is_file():
        return None
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    cmd = [
        sys.executable,
        "-W",
        "ignore",
        str(script),
        "--mode",
        "retrieval-pack",
        "--json",
    ]
    proc = subprocess.run(
        cmd,
        cwd=str(repo_root),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=45,
        env=env,
    )
    if proc.returncode != 0:
        print(
            f"[research-end-retrieval-pack] WARN: get_context exit {proc.returncode}: "
            f"{proc.stderr[:500]}",
            file=sys.stderr,
        )
        return None
    try:
        parsed = json.loads(proc.stdout)
    except json.JSONDecodeError:
        return None
    if not isinstance(parsed, dict):
        return None
    collection = parsed.get("collection") if isinstance(parsed.get("collection"), dict) else {}
    total = 0
    for value in collection.values():
        if isinstance(value, int):
            total += value
    status = "collected" if total > 0 else "empty"
    reason = (
        "quality-layer retrieval-pack of collected-evidence; "
        "not AC Evidence and not Close Evidence"
        if status == "collected"
        else (
            "collected-evidence items were present but pack collection is empty; "
            "not AC Evidence"
        )
    )
    return _stamp_pack(parsed, status, reason)


def _is_collected_pack(pack: dict[str, Any]) -> bool:
    if pack.get("collectionStatus") == "collected":
        return True
    collection = pack.get("collection")
    if not isinstance(collection, dict):
        return False
    return any(isinstance(value, int) and value > 0 for value in collection.values())


def _emit(platform: str | None, message: str) -> None:
    payload: dict[str, Any]
    if platform == "cursor":
        payload = {"followup_message": message}
    else:
        payload = {
            "hookSpecificOutput": {
                "hookEventName": "Stop",
                "additionalContext": message,
            },
        }
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def main() -> int:
    try:
        raw = sys.stdin.read()
        input_data = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError:
        return 0

    cwd = (
        input_data.get("cwd")
        or input_data.get("workspace_roots", [None])[0]
        or os.getcwd()
    )
    if not isinstance(cwd, str):
        return 0

    repo_root = _repo_root(cwd)
    if repo_root is None:
        return 0

    task_ref = _selected_task(repo_root, input_data)
    if not task_ref:
        return 0

    task_dir = (repo_root / task_ref).resolve()
    if not task_dir.is_dir():
        return 0

    items = collect_evidence_items(task_dir, repo_root)
    if not items:
        return 0

    pack = _pack_via_quality_cli(repo_root, items)
    if not pack:
        pack = _pack_via_get_context(repo_root)
    if not pack or not _is_collected_pack(pack):
        return 0

    research_dir = task_dir / "research"
    research_dir.mkdir(parents=True, exist_ok=True)
    out_path = research_dir / OUTPUT_BASENAME
    out_path.write_text(
        json.dumps(pack, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    selected_n = 0
    context_pack = pack.get("contextPack")
    if isinstance(context_pack, dict):
        selected = context_pack.get("selected")
        if isinstance(selected, list):
            selected_n = len(selected)

    rel = out_path.relative_to(repo_root).as_posix()
    message = (
        f"{MARKER}\n"
        f"retrieval-extended quality layer wrote `{rel}` from collected-evidence "
        f"(contextPack.selected={selected_n}). "
        f"This retrieval-pack is not AC Evidence and must not be used as Close Evidence."
    )
    _emit(_detect_platform(input_data), message)
    return 0


if __name__ == "__main__":
    sys.exit(main())
