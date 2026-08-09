#!/usr/bin/env python3
"""Verification evidence probe — repeatable false-green detection.

Evaluates a fixture verify.md against closeout-profile evidence requirements
by reusing task_gates.verify_evidence_status() (no duplicate rule set).

Exit 0 when actual outcome matches --expect; exit 1 on mismatch or error.
"""

from __future__ import annotations

import argparse
import io
import shutil
import sys
import tempfile
from pathlib import Path

_SCRIPTS = Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

from common.task_gates import verify_evidence_status  # noqa: E402

if sys.platform.startswith("win"):
    for _stream_name in ("stdin", "stdout", "stderr"):
        _stream = getattr(sys, _stream_name, None)
        if _stream is None and _stream_name != "stdin":
            continue
        if _stream is None:
            continue
        if hasattr(_stream, "reconfigure"):
            try:
                _stream.reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                pass
        elif hasattr(_stream, "detach"):
            try:
                setattr(
                    sys,
                    _stream_name,
                    io.TextIOWrapper(_stream.detach(), encoding="utf-8", errors="replace"),
                )
            except Exception:
                pass

PROFILE_REQUIRED_SIGNALS: dict[str, list[str]] = {
    "lite": ["validation", "acceptance", "durable_learning"],
    "full": [
        "validation",
        "acceptance",
        "durable_learning",
        "check_evidence",
        "reviewed_change_set",
    ],
    "parent": [
        "validation",
        "acceptance",
        "durable_learning",
        "integration",
    ],
}


def evaluate_fixture(fixture_path: Path, profile: str) -> tuple[bool, dict[str, bool], list[str]]:
    """Return (passes, status_map, missing_signals) for a fixture verify.md."""
    profile = profile.lower().strip()
    if profile not in PROFILE_REQUIRED_SIGNALS:
        raise ValueError(f"unknown profile: {profile}")

    required = PROFILE_REQUIRED_SIGNALS[profile]
    task_data: dict = {"children": ["probe-child"] if profile == "parent" else []}

    with tempfile.TemporaryDirectory(prefix="cstl-verify-probe-") as tmp:
        task_dir = Path(tmp)
        shutil.copy2(fixture_path, task_dir / "verify.md")
        status = verify_evidence_status(task_dir, task_data)

    missing = [signal for signal in required if not status.get(signal)]
    return len(missing) == 0, status, missing


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Probe verify.md fixture against closeout evidence requirements.",
    )
    parser.add_argument(
        "--fixture",
        required=True,
        type=Path,
        help="Path to fixture verify.md",
    )
    parser.add_argument(
        "--profile",
        required=True,
        choices=sorted(PROFILE_REQUIRED_SIGNALS),
        help="Closeout profile to evaluate against",
    )
    parser.add_argument(
        "--expect",
        required=True,
        choices=("pass", "fail"),
        help="Expected probe outcome",
    )
    args = parser.parse_args(argv)

    fixture = args.fixture.resolve()
    if not fixture.is_file():
        print(f"verify-evidence-probe: fixture not found: {fixture}", file=sys.stderr)
        return 2

    try:
        passes, status, missing = evaluate_fixture(fixture, args.profile)
    except ValueError as exc:
        print(f"verify-evidence-probe: {exc}", file=sys.stderr)
        return 2

    actual = "pass" if passes else "fail"
    expected = args.expect.lower()

    print(f"fixture: {fixture}")
    print(f"profile: {args.profile}")
    print(f"status: {status}")
    if missing:
        print(f"missing: {', '.join(missing)}")
    print(f"actual: {actual}")
    print(f"expect: {expected}")

    if actual == expected:
        print("result: OK")
        return 0

    print("result: MISMATCH", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
