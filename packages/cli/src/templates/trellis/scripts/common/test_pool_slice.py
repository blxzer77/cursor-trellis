#!/usr/bin/env python3
"""P40 pool-slice Check helper (not a start-execution hard gate)."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from common.full_quality import resolve_required_controls
from common.pool_slice import evaluate_pool_slice
from common.task_gates import validate_start_execution_check

TEMPLATES = Path(__file__).resolve().parents[3]
POOL_README = TEMPLATES / "trellis" / "pool" / "README.md"
INTAKE_CONTRACT = TEMPLATES / "trellis" / "modules" / "intake-basic" / "contract.md"
CANDIDATE_CONTRACT = TEMPLATES / "trellis" / "modules" / "candidate-pool" / "contract.md"
CHECK_CONTRACT = TEMPLATES / "trellis" / "modules" / "independent-check" / "contract.md"

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

MULTI_PRD = """# Full

## 池义务

- P40: README and Intake only.
- P01: not this slice.

## Acceptance Criteria

- [ ] Ship the slice
"""


def _write(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def _full_data(**meta: object) -> dict:
    payload = {
        "id": "full-sample",
        "status": "planning",
        "required_controls": resolve_required_controls(rigor="full"),
    }
    if meta:
        payload["meta"] = dict(meta)
    return payload


def test_full_missing_touches_fails(tmp_path: Path) -> None:
    task_dir = tmp_path / "full-missing"
    task_dir.mkdir()
    _write(task_dir / "prd.md", FULL_PRD)
    _write(task_dir / "implement.md", FULL_IMPLEMENT)
    verdict = evaluate_pool_slice(task_dir, _full_data())
    assert verdict["result"] == "FAIL"
    assert any("touches" in err for err in verdict["errors"])


def test_full_with_touches_passes(tmp_path: Path) -> None:
    task_dir = tmp_path / "full-ok"
    task_dir.mkdir()
    _write(task_dir / "implement.md", FULL_IMPLEMENT + "\ntouches: [a.py]\n")
    verdict = evaluate_pool_slice(task_dir, _full_data())
    assert verdict["result"] == "PASS"
    assert verdict["touches"] == ["a.py"]


def test_lite_missing_touches_is_skip(tmp_path: Path) -> None:
    task_dir = tmp_path / "lite"
    task_dir.mkdir()
    _write(task_dir / "implement.md", "execution_mode: inline\n")
    verdict = evaluate_pool_slice(
        task_dir,
        {"required_controls": resolve_required_controls(rigor="lite")},
    )
    assert verdict["profile"] == "lite"
    assert verdict["result"] == "SKIP"
    assert verdict["ok"] is True


def test_unrelated_modules_without_reason_fail(tmp_path: Path) -> None:
    task_dir = tmp_path / "unrelated"
    task_dir.mkdir()
    _write(
        task_dir / "implement.md",
        FULL_IMPLEMENT
        + "\ntouches: [packages/core/src/index.ts, packages/cli/src/templates/cursor/agents/x.md]\n",
    )
    verdict = evaluate_pool_slice(task_dir, _full_data())
    assert verdict["result"] == "FAIL"
    assert any("unrelated" in err for err in verdict["errors"])


def test_unrelated_modules_with_serial_reason_pass(tmp_path: Path) -> None:
    task_dir = tmp_path / "unrelated-ok"
    task_dir.mkdir()
    _write(
        task_dir / "implement.md",
        FULL_IMPLEMENT
        + "\nserial_reason: shared write-set\n"
        + "touches: [packages/core/src/index.ts, packages/cli/src/templates/cursor/agents/x.md]\n",
    )
    verdict = evaluate_pool_slice(task_dir, _full_data())
    assert verdict["result"] == "PASS"


def test_unrelated_modules_oversized_accepted_pass(tmp_path: Path) -> None:
    task_dir = tmp_path / "oversized"
    task_dir.mkdir()
    _write(
        task_dir / "implement.md",
        FULL_IMPLEMENT
        + "\noversized_accepted: true\n"
        + "touches: [packages/core/src/index.ts, smart-search/src/cli.py]\n",
    )
    verdict = evaluate_pool_slice(task_dir, _full_data())
    assert verdict["result"] == "PASS"


def test_multi_link_without_obligations_fail(tmp_path: Path) -> None:
    task_dir = tmp_path / "multi-missing"
    task_dir.mkdir()
    _write(task_dir / "prd.md", FULL_PRD)
    _write(task_dir / "implement.md", FULL_IMPLEMENT + "\ntouches: [a.py]\n")
    verdict = evaluate_pool_slice(
        task_dir,
        _full_data(pool_items=["P40", "P01"]),
    )
    assert verdict["result"] == "FAIL"
    assert any("multi-link" in err for err in verdict["errors"])


def test_multi_link_with_obligations_pass(tmp_path: Path) -> None:
    task_dir = tmp_path / "multi-ok"
    task_dir.mkdir()
    _write(task_dir / "prd.md", MULTI_PRD)
    _write(task_dir / "implement.md", FULL_IMPLEMENT + "\ntouches: [a.py]\n")
    verdict = evaluate_pool_slice(
        task_dir,
        _full_data(pool_items=["P40", "P01"]),
    )
    assert verdict["result"] == "PASS"


def test_start_execution_check_does_not_hard_fail_missing_touches(
    tmp_path: Path,
) -> None:
    task_dir = tmp_path / "full-gate"
    task_dir.mkdir()
    _write(task_dir / "prd.md", FULL_PRD)
    _write(task_dir / "design.md", "# Design\n")
    _write(task_dir / "implement.md", FULL_IMPLEMENT)
    data = _full_data()
    helper = evaluate_pool_slice(task_dir, data)
    assert helper["result"] == "FAIL"
    gate = validate_start_execution_check(task_dir, data)
    assert gate.ok
    assert not any("touches" in err for err in gate.errors)


def test_product_docs_lock_p40_language() -> None:
    readme = POOL_README.read_text(encoding="utf-8")
    intake = INTAKE_CONTRACT.read_text(encoding="utf-8")
    candidate = CANDIDATE_CONTRACT.read_text(encoding="utf-8")
    check = CHECK_CONTRACT.read_text(encoding="utf-8")
    assert "## 切片" in readme
    assert "does not fail" in readme.lower() or "不以缺该节失败" in readme
    assert "切片" in intake
    assert "不自动" in candidate
    assert "evaluate_pool_slice" in check
    assert "validate" in readme.lower()


def test_pool_validate_source_has_no_slice_heading_rule() -> None:
    store = (Path(__file__).resolve().parent / "pool_store.py").read_text(
        encoding="utf-8"
    )
    assert "切片" not in store
    assert "## 切片" not in store

