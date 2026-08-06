#!/usr/bin/env python3
"""Injection budget probe — measure alwaysApply, AGENTS, jsonl, and Layer 2 dispatch."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

_SCRIPTS = Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

from common.injection_budget import (  # noqa: E402
    budget_violations,
    collect_budget_report,
    format_budget_report,
)


def main() -> int:
    parser = argparse.ArgumentParser(description="Measure Trellis injection budget surfaces.")
    parser.add_argument("--repo-root", default=".", help="Repository root (default: .)")
    parser.add_argument("--task", default=None, help="Task directory for jsonl/dispatch probes")
    parser.add_argument(
        "--dispatch-role",
        choices=["implement", "check", "research"],
        default="implement",
        help="Role when measuring dispatch prompt (default: implement)",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Exit 1 on FAIL thresholds (rules >32KiB) or any WARN",
    )
    parser.add_argument("--json", action="store_true", help="Reserved for future machine output")
    args = parser.parse_args()

    if args.json:
        print("ERROR: --json not implemented yet", file=sys.stderr)
        return 2

    repo_root = Path(args.repo_root).resolve()
    task_dir = None
    if args.task:
        task_dir = Path(args.task)
        if not task_dir.is_absolute():
            task_dir = repo_root / task_dir
        task_dir = task_dir.resolve()

    report = collect_budget_report(
        repo_root,
        task_dir=task_dir,
        dispatch_role=args.dispatch_role if task_dir else None,
    )
    print(format_budget_report(report))

    violations = budget_violations(report, strict=args.strict)
    if violations:
        print("\n## Violations", file=sys.stderr)
        for item in violations:
            print(item, file=sys.stderr)
        if args.strict or any(item.startswith("FAIL:") for item in violations):
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
