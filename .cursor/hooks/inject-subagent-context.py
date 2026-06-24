#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Multi-Platform Sub-Agent Context Injection Hook (thin wrapper).

CLI Layer 2 (`generate-dispatch-prompt`) is the primary Cursor path; this hook is
best-effort and skips when the prompt already contains the injection marker.
"""
from __future__ import annotations

import warnings

warnings.filterwarnings("ignore")

import json
import os
import sys
from pathlib import Path
from typing import Any

if sys.platform.startswith("win"):
    import io as _io

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
    elif hasattr(sys.stdout, "detach"):
        sys.stdout = _io.TextIOWrapper(sys.stdout.detach(), encoding="utf-8", errors="replace")  # type: ignore[union-attr]

DIR_WORKFLOW = ".trellis"

AGENT_IMPLEMENT = "trellis-implement"
AGENT_CHECK = "trellis-check"
AGENT_RESEARCH = "trellis-research"
AGENTS_ALL = (AGENT_IMPLEMENT, AGENT_CHECK, AGENT_RESEARCH)
AGENTS_REQUIRE_TASK = (AGENT_IMPLEMENT, AGENT_CHECK)


def find_repo_root(start_path: str) -> str | None:
    current = Path(start_path).resolve()
    while current != current.parent:
        if (current / DIR_WORKFLOW).is_dir():
            return str(current)
        if (current / ".git").exists():
            return str(current)
        current = current.parent
    return None


def _detect_platform(input_data: dict) -> str | None:
    if isinstance(input_data.get("cursor_version"), str):
        return "cursor"
    env_map = {
        "CLAUDE_PROJECT_DIR": "claude",
        "CURSOR_PROJECT_DIR": "cursor",
        "CODEBUDDY_PROJECT_DIR": "codebuddy",
        "FACTORY_PROJECT_DIR": "droid",
        "GEMINI_PROJECT_DIR": "gemini",
        "QODER_PROJECT_DIR": "qoder",
        "KIRO_PROJECT_DIR": "kiro",
        "COPILOT_PROJECT_DIR": "copilot",
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


def get_selected_task(repo_root: str, input_data: dict) -> str | None:
    scripts_dir = Path(repo_root) / DIR_WORKFLOW / "scripts"
    if str(scripts_dir) not in sys.path:
        sys.path.insert(0, str(scripts_dir))
    try:
        from common.active_task import resolve_selected_task  # type: ignore[import-not-found]
    except Exception:
        return None

    selected = resolve_selected_task(
        Path(repo_root),
        input_data,
        platform=_detect_platform(input_data),
    )
    return selected.task_path


def _string_value(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    return ""


def _extract_subagent_name(value: Any) -> str:
    direct = _string_value(value)
    if direct:
        return direct
    if not isinstance(value, dict):
        return ""
    for key in ("name", "subagent_type_name", "subagentTypeName"):
        direct = _string_value(value.get(key))
        if direct:
            return direct
    custom = value.get("custom")
    if isinstance(custom, dict):
        custom_name = _string_value(custom.get("name"))
        if custom_name:
            return custom_name
    oneof = value.get("type")
    if isinstance(oneof, dict):
        case_name = _string_value(oneof.get("case"))
        if case_name == "custom":
            nested_value = oneof.get("value")
            if isinstance(nested_value, dict):
                custom_name = _string_value(nested_value.get("name"))
                if custom_name:
                    return custom_name
        if case_name:
            return case_name
    for agent_name in AGENTS_ALL:
        if agent_name in value:
            return agent_name
    return ""


def _extract_subagent_type(tool_input: dict) -> str:
    for key in (
        "subagent_type",
        "subagentType",
        "subagent_type_name",
        "subagentTypeName",
        "agent_type",
        "agentType",
        "name",
    ):
        agent_name = _extract_subagent_name(tool_input.get(key))
        if agent_name:
            return agent_name
    return ""


def _parse_hook_input(input_data: dict) -> tuple[str, str, dict]:
    tool_input = input_data.get("tool_input", {})
    tool_name = input_data.get("tool_name", "") or input_data.get("toolName", "")
    if tool_name.lower() in ("task", "agent", "subagent"):
        return (
            _extract_subagent_type(tool_input),
            tool_input.get("prompt", ""),
            tool_input,
        )
    agent_name = input_data.get("agent_name", "")
    if agent_name:
        return agent_name, tool_input.get("prompt", input_data.get("prompt", "")), tool_input
    if tool_name in AGENTS_ALL:
        return tool_name, tool_input.get("prompt", ""), tool_input
    tool_name_camel = input_data.get("toolName", "")
    if tool_name_camel in AGENTS_ALL:
        return tool_name_camel, input_data.get("toolArgs", ""), tool_input
    return "", "", tool_input


def main() -> None:
    if os.environ.get("TRELLIS_HOOKS") == "0" or os.environ.get("TRELLIS_DISABLE_HOOKS") == "1":
        sys.exit(0)

    try:
        input_text = sys.stdin.read()
        # Remove UTF-8 BOM if present
        if input_text.startswith('\ufeff'):
            input_text = input_text[1:]
        input_data = json.loads(input_text)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    subagent_type, original_prompt, tool_input = _parse_hook_input(input_data)
    if subagent_type not in AGENTS_ALL:
        sys.exit(0)

    repo_root = find_repo_root(input_data.get("cwd", os.getcwd()))
    if not repo_root:
        sys.exit(0)

    scripts_dir = Path(repo_root) / DIR_WORKFLOW / "scripts"
    if str(scripts_dir) not in sys.path:
        sys.path.insert(0, str(scripts_dir))

    from common.subagent_dispatch import (  # type: ignore[import-not-found]
        build_dispatch_prompt_for_agent,
        prompt_has_injection_marker,
    )

    if prompt_has_injection_marker(original_prompt):
        sys.exit(0)

    task_dir = get_selected_task(repo_root, input_data)
    if not task_dir and original_prompt:
        for line in original_prompt.split("\n"):
            line = line.strip()
            if line.startswith("Selected task:"):
                candidate = line.split("Selected task:", 1)[1].strip()
                if candidate and os.path.isdir(os.path.join(repo_root, candidate)):
                    task_dir = candidate
                    print(
                        f"[inject-subagent-context] Resolved task from prompt: {task_dir}",
                        file=sys.stderr,
                    )
                break

    if subagent_type in AGENTS_REQUIRE_TASK:
        if not task_dir:
            sys.exit(0)
        if not os.path.exists(os.path.join(repo_root, task_dir)):
            sys.exit(0)

    new_prompt = build_dispatch_prompt_for_agent(
        repo_root,
        task_dir or "",
        subagent_type,
        original_prompt,
    )
    if not new_prompt:
        sys.exit(0)

    updated = {**tool_input, "prompt": new_prompt}
    output = {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "allow",
            "updatedInput": updated,
        },
        "permission": "allow",
        "updated_input": updated,
        "updatedInput": updated,
    }
    print(json.dumps(output, ensure_ascii=False))
    sys.exit(0)


if __name__ == "__main__":
    main()
