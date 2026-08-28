#!/usr/bin/env python3
"""Personal Lite context pack (P29 context-progressive / P30 Stage 3).

Phase-assembled Definition / Evidence pack with a hard budget. Unactivated
On-demand modules (Parent / VCS / retrieval-extended) and a full workflow.md
dump are rejected instead of silently stuffed into the pack.
"""

from __future__ import annotations

from typing import Any

LITE_PACK_VERSION = 1
LITE_PACK_SOURCE = "personal-lite-context-pack"

LITE_BASELINE_MODULES = (
    "intake-basic",
    "define-basic",
    "approval-personal",
    "execute-agent",
    "verify-basic",
    "close-basic",
    "context-progressive",
    "observability-local",
)

LITE_BLOCKED_ON_DEMAND_MODULES = (
    "parent-child",
    "vcs-integration",
    "retrieval-extended",
)

LITE_RETRIEVAL_INTENTS = ("exact", "semantic", "structural", "external")

LITE_DEFAULT_MAX_ITEMS = 8
LITE_DEFAULT_MAX_ESTIMATED_TOKENS = 4000
LITE_CHARS_PER_TOKEN = 4
LITE_MIN_ITEM_TOKENS = 40

PHASE_ROLES: dict[str, tuple[str, ...]] = {
    "open": ("triage", "retrieval-router"),
    "define": ("triage", "definition", "retrieval-router"),
    "approve": ("triage", "definition", "approval", "retrieval-router"),
    "execute": ("definition", "approval", "retrieval-router"),
    "verify": ("definition", "evidence", "retrieval-router"),
    "integrate": ("definition", "evidence", "retrieval-router"),
    "close": ("definition", "evidence", "outcome", "retrieval-router"),
}

ROLE_MODULE = {
    "triage": "intake-basic",
    "definition": "define-basic",
    "approval": "approval-personal",
    "evidence": "verify-basic",
    "outcome": "close-basic",
    "retrieval-router": "context-progressive",
}

STATUS_TO_PHASE = {
    "planning": "define",
    "in_progress": "execute",
    "review": "verify",
    "completed": "close",
    "done": "close",
}


