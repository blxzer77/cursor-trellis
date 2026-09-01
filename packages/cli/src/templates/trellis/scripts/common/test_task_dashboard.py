#!/usr/bin/env python3
"""Dashboard Kernel-phase projection tests."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from common.task_dashboard import project_kernel_surface, render_task_dashboard


def _write_task(
    tasks_dir: Path,
    dir_name: str,
    *,
    status: str = "planning",
    kernel_phase: str | None = None,
    topology_kind: str | None = None,
) -> Path:
    task_dir = tasks_dir / dir_name
    task_dir.mkdir(parents=True, exist_ok=True)
    data = {
        "id": dir_name,
        "name": dir_name,
        "title": dir_name,
        "status": status,
        "assignee": "dev",
        "children": [],
    }
    if topology_kind is not None:
        data["topology"] = {"kind": topology_kind}
    (task_dir / "task.json").write_text(
        json.dumps(data, ensure_ascii=False), encoding="utf-8"
    )
    if kernel_phase is not None:
        kernel = {
            "schemaVersion": 1,
            "identity": {"taskId": dir_name},
            "revision": 1,
            "phase": kernel_phase,
            "condition": "ready",
            "outcome": None,
            "audit": [],
            "gates": {"schemaVersion": 1, "transitions": {}},
            "projection": {"status": status, "record": data, "extras": {}},
        }
        (task_dir / "kernel.json").write_text(
            json.dumps(kernel, ensure_ascii=False), encoding="utf-8"
        )
    return task_dir


def _patch_dashboard(
    monkeypatch: pytest.MonkeyPatch, repo_root: Path, tasks_dir: Path
) -> None:
    monkeypatch.chdir(repo_root)
    monkeypatch.setattr("common.task_dashboard.get_repo_root", lambda: repo_root)
    monkeypatch.setattr(
        "common.task_dashboard.get_tasks_dir", lambda _root=None: tasks_dir
    )
    monkeypatch.setattr(
        "common.task_dashboard.get_developer", lambda _root=None: "dev"
    )
    monkeypatch.setattr(
        "common.active_task.resolve_selected_task",
        lambda *_args, **_kwargs: type(
            "Sel", (), {"task_path": None, "source": None}
        )(),
    )


def test_kernel_define_fixture_uses_define_not_planning(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    repo_root = tmp_path / "repo"
    tasks_dir = repo_root / ".cstl" / "tasks"
    _write_task(
        tasks_dir,
        "08-31-define-fixture",
        status="planning",
        kernel_phase="define",
    )
    _patch_dashboard(monkeypatch, repo_root, tasks_dir)

    dashboard = render_task_dashboard(repo_root)
    assert "Define:" in dashboard
    assert "(Define)" in dashboard
    assert "Planning:" not in dashboard
    assert "(Planning)" not in dashboard
    on_disk = json.loads(
        (tasks_dir / "08-31-define-fixture" / "task.json").read_text(
            encoding="utf-8"
        )
    )
    assert on_disk["status"] == "planning"


def test_no_selected_task_does_not_name_micro_grill_as_mode(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    repo_root = tmp_path / "repo"
    tasks_dir = repo_root / ".cstl" / "tasks"
    tasks_dir.mkdir(parents=True)
    _patch_dashboard(monkeypatch, repo_root, tasks_dir)

    dashboard = render_task_dashboard(repo_root)
    assert "Selected task: none" in dashboard
    assert "Micro-Grill" not in dashboard
    assert "[Triage:]" not in dashboard
    assert "Intake" in dashboard
    assert "Open Proposal" in dashboard


def test_legacy_planning_status_still_listed(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    repo_root = tmp_path / "repo"
    tasks_dir = repo_root / ".cstl" / "tasks"
    task_dir = _write_task(tasks_dir, "08-31-legacy-planning", status="planning")
    _patch_dashboard(monkeypatch, repo_root, tasks_dir)

    dashboard = render_task_dashboard(repo_root)
    assert "08-31-legacy-planning" in dashboard
    assert "Define:" in dashboard
    surface = project_kernel_surface(
        task_dir,
        json.loads((task_dir / "task.json").read_text(encoding="utf-8")),
    )
    assert surface["status"] == "planning"
    assert surface["phase"] == "define"
    assert surface["humanPhase"] == "Define"


def test_integrate_heading_only_when_topology_needs_it(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    repo_root = tmp_path / "repo"
    tasks_dir = repo_root / ".cstl" / "tasks"
    _write_task(
        tasks_dir,
        "08-31-single-define",
        status="planning",
        kernel_phase="define",
        topology_kind="single",
    )
    _patch_dashboard(monkeypatch, repo_root, tasks_dir)

    dashboard = render_task_dashboard(repo_root)
    assert "Integrate:" not in dashboard
    assert "Define:" in dashboard
