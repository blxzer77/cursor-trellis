#!/usr/bin/env python3
"""Cursor beforeSubmitPrompt: inject router-derived ## 代码库检索计划 per user turn.

Runs route_codebase_retrieval + render_agent_instructions for the submitted
prompt. Complements retrieval-routing.mdc (Rules) with an explicit plan block
so REC-03 telemetry can set plan_block_in_prompt=true.

Silent exit 0 (no stdout) when:
  - TRELLIS_HOOKS=0 / not a Trellis repo
  - prompt is meta-only (continue, slash commands, etc.)
  - gate says retrieval plan is not needed
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

if sys.platform.startswith("win"):
    import io as _io

    for _stream_name in ("stdin", "stdout", "stderr"):
        _stream = getattr(sys, _stream_name, None)
        if _stream is None:
            continue
        if hasattr(_stream, "reconfigure"):
            try:
                _stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
            except Exception:
                pass
        elif hasattr(_stream, "detach"):
            try:
                setattr(
                    sys,
                    _stream_name,
                    _io.TextIOWrapper(
                        _stream.detach(), encoding="utf-8", errors="replace"
                    ),
                )
            except Exception:
                pass

DIR_WORKFLOW = ".trellis"
PLAN_MARKER_ZH = "## 代码库检索计划"
PLAN_MARKER_EN = "## Codebase retrieval plan"


def _find_trellis_root(start: Path) -> Path | None:
    current = start.resolve()
    while True:
        if (current / DIR_WORKFLOW / "scripts").is_dir():
            return current
        if current == current.parent:
            return None
        current = current.parent


def _detect_platform(input_data: dict[str, Any]) -> str | None:
    if isinstance(input_data.get("cursor_version"), str):
        return "cursor"
    if os.environ.get("CURSOR_PROJECT_DIR"):
        return "cursor"
    script_parts = set(Path(sys.argv[0]).parts)
    if ".cursor" in script_parts:
        return "cursor"
    return None


def _load_capabilities(root: Path) -> dict[str, object] | None:
    path = root / DIR_WORKFLOW / "capabilities.json"
    if not path.is_file():
        return None
    try:
        with path.open(encoding="utf-8") as handle:
            parsed = json.load(handle)
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        return None


def _emit_plan_block(plan_text: str) -> None:
    payload = {
        "additional_context": plan_text,
        "hookSpecificOutput": {
            "hookEventName": "beforeSubmitPrompt",
            "additionalContext": plan_text,
        },
    }
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def main() -> int:
    if os.environ.get("TRELLIS_HOOKS") == "0" or os.environ.get(
        "TRELLIS_DISABLE_HOOKS"
    ) == "1":
        return 0

    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        data = {}

    if not isinstance(data, dict):
        data = {}

    cwd_str = data.get("cwd") or os.getcwd()
    root = _find_trellis_root(Path(str(cwd_str)))
    if root is None:
        return 0

    scripts_dir = root / DIR_WORKFLOW / "scripts"
    if str(scripts_dir) not in sys.path:
        sys.path.insert(0, str(scripts_dir))

    try:
        from common.codebase_retrieval_router import (  # type: ignore[import-not-found]
            PLATFORM_CURSOR,
            codebase_retrieval_selected_from_capabilities,
            route_codebase_retrieval,
        )
        from common.project_file_stats import (  # type: ignore[import-not-found]
            resolve_project_file_count_arg,
        )
        from common.retrieval_agent_instructions import (  # type: ignore[import-not-found]
            render_agent_instructions,
        )
        from common.retrieval_plan_gate import (  # type: ignore[import-not-found]
            extract_user_prompt,
            should_inject_retrieval_plan,
        )
    except Exception:
        return 0

    query = extract_user_prompt(data)
    if not should_inject_retrieval_plan(query):
        return 0

    platform = _detect_platform(data) or PLATFORM_CURSOR
    if platform != PLATFORM_CURSOR:
        platform = PLATFORM_CURSOR

    try:
        project_file_count = resolve_project_file_count_arg("auto", repo_root=root)
    except ValueError:
        project_file_count = None

    caps = _load_capabilities(root)
    selected = codebase_retrieval_selected_from_capabilities(caps)
    plan = route_codebase_retrieval(
        query,
        codebase_retrieval_selected=selected,
        platform=platform,
        project_file_count=project_file_count,
    )
    instructions = render_agent_instructions(
        plan,
        platform=platform,
        locale="zh",
    )
    if PLAN_MARKER_ZH not in instructions and PLAN_MARKER_EN not in instructions:
        return 0

    _emit_plan_block(instructions)
    return 0


if __name__ == "__main__":
    sys.exit(main())