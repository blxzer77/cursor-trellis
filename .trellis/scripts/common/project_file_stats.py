#!/usr/bin/env python3
"""Estimate project file counts for router large-repo heuristics (R-CR-013)."""

from __future__ import annotations

import subprocess
from pathlib import Path

DEFAULT_LARGE_PROJECT_THRESHOLD = 2000

# Directories skipped when walking without git (aligned with common VCS ignore patterns).
_SKIP_DIR_NAMES = frozenset(
    {
        ".git",
        ".trellis",
        ".venv",
        "venv",
        "node_modules",
        "dist",
        "build",
        "out",
        ".next",
        "coverage",
        "__pycache__",
        ".pytest_cache",
        ".mypy_cache",
        ".turbo",
        ".codegraph",
        ".cursor",
    }
)


def count_project_files(repo_root: Path) -> int:
    """Count tracked + untracked-but-not-ignored files under repo_root (best effort)."""
    root = repo_root.resolve()
    git_count = _count_via_git(root)
    if git_count is not None:
        return git_count
    return _count_via_walk(root)


def _count_via_git(root: Path) -> int | None:
    if not (root / ".git").exists():
        return None
    try:
        proc = subprocess.run(
            ["git", "-C", str(root), "ls-files", "-co", "--exclude-standard"],
            capture_output=True,
            text=True,
            check=False,
            timeout=120,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    if proc.returncode != 0:
        return None
    lines = [line for line in proc.stdout.splitlines() if line.strip()]
    return len(lines)


def _count_via_walk(root: Path) -> int:
    total = 0
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if any(part in _SKIP_DIR_NAMES for part in path.relative_to(root).parts):
            continue
        total += 1
    return total


def resolve_project_file_count_arg(
    raw: str | int | None,
    *,
    repo_root: Path,
) -> int | None:
    """Parse CLI `--project-file-count` (int, `auto`, or omit → auto)."""
    if raw is None:
        return count_project_files(repo_root)
    if isinstance(raw, int):
        return raw
    text = str(raw).strip().lower()
    if text in {"", "auto"}:
        return count_project_files(repo_root)
    try:
        return int(text)
    except ValueError as error:
        raise ValueError(
            f"invalid --project-file-count {raw!r}; use a positive integer or 'auto'"
        ) from error