#!/usr/bin/env python3
"""Cursor afterShellExecution hook: prompt session rename after task bind/start.

When the agent successfully runs `task.py select` or
`task.py start-execution <task> --approved`, emit an agent_message (best-effort)
so the main session calls cursor-app-control `rename_chat` with the task
directory name. MCP unavailable → agent skips silently per cstl-session-rename rule.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import shlex
import sys
from pathlib import Path
from typing import Any

DIR_WORKFLOW = ".cstl"
DIR_RUNTIME = ".runtime"
DIR_SESSION_RENAME = "session-rename"
ANSI_ESCAPE = re.compile(r"\x1b\[[0-9;]*m")
CONTEXT_IDENTITY_KEYS = (
    "session_id",
    "sessionId",
    "sessionID",
    "conversation_id",
    "conversationId",
    "conversationID",
    "transcript_path",
    "transcriptPath",
    "transcript",
)


def _string_value(value: Any) -> str | None:
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return None


def _strip_ansi(text: str) -> str:
    return ANSI_ESCAPE.sub("", text)


def _find_trellis_root(start: Path) -> Path | None:
    current = start.resolve()
    while True:
        if (current / DIR_WORKFLOW).is_dir():
            return current
        if current == current.parent:
            return None
        current = current.parent


def _task_py_token_index(tokens: list[str]) -> int | None:
    for index, token in enumerate(tokens):
        if Path(token.strip("\"'")).name == "task.py":
            return index
    return None


def parse_rename_intent(command: str) -> dict[str, str] | None:
    """Return subcommand + task_ref when command should trigger rename."""
    try:
        tokens = shlex.split(command, posix=os.name != "nt")
    except ValueError:
        return None

    task_index = _task_py_token_index(tokens)
    if task_index is None or task_index + 1 >= len(tokens):
        return None

    subcommand = tokens[task_index + 1]
    if subcommand == "select":
        if task_index + 2 >= len(tokens):
            return None
        return {"subcommand": subcommand, "task_ref": tokens[task_index + 2]}
    if subcommand == "start-execution":
        if "--approved" not in tokens:
            return None
        if task_index + 2 >= len(tokens):
            return None
        task_ref = tokens[task_index + 2]
        if task_ref.startswith("-"):
            return None
        return {"subcommand": subcommand, "task_ref": task_ref}
    return None


def task_directory_name(task_ref: str) -> str:
    """Use task folder basename as the chat title."""
    cleaned = task_ref.strip().strip("\"'")
    return Path(cleaned.replace("\\", "/")).name


def shell_output_succeeded(subcommand: str, output: str) -> bool:
    text = _strip_ansi(output or "")
    if "Error:" in text or "error:" in text.lower():
        return False
    if subcommand == "select":
        return "Selected task:" in text or "✓ Selected task" in text
    if subcommand == "start-execution":
        return "Execution approved" in text or "✓ Execution approved" in text
    return False


def _safe_context_filename(context_key: str) -> str:
    digest = hashlib.sha256(context_key.encode("utf-8")).hexdigest()[:24]
    return f"{digest}.json"


def _rename_state_dir(root: Path) -> Path:
    return root / DIR_WORKFLOW / DIR_RUNTIME / DIR_SESSION_RENAME


def _load_rename_state(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}
    return data if isinstance(data, dict) else {}


def _should_emit_rename(state: dict[str, Any], title: str) -> bool:
    return state.get("last_title") != title


def _write_rename_state(path: Path, context_key: str, title: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "context_key": context_key,
        "last_title": title,
    }
    path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def _agent_rename_message(title: str) -> str:
    return (
        "Trellis session rename: call cursor-app-control MCP `rename_chat` once "
        f'with title "{title}" (task directory name). '
        "If rename_chat is not in your tool list, skip silently — do not ask the user "
        "to rename manually."
    )


def _load_context_key(root: Path, hook_input: dict[str, Any]) -> str | None:
    scripts_dir = root / DIR_WORKFLOW / "scripts"
    if str(scripts_dir) not in sys.path:
        sys.path.insert(0, str(scripts_dir))
    from common.active_task import resolve_context_key  # type: ignore[import-not-found]

    if not any(_string_value(hook_input.get(key)) for key in CONTEXT_IDENTITY_KEYS):
        return None
    return resolve_context_key(hook_input, platform="cursor")


def main() -> int:
    if os.environ.get("TRELLIS_HOOKS") == "0" or os.environ.get("TRELLIS_DISABLE_HOOKS") == "1":
        print("{}")
        return 0

    try:
        hook_input = json.loads(sys.stdin.read())
    except (json.JSONDecodeError, ValueError):
        hook_input = {}
    if not isinstance(hook_input, dict):
        hook_input = {}

    event = _string_value(hook_input.get("hook_event_name")) or "afterShellExecution"
    if event != "afterShellExecution":
        print("{}")
        return 0

    command = _string_value(hook_input.get("command")) or ""
    intent = parse_rename_intent(command)
    if intent is None:
        print("{}")
        return 0

    output = _string_value(hook_input.get("output")) or ""
    if not shell_output_succeeded(intent["subcommand"], output):
        print("{}")
        return 0

    title = task_directory_name(intent["task_ref"])
    if not title:
        print("{}")
        return 0

    cwd = Path(_string_value(hook_input.get("cwd")) or os.getcwd())
    root = _find_trellis_root(cwd)
    if root is None:
        print("{}")
        return 0

    context_key = _load_context_key(root, hook_input)
    if not context_key:
        print("{}")
        return 0

    state_path = _rename_state_dir(root) / _safe_context_filename(context_key)
    state = _load_rename_state(state_path)
    if not _should_emit_rename(state, title):
        print("{}")
        return 0

    try:
        _write_rename_state(state_path, context_key, title)
    except OSError:
        print("{}")
        return 0

    print(
        json.dumps(
            {"agent_message": _agent_rename_message(title)},
            ensure_ascii=False,
        ),
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
