"""
Task data access layer.

Single source of truth for loading and iterating task directories.
Replaces scattered task.json parsing across 9+ files.

Provides:
    load_task          — Load a single task by directory path
    iter_active_tasks  — Iterate all non-archived tasks (sorted)
    get_all_statuses   — Get {dir_name: status} map for children progress
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

from .io import read_json
from .paths import FILE_TASK_JSON
from .task_map import PARENT_TERMINAL_STATES, get_child_state, load_task_map
from .types import TaskInfo


def load_task(task_dir: Path) -> TaskInfo | None:
    """Load task from a directory containing task.json.

    Args:
        task_dir: Absolute path to the task directory.

    Returns:
        TaskInfo if task.json exists and is valid, None otherwise.
    """
    task_json = task_dir / FILE_TASK_JSON
    if not task_json.is_file():
        return None

    data = read_json(task_json)
    if not data:
        return None

    return TaskInfo(
        dir_name=task_dir.name,
        directory=task_dir,
        title=data.get("title") or data.get("name") or "unknown",
        status=data.get("status", "unknown"),
        assignee=data.get("assignee", ""),
        priority=data.get("priority", "P2"),
        children=tuple(data.get("children", [])),
        parent=data.get("parent"),
        package=data.get("package"),
        raw=data,
    )


def iter_active_tasks(tasks_dir: Path) -> Iterator[TaskInfo]:
    """Iterate all active (non-archived) tasks, sorted by directory name.

    Skips the "archive" directory and directories without valid task.json.

    Args:
        tasks_dir: Path to the tasks directory.

    Yields:
        TaskInfo for each valid task.
    """
    if not tasks_dir.is_dir():
        return

    for d in sorted(tasks_dir.iterdir()):
        if not d.is_dir() or d.name == "archive":
            continue
        info = load_task(d)
        if info is not None:
            yield info


def get_all_statuses(tasks_dir: Path) -> dict[str, str]:
    """Get a {dir_name: status} mapping for all active tasks.

    Useful for computing children progress without loading full TaskInfo.

    Args:
        tasks_dir: Path to the tasks directory.

    Returns:
        Dict mapping directory names to status strings.
    """
    return {t.dir_name: t.status for t in iter_active_tasks(tasks_dir)}


def load_parent_child_integration_states(
    parent_dir: Path,
    children: tuple[str, ...] | list[str],
) -> dict[str, str]:
    """Map structural child ids to parent task-map integration states."""
    if not children:
        return {}
    data, _ = load_task_map(parent_dir)
    if not data:
        return {}
    states: dict[str, str] = {}
    for child_name in children:
        state = get_child_state(parent_dir, child_name)
        if state:
            states[child_name] = state
    return states


def _child_counts_as_done_for_progress(
    child_name: str,
    all_statuses: dict[str, str],
    integration_states: dict[str, str] | None,
) -> bool:
    """Whether a structural child counts toward parent [n/m done]."""
    if child_name not in all_statuses:
        return True
    dir_status = all_statuses.get(child_name)
    if dir_status in ("completed", "done"):
        return True
    if integration_states:
        integration = integration_states.get(child_name)
        if integration in PARENT_TERMINAL_STATES:
            return True
    return False


def children_progress(
    children: tuple[str, ...] | list[str],
    all_statuses: dict[str, str],
    integration_states: dict[str, str] | None = None,
) -> str:
    """Format children progress like " [2/3 done]" or integration summary.

    Directory lifecycle (task.json status) and parent task-map integration
    are separate planes. A child integrated by the parent counts as done even
    when its directory status is still planning or in_progress.

    Args:
        children: List of child directory names.
        all_statuses: Status map from get_all_statuses().
        integration_states: Optional map from load_parent_child_integration_states().

    Returns:
        Formatted string, or "" if no children.
    """
    if not children:
        return ""

    done = sum(
        1
        for c in children
        if _child_counts_as_done_for_progress(c, all_statuses, integration_states)
    )
    total = len(children)

    if integration_states:
        integrated = sum(
            1 for c in children if integration_states.get(c) == "integrated"
        )
        cancelled = sum(
            1 for c in children if integration_states.get(c) == "cancelled"
        )
        terminal = integrated + cancelled
        if terminal == total and done == total:
            parts: list[str] = []
            if integrated:
                parts.append(f"{integrated} integrated")
            if cancelled:
                parts.append(f"{cancelled} cancelled")
            summary = ", ".join(parts) if parts else f"{done}/{total} done"
            return f" [{summary}]"

        in_flight = total - terminal
        if in_flight or terminal:
            detail = f"{done}/{total} done"
            if integrated or cancelled or in_flight:
                bits: list[str] = []
                if integrated:
                    bits.append(f"{integrated} integrated")
                if cancelled:
                    bits.append(f"{cancelled} cancelled")
                active = total - terminal
                if active:
                    bits.append(f"{active} active")
                detail = f"{detail}; {', '.join(bits)}"
            return f" [{detail}]"

    return f" [{done}/{total} done]"


def format_child_task_display(
    dir_status: str,
    integration_state: str | None,
) -> str:
    """Format task list/dashboard status for a child with optional integration."""
    if integration_state:
        return f"{dir_status}; integration:{integration_state}"
    return dir_status


def parent_archive_child_followup_hint(
    parent_dir: Path,
    child_names: list[str],
    tasks_dir: Path,
) -> str | None:
    """Return a hint when integrated children remain active after parent archive."""
    if not child_names:
        return None
    data, _ = load_task_map(parent_dir)
    if data is None:
        return None

    pending: list[str] = []
    for child_name in child_names:
        state = get_child_state(parent_dir, child_name)
        if state != "integrated":
            continue
        child_path = tasks_dir / child_name
        if child_path.is_dir():
            pending.append(child_name)

    if not pending:
        return None

    names = ", ".join(pending)
    return (
        f"Integrated child task dirs still active: {names}. "
        "Archive each child when ready: "
        f"python ./.trellis/scripts/task.py archive <child> "
        "(or parent archive with --archive-integrated-children after archive --check passes for each)."
    )