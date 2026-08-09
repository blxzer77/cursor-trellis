#!/usr/bin/env python3
"""
Review-pool data access layer (`.cstl/pool/`).

Pure read helpers plus the authoritative write path for item <-> task
bidirectional links. Consumers: scripts/pool.py (CLI) and
common/task_dependencies.py (pool: dependency resolution).

Frontmatter reading reuses artifact_search.split_frontmatter /
parse_frontmatter (the single simple-frontmatter parser; no PyYAML).
Frontmatter writes splice a re-serialized header between the raw `---`
fences so the body is preserved byte-for-byte (including the blank line
after the closing fence and the final newline), and key order stays stable:
known keys first (id, title, status, type, locale, created, approved,
linked_tasks), unknown keys keep their original relative order.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

from .artifact_search import parse_frontmatter, split_frontmatter
from .io import read_json, write_json
from .paths import get_repo_root, get_tasks_dir

POOL_STATUSES = frozenset({"inbox", "review", "accepted", "rejected", "rework"})

LINKED_TASKS_KEY = "linked_tasks"
POOL_ITEMS_KEY = "pool_items"
META_KEY = "meta"

KNOWN_FRONTMATTER_KEY_ORDER = (
    "id",
    "title",
    "status",
    "type",
    "locale",
    "created",
    "approved",
    LINKED_TASKS_KEY,
)

PLAN_TOKEN_RE = re.compile(r"\bP\d+\b")


@dataclass
class PoolItem:
    """One parsed pool entry from `.cstl/pool/items/`."""

    id: str
    path: Path
    status: str
    type: str
    title: str | None
    linked_tasks: list[str]
    frontmatter: dict[str, object]
    body: str


@dataclass
class Issue:
    """One validation finding. severity is "error" or "warning"."""

    severity: str
    code: str
    message: str
    path: Path | None = None

    @property
    def is_error(self) -> bool:
        return self.severity == "error"


@dataclass
class LinkResult:
    """Outcome of link_item_task / unlink_item_task."""

    ok: bool
    item_id: str
    task_ref: str
    item_path: Path | None = None
    task_path: Path | None = None
    errors: list[Issue] = field(default_factory=list)
    warnings: list[Issue] = field(default_factory=list)


# =============================================================================
# Paths and listing
# =============================================================================

def get_pool_root(repo_root: Path | None = None) -> Path:
    """Return the `.cstl/pool/` directory for the repository."""
    if repo_root is None:
        repo_root = get_repo_root()
    return repo_root / ".cstl" / "pool"


def list_items(repo_root: Path | None = None) -> list[PoolItem]:
    """Parse every entry in `.cstl/pool/items/`, sorted by id."""
    if repo_root is None:
        repo_root = get_repo_root()
    items_dir = get_pool_root(repo_root) / "items"
    if not items_dir.is_dir():
        return []
    items = [parse_item_file(path) for path in sorted(items_dir.glob("*.md"))]
    return sorted(items, key=lambda item: item.id)


def find_item_path(repo_root: Path | None, item_id: str) -> Path | None:
    """Locate the item file whose frontmatter id equals item_id, else None."""
    for item in list_items(repo_root):
        if item.id == item_id:
            return item.path
    return None


def load_item(repo_root: Path | None, item_id: str) -> PoolItem | None:
    """Load one pool entry by exact frontmatter id, else None."""
    for item in list_items(repo_root):
        if item.id == item_id:
            return item
    return None


def parse_item_file(path: Path) -> PoolItem:
    """Parse one pool entry file into a PoolItem (read-only)."""
    content = path.read_text(encoding="utf-8")
    frontmatter, body, _ = split_frontmatter(content)
    return PoolItem(
        id=_scalar_str(frontmatter.get("id"), ""),
        path=path,
        status=_scalar_str(frontmatter.get("status"), ""),
        type=_scalar_str(frontmatter.get("type"), ""),
        title=_scalar_str(frontmatter.get("title"), None),
        linked_tasks=normalize_id_list(frontmatter.get(LINKED_TASKS_KEY)),
        frontmatter=frontmatter,
        body=body,
    )


def _scalar_str(value: object, default: str | None) -> str | None:
    if isinstance(value, str):
        return value
    return default


# =============================================================================
# Link field helpers
# =============================================================================

def normalize_id_list(raw: object) -> list[str]:
    """Normalize a list field: strip, drop empties/non-strings, dedupe in order."""
    if isinstance(raw, str):
        raw = [raw]
    if not isinstance(raw, list):
        return []
    normalized: list[str] = []
    seen: set[str] = set()
    for item in raw:
        if not isinstance(item, str):
            continue
        value = item.strip()
        if not value or value in seen:
            continue
        seen.add(value)
        normalized.append(value)
    return normalized


def get_linked_tasks(item: PoolItem) -> list[str]:
    """Linked task dir names of one pool item (normalized)."""
    return normalize_id_list(item.frontmatter.get(LINKED_TASKS_KEY))


def get_pool_items(task_data: dict | None) -> list[str]:
    """meta.pool_items of one task.json dict (normalized)."""
    if not isinstance(task_data, dict):
        return []
    meta = task_data.get(META_KEY)
    if not isinstance(meta, dict):
        return []
    return normalize_id_list(meta.get(POOL_ITEMS_KEY))


# =============================================================================
# Frontmatter write (body-preserving)
# =============================================================================

def write_item_frontmatter(path: Path, updates: dict[str, object]) -> None:
    """Merge `updates` into the item's frontmatter and write the file back.

    Only the frontmatter block changes; the body is preserved byte-for-byte.
    List values are whole-key replaced with a normalized list.
    """
    content = path.read_text(encoding="utf-8")
    span = _frontmatter_span(content)
    if span is None:
        raise ValueError(f"no frontmatter block in {path}")
    start, end = span  # line indices between the two `---` fences
    lines = content.splitlines(keepends=True)
    raw_fm_lines = lines[start:end]
    eol = "\r\n" if raw_fm_lines and "\r\n" in raw_fm_lines[0] else "\n"

    frontmatter = parse_frontmatter([line.rstrip("\r\n") for line in raw_fm_lines])
    merged = dict(frontmatter)
    for key, value in updates.items():
        merged[key] = normalize_id_list(value) if isinstance(value, list) else value
    header = _serialize_frontmatter(merged, original_keys=list(frontmatter.keys()))

    body = "".join(lines[end + 1 :])
    new_content = "---" + eol + header.replace("\n", eol) + eol + "---" + eol + body
    if new_content != content:
        path.write_text(new_content, encoding="utf-8")


def update_item_frontmatter(path: Path, mutator) -> None:
    """Mutator-style frontmatter write: call mutator(current_fm) -> updates."""
    content = path.read_text(encoding="utf-8")
    span = _frontmatter_span(content)
    if span is None:
        raise ValueError(f"no frontmatter block in {path}")
    lines = content.splitlines(keepends=True)
    frontmatter = parse_frontmatter(
        [line.rstrip("\r\n") for line in lines[span[0] : span[1]]]
    )
    updates = mutator(frontmatter)
    if not isinstance(updates, dict):
        raise TypeError("frontmatter mutator must return a dict of updates")
    write_item_frontmatter(path, updates)


def _frontmatter_span(content: str) -> tuple[int, int] | None:
    """Line indices of the frontmatter content between the two fences."""
    lines = content.splitlines(keepends=True)
    if not lines or lines[0].strip() != "---":
        return None
    for idx in range(1, len(lines)):
        if lines[idx].strip() == "---":
            return 1, idx
    return None


def _serialize_frontmatter(data: dict[str, object], original_keys: list[str]) -> str:
    known = [key for key in KNOWN_FRONTMATTER_KEY_ORDER if key in data]
    rest = [
        key
        for key in original_keys
        if key not in KNOWN_FRONTMATTER_KEY_ORDER and key in data
    ]
    added = [
        key
        for key in data
        if key not in KNOWN_FRONTMATTER_KEY_ORDER and key not in original_keys
    ]
    lines: list[str] = []
    for key in known + rest + added:
        value = data[key]
        if isinstance(value, list):
            lines.append(f"{key}:")
            for item in value:
                lines.append(f"  - {_format_scalar(item)}")
        else:
            lines.append(f"{key}: {_format_scalar(value)}")
    return "\n".join(lines)


def _format_scalar(value: object) -> str:
    text = "" if value is None else str(value)
    if text == "":
        return '""'
    if (
        text != text.strip()
        or ":" in text
        or "#" in text
        or text in ("null", "true", "false")
    ):
        return f'"{text}"'
    return text


# =============================================================================
# Bidirectional link write path (authoritative: both sides in one call)
# =============================================================================

def find_task_dir(task_ref: str, tasks_dir: Path) -> Path | None:
    """Resolve a task ref to a task directory with task.json.

    Order: exact `tasks/<ref>` -> suffix match -> archive/<month>/<ref> ->
    archive suffix match. Mirrors task_dependencies._find_task_dir semantics.
    """
    candidates = [tasks_dir / task_ref]
    if tasks_dir.is_dir():
        for d in sorted(tasks_dir.iterdir()):
            if d.is_dir() and d.name != "archive" and d.name.endswith(f"-{task_ref}"):
                candidates.append(d)
    archive_root = tasks_dir / "archive"
    if archive_root.is_dir():
        for month_dir in sorted(archive_root.iterdir()):
            if not month_dir.is_dir():
                continue
            candidates.append(month_dir / task_ref)
            for d in sorted(month_dir.iterdir()):
                if d.is_dir() and d.name.endswith(f"-{task_ref}"):
                    candidates.append(d)
    for candidate in candidates:
        if candidate.is_dir() and (candidate / "task.json").is_file():
            return candidate
    return None


def _iter_task_dirs(tasks_dir: Path):
    """Yield task dirs with task.json: active tasks, then archive tasks."""
    if not tasks_dir.is_dir():
        return
    for d in sorted(tasks_dir.iterdir()):
        if d.is_dir() and d.name != "archive" and (d / "task.json").is_file():
            yield d
    archive_root = tasks_dir / "archive"
    if archive_root.is_dir():
        for month_dir in sorted(archive_root.iterdir()):
            if not month_dir.is_dir():
                continue
            for d in sorted(month_dir.iterdir()):
                if d.is_dir() and (d / "task.json").is_file():
                    yield d


def _task_meta_with_pool_items(task_dir: Path, item_id: str, *, remove: bool) -> bool:
    """Add/remove item_id in task.json meta.pool_items. True if file changed."""
    data = read_json(task_dir / "task.json")
    if not isinstance(data, dict):
        return False
    meta = data.get(META_KEY)
    if not isinstance(meta, dict):
        meta = {}
    pool_items = normalize_id_list(meta.get(POOL_ITEMS_KEY))
    if remove:
        if item_id not in pool_items:
            return False
        pool_items = [value for value in pool_items if value != item_id]
    else:
        if item_id in pool_items:
            return False
        pool_items.append(item_id)
    meta[POOL_ITEMS_KEY] = pool_items
    data[META_KEY] = meta
    return bool(write_json(task_dir / "task.json", data))


def link_item_task(
    repo_root: Path | None,
    item_id: str,
    task_ref: str,
) -> LinkResult:
    """Link one pool item to one task on both sides (idempotent).

    Item side stores the resolved task directory name in linked_tasks; task
    side stores the item id in meta.pool_items. Missing item or task -> error.
    """
    if repo_root is None:
        repo_root = get_repo_root()
    tasks_dir = get_tasks_dir(repo_root)

    item = load_item(repo_root, item_id)
    if item is None:
        return LinkResult(
            ok=False,
            item_id=item_id,
            task_ref=task_ref,
            errors=[
                Issue(
                    "error",
                    "item-not-found",
                    f"pool item {item_id!r} not found under {get_pool_root(repo_root) / 'items'}",
                )
            ],
        )

    task_dir = find_task_dir(task_ref, tasks_dir)
    if task_dir is None:
        return LinkResult(
            ok=False,
            item_id=item_id,
            task_ref=task_ref,
            item_path=item.path,
            errors=[
                Issue(
                    "error",
                    "task-not-found",
                    f"task {task_ref!r} not found under {tasks_dir} or archive",
                )
            ],
        )

    canonical_ref = task_dir.name
    linked = get_linked_tasks(item)
    if canonical_ref not in linked:
        linked.append(canonical_ref)
        write_item_frontmatter(item.path, {LINKED_TASKS_KEY: linked})
    _task_meta_with_pool_items(task_dir, item_id, remove=False)

    return LinkResult(
        ok=True,
        item_id=item_id,
        task_ref=canonical_ref,
        item_path=item.path,
        task_path=task_dir,
    )


def unlink_item_task(
    repo_root: Path | None,
    item_id: str,
    task_ref: str,
) -> LinkResult:
    """Remove the item<->task link on both sides, best-effort.

    Missing item -> error. When the task side is absent (unresolvable ref or
    no link recorded), the item side is still cleaned and a warning is issued;
    exit semantics are left to the CLI (warnings -> exit 0).
    """
    if repo_root is None:
        repo_root = get_repo_root()
    tasks_dir = get_tasks_dir(repo_root)

    item = load_item(repo_root, item_id)
    if item is None:
        return LinkResult(
            ok=False,
            item_id=item_id,
            task_ref=task_ref,
            errors=[
                Issue(
                    "error",
                    "item-not-found",
                    f"pool item {item_id!r} not found under {get_pool_root(repo_root) / 'items'}",
                )
            ],
        )

    warnings: list[Issue] = []
    task_dir = find_task_dir(task_ref, tasks_dir)
    canonical_ref = task_dir.name if task_dir is not None else task_ref.strip()

    linked = get_linked_tasks(item)
    removed_item_side = any(value in linked for value in (canonical_ref, task_ref.strip()))
    if removed_item_side:
        linked = [value for value in linked if value not in (canonical_ref, task_ref.strip())]
        write_item_frontmatter(item.path, {LINKED_TASKS_KEY: linked})

    removed_task_side = False
    if task_dir is not None:
        removed_task_side = _task_meta_with_pool_items(task_dir, item_id, remove=True)

    if task_dir is None:
        warnings.append(
            Issue(
                "warning",
                "task-not-found",
                f"task {task_ref!r} not found; could not clean task side (item side cleaned)",
                item.path,
            )
        )
    elif not removed_task_side:
        warnings.append(
            Issue(
                "warning",
                "no-task-side-link",
                f"task {task_dir.name} had no meta.pool_items entry for {item_id!r}",
                task_dir,
            )
        )
    if not removed_item_side and task_dir is not None:
        warnings.append(
            Issue(
                "warning",
                "no-item-side-link",
                f"item {item_id} had no linked_tasks entry for {canonical_ref!r}",
                item.path,
            )
        )

    return LinkResult(
        ok=True,
        item_id=item_id,
        task_ref=canonical_ref,
        item_path=item.path,
        task_path=task_dir,
        warnings=warnings,
    )


# =============================================================================
# Validation
# =============================================================================

REQUIRED_SECTIONS = ("意图", "动机", "粗验收", "非目标")
_SECTION_RE = {
    section: re.compile(rf"(?im)^\s{{0,3}}#{{1,6}}\s*{section}\s*$")
    for section in REQUIRED_SECTIONS
}


def _has_section(body: str, section: str) -> bool:
    return _SECTION_RE[section].search(body) is not None


def validate_pool(repo_root: Path | None = None) -> list[Issue]:
    """Full item validation: required keys, status, sections, id uniqueness,
    dangling links, and bidirectional link consistency."""
    if repo_root is None:
        repo_root = get_repo_root()
    issues: list[Issue] = []
    seen_ids: dict[str, Path] = {}
    tasks_dir = get_tasks_dir(repo_root)

    for item in list_items(repo_root):
        label = item.id or item.path.name
        for key in ("id", "status", "type"):
            if not item.frontmatter.get(key):
                issues.append(
                    Issue(
                        "error",
                        "missing-frontmatter-key",
                        f"item {label}: required frontmatter key {key!r} missing",
                        item.path,
                    )
                )
        if item.status and item.status not in POOL_STATUSES:
            issues.append(
                Issue(
                    "error",
                    "invalid-status",
                    f"item {label}: status {item.status!r} not in {sorted(POOL_STATUSES)}",
                    item.path,
                )
            )
        for section in REQUIRED_SECTIONS:
            if not _has_section(item.body, section):
                severity = (
                    "warning"
                    if item.status in {"inbox", "review"}
                    else "error"
                )
                issues.append(
                    Issue(
                        severity,
                        "missing-section",
                        f"item {label}: missing required section {section!r}",
                        item.path,
                    )
                )
        for ref in item.linked_tasks:
            if find_task_dir(ref, tasks_dir) is None:
                issues.append(
                    Issue(
                        "error",
                        "dangling-link",
                        f"item {label}: linked_tasks entry {ref!r} does not resolve to a task",
                        item.path,
                    )
                )
        if item.id:
            if item.id in seen_ids:
                issues.append(
                    Issue(
                        "error",
                        "duplicate-id",
                        f"pool item id {item.id!r} duplicated at {seen_ids[item.id]} and {item.path}",
                        item.path,
                    )
                )
            else:
                seen_ids[item.id] = item.path

    issues.extend(check_link_consistency(repo_root))
    return issues


def check_link_consistency(repo_root: Path | None = None) -> list[Issue]:
    """Detect one-sided links: item links a task whose meta.pool_items lacks
    the item, or a task lists a pool item the entry does not link back."""
    if repo_root is None:
        repo_root = get_repo_root()
    issues: list[Issue] = []
    tasks_dir = get_tasks_dir(repo_root)

    for item in list_items(repo_root):
        for ref in item.linked_tasks:
            task_dir = find_task_dir(ref, tasks_dir)
            if task_dir is None:
                continue  # dangling links are flagged by validate_pool
            data = read_json(task_dir / "task.json") or {}
            if item.id and item.id not in get_pool_items(data):
                issues.append(
                    Issue(
                        "error",
                        "link-missing-task-side",
                        f"item {item.id} links task {task_dir.name} but task.json meta.pool_items is missing {item.id!r}",
                        item.path,
                    )
                )

    for task_dir in _iter_task_dirs(tasks_dir):
        data = read_json(task_dir / "task.json") or {}
        for pool_id in get_pool_items(data):
            item = load_item(repo_root, pool_id)
            if item is None:
                issues.append(
                    Issue(
                        "error",
                        "link-item-missing",
                        f"task {task_dir.name} meta.pool_items references unknown pool item {pool_id!r}",
                        task_dir,
                    )
                )
            elif task_dir.name not in item.linked_tasks:
                issues.append(
                    Issue(
                        "error",
                        "link-missing-item-side",
                        f"task {task_dir.name} meta.pool_items lists {pool_id} but item linked_tasks is missing {task_dir.name!r}",
                        item.path,
                    )
                )
    return issues


# =============================================================================
# plan.md reference checking
# =============================================================================

def _strip_code_blocks(text: str) -> str:
    lines: list[str] = []
    in_block = False
    for line in text.splitlines():
        if line.lstrip().startswith("```"):
            in_block = not in_block
            continue
        if not in_block:
            lines.append(line)
    return "\n".join(lines)


def _plan_tokens(plan_text: str) -> set[str]:
    """All `P<digits>` tokens in plan text, outside fenced code blocks."""
    return set(PLAN_TOKEN_RE.findall(_strip_code_blocks(plan_text)))


def plan_referenced_ids(plan_text: str, known_ids: set[str]) -> set[str]:
    """Plan tokens that intersect the known item ids (conservative scan)."""
    return _plan_tokens(plan_text) & known_ids


def _known_item_ids(repo_root: Path) -> set[str]:
    """Item ids from items/ plus any archived entries under pool/archive/."""
    ids = {item.id for item in list_items(repo_root) if item.id}
    archive_dir = get_pool_root(repo_root) / "archive"
    if archive_dir.is_dir():
        for path in sorted(archive_dir.rglob("*.md")):
            item = parse_item_file(path)
            if item.id:
                ids.add(item.id)
    return ids


def check_plan(repo_root: Path | None = None) -> list[Issue]:
    """plan.md checks: ghost references -> error; accepted items not mentioned
    -> warning."""
    if repo_root is None:
        repo_root = get_repo_root()
    plan_file = get_pool_root(repo_root) / "plan.md"
    if not plan_file.is_file():
        return [
            Issue("error", "plan-missing", "plan.md not found", plan_file)
        ]

    known_ids = _known_item_ids(repo_root)
    tokens = _plan_tokens(plan_file.read_text(encoding="utf-8"))
    issues: list[Issue] = []
    for ghost in sorted(tokens - known_ids):
        issues.append(
            Issue(
                "error",
                "plan-ghost-id",
                f"plan.md references unknown pool id {ghost!r}",
                plan_file,
            )
        )
    for item in list_items(repo_root):
        if item.status == "accepted" and item.id and item.id not in tokens:
            issues.append(
                Issue(
                    "warning",
                    "accepted-not-in-plan",
                    f"accepted item {item.id} not referenced in plan.md",
                    item.path,
                )
            )
    return issues
