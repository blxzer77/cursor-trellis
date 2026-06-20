#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Research-end / stop hook: optional retrieval-pack scoring for the selected task.

Runs after an agent turn (Cursor `stop`, Claude `Stop`). When the selected task
has research artifacts or smart-search manifests, builds a retrieval-pack JSON
file under `{TASK}/research/` and returns a short operator hint.

Does not change default `get_context --json` behavior.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import warnings
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

DIR_WORKFLOW = ".trellis"
OUTPUT_BASENAME = "retrieval-pack-latest.json"
MARKER = "<!-- trellis-research-end-pack -->"


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


def _has_research_signals(task_dir: Path) -> bool:
    research = task_dir / "research"
    if not research.is_dir():
        return False
    for child in research.iterdir():
        if child.is_file() and child.suffix.lower() in {".md", ".json"}:
            if child.name != OUTPUT_BASENAME:
                return True
        if child.is_dir() and child.name == "smart-search":
            if any(child.iterdir()):
                return True
    return False


_PLATFORM_ARG_MAP = {
    "cursor": "cursor",
    "claude": "claude-code",
}


def _run_retrieval_pack(repo_root: Path, platform: str | None) -> dict[str, Any] | None:
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
    if platform:
        router_platform = _PLATFORM_ARG_MAP.get(platform, platform)
        cmd.extend(["--platform", router_platform])
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
        return json.loads(proc.stdout)
    except json.JSONDecodeError:
        return None


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
            "additional_context": message,
        }
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def main() -> None:
    try:
        raw = sys.stdin.read()
        input_data = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError:
        return

    cwd = (
        input_data.get("cwd")
        or input_data.get("workspace_roots", [None])[0]
        or os.getcwd()
    )
    if not isinstance(cwd, str):
        return

    repo_root = _repo_root(cwd)
    if repo_root is None:
        return

    task_ref = _selected_task(repo_root, input_data)
    if not task_ref:
        return

    task_dir = (repo_root / task_ref).resolve()
    if not task_dir.is_dir():
        return

    if not _has_research_signals(task_dir):
        return

    pack = _run_retrieval_pack(repo_root, _detect_platform(input_data))
    if not pack:
        return

    research_dir = task_dir / "research"
    research_dir.mkdir(parents=True, exist_ok=True)
    out_path = research_dir / OUTPUT_BASENAME
    out_path.write_text(json.dumps(pack, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    collection = pack.get("collection") or {}
    selected_n = 0
    context_pack = pack.get("contextPack")
    if isinstance(context_pack, dict):
        selected = context_pack.get("selected")
        if isinstance(selected, list):
            selected_n = len(selected)

    rel = out_path.relative_to(repo_root).as_posix()
    message = (
        f"{MARKER}\n"
        f"Trellis research-end hook wrote scored evidence to `{rel}` "
        f"(contextPack.selected={selected_n}, "
        f"artifacts={collection.get('artifactSearchResults', 0)}, "
        f"smart-search={collection.get('smartSearchManifests', 0)}). "
        f"Cite ranked sources or gaps in `verify.md` when finishing the task."
    )
    _emit(_detect_platform(input_data), message)


if __name__ == "__main__":
    main()