#!/usr/bin/env python3
"""Tests for P1 observable defaults (verify seed, jsonl seed, dashboard summary)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from common.artifact_locale import default_verify_content
from common.task_dashboard import format_verify_summary, render_task_dashboard
from common.task_store import _resolve_seed_spec_paths, _write_seed_jsonl


def test_default_verify_content_has_standard_sections() -> None:
    content = default_verify_content(locale="en")
    for heading in (
        "## Planning check",
        "## Execution evidence",
        "### Validation commands",
        "### Acceptance",
        "### Durable learning",
    ):
        assert heading in content


def test_write_seed_jsonl_uses_real_spec_paths(tmp_path: Path) -> None:
    repo_root = tmp_path / "repo"
    spec_root = repo_root / ".cstl" / "spec" / "guides"
    spec_root.mkdir(parents=True)
    for name in ("index.md", "verification-strength-guide.md", "injection-budget-guide.md"):
        (spec_root / name).write_text(f"# {name}\n", encoding="utf-8")

    task_dir = repo_root / ".cstl" / "tasks" / "08-07-test-seed"
    task_dir.mkdir(parents=True)
    task_data = {"id": "test-seed", "package": None, "scope": None, "children": []}

    jsonl_path = task_dir / "implement.jsonl"
    _write_seed_jsonl(jsonl_path, repo_root, task_dir, task_data)

    rows = [json.loads(line) for line in jsonl_path.read_text(encoding="utf-8").splitlines() if line.strip()]
    assert len(rows) >= 2
    assert all("file" in row and row["file"].startswith(".cstl/spec/") for row in rows)
    assert all("_example" not in row for row in rows)
    for row in rows:
        assert (repo_root / row["file"]).is_file()


def test_resolve_seed_spec_paths_prefers_existing_guides(tmp_path: Path) -> None:
    repo_root = tmp_path / "repo"
    guides = repo_root / ".cstl" / "spec" / "guides"
    guides.mkdir(parents=True)
    (guides / "index.md").write_text("# index\n", encoding="utf-8")
    (guides / "verification-strength-guide.md").write_text("# verify\n", encoding="utf-8")

    task_dir = repo_root / ".cstl" / "tasks" / "08-07-test-paths"
    task_dir.mkdir(parents=True)
    paths = _resolve_seed_spec_paths(repo_root, task_dir, {"children": []})
    assert len(paths) >= 2
    assert all((repo_root / rel).is_file() for rel in paths)


def test_format_verify_summary_missing_without_file(tmp_path: Path) -> None:
    task_dir = tmp_path / "task"
    task_dir.mkdir()
    assert format_verify_summary(task_dir, {"children": []}) == "[verify: missing]"


def test_format_verify_summary_partial_from_signals(tmp_path: Path) -> None:
    task_dir = tmp_path / "task"
    task_dir.mkdir()
    (task_dir / "verify.md").write_text(
        "Validation commands: pytest -q — pass\n",
        encoding="utf-8",
    )
    assert format_verify_summary(task_dir, {"children": []}) == "[verify: partial]"


def test_format_verify_summary_ok_when_all_signals(tmp_path: Path) -> None:
    task_dir = tmp_path / "task"
    task_dir.mkdir()
    (task_dir / "verify.md").write_text(
        "\n".join(
            [
                "Validation commands: pytest -q — pass",
                "Check evidence: cstl-check — pass",
                "Final acceptance evidence: all AC met",
                "Durable learning decision: no durable learning",
                "Reviewed change-set: git diff main..HEAD",
            ]
        ),
        encoding="utf-8",
    )
    assert format_verify_summary(task_dir, {"children": []}) == "[verify: ok]"


def test_render_task_dashboard_includes_verify_summary(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    repo_root = tmp_path / "repo"
    tasks_dir = repo_root / ".cstl" / "tasks"
    task_dir = tasks_dir / "08-07-dashboard-task"
    task_dir.mkdir(parents=True)
    (task_dir / "task.json").write_text(
        json.dumps(
            {
                "id": "dashboard-task",
                "name": "dashboard-task",
                "title": "dashboard-task",
                "status": "planning",
                "assignee": "dev",
                "children": [],
            }
        ),
        encoding="utf-8",
    )
    (task_dir / "verify.md").write_text(
        "Validation commands: echo ok — pass\n",
        encoding="utf-8",
    )

    monkeypatch.chdir(repo_root)
    monkeypatch.setattr("common.task_dashboard.get_repo_root", lambda: repo_root)
    monkeypatch.setattr("common.task_dashboard.get_tasks_dir", lambda _root=None: tasks_dir)
    monkeypatch.setattr("common.task_dashboard.get_developer", lambda _root=None: "dev")
    monkeypatch.setattr(
        "common.active_task.resolve_selected_task",
        lambda *_args, **_kwargs: type("Sel", (), {"task_path": None, "source": None})(),
    )

    dashboard = render_task_dashboard(repo_root)
    assert "[verify: partial]" in dashboard
    assert "08-07-dashboard-task" in dashboard
