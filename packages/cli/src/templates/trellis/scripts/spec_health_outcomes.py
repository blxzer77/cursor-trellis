#!/usr/bin/env python3
"""S1 spec-health outcomes — read-only durable-learning distribution over archive verify.md.

Maintainer observability only — NOT a blocking gate or KPI.
See .cstl/spec/guides/durable-learning-decision-guide.md for outcome definitions.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from common.task_gates import NO_DURABLE_LEARNING_RE  # noqa: E402

BUCKET_NAMES = ("no_only", "spec", "artifact", "ambiguous_multi", "legacy_none")

MONTH_RE = re.compile(r"^(\d{4}-\d{2})$")


def detect_signals(content: str) -> dict[str, bool]:
    """Return which durable-learning signal families appear in verify.md text.

    Uses the same substring probes as spec-health-signals.md S1 baseline (2026-08-06).
    """
    lower = content.lower()
    return {
        "no": bool(NO_DURABLE_LEARNING_RE.search(content)),
        "spec": "spec update evidence" in lower,
        "artifact": "learning artifact" in lower,
    }


def classify_bucket(content: str) -> str:
    """Assign exactly one mutually-exclusive S1 outcome bucket."""
    active = [name for name, present in detect_signals(content).items() if present]
    if not active:
        return "legacy_none"
    if len(active) > 1:
        return "ambiguous_multi"
    return {"no": "no_only", "spec": "spec", "artifact": "artifact"}[active[0]]


def extract_month(verify_path: Path, archive_root: Path) -> str | None:
    """Derive YYYY-MM from archive folder layout (e.g. archive/2026-08/<task>/verify.md)."""
    try:
        rel = verify_path.relative_to(archive_root)
    except ValueError:
        return None
    if rel.parts and MONTH_RE.match(rel.parts[0]):
        return rel.parts[0]
    return None


def empty_counts() -> dict[str, int]:
    return {name: 0 for name in BUCKET_NAMES}


def scan_archive(root: Path) -> tuple[dict[str, int], dict[str, dict[str, int]], int]:
    totals = empty_counts()
    by_month: dict[str, dict[str, int]] = defaultdict(empty_counts)
    total_files = 0

    for verify_path in sorted(root.rglob("verify.md")):
        if not verify_path.is_file():
            continue
        total_files += 1
        try:
            content = verify_path.read_text(encoding="utf-8")
        except OSError:
            content = ""
        bucket = classify_bucket(content)
        totals[bucket] += 1
        month = extract_month(verify_path, root)
        if month:
            by_month[month][bucket] += 1

    return totals, dict(sorted(by_month.items())), total_files


def build_report(root: Path, *, by_month: bool) -> dict[str, Any]:
    totals, monthly, total_files = scan_archive(root)
    report: dict[str, Any] = {
        "root": str(root),
        "total": total_files,
        "buckets": totals,
        "note": "Maintainer observability only — not a blocking gate or KPI.",
    }
    if by_month:
        report["by_month"] = monthly
    return report


def format_text_report(report: dict[str, Any]) -> str:
    lines = [
        f"Spec health S1 outcomes — {report['total']} verify.md files",
        f"Root: {report['root']}",
        "",
    ]
    total = int(report["total"])
    for name in BUCKET_NAMES:
        count = int(report["buckets"][name])
        pct = (count / total * 100) if total else 0.0
        lines.append(f"  {name}: {count} ({pct:.1f}%)")
    lines.extend(["", str(report["note"])])
    if report.get("by_month"):
        lines.append("")
        lines.append("By month:")
        for month, counts in report["by_month"].items():
            month_total = sum(int(v) for v in counts.values())
            lines.append(f"  {month}: {month_total} files — {counts}")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "S1 spec-health: durable-learning outcome distribution in archive verify.md "
            "(read-only; not a gate)."
        ),
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(".cstl/tasks/archive"),
        help="Archive root to scan (default: .cstl/tasks/archive)",
    )
    parser.add_argument("--json", action="store_true", help="Emit JSON report on stdout")
    parser.add_argument(
        "--by-month",
        action="store_true",
        help="Include per YYYY-MM bucket counts (from archive folder names)",
    )
    args = parser.parse_args(argv)

    root = args.root.resolve()
    if not root.is_dir():
        print(f"error: archive root not found: {root}", file=sys.stderr)
        return 1

    report = build_report(root, by_month=args.by_month)

    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        print(format_text_report(report))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
