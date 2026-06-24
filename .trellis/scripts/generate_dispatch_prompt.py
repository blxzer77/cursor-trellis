#!/usr/bin/env python3
"""
CLI wrapper for subagent dispatch prompt generation (D-1 path).

Usage:
    python ./.trellis/scripts/generate_dispatch_prompt.py --agent research
    python ./.trellis/scripts/generate_dispatch_prompt.py --agent implement --task .trellis/tasks/06-23-subagent-smoke
    python ./.trellis/scripts/generate_dispatch_prompt.py --agent research --repo-root d:/MyHarness/Trellis

Outputs the complete dispatch prompt to stdout. The main session captures
this output and passes it as the `prompt` parameter to `Task(subagent_type=..., prompt=<generated>)`.

This replaces the broken preToolUse hook injection path (hook does not fire
for Task tool in Cursor 3.8.22). The generated prompt carries:
  - Role identity ("You are the Trellis Research/Implement/Check Agent")
  - Write scope constraints (Write ALLOWED / Write FORBIDDEN)
  - Recursion guard
  - Dynamic context (prd.md, design.md, implement.md, spec tree, jsonl files)
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate a complete Trellis subagent dispatch prompt."
    )
    parser.add_argument(
        "--agent",
        required=True,
        choices=["research", "implement", "check"],
        help="Subagent role to generate prompt for.",
    )
    parser.add_argument(
        "--task",
        default=None,
        help="Task directory path (absolute or relative to repo root). "
        "If omitted, resolves the currently selected task.",
    )
    parser.add_argument(
        "--repo-root",
        default=None,
        help="Repository root path. If omitted, auto-detect via .trellis or .git.",
    )
    parser.add_argument(
        "--finish",
        action="store_true",
        help="Use finish context (check agent only, final pre-PR verification).",
    )
    parser.add_argument(
        "--max-chars",
        type=int,
        default=None,
        help="Truncate injected context at this character count.",
    )
    args = parser.parse_args()

    # Resolve repo root
    if args.repo_root:
        repo_root = Path(args.repo_root).resolve()
    else:
        repo_root = _find_repo_root(Path.cwd())
        if not repo_root:
            print("ERROR: could not find repo root (no .trellis or .git upward)", file=sys.stderr)
            return 1

    # Make scripts importable — workspace root first (subagent_dispatch.py lives there),
    # then repo_root's own scripts (may be a subproject with different common/)
    workspace_root = _find_workspace_root(repo_root)
    if workspace_root and workspace_root != repo_root:
        ws_scripts = workspace_root / ".trellis" / "scripts"
        if str(ws_scripts) not in sys.path:
            sys.path.insert(0, str(ws_scripts))

    scripts_dir = repo_root / ".trellis" / "scripts"
    if str(scripts_dir) not in sys.path:
        sys.path.insert(1, str(scripts_dir))

    from common.subagent_dispatch import build_dispatch_prompt  # type: ignore[import-not-found]

    # Resolve task directory
    if args.task:
        task_dir = Path(args.task)
        if not task_dir.is_absolute():
            task_dir = repo_root / task_dir
        task_dir = task_dir.resolve()
    else:
        task_dir = _resolve_selected_task(repo_root)
        if not task_dir:
            print(
                "ERROR: no --task specified and no selected task found. "
                "Run `python ./.trellis/scripts/task.py select <task>` first.",
                file=sys.stderr,
            )
            return 1

    if not task_dir.is_dir():
        print(f"ERROR: task directory not found: {task_dir}", file=sys.stderr)
        return 1

    prompt, warnings, errors = build_dispatch_prompt(
        repo_root,
        task_dir,
        args.agent,
        finish=args.finish,
        max_chars=args.max_chars,
        require_in_progress=False,
    )

    for w in warnings:
        print(f"WARN: {w}", file=sys.stderr)
    for e in errors:
        print(f"ERROR: {e}", file=sys.stderr)

    if not prompt:
        print("ERROR: failed to generate prompt (see errors above)", file=sys.stderr)
        return 1

    # Output the prompt to stdout — the caller captures this
    print(prompt)
    return 0


def _find_repo_root(start: Path) -> Path | None:
    current = start.resolve()
    while current != current.parent:
        if (current / ".trellis").is_dir() or (current / ".git").exists():
            return current
        current = current.parent
    return None


def _find_workspace_root(start: Path) -> Path | None:
    """Find the outermost directory with .trellis (workspace root, not subproject)."""
    found = None
    current = start.resolve()
    while current != current.parent:
        if (current / ".trellis").is_dir():
            found = current
        current = current.parent
    return found


def _resolve_selected_task(repo_root: Path) -> Path | None:
    try:
        from common.active_task import resolve_selected_task  # type: ignore[import-not-found]
        result = resolve_selected_task(repo_root, {}, platform="cursor")
        if result.task_path:
            task_path = Path(result.task_path)
            if not task_path.is_absolute():
                task_path = repo_root / task_path
            return task_path
    except Exception:
        pass
    return None


if __name__ == "__main__":
    sys.exit(main())
