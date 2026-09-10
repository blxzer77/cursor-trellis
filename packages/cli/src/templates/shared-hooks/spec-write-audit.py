#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Spec Write Audit Hook — machine record of writes to long-term spec knowledge.

Part of the "record mandatory / flow free / verdict by human" trichotomy
(P41 memory-s3-spec-gate). This hook ONLY records that a write to
`.pactile/spec/`, `docs/adr/`, or Policy files was initiated. It NEVER blocks
the write:

- Always prints a preToolUse ``allow`` permission decision.
- Every failure path is a silent no-op (exit 0) — a recording failure must
  not block any write.

The preToolUse event fires before the tool executes, so the record describes
the *initiated* write (actor / when / target file / verification state),
not the write result. ``verified`` is conservative: with no confirmation
signal in the hook input it records ``false`` (unverified write, recorded
not rejected).
"""
from __future__ import annotations

import getpass
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

if sys.platform.startswith("win"):
    import io as _io

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
    elif hasattr(sys.stdout, "detach"):
        sys.stdout = _io.TextIOWrapper(sys.stdout.detach(), encoding="utf-8", errors="replace")  # type: ignore[union-attr]

DIR_WORKFLOW = ".pactile"
DIR_RUNTIME = ".runtime"
DIR_HOOKS = "hooks"
AUDIT_FILE = "spec-write.log"

# Authoritative protected roots, matching `spec-learning` contract wording:
# ".pactile/spec/", ADR (docs/adr/), Policy. Policy files live under .pactile/spec/
# (e.g. .pactile/spec/Pactile/...); platform rule files (.cursor/rules/*.mdc) are
# outside this machine-record scope.
PROTECTED_REL_PREFIXES = (
    ".pactile/spec/",
    "pactile/spec/",
    "docs/adr/",
    ".pactile/spec",
    "docs/adr",
)

WRITE_TOOLS = frozenset({"write", "edit", "notebookedit", "applydiff", "multiplediff"})


def find_repo_root(start_path: str) -> str | None:
    current = Path(start_path).resolve()
    while current != current.parent:
        if (current / DIR_WORKFLOW).is_dir():
            return str(current)
        if (current / ".git").exists():
            return str(current)
        current = current.parent
    return None


def _safe_payload() -> dict:
    raw = sys.stdin.read() if not sys.stdin.isatty() else ""
    if not raw.strip():
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _string_value(value, default: str = "") -> str:
    if isinstance(value, str):
        return value.strip()
    return default


def _extract_target_path(hook_input: dict) -> str | None:
    tool_input = hook_input.get("tool_input")
    if not isinstance(tool_input, dict):
        tool_input = {}
    for key in ("file_path", "filePath", "path", "target_path", "targetPath", "doc_path", "docPath"):
        value = _string_value(tool_input.get(key))
        if value:
            return value
    return None


def _is_protected_target(repo_root: str, raw_path: str) -> bool:
    target = Path(raw_path)
    if target.is_absolute():
        try:
            relative = target.resolve().relative_to(Path(repo_root).resolve())
        except ValueError:
            return False
        target_rel = str(relative).replace("\\", "/")
    else:
        target_rel = raw_path.replace("\\", "/").lstrip("./")
    return any(target_rel == prefix or target_rel.startswith(prefix.rstrip("/") + "/") for prefix in PROTECTED_REL_PREFIXES)


def _actor_for(hook_input: dict) -> str:
    """Best-effort actor label. OS user is always available; enrich with the
    session/interaction id when the hook payload carries one."""
    user = ""
    try:
        user = getpass.getuser()
    except Exception:
        user = "unknown"
    for key in ("session_id", "sessionId", "conversation_id", "conversationId", "interaction_id", "interactionId"):
        if _string_value(hook_input.get(key)):
            return f"{user}:{_string_value(hook_input.get(key))}"
    return user


def _record(repo_root: str, hook_input: dict, target_path: str) -> None:
    log_dir = Path(repo_root) / DIR_WORKFLOW / DIR_RUNTIME / DIR_HOOKS
    log_dir.mkdir(parents=True, exist_ok=True)
    record = {
        "event": "spec-write-initiated",
        "ts": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "actor": _actor_for(hook_input),
        "tool": _string_value(hook_input.get("tool_name", hook_input.get("toolName"))).lower() or "unknown",
        "file": target_path.replace("\\", "/"),
        # No confirmation signal exists in the preToolUse payload: an
        # unverified write is *recorded*, never blocked.
        "verified": False,
    }
    with (log_dir / AUDIT_FILE).open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, ensure_ascii=False) + "\n")


def main() -> int:
    try:
        hook_input = _safe_payload()
        tool_name = _string_value(
            hook_input.get("tool_name", hook_input.get("toolName"))
        ).lower()
        if tool_name not in WRITE_TOOLS:
            print(json.dumps({"permission": "allow"}), flush=True)
            return 0

        target_path = _extract_target_path(hook_input)
        if not target_path:
            print(json.dumps({"permission": "allow"}), flush=True)
            return 0

        repo_root = find_repo_root(_string_value(hook_input.get("cwd"), os.getcwd()))
        if not repo_root or not _is_protected_target(repo_root, target_path):
            print(json.dumps({"permission": "allow"}), flush=True)
            return 0

        # Recording failure must never block the write: swallow and allow.
        try:
            _record(repo_root, hook_input, target_path)
        except Exception:
            pass
    except Exception:
        pass
    print(json.dumps({"permission": "allow"}), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())