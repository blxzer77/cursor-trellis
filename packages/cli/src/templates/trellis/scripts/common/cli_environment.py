#!/usr/bin/env python3
"""Classify common Trellis CLI environment blockers and suggest repairs."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class EnvironmentBlocker:
    """A classified environment issue with a user-facing repair hint."""

    kind: str
    summary: str
    repair: str


def classify_git_failure(detail: str) -> EnvironmentBlocker | None:
    """Map git stderr/stdout into a blocker kind and repair hint."""
    text = (detail or "").strip()
    if not text:
        return None
    lowered = text.lower()

    if "dubious ownership" in lowered or "safe.directory" in lowered:
        return EnvironmentBlocker(
            kind="git-safe-directory",
            summary="Git refused the repository (safe.directory / dubious ownership).",
            repair=(
                "Add the repo to Git safe.directory, e.g. "
                "`git config --global --add safe.directory <absolute-repo-path>`, "
                "or run one-off commands with "
                "`git -c safe.directory=<absolute-repo-path> ...`."
            ),
        )

    if "not a git repository" in lowered or "not a git repo" in lowered:
        return EnvironmentBlocker(
            kind="non-git-root",
            summary="This directory is not inside a Git work tree.",
            repair=(
                "Run Git commands from a cloned repository root, or initialize Git here "
                "only when the workflow explicitly requires it."
            ),
        )

    if (
        "not a git worktree" in lowered
        or ("rev-parse" in lowered and "true" not in lowered)
    ):
        if "fatal:" in lowered or "not a git" in lowered:
            return EnvironmentBlocker(
                kind="non-git-root",
                summary="Git repository required for this command.",
                repair=(
                    "Use a Trellis project inside a Git clone. "
                    "Worktree and merge commands need `git rev-parse --is-inside-work-tree` to succeed."
                ),
            )

    return None


def classify_subprocess_failure(detail: str) -> EnvironmentBlocker | None:
    """Classify non-git subprocess failures (npm cache, permissions)."""
    text = (detail or "").strip()
    if not text:
        return None
    lowered = text.lower()

    if "eperm" in lowered or "eacces" in lowered:
        if "npm" in lowered or "cache" in lowered or "appdata" in lowered:
            return EnvironmentBlocker(
                kind="npm-cache-eperm",
                summary="npm cache or install path is not writable (EPERM/EACCES).",
                repair=(
                    "Close processes locking the npm cache, run the terminal as a user with "
                    "write access, or clear/repair the npm cache directory. "
                    "Do not run destructive cache wipes without explicit approval."
                ),
            )
        return EnvironmentBlocker(
            kind="permission-denied",
            summary="Command failed with EPERM/EACCES (permission or sandbox restriction).",
            repair=(
                "Retry from a shell with sufficient permissions, or adjust sandbox/policy "
                "so child_process can spawn the required tool."
            ),
        )

    return None


def format_git_repo_errors(raw_errors: list[str]) -> list[str]:
    """Rewrite generic git repo errors with classified summaries."""
    out: list[str] = []
    for item in raw_errors:
        if not item.startswith("Git repository required:"):
            out.append(item)
            continue
        detail = item.split(":", 1)[-1].strip()
        blocker = classify_git_failure(detail)
        if blocker:
            out.append(f"[{blocker.kind}] {blocker.summary} ({detail})")
        else:
            out.append(item)
    return out


def print_environment_repair_hints(
    raw_errors: list[str],
    *,
    stream=None,
) -> None:
    """Print deduplicated repair hints for classified errors."""
    import sys

    if stream is None:
        stream = sys.stderr

    from .log import Colors, colored

    seen: set[str] = set()
    hints: list[str] = []

    for item in raw_errors:
        detail = item
        if ":" in item and item.startswith("["):
            detail = item.split(")", 1)[-1].strip().strip("()")
        for classifier in (classify_git_failure, classify_subprocess_failure):
            blocker = classifier(detail)
            if blocker and blocker.repair not in seen:
                seen.add(blocker.repair)
                hints.append(f"[{blocker.kind}] {blocker.repair}")

    if not hints:
        return

    print(colored("Environment repair:", Colors.BLUE), file=stream)
    for hint in hints:
        print(f"  - {hint}", file=stream)


def optional_capability_note(capabilities: list[str] | None) -> str | None:
    """Return a short note when optional capabilities are declared but unavailable."""
    if not capabilities:
        return None
    names = [c for c in capabilities if isinstance(c, str) and c.strip()]
    if not names:
        return None
    joined = ", ".join(names)
    return (
        f"Optional capabilities declared in implement.md ({joined}) may require platform "
        "support or extra setup; absence is not fatal unless the task contract requires them."
    )