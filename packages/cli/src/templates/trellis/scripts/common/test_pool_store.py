#!/usr/bin/env python3
"""Tests for the review-pool store (read, write, links, validation, plan)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from common.pool_store import (
    check_plan,
    find_item_path,
    get_linked_tasks,
    get_pool_items,
    link_item_task,
    list_items,
    load_item,
    normalize_id_list,
    parse_item_file,
    plan_referenced_ids,
    unlink_item_task,
    validate_pool,
    write_item_frontmatter,
)
from common.kernel_command import to_kernel_record

ITEM_TEMPLATE = """\
---
id: {item_id}
title: {title}
status: {status}
type: mechanism
locale: zh
created: 2026-08-08
approved: 2026-08-08
delivery: standing
---

## 意图

one line

## 动机

why

## 粗验收

- a
- b

## 非目标

- c
"""


def _repo(tmp_path: Path) -> Path:
    repo = tmp_path / "repo"
    (repo / ".cstl" / "pool" / "items").mkdir(parents=True)
    (repo / ".cstl" / "tasks").mkdir(parents=True)
    return repo


def _write_item(repo: Path, item_id: str, *, title: str = "t", status: str = "accepted") -> Path:
    path = repo / ".cstl" / "pool" / "items" / f"{item_id}.md"
    path.write_text(
        ITEM_TEMPLATE.format(item_id=item_id, title=title, status=status),
        encoding="utf-8",
    )
    return path


def _write_task(
    repo: Path,
    dir_name: str,
    status: str = "completed",
    meta: dict | None = None,
) -> Path:
    task_dir = repo / ".cstl" / "tasks" / dir_name
    task_dir.mkdir(parents=True, exist_ok=True)
    data = to_kernel_record(
        {
            "id": dir_name,
            "name": dir_name,
            "title": dir_name,
            "description": "",
            "status": status,
        }
    )
    if meta is not None:
        data["meta"] = meta
    (task_dir / "task.json").write_text(json.dumps(data, indent=2), encoding="utf-8")
    return task_dir


def _write_plan(repo: Path, text: str) -> Path:
    plan_file = repo / ".cstl" / "pool" / "plan.md"
    plan_file.write_text(text, encoding="utf-8")
    return plan_file


# =============================================================================
# Load / parse
# =============================================================================

def test_parse_item_file_loads_fields(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    path = _write_item(repo, "P01", title="审核池状态机")
    item = parse_item_file(path)
    assert item.id == "P01"
    assert item.title == "审核池状态机"
    assert item.status == "accepted"
    assert item.type == "mechanism"
    assert item.linked_tasks == []
    assert "## 动机" in item.body


def test_list_items_and_load_item(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    _write_item(repo, "P02")
    _write_item(repo, "P01")
    items = list_items(repo)
    assert [item.id for item in items] == ["P01", "P02"]

    loaded = load_item(repo, "P02")
    assert loaded is not None and loaded.id == "P02"
    assert load_item(repo, "P99") is None
    assert find_item_path(repo, "P01") == repo / ".cstl" / "pool" / "items" / "P01.md"
    assert find_item_path(repo, "P99") is None
    assert list_items(tmp_path / "empty") == []  # no pool dir -> empty


def test_normalize_id_list_dedupes_preserves_order() -> None:
    assert normalize_id_list(["b", " a ", "b", "", "c", 5]) == ["b", "a", "c"]
    assert normalize_id_list(None) == []
    assert normalize_id_list("single") == ["single"]
    assert normalize_id_list("  ") == []


# =============================================================================
# Frontmatter write
# =============================================================================

def test_write_frontmatter_preserves_body_and_key_order(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    path = _write_item(repo, "P01")
    original = path.read_text(encoding="utf-8")
    original_body = original[original.index("---\n", 4) + 5 :]

    write_item_frontmatter(path, {"status": "review", "linked_tasks": ["task-x"]})

    rewritten = path.read_text(encoding="utf-8")
    assert rewritten[rewritten.index("---\n", 4) + 5 :] == original_body  # body byte-identical
    item = parse_item_file(path)
    assert item.status == "review"
    assert item.linked_tasks == ["task-x"]

    fm_lines = [line for line in rewritten.splitlines() if ":" in line and not line.startswith("-")]
    keys = [line.split(":", 1)[0] for line in fm_lines]
    assert keys == ["id", "title", "status", "type", "locale", "created", "approved", "delivery", "linked_tasks"]
    assert keys == list(item.frontmatter.keys())


def test_write_frontmatter_keeps_unknown_key_relative_order(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    path = repo / ".cstl" / "pool" / "items" / "P05.md"
    path.write_text(
        "---\n"
        "id: P05\n"
        "title: t\n"
        "status: inbox\n"
        "type: task\n"
        "decision_note: keep-me\n"
        "created: 2026-08-08\n"
        "---\n\n## 意图\nx\n",
        encoding="utf-8",
    )
    write_item_frontmatter(path, {"status": "review"})
    item = parse_item_file(path)
    assert item.frontmatter["decision_note"] == "keep-me"
    # known keys first, then the unknown key keeps its original position
    assert list(item.frontmatter.keys()) == [
        "id", "title", "status", "type", "created", "decision_note",
    ]


def test_write_frontmatter_empty_list_round_trips(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    path = _write_item(repo, "P01")
    write_item_frontmatter(path, {"linked_tasks": []})
    assert parse_item_file(path).linked_tasks == []
    assert "linked_tasks:" in path.read_text(encoding="utf-8")


# =============================================================================
# Bidirectional link / unlink
# =============================================================================

def test_link_item_task_writes_both_sides_idempotent(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    _write_item(repo, "P01")
    task_dir = _write_task(repo, "08-09-some-task", status="in_progress")

    first = link_item_task(repo, "P01", "some-task")  # suffix ref -> canonical dir name
    assert first.ok
    assert first.task_ref == "08-09-some-task"

    item = load_item(repo, "P01")
    assert item is not None
    assert get_linked_tasks(item) == ["08-09-some-task"]
    data = json.loads((task_dir / "task.json").read_text(encoding="utf-8"))
    assert get_pool_items(data) == ["P01"]

    second = link_item_task(repo, "P01", "08-09-some-task")
    assert second.ok
    item = load_item(repo, "P01")
    assert item is not None
    assert get_linked_tasks(item) == ["08-09-some-task"]  # no duplicate
    assert get_pool_items(json.loads((task_dir / "task.json").read_text(encoding="utf-8"))) == ["P01"]


def test_link_multiple_tasks_and_items(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    _write_item(repo, "P01")
    _write_item(repo, "P02")
    task_a = _write_task(repo, "task-a")
    task_b = _write_task(repo, "task-b")

    link_item_task(repo, "P01", "task-a")
    link_item_task(repo, "P01", "task-b")
    link_item_task(repo, "P02", "task-a")

    item_p01 = load_item(repo, "P01")
    assert item_p01 is not None
    assert item_p01.linked_tasks == ["task-a", "task-b"]
    data_a = json.loads((task_a / "task.json").read_text(encoding="utf-8"))
    assert get_pool_items(data_a) == ["P01", "P02"]


def test_link_missing_item_or_task_is_error(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    _write_item(repo, "P01")
    result = link_item_task(repo, "P99", "task-a")
    assert not result.ok
    assert result.errors[0].code == "item-not-found"

    result = link_item_task(repo, "P01", "ghost-task")
    assert not result.ok
    assert result.errors[0].code == "task-not-found"


def test_unlink_removes_both_sides_and_warns_on_missing_side(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    _write_item(repo, "P01")
    task_dir = _write_task(repo, "task-a")
    link_item_task(repo, "P01", "task-a")

    result = unlink_item_task(repo, "P01", "task-a")
    assert result.ok
    assert result.warnings == []
    item = load_item(repo, "P01")
    assert item is not None
    assert item.linked_tasks == []
    data = json.loads((task_dir / "task.json").read_text(encoding="utf-8"))
    assert get_pool_items(data) == []

    # task side already clean -> warning, still ok
    result = unlink_item_task(repo, "P01", "task-a")
    assert result.ok
    assert any(w.code == "no-task-side-link" for w in result.warnings)


def test_unlink_missing_task_still_cleans_item_side(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    _write_item(repo, "P01")
    task_dir = _write_task(repo, "task-a")
    link_item_task(repo, "P01", "task-a")
    # task dir disappears (simulates dangling state)
    (task_dir / "task.json").unlink()

    result = unlink_item_task(repo, "P01", "task-a")
    assert result.ok
    assert any(w.code == "task-not-found" for w in result.warnings)
    item = load_item(repo, "P01")
    assert item is not None
    assert item.linked_tasks == []


def test_unlink_missing_item_is_error(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    result = unlink_item_task(repo, "P99", "task-a")
    assert not result.ok
    assert result.errors[0].code == "item-not-found"


# =============================================================================
# validate_pool
# =============================================================================

def test_validate_pool_missing_sections_and_keys(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    path = repo / ".cstl" / "pool" / "items" / "P03.md"
    path.write_text(
        "---\nid: P03\nstatus: accepted\n---\n\n## 意图\nx\n\n## 动机\nx\n",
        encoding="utf-8",
    )
    issues = validate_pool(repo)
    codes = [issue.code for issue in issues]
    assert "missing-section" in codes  # 粗验收 / 非目标 missing
    assert "missing-frontmatter-key" in codes  # type missing


def test_validate_pool_accepted_requires_delivery(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    path = repo / ".cstl" / "pool" / "items" / "P20.md"
    path.write_text(
        "---\nid: P20\nstatus: accepted\ntype: mechanism\n---\n\n"
        "## 意图\nx\n\n## 动机\nx\n\n## 粗验收\nx\n\n## 非目标\nx\n",
        encoding="utf-8",
    )
    issues = validate_pool(repo)
    missing = [issue for issue in issues if issue.code == "missing-delivery"]
    assert len(missing) == 1
    assert missing[0].is_error


def test_validate_pool_inbox_missing_section_is_warning(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    path = repo / ".cstl" / "pool" / "items" / "P11.md"
    path.write_text(
        "---\nid: P11\nstatus: inbox\ntype: mechanism\n---\n\n## 意图\nx\n\n## 动机\nx\n",
        encoding="utf-8",
    )
    issues = validate_pool(repo)
    missing = [issue for issue in issues if issue.code == "missing-section"]
    assert len(missing) == 2  # 粗验收 / 非目标 missing
    assert all(not issue.is_error for issue in missing)
    assert not any(issue.is_error for issue in issues)  # 纯 WARN → CLI exit 0


def test_validate_pool_accepted_missing_section_is_error(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    path = repo / ".cstl" / "pool" / "items" / "P12.md"
    path.write_text(
        "---\nid: P12\nstatus: accepted\ntype: mechanism\n---\n\n## 意图\nx\n\n## 动机\nx\n",
        encoding="utf-8",
    )
    issues = validate_pool(repo)
    missing = [issue for issue in issues if issue.code == "missing-section"]
    assert len(missing) == 2
    assert all(issue.is_error for issue in missing)


def test_validate_pool_invalid_status_and_duplicate_id(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    _write_item(repo, "P01", status="accepted")
    dup = repo / ".cstl" / "pool" / "items" / "P01-dup.md"
    dup.write_text(
        ITEM_TEMPLATE.format(item_id="P01", title="dup", status="weird"),
        encoding="utf-8",
    )

    issues = validate_pool(repo)
    codes = [issue.code for issue in issues]
    assert "duplicate-id" in codes
    assert "invalid-status" in codes


def test_validate_pool_dangling_link_is_error(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    path = _write_item(repo, "P01")
    write_item_frontmatter(path, {"linked_tasks": ["ghost-task"]})

    issues = validate_pool(repo)
    assert any(issue.code == "dangling-link" for issue in issues)
    assert all(issue.is_error for issue in issues if issue.code == "dangling-link")


def test_validate_pool_one_sided_link_is_error(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    path = _write_item(repo, "P01")
    _write_task(repo, "task-a")
    write_item_frontmatter(path, {"linked_tasks": ["task-a"]})  # item side only

    issues = validate_pool(repo)
    assert any(issue.code == "link-missing-task-side" for issue in issues)

    # task side only, item side missing
    write_item_frontmatter(path, {"linked_tasks": []})
    _write_task(repo, "task-b", meta={"pool_items": ["P01"]})
    issues = validate_pool(repo)
    assert any(issue.code == "link-missing-item-side" for issue in issues)

    # task side references an unknown item
    _write_task(repo, "task-c", meta={"pool_items": ["P99"]})
    issues = validate_pool(repo)
    assert any(issue.code == "link-item-missing" for issue in issues)


def test_validate_pool_clean_pool_has_no_issues(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    _write_item(repo, "P01")
    task_dir = _write_task(repo, "task-a")
    link_item_task(repo, "P01", "task-a")
    assert validate_pool(repo) == []


# =============================================================================
# check_plan
# =============================================================================

def test_check_plan_ghost_id_is_error(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    _write_item(repo, "P01")
    _write_plan(repo, "# 计划\n\n- P01 已落地\n- P99 幽灵引用\n")
    issues = check_plan(repo)
    assert any(issue.code == "plan-ghost-id" for issue in issues)
    ghost = next(issue for issue in issues if issue.code == "plan-ghost-id")
    assert "P99" in ghost.message
    assert ghost.is_error


def test_check_plan_ignores_code_blocks(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    _write_item(repo, "P01")
    _write_plan(
        repo,
        "# 计划\n\n```\nP99 inside code block\n```\n\nP01 outside\n",
    )
    issues = check_plan(repo)
    assert not any(issue.code == "plan-ghost-id" for issue in issues)


def test_plan_referenced_ids_intersects_known() -> None:
    text = "P01 done, P02 later, P99 unknown"
    assert plan_referenced_ids(text, {"P01", "P02"}) == {"P01", "P02"}
    assert plan_referenced_ids(text, {"P01"}) == {"P01"}


def test_check_plan_accepted_item_not_in_plan_warns(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    _write_item(repo, "P01")
    _write_item(repo, "P07")
    _write_plan(repo, "# 计划\n\nP01 落地\n")
    issues = check_plan(repo)
    assert any(issue.code == "accepted-not-in-plan" for issue in issues)
    assert not any(issue.code == "plan-ghost-id" for issue in issues)
