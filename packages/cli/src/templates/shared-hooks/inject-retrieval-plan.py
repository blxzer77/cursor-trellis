#!/usr/bin/env python3
"""Cursor beforeSubmitPrompt: quality-layer telemetry-only retrieval routing.

Three-layer retrieval ABI (frozen; do not merge back into workflow.md):

| Layer    | Owner                 | This hook                                      |
| -------- | --------------------- | ---------------------------------------------- |
| Intent   | context-progressive   | logs intent ids; does not own the four intents |
| Provider | Middleware            | does not take smart-search as Kernel         |
| Quality  | retrieval-extended    | subscriber: local telemetry only               |

DEGRADED MODE (2026-06-24): beforeSubmitPrompt ``additional_context`` does
not reach the model in current Cursor versions (L1: event often not fired;
L2: additional_context not delivered). This hook is telemetry-only: it logs
routing decisions to ``.cstl/.runtime/retrieval-plan-events.log`` and MUST
NOT inject plan blocks, MUST NOT print ``additional_context`` to stdout, and
MUST NOT claim the plan was delivered into the Prompt.

Silent exit 0 (no stdout) when:
  - TRELLIS_HOOKS=0 / not a Trellis repo
  - prompt is meta-only (continue, slash commands, etc.)
  - gate says retrieval plan is not needed
  - quality layer has nothing to score (still must not fail)
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

if sys.platform.startswith("win"):
    import io as _io

    for _stream_name in ("stdin", "stdout", "stderr"):
        _stream = getattr(sys, _stream_name, None)
        if _stream is None:
            continue
        if hasattr(_stream, "reconfigure"):
            try:
                _stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
            except Exception:
                pass
        elif hasattr(_stream, "detach"):
            try:
                setattr(
                    sys,
                    _stream_name,
                    _io.TextIOWrapper(
                        _stream.detach(), encoding="utf-8", errors="replace"
                    ),
                )
            except Exception:
                pass

DIR_WORKFLOW = ".cstl"
# Markers of the plan block this hook deliberately does NOT emit.
PLAN_MARKER_ZH = "## 代码库检索计划"
PLAN_MARKER_EN = "## Codebase retrieval plan"
TELEMETRY_LOG = ".runtime/retrieval-plan-events.log"

ABI_INTENT_OWNER = "context-progressive"
ABI_PROVIDER_OWNER = "middleware"
ABI_QUALITY_OWNER = "retrieval-extended"
ABI_LAYER = "quality"


def _find_trellis_root(start: Path) -> Path | None:
    current = start.resolve()
    while True:
        if (current / DIR_WORKFLOW / "scripts").is_dir():
            return current
        if current == current.parent:
            return None
        current = current.parent


def _detect_platform(input_data: dict[str, Any]) -> str | None:
    if isinstance(input_data.get("cursor_version"), str):
        return "cursor"
    if os.environ.get("CURSOR_PROJECT_DIR"):
        return "cursor"
    script_parts = set(Path(sys.argv[0]).parts)
    if ".cursor" in script_parts:
        return "cursor"
    return None


def _load_capabilities(root: Path) -> dict[str, object] | None:
    path = root / DIR_WORKFLOW / "capabilities.json"
    if not path.is_file():
        return None
    try:
        with path.open(encoding="utf-8") as handle:
            parsed = json.load(handle)
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        return None


def _retrieval_extended_active(root: Path, input_data: dict[str, Any]) -> bool:
    """Unactivated retrieval-extended → no telemetry and no plan injection."""
    scripts_dir = root / DIR_WORKFLOW / "scripts"
    if str(scripts_dir) not in sys.path:
        sys.path.insert(0, str(scripts_dir))
    try:
        from common.active_task import resolve_selected_task  # type: ignore[import-not-found]
        from common.ondemand_topology import is_ondemand_module_active  # type: ignore[import-not-found]
    except Exception:
        return False
    try:
        selected = resolve_selected_task(
            root,
            input_data,
            platform=_detect_platform(input_data),
        )
        task_path = selected.task_path if selected else None
    except Exception:
        task_path = None
    if not task_path:
        return False
    candidate = Path(task_path)
    task_dir = candidate if candidate.is_absolute() else root / task_path
    return bool(is_ondemand_module_active(task_dir, "retrieval-extended"))


def _write_telemetry_log(
    root: Path,
    query_preview: str,
    cursor_env: str,
    intents: list[str],
) -> None:
    """Write local telemetry / assurance. Never claims model delivery."""
    log_path = root / DIR_WORKFLOW / TELEMETRY_LOG
    log_path.parent.mkdir(parents=True, exist_ok=True)

    event = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "event": "beforeSubmitPrompt",
        "query_preview": query_preview[:120],
        "cursorEnv": cursor_env,
        "intents": intents,
        "action": "telemetry-only",
        "assurance": "local-telemetry-only",
        "promptInjected": False,
        "additionalContextDelivered": False,
        "abiLayer": ABI_LAYER,
        "abiOwner": ABI_QUALITY_OWNER,
        "abiIntentOwner": ABI_INTENT_OWNER,
        "abiProviderOwner": ABI_PROVIDER_OWNER,
        "note": (
            "additional_context channel unreliable; promptInjected=false; "
            "do not treat local telemetry as model delivery"
        ),
    }

    try:
        with log_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(event, ensure_ascii=False) + "\n")
    except Exception:
        pass


def main() -> int:
    if os.environ.get("TRELLIS_HOOKS") == "0" or os.environ.get(
        "TRELLIS_DISABLE_HOOKS"
    ) == "1":
        return 0

    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        data = {}

    if not isinstance(data, dict):
        data = {}

    cwd_str = data.get("cwd") or os.getcwd()
    root = _find_trellis_root(Path(str(cwd_str)))
    if root is None:
        return 0

    scripts_dir = root / DIR_WORKFLOW / "scripts"
    if str(scripts_dir) not in sys.path:
        sys.path.insert(0, str(scripts_dir))

    try:
        if not _retrieval_extended_active(root, data):
            return 0
    except Exception:
        return 0

    try:
        from common.codebase_retrieval_router import (  # type: ignore[import-not-found]
            codebase_retrieval_selected_from_capabilities,
            route_codebase_retrieval,
        )
        from common.project_file_stats import (  # type: ignore[import-not-found]
            resolve_project_file_count_arg,
        )
        from common.retrieval_plan_gate import (  # type: ignore[import-not-found]
            extract_user_prompt,
            should_inject_retrieval_plan,
        )
    except Exception:
        return 0

    query = extract_user_prompt(data)
    if not should_inject_retrieval_plan(query):
        return 0

    try:
        project_file_count = resolve_project_file_count_arg("auto", repo_root=root)
    except ValueError:
        project_file_count = None

    caps = _load_capabilities(root)
    selected = codebase_retrieval_selected_from_capabilities(caps)
    plan = route_codebase_retrieval(
        query,
        codebase_retrieval_selected=selected,
        project_file_count=project_file_count,
    )

    cursor_env = plan.get("cursorEnv", "unknown")
    intent_ids = [i.get("id", "unknown") for i in plan.get("intents", [])]
    _write_telemetry_log(root, query, cursor_env, intent_ids)

    # Channel unavailable: local telemetry only. No stdout. Never claim
    # additional_context reached the model. Do not emit PLAN_MARKER_*.
    _ = _detect_platform(data)
    return 0


if __name__ == "__main__":
    sys.exit(main())
