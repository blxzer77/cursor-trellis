#!/usr/bin/env python3
"""
Task CRUD operations.

Provides:
    ensure_tasks_dir   - Ensure tasks directory exists
    cmd_create         - Create a new task
    cmd_archive        - Archive completed task
    cmd_set_branch     - Set git branch for task
    cmd_set_base_branch - Set PR target branch
    cmd_set_scope      - Set scope for PR title
    cmd_add_subtask    - Link child task to parent
    cmd_remove_subtask - Unlink child task from parent
    cmd_prepare_child_worktree - Create/register Child git worktree
    cmd_set_child_state - Set Child-reported task-map state
    cmd_integrate_child - Set Parent-controlled Child integration state
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path

from .config import (
    get_packages,
    get_session_auto_commit,
    is_monorepo,
    resolve_package,
    validate_package,
)
from .cli_environment import format_git_repo_errors, print_environment_repair_hints
from .git import run_git
from .io import read_json, write_json
from .log import Colors, colored
from .paths import (
    DIR_ARCHIVE,
    DIR_TASKS,
    DIR_WORKFLOW,
    FILE_TASK_JSON,
    generate_task_date_prefix,
    get_developer,
    get_repo_root,
    get_tasks_dir,
)
from .safe_commit import (
    print_gitignore_warning,
    safe_archive_paths_to_add,
    safe_git_add,
)
from .task_gates import (
    BASELINE_GATE,
    archive_repair_hints,
    build_spec_update_scaffold,
    prepare_archive_evidence,
    validate_archive,
    write_gate_record,
)
from .task_map import (
    CHILD_STATES,
    CHILD_REPORT_STATES,
    PARENT_CONTROLLED_STATES,
    ensure_task_map,
    get_child_state,
    record_child_worktree,
    remove_child_from_task_map,
    set_child_state,
    set_parent_child_integration_state,
    validate_parent_child_integration,
)
from .tasks import parent_archive_child_followup_hint
from .task_utils import (
    archive_task_complete,
    find_task_by_name,
    resolve_task_dir,
    run_task_hooks,
)


# =============================================================================
# Helper Functions
# =============================================================================

def _slugify(title: str) -> str:
    """Convert title to slug (only works with ASCII)."""
    result = title.lower()
    result = re.sub(r"[^a-z0-9]", "-", result)
    result = re.sub(r"-+", "-", result)
    result = result.strip("-")
    return result


def ensure_tasks_dir(repo_root: Path) -> Path:
    """Ensure tasks directory exists."""
    tasks_dir = get_tasks_dir(repo_root)
    archive_dir = tasks_dir / "archive"

    if not tasks_dir.exists():
        tasks_dir.mkdir(parents=True)
        print(colored(f"Created tasks directory: {tasks_dir}", Colors.GREEN), file=sys.stderr)

    if not archive_dir.exists():
        archive_dir.mkdir(parents=True)

    return tasks_dir


def _find_archived_task_by_dir_name(tasks_dir: Path, dir_name: str) -> Path | None:
    """Find an archived task directory with the exact active-task dir name."""
    archive_dir = tasks_dir / DIR_ARCHIVE
    if not archive_dir.is_dir():
        return None

    for month_dir in sorted(archive_dir.iterdir()):
        if not month_dir.is_dir():
            continue
        candidate = month_dir / dir_name
        if candidate.is_dir():
            return candidate

    return None


def _repo_relative_path(path: Path, repo_root: Path) -> str:
    """Format a path relative to the repo root when possible."""
    try:
        return path.relative_to(repo_root).as_posix()
    except ValueError:
        return str(path)


def _short_cli_ref(value: str | None) -> bool:
    """Return True for a compact single-argument ref/path value."""
    if not value or not isinstance(value, str):
        return False
    if value.startswith("-"):
        return False
    if len(value) > 240:
        return False
    return "\n" not in value and "\r" not in value


def _validate_git_repo(repo_root: Path) -> list[str]:
    rc, out, err = run_git(["rev-parse", "--is-inside-work-tree"], cwd=repo_root)
    if rc != 0 or out.strip() != "true":
        detail = err.strip() or out.strip() or "not a Git worktree"
        return format_git_repo_errors([f"Git repository required: {detail}"])
    return []


def _validate_branch_name(repo_root: Path, branch: str) -> list[str]:
    if not _short_cli_ref(branch):
        return ["branch must be a short git branch name"]
    rc, _, err = run_git(["check-ref-format", "--branch", branch], cwd=repo_root)
    if rc != 0:
        return [f"invalid branch name: {branch} ({err.strip() or 'git check-ref-format failed'})"]
    return []


def _git_commit_exists(repo_root: Path, ref: str | None) -> bool:
    if not _short_cli_ref(ref):
        return False
    rc, _, _ = run_git(["rev-parse", "--verify", f"{ref}^{{commit}}"], cwd=repo_root)
    return rc == 0


def _git_branch_exists(repo_root: Path, branch: str) -> bool:
    rc, _, _ = run_git(
        ["rev-parse", "--verify", "--quiet", f"refs/heads/{branch}"],
        cwd=repo_root,
    )
    return rc == 0


def _default_child_worktree_path(repo_root: Path, child_dir: Path) -> Path:
    return repo_root / DIR_WORKFLOW / "worktrees" / child_dir.name


def _resolve_child_worktree_path(repo_root: Path, child_dir: Path, raw_path: str | None) -> tuple[Path | None, str | None]:
    path = Path(raw_path) if raw_path else _default_child_worktree_path(repo_root, child_dir)
    if not path.is_absolute():
        path = repo_root / path
    resolved = path.resolve()
    worktree_root = (repo_root / DIR_WORKFLOW / "worktrees").resolve()
    try:
        resolved.relative_to(worktree_root)
    except ValueError:
        return None, f"worktree path must stay under {_repo_relative_path(worktree_root, repo_root)}"
    return resolved, None


def _non_trellis_dirty_paths(repo_root: Path) -> list[str]:
    rc, out, err = run_git(["status", "--porcelain"], cwd=repo_root)
    if rc != 0:
        return [err.strip() or "git status failed"]

    dirty: list[str] = []
    for raw_line in out.splitlines():
        path = raw_line[3:].strip()
        if " -> " in path:
            path = path.split(" -> ", 1)[1].strip()
        path = path.replace("\\", "/").strip('"')
        if path and path != ".trellis" and not path.startswith(".trellis/"):
            dirty.append(path)
    return dirty


def _validate_merge_execution(repo_root: Path, state: str, ref: str | None) -> list[str]:
    errors = _validate_git_repo(repo_root)
    if state != "integrated":
        errors.append("--execute-merge is only valid with state `integrated`")
    if not _short_cli_ref(ref):
        errors.append("--execute-merge requires --ref")
    elif not _git_commit_exists(repo_root, ref):
        errors.append(f"merge ref does not resolve to a commit: {ref}")

    dirty = _non_trellis_dirty_paths(repo_root)
    if dirty:
        errors.append(
            "non-Trellis working tree changes block merge execution: "
            + ", ".join(dirty[:8])
        )
    return errors


# =============================================================================
# Sub-agent platform detection + JSONL seeding
# =============================================================================

# Config directories of platforms that consume implement.jsonl / check.jsonl.
# Keep in sync with src/types/ai-tools.ts AI_TOOLS entries — these are the
# platforms listed in workflow.md's "agent-capable" Skill Routing block
# (Class-1 hook-inject + Class-2 pull-based preludes). Kilo / Antigravity /
# Windsurf are NOT in this list: they do not consume JSONL.
_SUBAGENT_CONFIG_DIRS: tuple[str, ...] = (
    ".claude",
    ".cursor",
    ".codex",
    ".kiro",
    ".gemini",
    ".opencode",
    ".qoder",
    ".codebuddy",
    ".factory",   # Factory Droid
    ".github/copilot",
    ".pi",        # Pi Agent
)

_SEED_EXAMPLE = (
    "Fill with {\"file\": \"<path>\", \"reason\": \"<why>\"}. "
    "Put spec/research files only — no code paths. "
    "Run `python .trellis/scripts/get_context.py --mode packages` to list available specs. "
    "Delete this line once real entries are added."
)


def _has_subagent_platform(repo_root: Path) -> bool:
    """Return True if any sub-agent-capable platform is configured.

    Detected by probing well-known config directories at the repo root. Used
    only to decide whether ``task.py create`` should seed empty
    ``implement.jsonl`` / ``check.jsonl`` files.
    """
    for config_dir in _SUBAGENT_CONFIG_DIRS:
        if (repo_root / config_dir).is_dir():
            return True
    return False


def _write_seed_jsonl(path: Path) -> None:
    """Write a one-line seed JSONL file with a self-describing ``_example``.

    The seed row has no ``file`` field, so downstream consumers (hooks +
    preludes) that iterate entries via ``item.get("file")`` naturally skip
    it. The row exists purely as an in-file prompt for the AI curator.
    """
    seed = {"_example": _SEED_EXAMPLE}
    path.write_text(json.dumps(seed, ensure_ascii=False) + "\n", encoding="utf-8")


def _default_prd_content(title: str, description: str | None = None) -> str:
    """Return the default PRD skeleton created with every task."""
    goal = (description or "").strip() or "TBD."
    heading = title.strip() or "Untitled task"
    return f"""# {heading}

