#!/usr/bin/env python3
"""
Parent reviewer orchestration: child prompt generation and review workflows.

Inline mode prints prompts and review summaries for manual handoff to external agents.
Subagent-capable platforms may use the same output with platform-specific dispatch.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path

from .paths import get_repo_root
from .task_gates import (
    build_spec_update_scaffold,
    durable_learning_decision_status,
    task_closeout_profile,
)
from .task_map import (
    PARENT_TERMINAL_STATES,
    get_child_entry,
    load_task_map,
    validate_parent_child_integration,
)

_ARTIFACT_NAMES = ("prd.md", "design.md", "implement.md", "verify.md", "handoff.md")
_GLOBAL_CHILD_CONSTRAINTS = """General constraints:
- Read the parent task artifacts first: prd.md, design.md, implement.md, task-map.md, and child-prompts.md when present.
- Read your own child task artifacts: prd.md, design.md, implement.md.
- Stay inside your child scope and declared touch areas.
- Do not publish packages, push remotes, create tags, edit credentials, or change global/MCP configuration.
- Preserve explicit user approval for destructive, remote, credential-bearing, publish, push, tag, and global configuration actions.
- Write `verify.md` and `handoff.md` in your child task directory.
- Handoff must include changed files, validation commands/results, residual risks, and parent integration notes.
- If you find a needed contract change, stop and report it to the parent instead of silently redefining shared state/gate semantics.

