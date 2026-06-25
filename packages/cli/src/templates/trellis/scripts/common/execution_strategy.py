#!/usr/bin/env python3
"""Suggest Development Strategy Contract execution_mode and isolation from task signals."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from .git import run_git
from .task_gates import read_strategy_contract, task_closeout_profile

_RULES_CACHE: dict | None = None


@dataclass
class ExecutionStrategySuggestion:
    skipped: bool = False
    profile: str = ""
    execution_mode: str = ""
    isolation: str = ""
    reasons: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    signals: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _rules_path() -> Path:
    return Path(__file__).resolve().parent.parent.parent / "config" / "execution-strategy-rules.json"


def load_execution_strategy_rules() -> dict:
    global _RULES_CACHE
    if _RULES_CACHE is not None:
        return _RULES_CACHE
    path = _rules_path()
    if not path.is_file():
        _RULES_CACHE = {
            "version": 1,
            "doc_only_capabilities": ["markdown-documentation"],
            "code_capabilities": [],
            "code_path_segments": ["src", "packages", "scripts"],
            "pair_warnings": [],
        }
        return _RULES_CACHE
    _RULES_CACHE = json.loads(path.read_text(encoding="utf-8"))
    return _RULES_CACHE


def resolve_git_package_root(repo_root: Path, task_data: dict) -> Path | None:
    """Return a directory inside a git worktree suitable for prepare-child-worktree."""
    candidates: list[Path] = []
    package = task_data.get("package")
    if isinstance(package, str) and package.strip():
        candidates.append(repo_root / package.strip().replace("\\", "/"))
    scope = task_data.get("scope")
    if isinstance(scope, str) and scope.strip():
        first = scope.strip().replace("\\", "/").split("/")[0]
        if first:
            candidates.append(repo_root / first)
    candidates.append(repo_root)

    seen: set[str] = set()
    for candidate in candidates:
        key = str(candidate.resolve()) if candidate.exists() else str(candidate)
        if key in seen:
            continue
        seen.add(key)
        if not candidate.is_dir():
            continue
        rc, out, _ = run_git(["rev-parse", "--is-inside-work-tree"], cwd=candidate)
        if rc == 0 and out.strip().lower() == "true":
            return candidate
    return None


def _path_hits_code_segment(repo_root: Path, rel: str, segments: list[str]) -> bool:
    parts = [p for p in rel.replace("\\", "/").split("/") if p]
    return any(part in segments for part in parts)


def _capabilities_list(contract: dict) -> list[str]:
    raw = contract.get("optional_capabilities")
    if not isinstance(raw, list):
        return []
    return [str(item).strip() for item in raw if isinstance(item, str) and item.strip()]


def collect_signals(repo_root: Path, task_dir: Path, task_data: dict) -> dict[str, Any]:
    rules = load_execution_strategy_rules()
    profile = task_closeout_profile(task_dir, task_data)
    contract, _ = read_strategy_contract(task_dir)
    caps = _capabilities_list(contract)
    doc_only_set = set(rules.get("doc_only_capabilities") or [])
    code_cap_set = set(rules.get("code_capabilities") or [])
    segments = list(rules.get("code_path_segments") or [])

    has_parent = bool(task_data.get("parent"))
    children = task_data.get("children")
    has_children = isinstance(children, list) and any(isinstance(c, str) for c in children)

    touches_code = False
    if caps and any(c in code_cap_set for c in caps):
        touches_code = True
    package = task_data.get("package")
    if isinstance(package, str) and package.strip():
        if _path_hits_code_segment(repo_root, package.strip(), segments):
            touches_code = True
    scope = task_data.get("scope")
    if isinstance(scope, str) and scope.strip():
        if _path_hits_code_segment(repo_root, scope.strip(), segments):
            touches_code = True
    if (
        profile == "full"
        and (task_dir / "design.md").is_file()
        and caps
        and not all(c in doc_only_set for c in caps)
    ):
        touches_code = True
    if profile == "full" and (task_dir / "design.md").is_file() and not caps:
        touches_code = True

    doc_only = bool(caps) and all(c in doc_only_set for c in caps)
    if profile == "full" and caps and doc_only and not touches_code:
        doc_only = True

    git_root = resolve_git_package_root(repo_root, task_data)
    return {
        "profile": profile,
        "has_parent": has_parent,
        "has_children": has_children,
        "touches_code": touches_code,
        "doc_only": doc_only,
        "git_package_root": git_root.as_posix() if git_root else None,
        "package": package if isinstance(package, str) else None,
        "scope": scope if isinstance(scope, str) else None,
        "optional_capabilities": caps,
    }


def validate_strategy_pair(execution_mode: str, isolation: str) -> list[str]:
    rules = load_execution_strategy_rules()
    warnings: list[str] = []
    for entry in rules.get("pair_warnings") or []:
        if not isinstance(entry, dict):
            continue
        if (
            entry.get("execution_mode") == execution_mode
            and entry.get("isolation") == isolation
        ):
            msg = entry.get("message")
            if isinstance(msg, str) and msg.strip():
                warnings.append(msg.strip())
    return warnings


def suggest_execution_strategy(
    repo_root: Path,
    task_dir: Path,
    task_data: dict,
) -> ExecutionStrategySuggestion:
    signals = collect_signals(repo_root, task_dir, task_data)
    profile = signals["profile"]
    if profile == "lite":
        return ExecutionStrategySuggestion(
            skipped=True,
            profile=profile,
            reasons=["Lite task: no full Development Strategy Contract required"],
            signals=signals,
        )

    reasons: list[str] = []
    warnings: list[str] = []

    if signals["has_parent"]:
        mode = "child-task"
        if signals["git_package_root"]:
            iso = "git-worktree"
            reasons.append("Child task with git package root → git-worktree isolation")
        else:
            iso = "main-worktree"
            reasons.append("Child task without resolvable git root → main-worktree (degraded)")
            warnings.append("No git package root; child git-worktree not recommended")
    elif signals["has_children"] or profile == "parent":
        mode = "inline"
        iso = "main-worktree"
        reasons.append("Parent task orchestrates children in main session")
    elif profile == "full" and signals["doc_only"] and not signals["touches_code"]:
        mode = "inline"
        iso = "main-worktree"
        reasons.append("Full task with documentation-only capabilities")
    elif profile == "full":
        mode = "worker"
        iso = "main-worktree"
        reasons.append("Full task touching code → worker (trellis-implement / check sub-agents)")
    else:
        mode = "inline"
        iso = "main-worktree"
        reasons.append(f"Default for profile={profile}")

    warnings.extend(validate_strategy_pair(mode, iso))
    return ExecutionStrategySuggestion(
        profile=profile,
        execution_mode=mode,
        isolation=iso,
        reasons=reasons,
        warnings=warnings,
        signals=signals,
    )


def format_contract_yaml_block(suggestion: ExecutionStrategySuggestion) -> str:
    if suggestion.skipped:
        return "# Lite task: Development Strategy Contract not required\n"
    lines = [
        "## Development Strategy Contract (suggested — paste into implement.md)",
        "",
        "```yaml",
        f"execution_mode: {suggestion.execution_mode}",
        f"isolation: {suggestion.isolation}",
        "verification_profile: standard",
        "retrieval_profile: structure",
        "optional_capabilities: []",
        "quality_gates:",
        "  mode: profile",
        "  profile: standard",
        "  enabled: []",
        "  disabled: []",
        "```",
        "",
    ]
    if suggestion.reasons:
        lines.append("Reasons:")
        for item in suggestion.reasons:
            lines.append(f"- {item}")
    if suggestion.warnings:
        lines.append("")
        lines.append("Warnings:")
        for item in suggestion.warnings:
            lines.append(f"- {item}")
    lines.append("")
    return "\n".join(lines)


def contract_drift_warnings(
    repo_root: Path,
    task_dir: Path,
    task_data: dict,
    contract: dict,
) -> list[str]:
    """Compare approved contract to suggestion; advisory only."""
    if not contract:
        return []
    suggestion = suggest_execution_strategy(repo_root, task_dir, task_data)
    if suggestion.skipped:
        return []
    warnings: list[str] = []
    for key in ("execution_mode", "isolation"):
        approved = contract.get(key)
        suggested = getattr(suggestion, key, "")
        if approved and suggested and approved != suggested:
            warnings.append(
                f"contract {key}={approved!r} differs from suggestion {suggested!r}"
            )
    return warnings