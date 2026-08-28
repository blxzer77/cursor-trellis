#!/usr/bin/env python3
"""Stage 3 Personal Lite: no-Git Close, dual surfaces, budgeted context pack."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from common import kernel_command as kernel_command_mod
from common.kernel_command import kernel_start, kernel_expected_revision
from common.lite_context import (
    LITE_BASELINE_MODULES,
    LITE_PACK_SOURCE,
    LiteContextPackError,
    build_lite_context_pack,
)
from common.task_gates import validate_archive, validate_start_execution_check
from common.task_store import cmd_archive, cmd_create
from common.test_kernel_command import FAKE_KERNEL, _record


LITE_VERIFY = """# Verification Evidence

- validation: python -c "print('ok')"
- acceptance: Lite path completed without Parent or Git
- durable learning: no durable learning
"""

PLACEHOLDER_VERIFY = """# Verification Evidence

- validation: TBD
- acceptance: TODO
- durable learning: TBD
"""


@pytest.fixture
def lite_repo(tmp_path, monkeypatch):
    repo = tmp_path / "repo"
    (repo / ".cstl" / "tasks").mkdir(parents=True)
    (repo / ".cstl" / ".developer").write_text("tester\n", encoding="utf-8")
    script = tmp_path / "fake_kernel.py"
    script.write_text(FAKE_KERNEL, encoding="utf-8")
    monkeypatch.setattr("common.task_store.get_repo_root", lambda: repo)
    monkeypatch.setattr("common.task_store.get_developer", lambda _repo=None: "tester")
    monkeypatch.setattr("common.task_store.is_monorepo", lambda _repo: False)
    monkeypatch.setattr("common.task_store._has_subagent_platform", lambda _repo: False)
    monkeypatch.setattr("common.paths.get_repo_root", lambda: repo)
    monkeypatch.setattr("common.artifact_locale.get_repo_root", lambda: repo)
    monkeypatch.setattr(
        kernel_command_mod,
        "kernel_cli_argv",
        lambda: [sys.executable, str(script)],
    )
    assert not (repo / ".git").exists()
    return repo


def _only_task_dir(repo: Path) -> Path:
    tasks = [
        p
        for p in (repo / ".cstl" / "tasks").iterdir()
        if p.is_dir() and p.name != "archive"
    ]
    assert len(tasks) == 1
    return tasks[0]


def test_lite_context_pack_budget_and_exclusions() -> None:
    pack = build_lite_context_pack(
        phase="verify",
        artifacts=[
            {
                "role": "definition",
                "path": "prd.md",
                "content": "# Lite\n\n## Acceptance Criteria\n\n- [x] Close without Git\n",
            },
            {
                "role": "evidence",
                "path": "verify.md",
                "content": "- validation: core test\n- acceptance: done\n",
            },
        ],
    )
    assert pack["source"] == LITE_PACK_SOURCE
    assert pack["modules"]["baseline"] == list(LITE_BASELINE_MODULES)
    assert pack["budget"]["estimatedTokens"] <= pack["budget"]["maxEstimatedTokens"]
    assert any(item["role"] == "retrieval-router" for item in pack["selected"])
    assert not any(
        item["module"]
        in (
            "parent-child",
            "vcs-integration",
            "personal-memory",
            "retention-storage",
            "retrieval-extended",
        )
        for item in pack["selected"]
    )

    with pytest.raises(LiteContextPackError) as dump:
        build_lite_context_pack(phase="define", include_full_workflow=True)
    assert dump.value.code == "WORKFLOW_DUMP"

    with pytest.raises(LiteContextPackError) as parent:
        build_lite_context_pack(phase="execute", activated_modules=["parent-child"])
    assert parent.value.code == "ON_DEMAND_INACTIVE"

    tight = build_lite_context_pack(
        phase="verify",
        max_items=1,
        max_estimated_tokens=80,
        artifacts=[
            {"role": "definition", "path": "prd.md", "content": "x" * 400},
            {"role": "evidence", "path": "verify.md", "content": "y" * 400},
        ],
    )
    assert tight["budget"]["itemsUsed"] == 1
    assert tight["omitted"]
    assert "budget limits caused Lite pack omission" in tight["warnings"]


def test_create_start_check_and_no_git_archive(lite_repo: Path) -> None:
    rc = cmd_create(
        argparse.Namespace(
            title="Personal Lite Slice",
            slug="personal-lite-slice",
            description="no parent no git",
            assignee="tester",
            priority="P2",
            parent=None,
            package=None,
        )
    )
    assert rc == 0
    task_dir = _only_task_dir(lite_repo)
    assert (task_dir / "prd.md").is_file()
    assert (task_dir / "verify.md").is_file()
    assert not (task_dir / "task-map.md").is_file()
    data = json.loads((task_dir / "task.json").read_text(encoding="utf-8"))
    assert data["status"] == "planning"
    assert data["parent"] is None
    assert data["children"] == []

    check = validate_start_execution_check(task_dir, data)
    assert check.ok
    assert data.get("execution_approval") is None

    (task_dir / "verify.md").write_text(PLACEHOLDER_VERIFY, encoding="utf-8")
    fake = validate_archive(task_dir, data)
    assert not fake.ok
    assert any("verify.md" in err for err in fake.errors)

    (task_dir / "verify.md").write_text(LITE_VERIFY, encoding="utf-8")
    started = kernel_start(
        task_dir,
        _record(
            id=data["id"],
            name=data["name"],
            title=data["title"],
            status="in_progress",
        ),
        {"execution_approval": {"approved_by": "user"}},
        expected_revision=kernel_expected_revision(task_dir),
        actor="task.py start-execution --approved",
        idempotency_key="start:personal-lite-slice",
    )
    assert started["legacy"]["status"] == "in_progress"

    rc = cmd_archive(
        argparse.Namespace(
            name=task_dir.name,
            check=False,
            no_commit=False,
            archive_integrated_children=False,
        )
    )
    assert rc == 0
    assert not (lite_repo / ".git").exists()
    archived_root = lite_repo / ".cstl" / "tasks" / "archive"
    archived = list(archived_root.rglob("task.json")) if archived_root.is_dir() else []
    assert archived, "Lite Close should still move or keep Outcome on disk"
    closed = json.loads(archived[0].read_text(encoding="utf-8"))
    assert closed["status"] == "completed"
