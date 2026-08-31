#!/usr/bin/env python3
"""Narrow pool dependency contract.

``task_dependencies`` imports this module only — not ``pool_store``.
Satisfaction is the item's ``delivery`` field, not linked-task Close.

Missing ``.cstl/pool/`` (candidate-pool not captured) is ignored
(``missing_module`` → SATISFIED for gating) so Close is not blocked.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from .artifact_search import split_frontmatter
from .paths import get_repo_root

POOL_PREFIX = "pool:"

DELIVERY_SATISFIED = frozenset({"standing", "landed", "deferred"})
DELIVERY_OPEN = frozenset({"open", "in-slice"})
DELIVERIES = DELIVERY_SATISFIED | DELIVERY_OPEN

# Resolution codes stored on ResolvedDep.status
MISSING_MODULE = "missing_module"
MISSING_ITEM = "missing_item"
NOT_READY = "not_ready"
SATISFIED = "satisfied"
NOT_SATISFIED = "not_satisfied"


@dataclass(frozen=True)
class PoolRefResolution:
    """One ``pool:Pxx`` lookup. ``code`` is the ResolvedDep.status value."""

    code: str
    note: str


def pool_root(repo_root: Path | None = None) -> Path:
    if repo_root is None:
        repo_root = get_repo_root()
    return repo_root / ".cstl" / "pool"


def resolve_pool_ref(
    ref: str,
    *,
    repo_root: Path | None = None,
) -> PoolRefResolution:
    """Resolve ``pool:Pxx`` (or a bare item id) against item frontmatter."""
    raw = ref.strip()
    item_id = (
        raw[len(POOL_PREFIX) :].strip()
        if raw.startswith(POOL_PREFIX)
        else raw
    )
    if not item_id:
        return PoolRefResolution(MISSING_ITEM, "empty pool ref")

    if repo_root is None:
        repo_root = get_repo_root()
    root = pool_root(repo_root)
    items_dir = root / "items"
    if not items_dir.is_dir():
        return PoolRefResolution(
            MISSING_MODULE,
            "candidate-pool not materialized; pool: ignored",
        )

    item = _load_item_delivery(items_dir, item_id)
    if item is None:
        return PoolRefResolution(MISSING_ITEM, "pool item not found")

    status, delivery = item
    if status in {"inbox", "review", "rework"}:
        return PoolRefResolution(
            NOT_READY,
            f"pool item status={status!r}, not accepted",
        )
    if status == "rejected":
        return PoolRefResolution(SATISFIED, "rejected pool item")

    if delivery in DELIVERY_SATISFIED:
        return PoolRefResolution(SATISFIED, f"delivery={delivery}")
    if delivery in DELIVERY_OPEN:
        return PoolRefResolution(
            NOT_SATISFIED,
            f"delivery={delivery}, remaining obligation",
        )
    if status == "accepted":
        return PoolRefResolution(
            NOT_SATISFIED,
            "accepted item missing delivery; treat as open",
        )
    return PoolRefResolution(
        NOT_READY,
        f"pool item status={status!r}",
    )


def _load_item_delivery(items_dir: Path, item_id: str) -> tuple[str, str] | None:
    """Return (status, delivery) for the item id, else None."""
    for path in sorted(items_dir.glob("*.md")):
        frontmatter, _body, _ = split_frontmatter(path.read_text(encoding="utf-8"))
        found_id = _scalar(frontmatter.get("id"))
        if found_id != item_id:
            continue
        status = _scalar(frontmatter.get("status")) or ""
        delivery = _scalar(frontmatter.get("delivery")) or ""
        return status, delivery
    return None


def _scalar(value: object) -> str:
    if isinstance(value, str):
        return value.strip()
    return ""