Validation baseline:
- Run focused tests for touched behavior.
- Run typecheck when touching TypeScript.
- Run ESLint for changed TypeScript test/source files when applicable.
- Run Python compile checks when touching Python scripts/templates.
- Run `python ./.trellis/scripts/task.py validate <your-child-task>` before handoff."""

_VALIDATION_BASELINE = """Validation baseline:
- Run focused tests for touched behavior.
- Run typecheck when touching TypeScript.
- Run ESLint for changed TypeScript test/source files when applicable.
- Run Python compile checks when touching Python scripts/templates.
- Run `python ./.trellis/scripts/task.py validate <child-dir>` before handoff."""


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _read_optional(path: Path, max_chars: int = 12000) -> str | None:
    if not path.is_file():
        return None
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return None
    if len(text) > max_chars:
        return text[:max_chars] + "\n\n...[truncated for prompt]...\n"
    return text


def _repo_rel(path: Path, repo_root: Path) -> str:
    try:
        return path.relative_to(repo_root).as_posix()
    except ValueError:
        return str(path)


def _unmet_dependencies(child_entry: dict, children_by_id: dict[str, dict]) -> list[str]:
    deps = child_entry.get("depends_on") or []
    if not isinstance(deps, list):
        return []
    blocked: list[str] = []
    for dep_id in deps:
        if not isinstance(dep_id, str):
            continue
        dep = children_by_id.get(dep_id)
        if dep is None:
            blocked.append(f"{dep_id} (missing from task-map)")
            continue
        state = dep.get("state")
        if state not in PARENT_TERMINAL_STATES:
            blocked.append(f"{dep_id} (state={state!r}, need integrated or cancelled)")
    return blocked


def _child_prompt_section(
    parent_dir: Path,
    child_dir: Path,
    child_entry: dict,
    repo_root: Path,
    *,
    include_artifacts: bool,
) -> str:
    child_name = child_dir.name
    parent_rel = _repo_rel(parent_dir, repo_root)
    child_rel = _repo_rel(child_dir, repo_root)
    state = child_entry.get("state", "open")
    depends_on = child_entry.get("depends_on") or []
    touches = child_entry.get("touches") or []
    isolation = child_entry.get("isolation") or "git-worktree"

    lines = [
        f"## Child: `{child_name}`",
        "",
        f"- Parent task: `{parent_rel}`",
        f"- Child task: `{child_rel}`",
        f"- Integration state: `{state}`",
        f"- Isolation: `{isolation}`",
    ]
    if depends_on:
        lines.append(f"- Depends on: {', '.join(f'`{d}`' for d in depends_on)}")
    else:
        lines.append("- Depends on: (none)")
    if touches:
        lines.append("- Touch scope:")
        for touch in touches:
            lines.append(f"  - `{touch}`")
    else:
        lines.append("- Touch scope: (not declared in task-map; stay within child prd/design/implement)")

    if include_artifacts:
        lines.append("")
        lines.append("### Child artifacts (context)")
        for name in _ARTIFACT_NAMES:
            content = _read_optional(child_dir / name, max_chars=8000)
            if content:
                lines.append(f"#### {name}")
                lines.append("")
                lines.append(content.strip())
                lines.append("")

    lines.append("### Suggested child worker commands")
    lines.append("")
    lines.append("```bash")
    lines.append(f"python ./.trellis/scripts/task.py select {child_rel}")
    lines.append(
        f"python ./.trellis/scripts/task.py set-child-state {parent_rel} {child_rel} working --evidence implement.md"
    )
    lines.append("# ... implement ...")
    lines.append(
        f"python ./.trellis/scripts/task.py set-child-state {parent_rel} {child_rel} review --evidence verify.md"
    )
    lines.append("```")
    lines.append("")
    return "\n".join(lines)


def build_child_prompt(
    parent_dir: Path,
    child_dir: Path,
    *,
    include_artifacts: bool = False,
    mode: str = "inline",
) -> tuple[str | None, list[str]]:
    """Build an implementation prompt for a linked child task."""
    errors: list[str] = []
    repo_root = get_repo_root()
    child_name = child_dir.name

    parent_json = parent_dir / "task.json"
    if not parent_json.is_file():
        return None, [f"parent task.json missing: {parent_dir}"]

    data, body = load_task_map(parent_dir)
    if data is None:
        return None, ["parent task-map.md missing or invalid"]

    child_entry = get_child_entry(data, child_name)
    if child_entry is None:
        return None, [f"child not in parent task-map: {child_name}"]

    children_by_id = {
        item.get("id"): item
        for item in data.get("children", [])
        if isinstance(item, dict) and item.get("id")
    }
    blocked = _unmet_dependencies(child_entry, children_by_id)

    parent_rel = _repo_rel(parent_dir, repo_root)
    child_rel = _repo_rel(child_dir, repo_root)
    repo_rel = _repo_rel(repo_root, repo_root)

    child_prd = _read_optional(child_dir / "prd.md", 4000)
    child_design = _read_optional(child_dir / "design.md", 4000)
    child_implement = _read_optional(child_dir / "implement.md", 4000)
    parent_child_prompts = _read_optional(parent_dir / "child-prompts.md", 16000)

    goal = ""
    if child_prd:
        goal_match = re.search(r"(?ms)^##\s*Goal\s*\n+(.*?)(?:\n##|\Z)", child_prd)
        if goal_match:
            goal = goal_match.group(1).strip()

    lines = [
        f"You are implementing child task `{child_name}`.",
        "",
        "Workspace:",
        f"- Root: {repo_rel}",
        f"- Parent task: {parent_rel}",
        f"- Child task: {child_rel}",
        "",
    ]

    if blocked:
        lines.extend(
            [
                "Start condition:",
                "- **BLOCKED** — unmet dependencies:",
            ]
        )
        for item in blocked:
            lines.append(f"  - {item}")
        lines.append("- Do not start implementation until dependencies reach `integrated` or `cancelled`.")
        lines.append("")
    elif depends_on := child_entry.get("depends_on"):
        lines.extend(
            [
                "Start condition:",
                f"- Dependencies satisfied: {', '.join(f'`{d}`' for d in depends_on)}.",
                "",
            ]
        )

    lines.extend(
        [
            "Read first:",
            f"- Parent prd.md/design.md/implement.md/task-map.md",
            f"- Child prd.md/design.md/implement.md under `{child_rel}`",
        ]
    )
    if parent_child_prompts and child_name in parent_child_prompts:
        lines.append(f"- Parent child-prompts.md section for `{child_name}` when present")

    if goal:
        lines.extend(["", "Goal:", goal, ""])

    lines.append(_GLOBAL_CHILD_CONSTRAINTS)
    lines.append("")

    if child_implement:
        lines.extend(["Implementation plan (from child implement.md):", child_implement.strip()[:6000], ""])
    elif child_design:
        lines.extend(["Design notes (from child design.md):", child_design.strip()[:4000], ""])

    touches = child_entry.get("touches") or []
    if touches:
        lines.append("Declared touch scope (parent task-map):")
        for touch in touches:
            lines.append(f"- `{touch}`")
        lines.append("")

    if mode == "subagent":
        topo = data.get("execution_topology", "serial")
        merge_lim = data.get("merge_limit", 1)
        lines.extend(
            [
                f"Selected task: {child_rel}",
                "",
                "Delivery mode: subagent (Cursor)",
                "- **Default:** Parent session dispatches **Task** with `subagent_type=trellis-implement` and this prompt as the task description (writable sub-agent). Model under Cursor++ BYOK comes from `.trellis/local/cursor2plus/` routing (see `cursor-subagent-policy.md` Method 2.5/2.6).",
                "- **Exception:** If parent `child-prompts.md` or the user names this child for a **separate writable Agent chat**, open a new Agent session, pick the model manually, paste this prompt — do not use Task from Parent.",
                "- Parent retains `review-child` / `integrate-child`. Child must not nest further `trellis-research` / `trellis-implement` / `trellis-check` Task dispatches.",
                f"- Parent orchestration: `execution_topology={topo}`, `merge_limit={merge_lim}`.",
                "- When `isolation: git-worktree`, prepare worktree from a **git repo root** (e.g. `Trellis/`) before large edits.",
                "",
            ]
        )
    else:
        lines.extend(
            [
                "Delivery mode: inline",
                "- Hand this prompt to the child worker agent or session manually.",
                "- Parent session retains integration authority (`integrate-child`, `review-child`).",
                "",
            ]
        )

    lines.append(_child_prompt_section(parent_dir, child_dir, child_entry, repo_root, include_artifacts=include_artifacts))

    return "\n".join(lines), errors


def build_parent_status(parent_dir: Path) -> str:
    """Render a parent task-map status summary for the reviewer."""
    repo_root = get_repo_root()
    parent_rel = _repo_rel(parent_dir, repo_root)
    data, _ = load_task_map(parent_dir)
    if data is None:
        return f"Parent `{parent_rel}`: task-map.md missing or invalid."

    lines = [
        f"# Parent orchestration status — `{parent_dir.name}`",
        "",
        f"- Path: `{parent_rel}`",
        f"- contract_epoch: {data.get('contract_epoch', '?')}",
        f"- execution_topology: {data.get('execution_topology', '?')}",
        f"- merge_limit: {data.get('merge_limit', '?')}",
        "",
        "## Children",
        "",
    ]

    children = data.get("children") or []
    if not children:
        lines.append("(no children in task-map)")
        return "\n".join(lines)

    for child in children:
        if not isinstance(child, dict):
            continue
        cid = child.get("id", "?")
        state = child.get("state", "?")
        evidence = child.get("evidence")
        ref = child.get("ref")
        deps = child.get("depends_on") or []
        touches = child.get("touches") or []
        isolation = child.get("isolation")
        branch = child.get("branch")
        worktree_path = child.get("worktree_path")
        lines.append(f"### `{cid}` — `{state}`")
        if deps:
            lines.append(f"- depends_on: {', '.join(deps)}")
        if touches:
            lines.append(f"- touches: {', '.join(touches)}")
        if isolation:
            lines.append(f"- isolation: {isolation}")
        if branch:
            lines.append(f"- branch: {branch}")
        if worktree_path:
            lines.append(f"- worktree_path: {worktree_path}")
        if evidence:
            lines.append(f"- evidence: {evidence}")
        if ref:
            lines.append(f"- ref: {ref}")
        child_dir = parent_dir.parent / cid
        for artifact in ("verify.md", "handoff.md"):
            flag = "yes" if (child_dir / artifact).is_file() else "missing"
            lines.append(f"- {artifact}: {flag}")
        lines.append("")

    queue = data.get("integration_queue") or []
    lines.append(f"integration_queue: {queue}")
    lines.append("")
    lines.append("## Suggested parent commands")
    lines.append("")
    lines.append("```bash")
    lines.append(f"python ./.trellis/scripts/task.py parent-status {parent_rel}")
    lines.append(f"python ./.trellis/scripts/task.py generate-child-prompt {parent_rel} <child> --mode subagent")
    lines.append(f"python ./.trellis/scripts/task.py generate-child-prompt {parent_rel} <child> --mode inline")
    lines.append(f"python ./.trellis/scripts/task.py review-child {parent_rel} <child> --check")
    lines.append(f"python ./.trellis/scripts/task.py review-child {parent_rel} <child> --decision accept --ref <ref>")
    lines.append("```")
    return "\n".join(lines)


def _summarize_handoff(child_dir: Path) -> dict[str, str | list[str] | bool]:
    verify = _read_optional(child_dir / "verify.md", 6000) or ""
    handoff = _read_optional(child_dir / "handoff.md", 12000) or ""
    has_verify = (child_dir / "verify.md").is_file()
    has_handoff = (child_dir / "handoff.md").is_file()

    validation_ok = bool(
        re.search(r"(?i)validation\s+(evidence|commands|results)", verify)
        or re.search(r"(?i)validation\s*:", verify)
    )
    acceptance_ok = bool(re.search(r"(?i)acceptance\s+evidence|accepted\s+by\s+user", verify))
    learning = durable_learning_decision_status(verify) if verify else {
        "no_durable_learning": False,
        "spec_update": False,
        "learning_artifact": False,
        "any": False,
    }

    changed_files: list[str] = []
    for line in handoff.splitlines():
        if "|" in line and not line.strip().startswith("| ---"):
            cells = [c.strip() for c in line.split("|") if c.strip()]
            if len(cells) >= 2 and cells[0].lower() not in ("path", "file"):
                changed_files.append(cells[0])

    return {
        "has_verify": has_verify,
        "has_handoff": has_handoff,
        "validation_section": validation_ok,
        "acceptance_section": acceptance_ok,
        "learning_decision": learning,
        "verify_excerpt": verify.strip()[:2000],
        "handoff_excerpt": handoff.strip()[:4000],
        "changed_files": changed_files[:20],
    }


def _learning_decision_review_lines(
    parent_dir: Path,
    child_dir: Path,
    child_data: dict,
    summary: dict,
    *,
    decision: str | None,
    reason: str | None,
) -> list[str]:
    """Prompt parent/child to record durable learning before child archive."""
    learning = summary.get("learning_decision") or {}
    if learning.get("any"):
        return []

    repo_root = get_repo_root()
    child_rel = _repo_rel(child_dir, repo_root)
    lines = [
        "## Durable learning decision (required before child archive)",
        "",
        "Child verify.md has no grep-friendly durable-learning line yet. Pick one outcome:",
        "",
        "- `Durable learning decision: no durable learning` — routine scope, no reusable contract.",
        "- `Spec update evidence: .trellis/spec/<path>` — after `/trellis:update-spec` with reviewer confirmation.",
        f"- `Learning artifact: {child_rel}/handoff.md` — handoff already captures the insight.",
        "",
        f"Helper: `python ./.trellis/scripts/task.py prepare-archive-evidence {child_rel}`",
        "",
    ]

    trigger: str | None = None
    if decision == "changes":
        trigger = f"Parent review requested changes ({reason or 'see review notes'})"
    elif decision in ("accept", "integrate-through"):
        trigger = "Parent accepted child handoff — confirm whether workflow/contracts should be captured in spec"

    if trigger or decision == "changes":
        lines.append(build_spec_update_scaffold(repo_root, child_dir, child_data, trigger=trigger))
    return lines


def build_review_report(
    parent_dir: Path,
    child_dir: Path,
    parent_data: dict,
    child_data: dict,
    *,
    decision: str | None,
    ref: str | None,
    reason: str | None,
    notes: str | None,
) -> tuple[str, list[str], dict]:
    """Build review summary and validate integration transitions for a decision."""
    child_name = child_dir.name
    summary = _summarize_handoff(child_dir)
    errors: list[str] = []
    actions: dict = {"integrate": None, "gates": []}

    data, _ = load_task_map(parent_dir)
    child_entry = get_child_entry(data, child_name) if data else None
    current_state = child_entry.get("state") if child_entry else None

    lines = [
        f"# Parent review — `{child_name}`",
        "",
        f"- Timestamp: {_utc_now()}",
        f"- Current integration state: `{current_state}`",
        f"- Decision: `{decision or 'check-only'}`",
        "",
        "## Handoff artifacts",
        "",
        f"- verify.md: {'present' if summary['has_verify'] else '**missing**'}",
        f"- handoff.md: {'present' if summary['has_handoff'] else '**missing**'}",
        f"- verify validation section signal: {summary['validation_section']}",
        f"- verify acceptance section signal: {summary['acceptance_section']}",
        f"- durable learning decision signal: {summary['learning_decision'].get('any')}",
        "",
    ]
    learning_lines = _learning_decision_review_lines(
        parent_dir,
        child_dir,
        child_data,
        summary,
        decision=decision,
        reason=reason,
    )
    if learning_lines:
        lines.extend(learning_lines)

    if summary["changed_files"]:
        lines.append("Changed files (from handoff table):")
        for path in summary["changed_files"]:
            lines.append(f"- `{path}`")
        lines.append("")

    if notes:
        lines.extend(["## Parent notes", "", notes.strip(), ""])

    if decision in ("accept", "changes", "cancel"):
        if decision == "accept":
            target = "accepted"
            if current_state != "review":
                errors.append(f"accept requires child state 'review', got {current_state!r}")
            errors.extend(
                validate_parent_child_integration(
                    parent_dir,
                    parent_data,
                    child_dir,
                    child_data,
                    target,
                    "handoff.md",
                    ref,
                    reason,
                )
            )
            actions["integrate"] = {
                "state": target,
                "evidence": "handoff.md",
                "ref": ref,
            }
            actions["gates"].append(
                {
                    "task": "parent",
                    "transition": "parent-accepted",
                    "optional": True,
                    "hint": (
                        f"Optional audit: python ./.trellis/scripts/task.py record-gate {parent_dir.name} "
                        f"--transition parent-accepted --gate code-review --result PASS "
                        f"--reviewer parent --evidence review-{child_name}.md"
                    ),
                }
            )
            child_profile = task_closeout_profile(child_dir, child_data)
            if child_profile == "full":
                actions["gates"].append(
                    {
                        "task": "child",
                        "transition": "child-review",
                        "optional": False,
                        "hint": (
                            f"Required before accept: python ./.trellis/scripts/task.py record-gate {child_name} "
                            f"--transition child-review --gate code-review --result PASS "
                            f"--reviewer parent --evidence verify.md"
                        ),
                    }
                )
            elif child_profile == "lite":
                actions["gates"].append(
                    {
                        "task": "child",
                        "transition": "child-review",
                        "optional": True,
                        "hint": "Lite child: no child-review gate chain required.",
                    }
                )
        elif decision == "changes":
            target = "changes"
            errors.extend(
                validate_parent_child_integration(
                    parent_dir,
                    parent_data,
                    child_dir,
                    child_data,
                    target,
                    "handoff.md",
                    ref,
                    reason,
                )
            )
            if not reason:
                errors.append("changes requires --reason")
            actions["integrate"] = {
                "state": target,
                "evidence": "handoff.md",
                "ref": ref,
                "reason": reason,
            }
        elif decision == "cancel":
            target = "cancelled"
            errors.extend(
                validate_parent_child_integration(
                    parent_dir,
                    parent_data,
                    child_dir,
                    child_data,
                    target,
                    "handoff.md",
                    ref,
                    reason,
                )
            )
            if not reason:
                errors.append("cancel requires --reason")
            actions["integrate"] = {
                "state": target,
                "evidence": "handoff.md",
                "reason": reason,
            }
    elif decision == "integrate-through":
        sequence = [
            ("accepted", "handoff.md"),
            ("integrating", "task-map.md"),
            ("integrated", "task-map.md"),
        ]
        sim_state = current_state
        for target, evidence in sequence:
            if target == "accepted" and sim_state != "review":
                errors.append(f"integrate-through requires child state 'review', got {sim_state!r}")
                break
            if target == "integrating" and sim_state != "accepted":
                errors.append(f"integrating requires 'accepted', simulated from {sim_state!r}")
                break
            if target == "integrated" and sim_state != "integrating":
                errors.append(f"integrated requires 'integrating', simulated from {sim_state!r}")
                break
            step_errors = validate_parent_child_integration(
                parent_dir,
                parent_data,
                child_dir,
                child_data,
                target,
                evidence,
                ref,
                reason,
                current_state_override=sim_state,
            )
            errors.extend(step_errors)
            if step_errors:
                break
            sim_state = target
        if not errors:
            actions["integrate_sequence"] = [
                {"state": "accepted", "evidence": "handoff.md", "ref": ref},
                {"state": "integrating", "evidence": "task-map.md", "ref": ref},
                {"state": "integrated", "evidence": "task-map.md", "ref": ref},
            ]
            actions["gates"].append(
                {
                    "task": "parent",
                    "transition": "parent-integrated",
                    "optional": False,
                    "hint": (
                        f"Required before parent archive: python ./.trellis/scripts/task.py record-gate {parent_dir.name} "
                        f"--transition parent-integrated --gate integration-review --result PASS "
                        f"--reviewer parent --evidence task-map.md"
                    ),
                }
            )

    lines.extend(
        [
            "## verify.md excerpt",
            "",
            (summary["verify_excerpt"] or "(empty)"),
            "",
            "## handoff.md excerpt",
            "",
            (summary["handoff_excerpt"] or "(empty)"),
            "",
        ]
    )

    if decision and not errors:
        lines.append("## Integration plan")
        lines.append("")
        if actions.get("integrate_sequence"):
            for step in actions["integrate_sequence"]:
                lines.append(
                    f"- integrate-child → `{step['state']}` (evidence={step['evidence']}, ref={step.get('ref')})"
                )
        elif actions.get("integrate"):
            step = actions["integrate"]
            lines.append(
                f"- integrate-child → `{step['state']}` (evidence={step['evidence']}, ref={step.get('ref')})"
            )
        for gate in actions.get("gates", []):
            if gate.get("optional"):
                lines.append(f"- Optional gate ({gate['transition']}): {gate['hint']}")
        lines.append("")

    report = "\n".join(lines)
    return report, errors, actions


def append_parent_review_notes(parent_dir: Path, child_name: str, report: str) -> None:
    """Append a parent review section to parent verify.md."""
    verify_path = parent_dir / "verify.md"
    header = f"\n\n## Parent review — `{child_name}` ({_utc_now()})\n\n"
    if verify_path.is_file():
        existing = verify_path.read_text(encoding="utf-8")
        verify_path.write_text(existing.rstrip() + header + report.strip() + "\n", encoding="utf-8")
    else:
        verify_path.write_text(
            "# Verification Evidence\n\n" + header + report.strip() + "\n",
            encoding="utf-8",
        )


def write_review_artifact(parent_dir: Path, child_name: str, report: str) -> Path:
    """Write a standalone review artifact under the parent task directory."""
    path = parent_dir / f"review-{child_name}.md"
    path.write_text(report.strip() + "\n", encoding="utf-8")
    return path