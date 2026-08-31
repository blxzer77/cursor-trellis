#!/usr/bin/env python3
"""P38 planning-declaration Check helper (not a start-execution hard gate)."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from common.full_quality import resolve_required_controls
from common.ondemand_topology import ONDEMAND_TRIGGER_HINTS
from common.parallel_declaration import (
    evaluate_parallel_declaration,
    host_forbidden_terms,
)
from common.task_gates import validate_start_execution_check

TEMPLATES = Path(__file__).resolve().parents[3]
PARALLEL_DOC = TEMPLATES / "markdown" / "framework" / "parallel-first-execution.md.txt"
WORKER_CONTRACT = TEMPLATES / "trellis" / "modules" / "worker-orchestration" / "contract.md"
INTAKE_CONTRACT = TEMPLATES / "trellis" / "modules" / "intake-basic" / "contract.md"

FULL_IMPLEMENT = """# Contract

execution_mode: worker
isolation: git-worktree
verification_profile: standard
retrieval_profile: exact-only
optional_capabilities: []
quality_gates:
  mode: profile
"""

FULL_PRD = """# Full

## Acceptance Criteria

- [ ] Ship the slice
"""


def _write(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def _full_data() -> dict:
    return {
        "id": "full-sample",
        "status": "planning",
        "required_controls": resolve_required_controls(rigor="full"),
        "baseline_modules": {
            "active": [
                "intake-basic",
                "define-basic",
                "approval-personal",
                "execute-agent",
                "verify-basic",
                "close-basic",
                "context-progressive",
                "observability-local",
            ]
        },
    }


def test_full_missing_declaration_fails_check_helper(tmp_path: Path) -> None:
    task_dir = tmp_path / "full-missing"
    task_dir.mkdir()
    _write(task_dir / "prd.md", FULL_PRD)
    _write(task_dir / "design.md", "# Design\n")
    _write(task_dir / "implement.md", FULL_IMPLEMENT)
    verdict = evaluate_parallel_declaration(task_dir, _full_data())
    assert verdict["result"] == "FAIL"
    assert verdict["ok"] is False
    assert any("parallel_groups" in err and "serial_reason" in err for err in verdict["errors"])


def test_full_serial_reason_passes(tmp_path: Path) -> None:
    task_dir = tmp_path / "full-serial"
    task_dir.mkdir()
    _write(
        task_dir / "implement.md",
        FULL_IMPLEMENT + "\nserial_reason: shared write-set\n",
    )
    verdict = evaluate_parallel_declaration(task_dir, _full_data())
    assert verdict["result"] == "PASS"
    assert verdict["has_serial_reason"] is True


def test_parent_stages_alias_and_disjoint_touches_pass(tmp_path: Path) -> None:
    task_dir = tmp_path / "parent-stages"
    task_dir.mkdir()
    _write(
        task_dir / "task-map.md",
        "---\n"
        "execution_topology: parallel\n"
        "merge_limit: 1\n"
        "children:\n"
        "  - id: child-a\n"
        "    state: open\n"
        "    depends_on: []\n"
        "    touches: [a.py]\n"
        "    isolation: main-worktree\n"
        "    ref: null\n"
        "  - id: child-b\n"
        "    state: open\n"
        "    depends_on: []\n"
        "    touches: [b.py]\n"
        "    isolation: main-worktree\n"
        "    ref: null\n"
        "stages:\n"
        "  - id: land\n"
        "    units: [child-a, child-b]\n"
        "integration_queue: []\n"
        "---\n# Task Map\n",
    )
    _write(task_dir / "implement.md", FULL_IMPLEMENT)
    data = {
        **_full_data(),
        "children": ["child-a", "child-b"],
        "topology": {"kind": "parent-child", "children": ["child-a", "child-b"]},
    }
    verdict = evaluate_parallel_declaration(task_dir, data)
    assert verdict["profile"] == "parent"
    assert verdict["units"] == ["child-a", "child-b"]
    assert verdict["result"] == "PASS"


def test_overlapping_touches_without_isolation_fail(tmp_path: Path) -> None:
    task_dir = tmp_path / "overlap"
    task_dir.mkdir()
    _write(
        task_dir / "task-map.md",
        "---\n"
        "parallel_groups: [child-a, child-b]\n"
        "children:\n"
        "  - id: child-a\n"
        "    state: open\n"
        "    depends_on: []\n"
        "    touches: [shared.py]\n"
        "    isolation: main-worktree\n"
        "    ref: null\n"
        "  - id: child-b\n"
        "    state: open\n"
        "    depends_on: []\n"
        "    touches: [shared.py]\n"
        "    isolation: main-worktree\n"
        "    ref: null\n"
        "---\n# Task Map\n",
    )
    verdict = evaluate_parallel_declaration(
        task_dir,
        {
            **_full_data(),
            "children": ["child-a", "child-b"],
            "topology": {"kind": "parent-child", "children": ["child-a", "child-b"]},
        },
    )
    assert verdict["result"] == "FAIL"
    assert any("overlap" in err for err in verdict["errors"])


def test_overlapping_touches_with_worktree_isolation_pass(tmp_path: Path) -> None:
    task_dir = tmp_path / "isolated"
    task_dir.mkdir()
    _write(
        task_dir / "task-map.md",
        "---\n"
        "parallel_groups: [child-a, child-b]\n"
        "children:\n"
        "  - id: child-a\n"
        "    state: open\n"
        "    depends_on: []\n"
        "    touches: [shared.py]\n"
        "    isolation: git-worktree\n"
        "    ref: null\n"
        "  - id: child-b\n"
        "    state: open\n"
        "    depends_on: []\n"
        "    touches: [shared.py]\n"
        "    isolation: git-worktree\n"
        "    ref: null\n"
        "---\n# Task Map\n",
    )
    verdict = evaluate_parallel_declaration(
        task_dir,
        {
            **_full_data(),
            "children": ["child-a", "child-b"],
            "topology": {"kind": "parent-child", "children": ["child-a", "child-b"]},
        },
    )
    assert verdict["result"] == "PASS"


def test_declared_groups_inline_without_reason_fails(tmp_path: Path) -> None:
    task_dir = tmp_path / "inline-groups"
    task_dir.mkdir()
    _write(
        task_dir / "implement.md",
        "execution_mode: inline\n"
        "isolation: main-worktree\n"
        "verification_profile: standard\n"
        "retrieval_profile: exact-only\n"
        "optional_capabilities: []\n"
        "quality_gates:\n"
        "  mode: profile\n"
        "parallel_groups: [slice-a, slice-b]\n",
    )
    verdict = evaluate_parallel_declaration(task_dir, _full_data())
    assert verdict["result"] == "FAIL"
    assert any("inline" in err for err in verdict["errors"])


def test_lite_missing_declaration_is_skip(tmp_path: Path) -> None:
    task_dir = tmp_path / "lite"
    task_dir.mkdir()
    _write(task_dir / "implement.md", "execution_mode: inline\n")
    verdict = evaluate_parallel_declaration(
        task_dir,
        {"required_controls": resolve_required_controls(rigor="lite")},
    )
    assert verdict["profile"] == "lite"
    assert verdict["result"] == "SKIP"
    assert verdict["ok"] is True


def test_start_execution_check_does_not_hard_fail_missing_declaration(
    tmp_path: Path,
) -> None:
    task_dir = tmp_path / "full-gate"
    task_dir.mkdir()
    _write(task_dir / "prd.md", FULL_PRD)
    _write(task_dir / "design.md", "# Design\n")
    _write(task_dir / "implement.md", FULL_IMPLEMENT)
    data = _full_data()
    helper = evaluate_parallel_declaration(task_dir, data)
    assert helper["result"] == "FAIL"
    gate = validate_start_execution_check(task_dir, data)
    assert gate.ok
    assert not any("serial_reason" in err or "parallel_groups" in err for err in gate.errors)


def test_worker_trigger_hint_includes_isolatable_window() -> None:
    hints = ONDEMAND_TRIGGER_HINTS["worker-orchestration"]
    assert "isolatable-group-dispatch-window" in hints


def test_product_docs_lock_p38_language() -> None:
    parallel = PARALLEL_DOC.read_text(encoding="utf-8")
    worker = WORKER_CONTRACT.read_text(encoding="utf-8")
    intake = INTAKE_CONTRACT.read_text(encoding="utf-8")
    for term in host_forbidden_terms():
        assert term not in parallel
        assert term not in worker
    assert "Check FAIL" in parallel or "unqualified" in parallel
    assert "serial_reason" in parallel
    assert "parallel_groups" in parallel
    assert "已声明可隔离组" in worker
    assert "派工窗口" in worker
    assert "不得以「Parent 默默顺序做完」代替激活" in worker
    assert "可以全程 inline / 顺序会话做完 Child，不自动打开本块" not in worker
    assert "可隔离单位" in intake