class LiteContextPackError(RuntimeError):
    """Lite pack refused to assemble (budget, On-demand, or workflow dump)."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def kernel_phase_from_legacy_status(status: str | None) -> str:
    """Project user-visible task.json.status onto a Kernel phase name."""
    if not status:
        return "open"
    return STATUS_TO_PHASE.get(status, "open")


def estimate_lite_tokens(text: str) -> int:
    if not text:
        return LITE_MIN_ITEM_TOKENS
    return max(LITE_MIN_ITEM_TOKENS, len(text) // LITE_CHARS_PER_TOKEN + 20)


def _normalize_path(value: object) -> str:
    if not isinstance(value, str) or not value.strip():
        return ""
    return value.replace("\\", "/")


def _is_workflow_dump(role: str, path: str) -> bool:
    if role == "workflow-full":
        return True
    base = path.rsplit("/", 1)[-1]
    return base == "workflow.md"


def _is_blocked(name: str) -> bool:
    return name in LITE_BLOCKED_ON_DEMAND_MODULES


def build_lite_context_pack(
    *,
    phase: str,
    artifacts: list[dict[str, Any]] | None = None,
    activated_modules: list[str] | None = None,
    include_full_workflow: bool = False,
    max_items: int | None = None,
    max_estimated_tokens: int | None = None,
) -> dict[str, Any]:
    """Assemble a bounded Lite pack. Raises LiteContextPackError on refuse."""
    if phase not in PHASE_ROLES:
        raise LiteContextPackError("WORKFLOW_DUMP", f"invalid Lite pack phase: {phase}")
    if include_full_workflow:
        raise LiteContextPackError(
            "WORKFLOW_DUMP",
            "Lite context pack refuses a full workflow.md dump",
        )

    activated = [
        name for name in (activated_modules or []) if isinstance(name, str) and name.strip()
    ]
    for name in activated:
        if _is_blocked(name):
            raise LiteContextPackError(
                "ON_DEMAND_INACTIVE",
                f"Lite pack excludes unactivated On-demand module: {name}",
            )

    item_cap = LITE_DEFAULT_MAX_ITEMS if max_items is None else max_items
    token_cap = (
        LITE_DEFAULT_MAX_ESTIMATED_TOKENS
        if max_estimated_tokens is None
        else max_estimated_tokens
    )
    allowed_roles = set(PHASE_ROLES[phase])

    candidates: list[dict[str, Any]] = [
        {
            "role": "retrieval-router",
            "module": "context-progressive",
            "path": "capability://retrieval-router",
            "estimatedTokens": LITE_MIN_ITEM_TOKENS,
        }
    ]

    for artifact in artifacts or []:
        if not isinstance(artifact, dict):
            continue
        role = str(artifact.get("role") or "")
        path = _normalize_path(artifact.get("path"))
        if _is_workflow_dump(role, path):
            raise LiteContextPackError(
                "WORKFLOW_DUMP",
                "Lite context pack refuses a full workflow.md dump",
            )
        module_name = str(artifact.get("module") or ROLE_MODULE.get(role) or "")
        if _is_blocked(module_name) or _is_blocked(role):
            raise LiteContextPackError(
                "ON_DEMAND_INACTIVE",
                f"Lite pack excludes unactivated On-demand module: {module_name or role}",
            )
        if role not in allowed_roles:
            continue
        candidates.append(
            {
                "role": role,
                "module": module_name or "define-basic",
                "path": path,
                "estimatedTokens": estimate_lite_tokens(str(artifact.get("content") or "")),
            }
        )

    selected: list[dict[str, Any]] = []
    omitted: list[dict[str, str]] = []
    warnings: list[str] = []
    estimated_tokens = 0
    budget_exceeded = False

    for item in candidates:
        would_exceed_items = len(selected) >= item_cap
        next_tokens = int(item["estimatedTokens"])
        would_exceed_tokens = estimated_tokens + next_tokens > token_cap
        if would_exceed_items or would_exceed_tokens:
            budget_exceeded = True
            reason = (
                "outside token budget after higher-ranked Lite surfaces"
                if would_exceed_tokens
                else "outside item budget after higher-ranked Lite surfaces"
            )
            omitted.append({"role": item["role"], "path": item["path"], "reason": reason})
            continue
        selected.append(item)
        estimated_tokens += next_tokens

    if budget_exceeded:
        if any(
            row["path"].endswith("workflow.md") or row["role"] == "workflow-full"
            for row in omitted
        ):
            raise LiteContextPackError(
                "BUDGET_EXCEEDED",
                "Lite context pack over budget; refusing silent full workflow dump",
            )
        warnings.append("budget limits caused Lite pack omission")

    return {
        "version": LITE_PACK_VERSION,
        "source": LITE_PACK_SOURCE,
        "phase": phase,
        "budget": {
            "maxItems": item_cap,
            "maxEstimatedTokens": token_cap,
            "estimatedTokens": estimated_tokens,
            "itemsUsed": len(selected),
        },
        "selected": selected,
        "omitted": omitted,
        "modules": {
            "baseline": list(LITE_BASELINE_MODULES),
            "activatedOnDemand": activated,
        },
        "retrievalIntents": list(LITE_RETRIEVAL_INTENTS),
        "warnings": warnings,
    }


def collect_lite_artifacts(task_dir) -> list[dict[str, Any]]:
    """Read Definition / Evidence surfaces when present (capped per file)."""
    from pathlib import Path

    root = Path(task_dir)
    artifacts: list[dict[str, Any]] = []
    for role, name in (("definition", "prd.md"), ("evidence", "verify.md")):
        path = root / name
        if not path.is_file():
            continue
        try:
            content = path.read_text(encoding="utf-8")
        except OSError:
            continue
        artifacts.append(
            {
                "role": role,
                "path": name,
                "content": content[:12_000],
            }
        )
    return artifacts


def get_lite_context_json(repo_root=None) -> dict[str, Any]:
    """Build a Lite pack for the selected task, or an Open-phase empty pack."""
    from .paths import get_repo_root, get_selected_task
    from .tasks import load_task
    from .task_utils import resolve_task_dir

    root = repo_root or get_repo_root()
    selected = get_selected_task(root)
    phase = "open"
    artifacts: list[dict[str, Any]] = []
    if selected:
        task_dir = resolve_task_dir(selected, root)
        info = load_task(task_dir) if task_dir.is_dir() else None
        status = getattr(info, "status", None) if info is not None else None
        if status is None and task_dir.is_dir():
            from .io import read_json
            from .paths import FILE_TASK_JSON

            data = read_json(task_dir / FILE_TASK_JSON) or {}
            status = data.get("status") if isinstance(data, dict) else None
        phase = kernel_phase_from_legacy_status(status if isinstance(status, str) else None)
        artifacts = collect_lite_artifacts(task_dir)
    return build_lite_context_pack(phase=phase, artifacts=artifacts)