## Goal

{goal}

## Requirements

- TBD

## Acceptance Criteria

- [ ] TBD

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start-execution --check`.
"""


# =============================================================================
# Command: create
# =============================================================================

def cmd_create(args: argparse.Namespace) -> int:
    """Create a new task."""
    repo_root = get_repo_root()

    if not args.title:
        print(colored("Error: title is required", Colors.RED), file=sys.stderr)
        return 1

    # Validate --package (CLI source: fail-fast)
    package: str | None = getattr(args, "package", None)
    if not is_monorepo(repo_root):
        # Single-repo: ignore --package, no package prefix
        if package:
            print(colored(f"Warning: --package ignored in single-repo project", Colors.YELLOW), file=sys.stderr)
        package = None
    elif package:
        if not validate_package(package, repo_root):
            packages = get_packages(repo_root)
            available = ", ".join(sorted(packages.keys())) if packages else "(none)"
            print(colored(f"Error: unknown package '{package}'. Available: {available}", Colors.RED), file=sys.stderr)
            return 1
    else:
        # Inferred: default_package → None (no task.json yet for create)
        package = resolve_package(repo_root=repo_root)

    # Default assignee to current developer
    assignee = args.assignee
    if not assignee:
        assignee = get_developer(repo_root)
        if not assignee:
            print(colored("Error: No developer set. Run init_developer.py first or use --assignee", Colors.RED), file=sys.stderr)
            return 1

    ensure_tasks_dir(repo_root)

    # Get current developer as creator
    creator = get_developer(repo_root) or assignee

    # Generate slug if not provided
    slug = args.slug or _slugify(args.title)
    if not slug:
        print(colored("Error: could not generate slug from title", Colors.RED), file=sys.stderr)
        return 1

    # Create task directory with MM-DD-slug format
    tasks_dir = get_tasks_dir(repo_root)
    date_prefix = generate_task_date_prefix()
    dir_name = f"{date_prefix}-{slug}"
    task_dir = tasks_dir / dir_name
    task_json_path = task_dir / FILE_TASK_JSON

    archived_task_dir = _find_archived_task_by_dir_name(tasks_dir, dir_name)
    if archived_task_dir:
        print(colored(f"Error: Task already archived: {dir_name}", Colors.RED), file=sys.stderr)
        print(f"Archived at: {_repo_relative_path(archived_task_dir, repo_root)}", file=sys.stderr)
        print("Use a new slug if you intend to create a new task.", file=sys.stderr)
        return 1

    if task_dir.exists():
        print(colored(f"Warning: Task directory already exists: {dir_name}", Colors.YELLOW), file=sys.stderr)
    else:
        task_dir.mkdir(parents=True)

    today = datetime.now().strftime("%Y-%m-%d")

    # Record current branch as base_branch (PR target)
    _, branch_out, _ = run_git(["branch", "--show-current"], cwd=repo_root)
    current_branch = branch_out.strip() or "main"

    task_data = {
        "id": slug,
        "name": slug,
        "title": args.title,
        "description": args.description or "",
        "status": "planning",
        "dev_type": None,
        "scope": None,
        "package": package,
        "priority": args.priority,
        "creator": creator,
        "assignee": assignee,
        "createdAt": today,
        "completedAt": None,
        "branch": None,
        "base_branch": current_branch,
        "worktree_path": None,
        "commit": None,
        "pr_url": None,
        "subtasks": [],
        "children": [],
        "parent": None,
        "relatedFiles": [],
        "notes": "",
        "meta": {},
    }

    write_json(task_json_path, task_data)

    prd_path = task_dir / "prd.md"
    if not prd_path.exists():
        prd_path.write_text(
            _default_prd_content(args.title, args.description),
            encoding="utf-8",
        )

    # Seed implement.jsonl / check.jsonl for sub-agent-capable platforms.
    # Agent curates real entries during planning when the task needs them.
    # Agent-less platforms (Kilo / Antigravity / Windsurf) skip this — they
    # load specs via the trellis-before-dev skill instead of JSONL.
    seeded_jsonl = False
    if _has_subagent_platform(repo_root):
        for jsonl_name in ("implement.jsonl", "check.jsonl"):
            jsonl_path = task_dir / jsonl_name
            if not jsonl_path.exists():
                _write_seed_jsonl(jsonl_path)
        seeded_jsonl = True

    # Handle --parent: establish bidirectional link
    if args.parent:
        parent_dir = resolve_task_dir(args.parent, repo_root)
        parent_json_path = parent_dir / FILE_TASK_JSON
        if not parent_json_path.is_file():
            print(colored(f"Warning: Parent task.json not found: {args.parent}", Colors.YELLOW), file=sys.stderr)
        else:
            parent_data = read_json(parent_json_path)
            if parent_data:
                # Add child to parent's children list
                parent_children = parent_data.get("children", [])
                if dir_name not in parent_children:
                    parent_children.append(dir_name)
                    parent_data["children"] = parent_children
                    write_json(parent_json_path, parent_data)

                # Set parent in child's task.json
                task_data["parent"] = parent_dir.name
                write_json(task_json_path, task_data)
                ensure_task_map(
                    parent_dir,
                    parent_data,
                    list(parent_data.get("children", [])),
                    f"Linked Child `{dir_name}`.",
                )

                print(colored(f"Linked as child of: {parent_dir.name}", Colors.GREEN), file=sys.stderr)

    print(colored(f"Created task: {dir_name}", Colors.GREEN), file=sys.stderr)
    print("", file=sys.stderr)
    print(colored("Next steps:", Colors.BLUE), file=sys.stderr)
    print("  - Fill prd.md with requirements and acceptance criteria", file=sys.stderr)
    print(f"  - Select it when ready: python ./.trellis/scripts/task.py select {DIR_WORKFLOW}/{DIR_TASKS}/{dir_name}", file=sys.stderr)
    print("  - Lightweight task: PRD-only is valid", file=sys.stderr)
    print("  - Complex task: add design.md and implement.md before task.py start-execution --check", file=sys.stderr)
    if seeded_jsonl:
        print(
            "  - Curate implement.jsonl / check.jsonl as spec/research manifests when sub-agents need context",
            file=sys.stderr,
        )
    print("  - Use /trellis:continue or phase context to decide the next step", file=sys.stderr)
    print("", file=sys.stderr)

    # Output relative path for script chaining
    print(f"{DIR_WORKFLOW}/{DIR_TASKS}/{dir_name}")

    run_task_hooks("after_create", task_json_path, repo_root)
    return 0


# =============================================================================
# Command: archive / prepare-archive-evidence
# =============================================================================

def cmd_prepare_archive_evidence(args: argparse.Namespace) -> int:
    """Append missing archive evidence sections to verify.md (non-destructive)."""
    repo_root = get_repo_root()
    task_name = args.name
    if not task_name:
        print(colored("Error: Task name is required", Colors.RED), file=sys.stderr)
        return 1

    task_dir = resolve_task_dir(task_name, repo_root)
    if not task_dir or not task_dir.is_dir():
        print(colored(f"Error: Task not found: {task_name}", Colors.RED), file=sys.stderr)
        return 1

    task_json_path = task_dir / FILE_TASK_JSON
    task_data = read_json(task_json_path) if task_json_path.is_file() else None
    dry_run = getattr(args, "dry_run", False)

    changed, messages = prepare_archive_evidence(
        task_dir, task_data, dry_run=dry_run
    )
    for msg in messages:
        print(msg)
    if not changed and messages and messages[0].startswith("task.json"):
        return 1

    guard = validate_archive(task_dir, task_data)
    if guard.ok:
        print(colored("Archive check: PASS (after prepare)", Colors.GREEN))
        return 0
    print(colored("Archive check: still blocked", Colors.YELLOW))
    for item in guard.errors:
        print(f"  - {item}")
    if task_data is not None:
        hints = archive_repair_hints(guard.errors, task_dir, task_data, guard)
        if hints:
            print(colored("Next steps:", Colors.BLUE))
            for hint in hints:
                print(f"  - {hint}")
    return 0 if changed else 1


def cmd_prepare_learning_scaffold(args: argparse.Namespace) -> int:
    """Print spec-update scaffolding for a task (stdout only; does not edit specs)."""
    repo_root = get_repo_root()
    task_name = args.name
    if not task_name:
        print(colored("Error: Task name is required", Colors.RED), file=sys.stderr)
        return 1

    task_dir = resolve_task_dir(task_name, repo_root)
    if not task_dir or not task_dir.is_dir():
        print(colored(f"Error: Task not found: {task_name}", Colors.RED), file=sys.stderr)
        return 1

    task_json_path = task_dir / FILE_TASK_JSON
    task_data = read_json(task_json_path) if task_json_path.is_file() else None
    if task_data is None:
        print(colored("Error: task.json missing or invalid", Colors.RED), file=sys.stderr)
        return 1

    trigger = getattr(args, "trigger", None)
    print(build_spec_update_scaffold(repo_root, task_dir, task_data, trigger=trigger))
    return 0


def _integrated_children_still_active(
    parent_dir: Path,
    child_names: list[str],
    tasks_dir: Path,
) -> list[tuple[str, Path]]:
    """Return (name, dir) for integrated children that remain in the active set."""
    pending: list[tuple[str, Path]] = []
    for child_name in child_names:
        if not isinstance(child_name, str):
            continue
        if get_child_state(parent_dir, child_name) != "integrated":
            continue
        child_dir = find_task_by_name(child_name, tasks_dir)
        if child_dir and child_dir.is_dir():
            pending.append((child_name, child_dir))
    return pending


def _archive_one_task(
    task_dir: Path,
    repo_root: Path,
    tasks_dir: Path,
    *,
    no_commit: bool,
) -> tuple[bool, list[str], str | None]:
    """Archive a single task directory after validate_archive passed.

    Returns (success, modified_child_names, archived_relative_path_or_none).
    """
    dir_name = task_dir.name
    task_json_path = task_dir / FILE_TASK_JSON
    task_data = read_json(task_json_path) if task_json_path.is_file() else None
    guard = validate_archive(task_dir, task_data)
    if not guard.ok:
        return False, [], None

    today = datetime.now().strftime("%Y-%m-%d")
    modified_children: list[str] = []
    if task_data:
        data = task_data
        if guard.baseline_record:
            write_gate_record(data, "full-task-complete", BASELINE_GATE, guard.baseline_record)
        data["status"] = "completed"
        data["completedAt"] = today
        write_json(task_json_path, data)

        task_children = data.get("children", [])
        if task_children:
            for child_name in task_children:
                child_dir_path = find_task_by_name(child_name, tasks_dir)
                if child_dir_path:
                    child_json = child_dir_path / FILE_TASK_JSON
                    if child_json.is_file():
                        child_data = read_json(child_json)
                        if child_data:
                            child_data["parent"] = None
                            write_json(child_json, child_data)
                            modified_children.append(child_dir_path.name)

    from .active_task import clear_task_from_sessions

    clear_task_from_sessions(str(task_dir), repo_root)
    result = archive_task_complete(task_dir, repo_root)
    if "archived_to" not in result:
        return False, modified_children, None

    archive_dest = Path(result["archived_to"])
    year_month = archive_dest.parent.name
    print(
        colored(f"Archived: {dir_name} -> archive/{year_month}/", Colors.GREEN),
        file=sys.stderr,
    )

    if not no_commit:
        if not _auto_commit_archive(dir_name, repo_root, modified_children):
            print(
                colored(
                    "Archive moved on disk, but git auto-commit did not complete. "
                    "Resolve `git status` before continuing.",
                    Colors.RED,
                ),
                file=sys.stderr,
            )
            return False, modified_children, None

    rel = f"{DIR_WORKFLOW}/{DIR_TASKS}/{DIR_ARCHIVE}/{year_month}/{dir_name}"
    archived_json = archive_dest / FILE_TASK_JSON
    run_task_hooks("after_archive", archived_json, repo_root)
    return True, modified_children, rel


def cmd_archive(args: argparse.Namespace) -> int:
    """Archive completed task."""
    repo_root = get_repo_root()
    task_name = args.name

    if not task_name:
        print(colored("Error: Task name is required", Colors.RED), file=sys.stderr)
        return 1

    tasks_dir = get_tasks_dir(repo_root)

    # Resolve task directory (supports task name, relative path, or absolute path)
    task_dir = resolve_task_dir(task_name, repo_root)

    if not task_dir or not task_dir.is_dir():
        print(colored(f"Error: Task not found: {task_name}", Colors.RED), file=sys.stderr)
        print("Active tasks:", file=sys.stderr)
        # Import lazily to avoid circular dependency
        from .tasks import iter_active_tasks
        for t in iter_active_tasks(tasks_dir):
            print(f"  - {t.dir_name}/", file=sys.stderr)
        return 1

    dir_name = task_dir.name
    task_json_path = task_dir / FILE_TASK_JSON
    task_data = read_json(task_json_path) if task_json_path.is_file() else None

    guard = validate_archive(task_dir, task_data)
    task_children_raw = (
        task_data.get("children", []) if isinstance(task_data, dict) else []
    )
    structural_children = [
        name for name in task_children_raw if isinstance(name, str)
    ]
    cascade = getattr(args, "archive_integrated_children", False)
    pending_integrated = _integrated_children_still_active(
        task_dir, structural_children, tasks_dir
    )

    if getattr(args, "check", False):
        if not guard.ok:
            print(colored("Archive check: FAIL", Colors.RED))
            for item in guard.errors:
                print(f"  - {item}")
            if task_data is not None:
                hints = archive_repair_hints(
                    guard.errors, task_dir, task_data, guard
                )
                if hints:
                    print(colored("Next steps:", Colors.BLUE))
                    for hint in hints:
                        print(f"  - {hint}")
            return 1
        if cascade and pending_integrated:
            for child_name, child_dir in pending_integrated:
                child_data = read_json(child_dir / FILE_TASK_JSON)
                child_guard = validate_archive(child_dir, child_data)
                if not child_guard.ok:
                    print(colored("Archive check: FAIL", Colors.RED))
                    print(
                        f"  - integrated child {child_name} not ready to archive:"
                    )
                    for item in child_guard.errors:
                        print(f"    - {item}")
                    if child_data is not None:
                        hints = archive_repair_hints(
                            child_guard.errors, child_dir, child_data, child_guard
                        )
                        if hints:
                            print(colored("Next steps:", Colors.BLUE))
                            for hint in hints:
                                print(f"    - {hint}")
                    return 1
        print(colored("Archive check: PASS", Colors.GREEN))
        print(f"Contract fingerprint: {guard.contract_fingerprint}")
        if guard.required_gates:
            print(f"Required completion gates: {', '.join(guard.required_gates)}")
        if pending_integrated and not cascade:
            hint = parent_archive_child_followup_hint(
                task_dir, structural_children, tasks_dir
            )
            if hint:
                print(hint)
        if cascade and pending_integrated:
            names = ", ".join(n for n, _ in pending_integrated)
            print(
                f"Cascade: {len(pending_integrated)} integrated child dir(s) "
                f"would archive with parent: {names}"
            )
        return 0

    if not guard.ok:
        print(colored("Error: cannot archive task; completion check failed.", Colors.RED), file=sys.stderr)
        for item in guard.errors:
            print(f"  - {item}", file=sys.stderr)
        if task_data is not None:
            hints = archive_repair_hints(guard.errors, task_dir, task_data, guard)
            if hints:
                print(colored("Next steps:", Colors.BLUE), file=sys.stderr)
                for hint in hints:
                    print(f"  - {hint}", file=sys.stderr)
        print("Run `task.py archive <task> --check` for a non-mutating preflight.", file=sys.stderr)
        return 1

    no_commit = getattr(args, "no_commit", False)
    if cascade and pending_integrated:
        for child_name, child_dir in pending_integrated:
            child_data = read_json(child_dir / FILE_TASK_JSON)
            child_guard = validate_archive(child_dir, child_data)
            if not child_guard.ok:
                print(
                    colored(
                        f"Error: integrated child {child_name} failed archive check.",
                        Colors.RED,
                    ),
                    file=sys.stderr,
                )
                for item in child_guard.errors:
                    print(f"  - {item}", file=sys.stderr)
                return 1
        for child_name, child_dir in pending_integrated:
            ok, _, _ = _archive_one_task(
                child_dir, repo_root, tasks_dir, no_commit=no_commit
            )
            if not ok:
                print(
                    colored(
                        f"Error: failed to archive integrated child {child_name}.",
                        Colors.RED,
                    ),
                    file=sys.stderr,
                )
                return 1

    manual_child_hint = None
    if pending_integrated and not cascade:
        manual_child_hint = parent_archive_child_followup_hint(
            task_dir, structural_children, tasks_dir
        )

    ok, _, rel_path = _archive_one_task(
        task_dir, repo_root, tasks_dir, no_commit=no_commit
    )
    if not ok or not rel_path:
        return 1

    if manual_child_hint:
        print(colored("Note:", Colors.YELLOW), file=sys.stderr)
        print(manual_child_hint, file=sys.stderr)

    print(rel_path)
    return 0


def _auto_commit_archive(
    task_name: str,
    repo_root: Path,
    modified_children: list[str] | None = None,
) -> bool:
    """Stage Trellis-owned task paths and commit after archive.

    Scoped narrowly to the archived task's source + destination paths
    plus any child task dirs whose ``task.json`` was edited (parent →
    children relationship update). Dirty changes in OTHER active task
    dirs are NOT bundled into the archive commit.

    If ``.gitignore`` blocks the paths, we warn + skip — we do NOT
    retry with ``git add -f``. The warning explicitly forbids
    ``git add -f .trellis/`` (which would fan out to caches/backups)
    and points users at ``session_auto_commit: false``.

    Honors ``session_auto_commit`` in ``.trellis/config.yaml``: when
    set to ``false``, this function returns immediately without
    touching git (the archive directory move on disk is unaffected).
    """
    if not get_session_auto_commit(repo_root):
        print(
            "[OK] session_auto_commit: false — skipping git stage/commit.",
            file=sys.stderr,
        )
        return True

    source_rel = f"{DIR_WORKFLOW}/{DIR_TASKS}/{task_name}"
    rc, tracked_out, _ = run_git(
        ["ls-files", "--", source_rel],
        cwd=repo_root,
    )
    source_was_tracked = rc == 0 and bool(tracked_out.strip())

    paths = safe_archive_paths_to_add(
        repo_root, task_name=task_name, modified_children=modified_children
    )
    if not paths:
        print("[OK] No task changes to commit.", file=sys.stderr)
        return True

    success, _, err = safe_git_add(paths, repo_root)
    if not success:
        if err and "ignored by" in err.lower():
            print_gitignore_warning(paths)
        else:
            print(
                f"[WARN] git add failed: {err.strip() if err else 'unknown error'}",
                file=sys.stderr,
            )
        return not source_was_tracked

    # Belt-and-suspenders for the phantom-delete bug: `safe_git_add` uses
    # `git add` (no -A) which only stages additions/modifications. The
    # source task directory was moved away by `shutil.move`, so its files
    # need an explicit `git rm --cached` to stage the deletions in this
    # same commit — otherwise they sit as uncommitted "phantom deletes"
    # against HEAD until something later picks them up.
    #
    # `--ignore-unmatch` makes this a no-op when the task was never tracked
    # (e.g. archiving a task that lived only in working tree).
    run_git(
        ["rm", "-r", "--cached", "--ignore-unmatch", "--", source_rel],
        cwd=repo_root,
    )

    rc, _, _ = run_git(
        ["diff", "--cached", "--quiet", "--", *paths, source_rel],
        cwd=repo_root,
    )
    if rc == 0:
        print("[OK] No task changes to commit.", file=sys.stderr)
        return True

    commit_msg = f"chore(task): archive {task_name}"
    rc, _, err = run_git(["commit", "-m", commit_msg], cwd=repo_root)
    if rc == 0:
        print(f"[OK] Auto-committed: {commit_msg}", file=sys.stderr)
        return True
    else:
        print(f"[WARN] Auto-commit failed: {err.strip()}", file=sys.stderr)
        return not source_was_tracked


# =============================================================================
# Command: add-subtask
# =============================================================================

def cmd_add_subtask(args: argparse.Namespace) -> int:
    """Link a child task to a parent task."""
    repo_root = get_repo_root()

    parent_dir = resolve_task_dir(args.parent_dir, repo_root)
    child_dir = resolve_task_dir(args.child_dir, repo_root)

    parent_json_path = parent_dir / FILE_TASK_JSON
    child_json_path = child_dir / FILE_TASK_JSON

    if not parent_json_path.is_file():
        print(colored(f"Error: Parent task.json not found: {args.parent_dir}", Colors.RED), file=sys.stderr)
        return 1

    if not child_json_path.is_file():
        print(colored(f"Error: Child task.json not found: {args.child_dir}", Colors.RED), file=sys.stderr)
        return 1

    parent_data = read_json(parent_json_path)
    child_data = read_json(child_json_path)

    if not parent_data or not child_data:
        print(colored("Error: Failed to read task.json", Colors.RED), file=sys.stderr)
        return 1

    # Check if child already has a parent
    existing_parent = child_data.get("parent")
    if existing_parent:
        print(colored(f"Error: Child task already has a parent: {existing_parent}", Colors.RED), file=sys.stderr)
        return 1

    # Add child to parent's children list
    parent_children = parent_data.get("children", [])
    child_dir_name = child_dir.name
    if child_dir_name not in parent_children:
        parent_children.append(child_dir_name)
        parent_data["children"] = parent_children

    # Set parent in child's task.json
    child_data["parent"] = parent_dir.name

    # Write both
    write_json(parent_json_path, parent_data)
    write_json(child_json_path, child_data)
    ensure_task_map(
        parent_dir,
        parent_data,
        list(parent_data.get("children", [])),
        f"Linked Child `{child_dir_name}`.",
    )

    print(colored(f"Linked: {child_dir.name} -> {parent_dir.name}", Colors.GREEN), file=sys.stderr)
    return 0


# =============================================================================
# Command: remove-subtask
# =============================================================================

def cmd_remove_subtask(args: argparse.Namespace) -> int:
    """Unlink a child task from a parent task."""
    repo_root = get_repo_root()

    parent_dir = resolve_task_dir(args.parent_dir, repo_root)
    child_dir = resolve_task_dir(args.child_dir, repo_root)

    parent_json_path = parent_dir / FILE_TASK_JSON
    child_json_path = child_dir / FILE_TASK_JSON

    if not parent_json_path.is_file():
        print(colored(f"Error: Parent task.json not found: {args.parent_dir}", Colors.RED), file=sys.stderr)
        return 1

    if not child_json_path.is_file():
        print(colored(f"Error: Child task.json not found: {args.child_dir}", Colors.RED), file=sys.stderr)
        return 1

    parent_data = read_json(parent_json_path)
    child_data = read_json(child_json_path)

    if not parent_data or not child_data:
        print(colored("Error: Failed to read task.json", Colors.RED), file=sys.stderr)
        return 1

    # Remove child from parent's children list
    parent_children = parent_data.get("children", [])
    child_dir_name = child_dir.name
    if child_dir_name in parent_children:
        parent_children.remove(child_dir_name)
        parent_data["children"] = parent_children

    # Clear parent in child's task.json
    child_data["parent"] = None

    # Write both
    write_json(parent_json_path, parent_data)
    write_json(child_json_path, child_data)
    remove_child_from_task_map(parent_dir, parent_data, child_dir_name)

    print(colored(f"Unlinked: {child_dir.name} from {parent_dir.name}", Colors.GREEN), file=sys.stderr)
    return 0


# =============================================================================
# Command: prepare-child-worktree
# =============================================================================

def cmd_prepare_child_worktree(args: argparse.Namespace) -> int:
    """Create and register a Git worktree for a Child task."""
    repo_root = get_repo_root()

    parent_dir = resolve_task_dir(args.parent_dir, repo_root)
    child_dir = resolve_task_dir(args.child_dir, repo_root)

    parent_json_path = parent_dir / FILE_TASK_JSON
    child_json_path = child_dir / FILE_TASK_JSON

    if not parent_json_path.is_file():
        print(colored(f"Error: Parent task.json not found: {args.parent_dir}", Colors.RED), file=sys.stderr)
        return 1
    if not child_json_path.is_file():
        print(colored(f"Error: Child task.json not found: {args.child_dir}", Colors.RED), file=sys.stderr)
        return 1

    parent_data = read_json(parent_json_path)
    child_data = read_json(child_json_path)
    if not parent_data or not child_data:
        print(colored("Error: Failed to read task.json", Colors.RED), file=sys.stderr)
        return 1

    if child_data.get("parent") != parent_dir.name:
        print(colored(f"Error: Child is not linked to parent: {child_dir.name}", Colors.RED), file=sys.stderr)
        return 1

    branch = args.branch
    base_ref = getattr(args, "base", None) or child_data.get("base_branch") or parent_data.get("base_branch") or "HEAD"
    worktree_path, path_error = _resolve_child_worktree_path(
        repo_root,
        child_dir,
        getattr(args, "path", None),
    )

    errors: list[str] = []
    errors.extend(_validate_git_repo(repo_root))
    errors.extend(_validate_branch_name(repo_root, branch))
    if path_error:
        errors.append(path_error)
    if worktree_path and worktree_path.exists():
        errors.append(f"worktree path already exists: {_repo_relative_path(worktree_path, repo_root)}")
    if not _git_commit_exists(repo_root, base_ref):
        errors.append(f"base ref does not resolve to a commit: {base_ref}")

    if errors:
        print("Prepare-child-worktree check: FAIL" if getattr(args, "check", False) else colored("Error: cannot prepare child worktree.", Colors.RED), file=sys.stderr)
        for item in errors:
            print(f"  - {item}", file=sys.stderr)
        print_environment_repair_hints(errors)
        return 1

    assert worktree_path is not None
    worktree_rel = _repo_relative_path(worktree_path, repo_root)
    if getattr(args, "check", False):
        print("Prepare-child-worktree check: PASS")
        print(f"Branch: {branch}")
        print(f"Base: {base_ref}")
        print(f"Path: {worktree_rel}")
        print("No files changed.")
        return 0

    worktree_path.parent.mkdir(parents=True, exist_ok=True)
    if _git_branch_exists(repo_root, branch):
        git_args = ["worktree", "add", str(worktree_path), branch]
    else:
        git_args = ["worktree", "add", "-b", branch, str(worktree_path), base_ref]
    rc, _, err = run_git(git_args, cwd=repo_root)
    if rc != 0:
        print(colored("Error: git worktree add failed.", Colors.RED), file=sys.stderr)
        print(err.strip() or "unknown git error", file=sys.stderr)
        return 1

    child_data["branch"] = branch
    child_data["worktree_path"] = worktree_rel
    write_json(child_json_path, child_data)

    ok, map_errors = record_child_worktree(
        parent_dir,
        parent_data,
        child_dir.name,
        branch,
        worktree_rel,
        base_ref,
    )
    if not ok:
        print(colored("Error: worktree created, but Parent task-map update failed.", Colors.RED), file=sys.stderr)
        for item in map_errors:
            print(f"  - {item}", file=sys.stderr)
        return 1

    print(colored(f"✓ Child worktree prepared: {child_dir.name}", Colors.GREEN))
    print(f"Branch: {branch}")
    print(f"Path: {worktree_rel}")
    print(f"Parent map: {_repo_relative_path(parent_dir / 'task-map.md', repo_root)}")
    return 0


# =============================================================================
# Command: set-child-state
# =============================================================================

def cmd_set_child_state(args: argparse.Namespace) -> int:
    """Set a Child Worker-reported state in the Parent task-map.md."""
    repo_root = get_repo_root()

    parent_dir = resolve_task_dir(args.parent_dir, repo_root)
    child_dir = resolve_task_dir(args.child_dir, repo_root)
    state = args.state

    parent_json_path = parent_dir / FILE_TASK_JSON
    child_json_path = child_dir / FILE_TASK_JSON

    if not parent_json_path.is_file():
        print(colored(f"Error: Parent task.json not found: {args.parent_dir}", Colors.RED), file=sys.stderr)
        return 1
    if not child_json_path.is_file():
        print(colored(f"Error: Child task.json not found: {args.child_dir}", Colors.RED), file=sys.stderr)
        return 1

    parent_data = read_json(parent_json_path)
    child_data = read_json(child_json_path)
    if not parent_data or not child_data:
        print(colored("Error: Failed to read task.json", Colors.RED), file=sys.stderr)
        return 1

    if child_data.get("parent") != parent_dir.name:
        print(colored(f"Error: Child is not linked to parent: {child_dir.name}", Colors.RED), file=sys.stderr)
        return 1

    if state in CHILD_STATES and not getattr(args, "evidence", None):
        print(colored("Error: --evidence is required when setting child state", Colors.RED), file=sys.stderr)
        return 1
    if state in PARENT_CONTROLLED_STATES:
        print(
            colored(
                "Error: Parent-controlled Child states require `task.py integrate-child`.",
                Colors.RED,
            ),
            file=sys.stderr,
        )
        print(
            "Allowed set-child-state values: "
            + ", ".join(sorted(CHILD_REPORT_STATES)),
            file=sys.stderr,
        )
        return 1

    ok, errors = set_child_state(
        parent_dir,
        parent_data,
        child_dir.name,
        state,
        args.evidence,
        getattr(args, "reason", None),
    )
    if not ok:
        print(colored("Error: cannot set child state.", Colors.RED), file=sys.stderr)
        for item in errors:
            print(f"  - {item}", file=sys.stderr)
        return 1

    print(colored(f"✓ Child state updated: {child_dir.name} -> {state}", Colors.GREEN))
    print(f"Parent map: {_repo_relative_path(parent_dir / 'task-map.md', repo_root)}")
    return 0


# =============================================================================
# Command: integrate-child
# =============================================================================

def cmd_integrate_child(args: argparse.Namespace) -> int:
    """Set a Parent-controlled Child integration state."""
    repo_root = get_repo_root()

    parent_dir = resolve_task_dir(args.parent_dir, repo_root)
    child_dir = resolve_task_dir(args.child_dir, repo_root)
    state = args.state

    parent_json_path = parent_dir / FILE_TASK_JSON
    child_json_path = child_dir / FILE_TASK_JSON

    if not parent_json_path.is_file():
        print(colored(f"Error: Parent task.json not found: {args.parent_dir}", Colors.RED), file=sys.stderr)
        return 1
    if not child_json_path.is_file():
        print(colored(f"Error: Child task.json not found: {args.child_dir}", Colors.RED), file=sys.stderr)
        return 1

    parent_data = read_json(parent_json_path)
    child_data = read_json(child_json_path)
    if not parent_data or not child_data:
        print(colored("Error: Failed to read task.json", Colors.RED), file=sys.stderr)
        return 1

    if state not in PARENT_CONTROLLED_STATES:
        print(
            colored("Error: state is not Parent-controlled.", Colors.RED),
            file=sys.stderr,
        )
        print(
            "Allowed integrate-child values: "
            + ", ".join(sorted(PARENT_CONTROLLED_STATES)),
            file=sys.stderr,
        )
        return 1

    evidence = args.evidence
    ref = getattr(args, "ref", None)
    reason = getattr(args, "reason", None)
    execute_merge = getattr(args, "execute_merge", False)
    if getattr(args, "check", False):
        errors = validate_parent_child_integration(
            parent_dir,
            parent_data,
            child_dir,
            child_data,
            state,
            evidence,
            ref,
            reason,
        )
        if execute_merge:
            errors.extend(_validate_merge_execution(repo_root, state, ref))
        if errors:
            print("Integrate-child check: FAIL")
            for item in errors:
                print(f"  - {item}")
            print_environment_repair_hints(errors, stream=sys.stdout)
            return 1
        print("Integrate-child check: PASS")
        if execute_merge:
            print("Merge execution check: PASS")
        print("No files changed.")
        return 0

    merge_ref = None
    if execute_merge:
        merge_errors = _validate_merge_execution(repo_root, state, ref)
        if merge_errors:
            print(colored("Error: cannot execute child merge.", Colors.RED), file=sys.stderr)
            for item in merge_errors:
                print(f"  - {item}", file=sys.stderr)
            print_environment_repair_hints(merge_errors)
            return 1

        rc, _, err = run_git(["merge", "--no-ff", "--no-commit", ref], cwd=repo_root)
        if rc != 0:
            print(colored("Error: git merge failed; Parent task-map was not advanced to integrated.", Colors.RED), file=sys.stderr)
            if err.strip():
                print(err.strip(), file=sys.stderr)
            print_environment_repair_hints([err.strip()])
            print("Resolve the merge manually, abort it with `git merge --abort`, or record a `changes` / `cancelled` Parent decision.", file=sys.stderr)
            return 1
        merge_ref = ref

    ok, errors = set_parent_child_integration_state(
        parent_dir,
        parent_data,
        child_dir,
        child_data,
        state,
        evidence,
        ref,
        reason,
        merge_ref,
    )
    if not ok:
        print(colored("Error: cannot integrate child.", Colors.RED), file=sys.stderr)
        for item in errors:
            print(f"  - {item}", file=sys.stderr)
        return 1

    print(colored(f"✓ Child integration updated: {child_dir.name} -> {state}", Colors.GREEN))
    if merge_ref:
        print(f"Merge executed: git merge --no-ff --no-commit {merge_ref}")
    print(f"Parent map: {_repo_relative_path(parent_dir / 'task-map.md', repo_root)}")
    return 0


# =============================================================================
# Command: generate-child-prompt / parent-status / review-child
# =============================================================================

def cmd_suggest_execution_strategy(args: argparse.Namespace) -> int:
    """Suggest execution_mode and isolation for implement.md contract."""
    import json

    from .execution_strategy import (
        format_contract_yaml_block,
        suggest_execution_strategy,
    )
    from .task_utils import resolve_task_dir

    repo_root = get_repo_root()
    task_dir = resolve_task_dir(args.task_dir, repo_root)
    task_json_path = task_dir / FILE_TASK_JSON
    if not task_json_path.is_file():
        print(colored("Error: task.json not found", Colors.RED), file=sys.stderr)
        return 1
    task_data = read_json(task_json_path)
    if not isinstance(task_data, dict):
        print(colored("Error: invalid task.json", Colors.RED), file=sys.stderr)
        return 1

    suggestion = suggest_execution_strategy(repo_root, task_dir, task_data)
    if getattr(args, "json", False):
        print(json.dumps(suggestion.to_dict(), indent=2, ensure_ascii=False))
        return 0
    print(format_contract_yaml_block(suggestion))
    return 0


def cmd_generate_dispatch_prompt(args: argparse.Namespace) -> int:
    """Build a full Task dispatch prompt (Agent-facing CLI Layer 2)."""
    from .subagent_dispatch import build_dispatch_prompt

    repo_root = get_repo_root()
    task_dir = resolve_task_dir(args.task_dir, repo_root)
    role = args.role
    scope = getattr(args, "scope", None)
    finish = bool(getattr(args, "finish", False))
    max_chars = getattr(args, "max_chars", None)

    prompt, warnings, errors = build_dispatch_prompt(
        repo_root,
        task_dir,
        role,
        scope=scope,
        finish=finish,
        max_chars=max_chars,
    )
    for item in warnings:
        print(f"[generate-dispatch-prompt] WARN: {item}", file=sys.stderr)
    if errors:
        for item in errors:
            print(f"[generate-dispatch-prompt] Error: {item}", file=sys.stderr)
        return 1
    if prompt is None:
        print(colored("Error: could not build dispatch prompt", Colors.RED), file=sys.stderr)
        return 1
    print(prompt)
    return 0


def cmd_generate_child_prompt(args: argparse.Namespace) -> int:
    """Generate a child implementation prompt for parent orchestration."""
    from .parent_orchestration import build_child_prompt

    repo_root = get_repo_root()
    parent_dir = resolve_task_dir(args.parent_dir, repo_root)
    child_dir = resolve_task_dir(args.child_dir, repo_root)
    mode = getattr(args, "mode", "inline") or "inline"
    if mode not in ("inline", "subagent"):
        print(colored("Error: --mode must be inline or subagent", Colors.RED), file=sys.stderr)
        return 1

    prompt, errors = build_child_prompt(
        parent_dir,
        child_dir,
        include_artifacts=getattr(args, "include_artifacts", False),
        mode=mode,
    )
    if errors:
        for item in errors:
            print(f"  - {item}", file=sys.stderr)
        return 1
    if prompt is None:
        print(colored("Error: could not generate child prompt", Colors.RED), file=sys.stderr)
        return 1

    out_path = getattr(args, "output", None)
    if out_path:
        path = Path(out_path)
        if not path.is_absolute():
            path = repo_root / path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(prompt + "\n", encoding="utf-8")
        print(colored(f"✓ Child prompt written: {_repo_relative_path(path, repo_root)}", Colors.GREEN))
    else:
        print(prompt)
    return 0


def cmd_parent_status(args: argparse.Namespace) -> int:
    """Show parent task-map orchestration status."""
    from .parent_orchestration import build_parent_status

    repo_root = get_repo_root()
    parent_dir = resolve_task_dir(args.parent_dir, repo_root)
    print(build_parent_status(parent_dir))
    return 0


def cmd_review_child(args: argparse.Namespace) -> int:
    """Review child handoff and optionally advance parent integration states."""
    from .parent_orchestration import (
        append_parent_review_notes,
        build_review_report,
        write_review_artifact,
    )
    from .task_map import set_parent_child_integration_state

    repo_root = get_repo_root()
    parent_dir = resolve_task_dir(args.parent_dir, repo_root)
    child_dir = resolve_task_dir(args.child_dir, repo_root)

    parent_json_path = parent_dir / FILE_TASK_JSON
    child_json_path = child_dir / FILE_TASK_JSON
    if not parent_json_path.is_file() or not child_json_path.is_file():
        print(colored("Error: parent or child task.json missing", Colors.RED), file=sys.stderr)
        return 1

    parent_data = read_json(parent_json_path)
    child_data = read_json(child_json_path)
    if not parent_data or not child_data:
        print(colored("Error: Failed to read task.json", Colors.RED), file=sys.stderr)
        return 1

    decision = getattr(args, "decision", None)
    ref = getattr(args, "ref", None)
    reason = getattr(args, "reason", None)
    notes = getattr(args, "notes", None)
    check_only = getattr(args, "check", False) or not decision

    report, errors, actions = build_review_report(
        parent_dir,
        child_dir,
        parent_data,
        child_data,
        decision=decision if not check_only else None,
        ref=ref,
        reason=reason,
        notes=notes,
    )

    if getattr(args, "write_artifact", False):
        artifact = write_review_artifact(parent_dir, child_dir.name, report)
        print(colored(f"✓ Review artifact: {_repo_relative_path(artifact, repo_root)}", Colors.GREEN))

    if check_only:
        if errors:
            print("Review-child check: FAIL")
            for item in errors:
                print(f"  - {item}")
            print("")
            print(report)
            return 1
        print("Review-child check: PASS")
        print("")
        print(report)
        return 0

    if errors:
        print(colored("Error: review decision blocked by validation.", Colors.RED), file=sys.stderr)
        for item in errors:
            print(f"  - {item}", file=sys.stderr)
        return 1

    evidence_default = "handoff.md"
    if actions.get("integrate_sequence"):
        for step in actions["integrate_sequence"]:
            ok, step_errors = set_parent_child_integration_state(
                parent_dir,
                parent_data,
                child_dir,
                child_data,
                step["state"],
                step.get("evidence", evidence_default),
                step.get("ref", ref),
                step.get("reason", reason),
            )
            if not ok:
                print(colored("Error: integrate-child step failed.", Colors.RED), file=sys.stderr)
                for item in step_errors:
                    print(f"  - {item}", file=sys.stderr)
                return 1
            print(colored(f"✓ Child integration updated: {child_dir.name} -> {step['state']}", Colors.GREEN))
    elif actions.get("integrate"):
        step = actions["integrate"]
        ok, step_errors = set_parent_child_integration_state(
            parent_dir,
            parent_data,
            child_dir,
            child_data,
            step["state"],
            step.get("evidence", evidence_default),
            step.get("ref", ref),
            step.get("reason", reason),
        )
        if not ok:
            print(colored("Error: integrate-child failed.", Colors.RED), file=sys.stderr)
            for item in step_errors:
                print(f"  - {item}", file=sys.stderr)
            return 1
        print(colored(f"✓ Child integration updated: {child_dir.name} -> {step['state']}", Colors.GREEN))

    if not getattr(args, "no_append_parent_verify", False):
        append_parent_review_notes(parent_dir, child_dir.name, report)
        print(colored("✓ Appended review notes to parent verify.md", Colors.GREEN))

    for gate in actions.get("gates", []):
        if gate.get("optional") and gate.get("hint"):
            print(f"Optional reviewer gate: {gate['hint']}")

    print(report)
    return 0


# =============================================================================
# Command: set-branch
# =============================================================================

def cmd_set_branch(args: argparse.Namespace) -> int:
    """Set git branch for task."""
    repo_root = get_repo_root()
    target_dir = resolve_task_dir(args.dir, repo_root)
    branch = args.branch

    if not branch:
        print(colored("Error: Missing arguments", Colors.RED))
        print("Usage: python task.py set-branch <task-dir> <branch-name>")
        return 1

    task_json = target_dir / FILE_TASK_JSON
    if not task_json.is_file():
        print(colored(f"Error: task.json not found at {target_dir}", Colors.RED))
        return 1

    data = read_json(task_json)
    if not data:
        return 1

    data["branch"] = branch
    write_json(task_json, data)

    print(colored(f"✓ Branch set to: {branch}", Colors.GREEN))
    return 0


# =============================================================================
# Command: set-base-branch
# =============================================================================

def cmd_set_base_branch(args: argparse.Namespace) -> int:
    """Set the base branch (PR target) for task."""
    repo_root = get_repo_root()
    target_dir = resolve_task_dir(args.dir, repo_root)
    base_branch = args.base_branch

    if not base_branch:
        print(colored("Error: Missing arguments", Colors.RED))
        print("Usage: python task.py set-base-branch <task-dir> <base-branch>")
        print("Example: python task.py set-base-branch <dir> develop")
        print()
        print("This sets the target branch for PR (the branch your feature will merge into).")
        return 1

    task_json = target_dir / FILE_TASK_JSON
    if not task_json.is_file():
        print(colored(f"Error: task.json not found at {target_dir}", Colors.RED))
        return 1

    data = read_json(task_json)
    if not data:
        return 1

    data["base_branch"] = base_branch
    write_json(task_json, data)

    print(colored(f"✓ Base branch set to: {base_branch}", Colors.GREEN))
    print(f"  PR will target: {base_branch}")
    return 0


# =============================================================================
# Command: set-scope
# =============================================================================

def cmd_set_scope(args: argparse.Namespace) -> int:
    """Set scope for PR title."""
    repo_root = get_repo_root()
    target_dir = resolve_task_dir(args.dir, repo_root)
    scope = args.scope

    if not scope:
        print(colored("Error: Missing arguments", Colors.RED))
        print("Usage: python task.py set-scope <task-dir> <scope>")
        return 1

    task_json = target_dir / FILE_TASK_JSON
    if not task_json.is_file():
        print(colored(f"Error: task.json not found at {target_dir}", Colors.RED))
        return 1

    data = read_json(task_json)
    if not data:
        return 1

    data["scope"] = scope
    write_json(task_json, data)

    print(colored(f"✓ Scope set to: {scope}", Colors.GREEN))
    return 0
