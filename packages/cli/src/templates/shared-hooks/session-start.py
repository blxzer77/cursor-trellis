#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Session Start Hook - Inject the context-progressive Session pack only.

Event Bridge remains a separate earlier `sessionStart` command in hooks.json.
This hook must not crash: compiler failure is a successful no-op (exit 0).
"""
from __future__ import annotations

# IMPORTANT: Suppress all warnings FIRST
import warnings
warnings.filterwarnings("ignore")

import importlib.util
import json
import os
import re
import shlex
import sys
from datetime import datetime, timezone
from pathlib import Path


def _normalize_windows_shell_path(path_str: str) -> str:
    """Normalize Unix-style shell paths to real Windows paths.

    On Windows, shells like Git Bash / MSYS2 / Cygwin may report paths like
    `/d/Users/...` or `/cygdrive/d/Users/...`. `Path.resolve()` will misinterpret
    these as `D:/d/Users...` on drive D: (or similar), breaking repo root
    detection.

    This function is intentionally conservative: it only rewrites patterns that
    unambiguously represent a drive letter mount.
    """
    if not isinstance(path_str, str) or not path_str:
        return path_str

    # Only relevant on Windows; keep other platforms untouched.
    if not sys.platform.startswith("win"):
        return path_str

    p = path_str.strip()

    # Already a Windows drive path (C:\... or C:/...)
    if re.match(r"^[A-Za-z]:[\/]", p):
        return p

    # MSYS/Git-Bash style: /c/Users/... or /d/Work/...
    m = re.match(r"^/([A-Za-z])/(.*)", p)
    if m:
        drive, rest = m.group(1).upper(), m.group(2)
        rest = rest.replace('/', '\\')
        return f"{drive}:\\{rest}"

    # Cygwin style: /cygdrive/c/Users/...
    m = re.match(r"^/cygdrive/([A-Za-z])/(.*)", p)
    if m:
        drive, rest = m.group(1).upper(), m.group(2)
        rest = rest.replace('/', '\\')
        return f"{drive}:\\{rest}"

    # WSL mounted drive (sometimes leaked into env): /mnt/c/Users/...
    m = re.match(r"^/mnt/([A-Za-z])/(.*)", p)
    if m:
        drive, rest = m.group(1).upper(), m.group(2)
        rest = rest.replace('/', '\\')
        return f"{drive}:\\{rest}"

    return path_str


FIRST_REPLY_NOTICE = """<first-reply-notice>
First visible reply: say once in Chinese that Trellis SessionStart context is loaded, then answer directly.
This notice is one-shot: do not repeat it after the first assistant reply in the same session.
</first-reply-notice>"""

# Force UTF-8 on stdin/stdout/stderr on Windows. Default codepage there is
# cp936 / cp1252 / etc. — non-ASCII content (Chinese task names, prd snippets)
# both in stdin (hook payload from host CLI) and stdout (our emitted blocks)
# raises UnicodeDecodeError / UnicodeEncodeError. Equivalent to `python -X utf8`
# but applied per-stream so we don't depend on host CLI's command wiring.
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
                setattr(sys, _stream_name, _io.TextIOWrapper(_stream.detach(), encoding="utf-8", errors="replace"))
            except Exception:
                pass


def should_skip_injection() -> bool:
    """Check if any platform's non-interactive flag is set, or if Trellis
    hooks are explicitly disabled via TRELLIS_HOOKS=0 / TRELLIS_DISABLE_HOOKS=1.
    """
    if os.environ.get("TRELLIS_HOOKS") == "0":
        return True
    if os.environ.get("TRELLIS_DISABLE_HOOKS") == "1":
        return True
    non_interactive_vars = [
        "CLAUDE_NON_INTERACTIVE",
        "QODER_NON_INTERACTIVE",
        "CODEBUDDY_NON_INTERACTIVE",
        "FACTORY_NON_INTERACTIVE",
        "CURSOR_NON_INTERACTIVE",
        "GEMINI_NON_INTERACTIVE",
        "KIRO_NON_INTERACTIVE",
        "COPILOT_NON_INTERACTIVE",
    ]
    return any(os.environ.get(var) == "1" for var in non_interactive_vars)


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
    if ".claude" in script_parts:
        return "claude"
    if ".cursor" in script_parts:
        return "cursor"
    if ".codex" in script_parts:
        return "codex"
    if ".gemini" in script_parts:
        return "gemini"
    if ".qoder" in script_parts:
        return "qoder"
    if ".codebuddy" in script_parts:
        return "codebuddy"
    if ".factory" in script_parts:
        return "droid"
    if ".kiro" in script_parts:
        return "kiro"
    return None


def _append_hook_log(trellis_dir: Path, record: dict) -> None:
    """Side-channel: prove this process ran even if additional_context is dropped."""
    try:
        log_dir = trellis_dir / ".runtime" / "hooks"
        log_dir.mkdir(parents=True, exist_ok=True)
        payload = {
            "ts": datetime.now(timezone.utc)
            .replace(microsecond=0)
            .isoformat()
            .replace("+00:00", "Z"),
            **record,
        }
        with (log_dir / "session-start.log").open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(payload, ensure_ascii=False) + "\n")
    except Exception:
        pass


def _resolve_trellis_dir(project_dir: Path) -> Path:
    """Resolve the cstl instance directory for this project.

    Mirrors common/paths.py get_repo_root(): finds the nearest .cstl upward
    from project_dir. Harness sub-repos without a local .cstl resolve to the
    harness root instance (thin-connect, 2026-08-16 instance-boundary decision).
    """
    current = project_dir
    while True:
        if (current / ".cstl").is_dir():
            return current / ".cstl"
        if current.parent == current:
            break
        current = current.parent
    return project_dir / ".cstl"


def _resolve_context_key(trellis_dir: Path, input_data: dict) -> str | None:
    scripts_dir = trellis_dir / "scripts"
    if str(scripts_dir) not in sys.path:
        sys.path.insert(0, str(scripts_dir))
    from common.active_task import resolve_context_key  # type: ignore[import-not-found]

    return resolve_context_key(input_data, platform=_detect_platform(input_data))


def _persist_context_key_for_bash(context_key: str | None) -> None:
    """Expose Trellis session identity to later Claude Code Bash commands.

    Claude Code SessionStart hooks can append exports to CLAUDE_ENV_FILE; those
    variables are then available to Bash tools in the same conversation. Without
    this bridge, `task.py select` has hook stdin during SessionStart but no
    session identity when the AI later runs it as a normal shell command.
    """
    if not context_key:
        return
    env_file = os.environ.get("CLAUDE_ENV_FILE")
    if not env_file:
        return
    try:
        with open(env_file, "a", encoding="utf-8") as handle:
            handle.write(f"export TRELLIS_CONTEXT_ID={shlex.quote(context_key)}\n")
    except OSError:
        pass


def _resolve_selected_task(trellis_dir: Path, input_data: dict):
    scripts_dir = trellis_dir / "scripts"
    if str(scripts_dir) not in sys.path:
        sys.path.insert(0, str(scripts_dir))
    from common.active_task import resolve_selected_task  # type: ignore[import-not-found]

    return resolve_selected_task(
        trellis_dir.parent,
        input_data,
        platform=_detect_platform(input_data),
    )


def _load_session_pack_module(trellis_dir: Path):
    """Load session_pack.py without executing common/__init__.py."""
    pack_path = trellis_dir / "scripts" / "common" / "session_pack.py"
    if not pack_path.is_file():
        return None
    spec = importlib.util.spec_from_file_location("cstl_session_pack", pack_path)
    if spec is None or spec.loader is None:
        return None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _compile_session_pack_text(trellis_dir: Path, input_data: dict) -> str:
    """Return compiled Session pack XML, or empty string on any failure."""
    try:
        module = _load_session_pack_module(trellis_dir)
        if module is None:
            return ""
        selected_path = None
        selected_stale = False
        try:
            active = _resolve_selected_task(trellis_dir, input_data)
            selected_path = active.task_path
            selected_stale = bool(active.stale)
        except Exception:
            selected_path = None
            selected_stale = False
        fact_gap = os.environ.get("CSTL_SESSION_FACT_GAP") == "1"
        pack = module.compile_session_pack_from_trellis(
            trellis_dir,
            selected_task_path=selected_path,
            selected_stale=selected_stale,
            fact_gap=fact_gap,
        )
        rendered = module.render_session_pack(pack)
        return rendered if isinstance(rendered, str) else ""
    except Exception:
        return ""


def _emit(context_text: str) -> None:
    result = {
        # Claude Code / Qoder / CodeBuddy / Droid / Gemini / Copilot format
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "additionalContext": context_text,
        },
        # Cursor sessionStart format (top-level snake_case per Cursor docs)
        "additional_context": context_text,
    }
    print(json.dumps(result, ensure_ascii=False), flush=True)


def main():
    enter_root = Path(_normalize_windows_shell_path(os.getcwd())).resolve()
    _append_hook_log(_resolve_trellis_dir(enter_root), {"phase": "enter"})
    if should_skip_injection():
        _append_hook_log(_resolve_trellis_dir(enter_root), {"phase": "skip"})
        sys.exit(0)

    try:
        hook_input = json.loads(sys.stdin.read())
        if not isinstance(hook_input, dict):
            hook_input = {}
    except (json.JSONDecodeError, ValueError):
        hook_input = {}

    # Try platform-specific env vars, hook cwd, fallback to cwd
    project_dir_env_vars = [
        "CLAUDE_PROJECT_DIR",
        "QODER_PROJECT_DIR",
        "CODEBUDDY_PROJECT_DIR",
        "FACTORY_PROJECT_DIR",
        "CURSOR_PROJECT_DIR",
        "GEMINI_PROJECT_DIR",
        "KIRO_PROJECT_DIR",
        "COPILOT_PROJECT_DIR",
    ]
    project_dir = None
    for var in project_dir_env_vars:
        val = os.environ.get(var)
        if val:
            project_dir = Path(_normalize_windows_shell_path(val)).resolve()
            break
    if project_dir is None:
        project_dir = Path(_normalize_windows_shell_path(hook_input.get("cwd", "."))).resolve()

    trellis_dir = _resolve_trellis_dir(project_dir)
    try:
        context_key = _resolve_context_key(trellis_dir, hook_input)
        _persist_context_key_for_bash(context_key)
    except Exception:
        pass

    compiled = _compile_session_pack_text(trellis_dir, hook_input)
    parts = [FIRST_REPLY_NOTICE]
    if compiled.strip():
        parts.append(compiled)
    text = "\n\n".join(parts)
    _append_hook_log(
        trellis_dir,
        {
            "phase": "emit",
            "chars": len(text),
            "has_session_pack": "<session-pack" in text,
        },
    )
    _emit(text)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # Hook must never crash the host session.
        try:
            _emit(FIRST_REPLY_NOTICE)
        except Exception:
            pass
        sys.exit(0)
