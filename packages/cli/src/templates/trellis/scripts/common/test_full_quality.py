#!/usr/bin/env python3
"""Stage 4 Full Quality: required_controls, ledger, graded Independent Check."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from common.full_quality import (
    FULL_BASELINE_CONTROLS,
    evaluate_independent_check,
    full_quality_archive_errors,
    resolve_required_controls,
    rigor_from_required_controls,
)
from common.task_gates import task_closeout_profile, validate_archive

LITE_VERIFY = """# Verification Evidence

- validation: python -c "print('ok')"
- acceptance: Lite path completed without Parent or Git
- durable learning: no durable learning
"""


def test_resolve_controls_does_not_require_design_for_standard_full() -> None:
    standard = resolve_required_controls(rigor="full", verification_profile="standard")
    assert standard["controls"] == list(FULL_BASELINE_CONTROLS)
    assert "design" not in standard["controls"]

    architecture = resolve_required_controls(
        rigor="full", verification_profile="architecture"
    )
    assert "design" in architecture["controls"]


def test_closeout_does_not_infer_from_files_or_children(tmp_path: Path) -> None:
    task_dir = tmp_path / "inferred"
    task_dir.mkdir()
    (task_dir / "design.md").write_text("# design\n", encoding="utf-8")
    (task_dir / "implement.md").write_text("# implement\n", encoding="utf-8")
    assert task_closeout_profile(task_dir, {"children": ["c1"]}) == "lite"
    assert task_closeout_profile(task_dir, {}) == "lite"


def test_closeout_reads_legacy_classification_but_prefers_topology(
    tmp_path: Path,
) -> None:
    task_dir = tmp_path / "legacy"
    task_dir.mkdir()
    assert (
        task_closeout_profile(
            task_dir,
            {"meta": {"classification": "parent"}, "children": []},
        )
        == "parent"
    )
    assert (
        task_closeout_profile(
            task_dir,
            {
                "required_controls": resolve_required_controls(rigor="lite"),
                "topology": {"kind": "parent-child", "parent_id": None, "children": ["c1"]},
            },
        )
        == "parent"
    )


def test_closeout_profile_prefers_required_controls_over_files(tmp_path: Path) -> None:
    task_dir = tmp_path / "task"
    task_dir.mkdir()
    (task_dir / "design.md").write_text("# design\n", encoding="utf-8")
    (task_dir / "implement.md").write_text("# implement\n", encoding="utf-8")
    lite = {
        "children": [],
        "required_controls": resolve_required_controls(rigor="lite"),
    }
    assert task_closeout_profile(task_dir, lite) == "lite"
    assert rigor_from_required_controls(lite) == "lite"

    full = {
        "children": [],
        "required_controls": resolve_required_controls(rigor="full"),
    }
    assert task_closeout_profile(tmp_path / "no-design", full) == "full"


def test_archive_full_requires_ledger_and_check(tmp_path: Path) -> None:
    task_dir = tmp_path / "full"
    task_dir.mkdir()
    (task_dir / "prd.md").write_text(
        "# Full\n\n## Acceptance Criteria\n\n- [x] Ledger maps AC\n",
        encoding="utf-8",
    )
    (task_dir / "implement.md").write_text("execution_mode: inline\n", encoding="utf-8")
    (task_dir / "verify.md").write_text(LITE_VERIFY, encoding="utf-8")
    data = {
        "status": "in_progress",
        "children": [],
        "parent": None,
        "required_controls": resolve_required_controls(rigor="full"),
    }
    missing = full_quality_archive_errors(task_dir, data)
    assert any("ledger" in err for err in missing)

    data["ac_evidence_ledger"] = {
        "items": [{"ac_id": "AC-1", "evidence_ref": "verify.md#validation"}],
        "source_fingerprint": "stale",
    }
    data["independent_check"] = evaluate_independent_check(
        mode="self-review",
        independent_worker_available=False,
        evidence="self-review notes",
        code_fingerprint="code-v1",
    )
    stale = full_quality_archive_errors(task_dir, data)
    assert any("stale" in err for err in stale)

    blocked = evaluate_independent_check(
        mode="true-independent",
        independent_worker_available=False,
        evidence="would-be independent",
        code_fingerprint="code-v1",
    )
    assert blocked["result"] == "BLOCKED"
    data["independent_check"] = blocked
    blocked_errors = full_quality_archive_errors(task_dir, data)
    assert any("PASS" in err or "independent worker" in err for err in blocked_errors)


def test_lite_archive_does_not_require_independent_check(tmp_path: Path) -> None:
    task_dir = tmp_path / "lite-quality"
    task_dir.mkdir()
    (task_dir / "prd.md").write_text(
        "# Lite\n\n## Acceptance Criteria\n\n- [x] Close\n",
        encoding="utf-8",
    )
    (task_dir / "verify.md").write_text(LITE_VERIFY, encoding="utf-8")
    data = {
        "id": "lite-quality",
        "name": "lite-quality",
        "title": "Lite",
        "status": "in_progress",
        "children": [],
        "parent": None,
    }
    guard = validate_archive(task_dir, data)
    assert guard.ok
    assert guard.closeout_profile == "lite"
    assert full_quality_archive_errors(task_dir, data) == []
