#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Review-pool CLI: validate / plan-check / link / unlink / show.

Usage:
    python pool.py validate [--root <repo>]
    python pool.py plan-check [--root <repo>]
    python pool.py link <item-id> <task-ref> [--root <repo>]
    python pool.py unlink <item-id> <task-ref> [--root <repo>]
    python pool.py show <item-id> [--root <repo>]

Exit codes: any error-level finding (or a failed link/unlink/show) -> 1;
warnings only -> 0.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from common.io import read_json
from common.log import Colors, colored
from common.paths import get_repo_root
from common import pool_store


def _print_issue(issue: pool_store.Issue) -> None:
    color = Colors.RED if issue.is_error else Colors.YELLOW
    level = "error" if issue.is_error else "warning"
    location = f" ({issue.path})" if issue.path is not None else ""
    print(colored(f"[{level}] {issue.code}: {issue.message}{location}", color))


def _exit_for_issues(issues: list[pool_store.Issue]) -> int:
    errors = [issue for issue in issues if issue.is_error]
    warnings = [issue for issue in issues if not issue.is_error]
    for issue in issues:
        _print_issue(issue)
    if not issues:
        print(colored("OK", Colors.GREEN))
    elif not errors:
        print(colored(f"OK with {len(warnings)} warning(s)", Colors.GREEN))
    else:
        print(colored(f"{len(errors)} error(s), {len(warnings)} warning(s)", Colors.RED))
    return 1 if errors else 0


def cmd_validate(args: argparse.Namespace) -> int:
    issues = pool_store.validate_pool(args.root)
    return _exit_for_issues(issues)


def cmd_plan_check(args: argparse.Namespace) -> int:
    issues = pool_store.check_plan(args.root)
    return _exit_for_issues(issues)


def cmd_link(args: argparse.Namespace) -> int:
    result = pool_store.link_item_task(args.root, args.item_id, args.task_ref)
    for issue in result.errors:
        _print_issue(issue)
    if not result.ok:
        return 1
    print(colored(f"linked {result.item_id} <-> {result.task_ref}", Colors.GREEN))
    item = pool_store.load_item(args.root, result.item_id)
    if item is not None:
        print(f"  item.linked_tasks: {item.linked_tasks or '[]'}")
    data = read_json(result.task_path / "task.json") if result.task_path else None
    if data is not None:
        print(f"  task.meta.pool_items: {pool_store.get_pool_items(data) or '[]'}")
    return 0


def cmd_unlink(args: argparse.Namespace) -> int:
    result = pool_store.unlink_item_task(args.root, args.item_id, args.task_ref)
    for issue in result.errors:
        _print_issue(issue)
    if not result.ok:
        return 1
    for issue in result.warnings:
        _print_issue(issue)
    print(colored(f"unlinked {result.item_id} <-> {result.task_ref}", Colors.GREEN))
    return 0


def cmd_show(args: argparse.Namespace) -> int:
    item = pool_store.load_item(args.root, args.item_id)
    if item is None:
        print(
            colored(
                f"[error] item-not-found: pool item {args.item_id!r} not found",
                Colors.RED,
            ),
            file=sys.stderr,
        )
        return 1
    tasks_dir = args.root / ".cstl" / "tasks"
    print(f"id: {item.id or '<missing>'}")
    print(f"title: {item.title or '<missing>'}")
    print(f"status: {item.status or '<missing>'}")
    print(f"type: {item.type or '<missing>'}")
    print(f"path: {item.path}")
    if not item.linked_tasks:
        print("linked_tasks: []")
    for ref in item.linked_tasks:
        task_dir = pool_store.find_task_dir(ref, tasks_dir)
        if task_dir is None:
            print(f"linked_tasks: {ref} (missing)")
            continue
        data = read_json(task_dir / "task.json") or {}
        status = data.get("status", "?")
        archived = "archive/" in task_dir.as_posix()
        suffix = " (archived)" if archived else ""
        print(f"linked_tasks: {ref} -> {task_dir.name} ({status}){suffix}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="pool.py",
        description="Review-pool maintenance CLI: validate, plan-check, link, unlink, show.",
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=None,
        help="Repository root. Defaults to nearest parent containing .cstl/.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    def add_root(entry_parser: argparse.ArgumentParser) -> None:
        # SUPPRESS so a missing subcommand --root never clobbers the global
        # --root with None (argparse subparser defaults overwrite parent values).
        entry_parser.add_argument(
            "--root",
            type=Path,
            default=argparse.SUPPRESS,
            help="Repository root (overrides the global --root).",
        )

    validate_parser = subparsers.add_parser(
        "validate",
        help="Validate pool entries (sections, frontmatter, links, consistency).",
    )
    add_root(validate_parser)
    plan_parser = subparsers.add_parser(
        "plan-check",
        help="Check plan.md references against known pool item ids.",
    )
    add_root(plan_parser)
    link_parser = subparsers.add_parser(
        "link",
        help="Link a pool item to a task on both sides (idempotent).",
    )
    add_root(link_parser)
    link_parser.add_argument("item_id", help="Pool item id, e.g. P01")
    link_parser.add_argument("task_ref", help="Task dir name or resolvable ref")
    unlink_parser = subparsers.add_parser(
        "unlink",
        help="Remove the item<->task link on both sides (best-effort).",
    )
    add_root(unlink_parser)
    unlink_parser.add_argument("item_id", help="Pool item id, e.g. P01")
    unlink_parser.add_argument("task_ref", help="Task dir name or resolvable ref")
    show_parser = subparsers.add_parser(
        "show",
        help="Print one pool item with linked task statuses.",
    )
    add_root(show_parser)
    show_parser.add_argument("item_id", help="Pool item id, e.g. P01")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    root = getattr(args, "root", None)
    args.root = root.resolve() if root is not None else get_repo_root()

    handlers = {
        "validate": cmd_validate,
        "plan-check": cmd_plan_check,
        "link": cmd_link,
        "unlink": cmd_unlink,
        "show": cmd_show,
    }
    return handlers[args.command](args)


if __name__ == "__main__":
    sys.exit(main())
