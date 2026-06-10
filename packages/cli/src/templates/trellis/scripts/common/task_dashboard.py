#!/usr/bin/env python3
"""Task dashboard rendering for framework entry routing."""

from __future__ import annotations

from pathlib import Path

from .active_task import resolve_selected_task
from .paths import DIR_TASKS, DIR_WORKFLOW, get_developer, get_repo_root, get_tasks_dir
from .tasks import children_progress, iter_active_tasks


_STATUS_ORDER = ("planning", "in_progress", "review", "blocked")


def _task_path(dir_name: str) -> str:
    return f"{DIR_WORKFLOW}/{DIR_TASKS}/{dir_name}"


def _selected_line(
    repo_root: Path,
    platform_input: dict | None = None,
    platform: str | None = None,
) -> str:
    selected = resolve_selected_task(repo_root, platform_input, platform)
    if selected.task_path:
        suffix = f" ({selected.source})" if selected.source else ""
        return f"Selected task: {selected.task_path}{suffix}"
    return "Selected task: none"


def render_task_dashboard(
    repo_root: Path | None = None,
    platform_input: dict | None = None,
    platform: str | None = None,
) -> str:
    """Render a compact, non-mutating Task Dashboard."""
    if repo_root is None:
        repo_root = get_repo_root()

    tasks_dir = get_tasks_dir(repo_root)
    developer = get_developer(repo_root)
    all_tasks = {task.dir_name: task for task in iter_active_tasks(tasks_dir)}
    all_statuses = {name: task.status for name, task in all_tasks.items()}

    lines: list[str] = [
        "Task Dashboard",
        "Trellis framework: active",
        _selected_line(repo_root, platform_input, platform),
        "",
    ]

    if not all_tasks:
        lines.append("Tasks: none")
    else:
        printed: set[str] = set()
        for status in _STATUS_ORDER:
            names = [
                name
                for name, task in sorted(all_tasks.items())
                if task.status == status and not task.parent
            ]
            if not names:
                continue
            title = status.replace("_", " ").title()
            lines.append(f"{title}:")
            for name in names:
                _append_task(lines, name, all_tasks, all_statuses, printed)
            lines.append("")

        other_names = [
            name
            for name, task in sorted(all_tasks.items())
            if name not in printed and not task.parent
        ]
        if other_names:
            lines.append("Other:")
            for name in other_names:
                _append_task(lines, name, all_tasks, all_statuses, printed)
            lines.append("")

    lines.append("Suggested actions:")
    lines.append("  - Select a task: python3 ./.trellis/scripts/task.py select <task>")
    lines.append("  - Create a task: python3 ./.trellis/scripts/task.py create \"<title>\" --slug <slug>")
    lines.append("  - Inspect raw list: python3 ./.trellis/scripts/task.py list")
    lines.append("  - Continue without a task only for No Task or Micro-Grill work")
    if developer:
        lines.append(f"Developer: {developer}")

    return "\n".join(line.rstrip() for line in lines).rstrip()


def _append_task(
    lines: list[str],
    name: str,
    all_tasks: dict,
    all_statuses: dict[str, str],
    printed: set[str],
    indent: int = 0,
) -> None:
    task = all_tasks[name]
    printed.add(name)
    progress = children_progress(task.children, all_statuses)
    assignee = task.assignee or "-"
    prefix = "  " * indent + "  - "
    lines.append(
        f"{prefix}{_task_path(name)} ({task.status}){progress} [{assignee}]"
    )
    for child_name in task.children:
        if child_name in all_tasks:
            _append_task(
                lines,
                child_name,
                all_tasks,
                all_statuses,
                printed,
                indent + 1,
            )
