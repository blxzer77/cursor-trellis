#!/usr/bin/env python3
"""
Task quality gate helpers.

Gate records are stored in task.json under:
quality_gate_results.transitions[transition][gate]
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from .task_map import (
    get_child_state,
    load_task_map,
    validate_child_archive_state,
    validate_parent_children_complete,
)

SCHEMA_VERSION = 1
BASELINE_GATE = "baseline-check"

KNOWN_TRANSITIONS = {
    "start-execution",
    "full-task-complete",
    "child-review",
    "parent-changes",
    "parent-accepted",
    "parent-integrating",
    "parent-integrated",
    "parent-cancelled",
}

REVIEW_GATES = {
    "requirements-review",
    "code-review",
    "architecture-review",
    "architecture-deep-review",
    "integration-review",
}

KNOWN_GATES = {BASELINE_GATE, *REVIEW_GATES}
RESULTS = {"PASS", "FAIL", "SKIPPED"}
FAIL_ROOT_CAUSES = {
    "implementation-defect": "Execution",
    "contract-changing-defect": "Planning",
    "validation-environment-blocker": "Verification / Review",
}

PROFILE_DEFAULT_GATES = {
    "standard": ["requirements-review", "code-review"],
    "strict": ["requirements-review", "code-review"],
    "architecture": [
        "requirements-review",
        "architecture-review",
        "code-review",
    ],
}

ALLOWED_EXECUTION_MODES = {"inline", "worker", "child-task"}
ALLOWED_ISOLATION = {"main-worktree", "git-worktree"}
ALLOWED_VERIFICATION_PROFILES = {"standard", "strict", "architecture"}
ALLOWED_RETRIEVAL_PROFILES = {
    "exact-only",
    "semantic",
    "structure",
    "architecture-memory",
}
ALLOWED_GATE_MODES = {"profile", "explicit"}

MAX_SHORT_FIELD = 240
MAX_REASON = 500
REVIEWER_RE = re.compile(r"^[A-Za-z0-9_.:@/-]+$")
VALIDATION_EVIDENCE_RE = re.compile(
    r"(?im)^\s*(?:[-*]\s*)?validation"
    r"(?:\s+(?:commands?|results?|evidence))?\s*:\s*(\S[^\r\n]*)$"
)
ACCEPTANCE_EVIDENCE_RE = re.compile(
    r"(?im)^\s*(?:[-*]\s*)?(?:final\s+|user\s+)?acceptance"
    r"(?:\s+evidence)?\s*:\s*(\S[^\r\n]*)$"
)
ACCEPTED_BY_USER_RE = re.compile(
    r"(?im)^\s*(?:[-*]\s*)?accepted\s+by\s+user\s*:\s*(\S[^\r\n]*)$"
)
NO_DURABLE_LEARNING_RE = re.compile(r"(?i)\bno\s+durable\s+learning\b")
DURABLE_LEARNING_EVIDENCE_RE = re.compile(
    r"(?im)^\s*(?:[-*]\s*)?(?:durable\s+learning(?:\s+decision)?|learning\s+decision|"
    r"spec\s+updates?|spec\s+update\s+(?:needed|evidence)|updated\s+spec|"
    r"retrospective(?:\.md)?|learning\s+artifact)\s*:\s*(\S[^\r\n]*)$"
)
INTEGRATION_EVIDENCE_RE = re.compile(
    r"(?im)^\s*(?:[-*]\s*)?(?:final\s+)?integration"
    r"(?:\s+evidence)?\s*:\s*(\S[^\r\n]*)$"
)
REVIEWED_CHANGE_SET_RE = re.compile(
    r"(?im)^\s*(?:[-*]\s*)?(?:reviewed\s+)?"
    r"(?:change[- ]set|changeset|diff|git\s+diff|ref|git\s+ref)"
    r"(?:\s+(?:identity|evidence|summary|ref))?\s*:\s*(\S[^\r\n]*)$"
)
CHECK_EVIDENCE_RE = re.compile(
    r"(?im)^\s*(?:[-*]\s*)?(?:check\s+evidence|trellis-check(?:\s+evidence)?)"
    r"\s*:\s*(\S[^\r\n]*)$"
)
PLACEHOLDER_VALUES_RE = re.compile(
    r"(?i)^(TBD|TODO|待定|待补充|N/?A|NA|NONE|-|\.\.\.)$"
)
PRD_ACCEPTANCE_CRITERIA_HEADING_RE = re.compile(
    r"(?im)^\s*#{1,6}\s*acceptance\s+criteria\s*$"
)
PRD_ACCEPTANCE_ITEM_RE = re.compile(
    r"(?im)^\s*-\s*\[[ xX]\]\s+(.+)$"
)
PRD_PLACEHOLDER_RE = re.compile(r"(?i)^\s*(TBD|TODO|待定|待补充)(?:\s*[.:：])?\s*$")
AUTO_PLANNING_REVIEWER = "trellis-cli"
START_EXECUTION_AUTO_GATES = frozenset({"requirements-review", "architecture-review"})

STABLE_TASK_KEYS = (
    "id",
    "name",
    "title",
    "description",
    "status",
    "dev_type",
    "scope",
    "package",
    "priority",
    "creator",
    "assignee",
    "parent",
    "children",
    "subtasks",
    "relatedFiles",
    "notes",
    "meta",
    "branch",
    "base_branch",
    "task_kind",
    "task_type",
    "kind",
    "mode",
    "contract_epoch",
)


@dataclass
class GateGuardResult:
    """Result from a protected-transition guard."""

    ok: bool
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    contract_fingerprint: str = ""
    artifact_fingerprints: dict[str, str] = field(default_factory=dict)
    required_gates: list[str] = field(default_factory=list)
    baseline_record: dict | None = None
    is_full_task: bool = False
    closeout_profile: str = "lite"
    auto_gate_records: dict[str, dict] = field(default_factory=dict)


def utc_now() -> str:
    """Return a compact UTC timestamp for task.json records."""
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace(
        "+00:00", "Z"
    )


def normalize_result(result: str) -> str:
    """Normalize a CLI result value."""
    return result.strip().upper()


def task_closeout_profile(task_dir: Path, task_data: dict | None = None) -> str:
    """Return lite, full, or parent closeout profile."""
    data = task_data or {}
    child_names = data.get("children")
    if isinstance(child_names, list) and any(isinstance(name, str) for name in child_names):
        return "parent"

    meta = data.get("meta") if isinstance(data.get("meta"), dict) else {}
    candidates = [
        data.get("task_kind"),
        data.get("task_type"),
        data.get("kind"),
        data.get("mode"),
        meta.get("task_kind"),
        meta.get("task_type"),
        meta.get("classification"),
        meta.get("mode"),
    ]

    explicit_lite = False
    for value in candidates:
        if not isinstance(value, str):
            continue
        normalized = value.lower().replace("_", "-")
        if "parent" in normalized:
            return "parent"
        if "full" in normalized:
            return "full"
        if "lite" in normalized:
            explicit_lite = True

    if explicit_lite:
        return "lite"

    if (task_dir / "design.md").is_file() and (task_dir / "implement.md").is_file():
        return "full"
    return "lite"


def is_full_task(task_dir: Path, task_data: dict | None = None) -> bool:
    """Return True when a task should satisfy Full Task gates."""
    return task_closeout_profile(task_dir, task_data) == "full"


def read_strategy_contract(task_dir: Path) -> tuple[dict, list[str]]:
    """Parse the lightweight Development Strategy Contract from implement.md."""
    implement_path = task_dir / "implement.md"
    if not implement_path.is_file():
        return {}, ["implement.md"]

    try:
        lines = implement_path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return {}, ["implement.md could not be read"]

    contract: dict = {}
    section: str | None = None
    list_key: str | None = None
    started = False

    top_level_keys = {
        "execution_mode",
        "isolation",
        "verification_profile",
        "retrieval_profile",
        "optional_capabilities",
        "quality_gates",
    }

    for raw_line in lines:
        line = raw_line.rstrip()
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("#") or stripped.startswith("```"):
            continue

        top_match = re.match(r"^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$", stripped)
        if top_match:
            key = top_match.group(1)
            value = top_match.group(2).strip()
            if key in top_level_keys:
                started = True
                section = key if key == "quality_gates" else None
                list_key = key if key == "optional_capabilities" and not value else None
                if key == "quality_gates":
                    contract.setdefault("quality_gates", {})
                elif key == "optional_capabilities":
                    if value:
                        contract[key] = _parse_inline_list(value)
                    else:
                        contract[key] = []
                else:
                    contract[key] = value
                continue

        if not started:
            continue

        nested_match = re.match(r"^\s+([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$", line)
        if nested_match and section == "quality_gates":
            key = nested_match.group(1)
            value = nested_match.group(2).strip()
            gates = contract.setdefault("quality_gates", {})
            if value:
                gates[key] = _parse_inline_list(value)
                list_key = None
            else:
                gates[key] = []
                list_key = f"quality_gates.{key}"
            continue

        item_match = re.match(r"^\s*-\s+(.+)$", line)
        if item_match:
            item = item_match.group(1).strip()
            if list_key == "optional_capabilities":
                contract.setdefault("optional_capabilities", []).append(item)
            elif list_key and list_key.startswith("quality_gates."):
                gate_key = list_key.split(".", 1)[1]
                gates = contract.setdefault("quality_gates", {})
                gates.setdefault(gate_key, []).append(item)

    errors = validate_strategy_contract(contract)
    return contract, errors


def validate_strategy_contract(contract: dict) -> list[str]:
    """Validate the parsed Development Strategy Contract."""
    errors: list[str] = []
    required = [
        "execution_mode",
        "isolation",
        "verification_profile",
        "retrieval_profile",
        "optional_capabilities",
        "quality_gates",
    ]
    for key in required:
        if key not in contract:
            errors.append(f"Development Strategy Contract missing {key}")

    execution_mode = contract.get("execution_mode")
    if execution_mode and execution_mode not in ALLOWED_EXECUTION_MODES:
        errors.append(f"invalid execution_mode: {execution_mode}")

    isolation = contract.get("isolation")
    if isolation and isolation not in ALLOWED_ISOLATION:
        errors.append(f"invalid isolation: {isolation}")

    verification_profile = contract.get("verification_profile")
    if verification_profile and verification_profile not in ALLOWED_VERIFICATION_PROFILES:
        errors.append(f"invalid verification_profile: {verification_profile}")

    retrieval_profile = contract.get("retrieval_profile")
    if retrieval_profile and retrieval_profile not in ALLOWED_RETRIEVAL_PROFILES:
        errors.append(f"invalid retrieval_profile: {retrieval_profile}")

    optional_capabilities = contract.get("optional_capabilities")
    if "optional_capabilities" in contract and not isinstance(optional_capabilities, list):
        errors.append("optional_capabilities must be a list")

    gates = contract.get("quality_gates")
    if isinstance(gates, dict):
        errors.extend(_validate_quality_gates(gates, verification_profile))
    elif "quality_gates" in contract:
        errors.append("quality_gates must be a mapping")

    return errors


def enabled_gates_for_contract(contract: dict) -> list[str]:
    """Return enabled non-baseline gates from a parsed contract."""
    gates = contract.get("quality_gates")
    if not isinstance(gates, dict):
        return []

    mode = gates.get("mode", "profile")
    if mode == "explicit":
        enabled = gates.get("enabled", [])
        return [g for g in enabled if isinstance(g, str)]

    profile = gates.get("profile") or contract.get("verification_profile") or "standard"
    return list(PROFILE_DEFAULT_GATES.get(profile, PROFILE_DEFAULT_GATES["standard"]))


def required_gates_for_transition(transition: str, contract: dict) -> list[str]:
    """Return non-baseline gates required before a transition."""
    enabled = set(enabled_gates_for_contract(contract))

    if transition == "start-execution":
        required = ["requirements-review"]
        if "architecture-review" in enabled:
            required.append("architecture-review")
        return required

    if transition in ("full-task-complete", "child-review"):
        required = ["code-review"]
        if "architecture-review" in enabled:
            required.append("architecture-review")
        if "architecture-deep-review" in enabled:
            required.append("architecture-deep-review")
        return required

    if transition == "parent-integrated":
        return ["integration-review"]

    return []


def compute_contract_fingerprint(
    task_dir: Path,
    task_data: dict,
    contract: dict | None = None,
) -> str:
    """Compute a task-level fingerprint excluding generated result fields."""
    payload = {
        "schema_version": SCHEMA_VERSION,
        "task_dir": task_dir.name,
        "stable_task": _stable_task_data(task_data),
        "strategy_contract": contract or {},
    }
    return _hash_payload(payload)


def compute_artifact_fingerprint(
    task_dir: Path,
    task_data: dict,
    transition: str,
    gate: str,
) -> str:
    """Compute a transition/gate-scoped artifact fingerprint."""
    files = _artifact_files_for(transition, gate)
    payload = {
        "schema_version": SCHEMA_VERSION,
        "transition": transition,
        "gate": gate,
        "task_dir": task_dir.name,
        "stable_task": _stable_task_data(task_data),
        "parent_contract": _parent_contract_metadata(
            task_dir,
            task_data,
            transition,
        ),
        "reviewed_change_set": _reviewed_change_set_metadata(
            task_dir,
            transition,
        ),
        "files": _read_artifact_files(task_dir, files),
    }
    return _hash_payload(payload)


def make_baseline_record(
    task_dir: Path,
    task_data: dict,
    transition: str,
    contract: dict | None = None,
    evidence: str = "task.json",
) -> dict:
    """Build a CLI-owned baseline-check PASS record."""
    contract_fingerprint = compute_contract_fingerprint(task_dir, task_data, contract)
    artifact_fingerprint = compute_artifact_fingerprint(
        task_dir, task_data, transition, BASELINE_GATE
    )
    return {
        "schema_version": SCHEMA_VERSION,
        "transition": transition,
        "gate": BASELINE_GATE,
        "result": "PASS",
        "reviewer": "trellis-cli",
        "evidence": evidence,
        "checked_at": utc_now(),
        "contract_fingerprint": contract_fingerprint,
        "artifact_fingerprint": artifact_fingerprint,
        "issue_fingerprint": None,
        "consecutive_failures": 0,
        "approved_skip": None,
    }


def write_gate_record(task_data: dict, transition: str, gate: str, record: dict) -> None:
    """Write a gate record into task_data in-place."""
    qgr = task_data.get("quality_gate_results")
    if not isinstance(qgr, dict):
        qgr = {}
        task_data["quality_gate_results"] = qgr

    qgr["schema_version"] = SCHEMA_VERSION
    qgr["contract_fingerprint"] = record.get("contract_fingerprint")
    qgr["artifact_fingerprint"] = record.get("artifact_fingerprint")
    transitions = qgr.get("transitions")
    if not isinstance(transitions, dict):
        transitions = {}
        qgr["transitions"] = transitions

    transition_records = transitions.get(transition)
    if not isinstance(transition_records, dict):
        transition_records = {}
        transitions[transition] = transition_records
    transition_records[gate] = record


def build_reviewer_gate_record(
    task_dir: Path,
    task_data: dict,
    transition: str,
    gate: str,
    result: str,
    reviewer: str,
    evidence: str,
    issue_fingerprint: str | None = None,
    issue_summary: str | None = None,
    root_cause: str | None = None,
    skip_approved_by: str | None = None,
    skip_reason: str | None = None,
    contract_fingerprint: str | None = None,
    artifact_fingerprint: str | None = None,
) -> tuple[dict | None, list[str], list[str]]:
    """Validate and build a non-baseline reviewer gate record."""
    normalized_result = normalize_result(result)
    errors = validate_reviewer_gate_input(
        transition=transition,
        gate=gate,
        result=normalized_result,
        reviewer=reviewer,
        evidence=evidence,
        issue_fingerprint=issue_fingerprint,
        issue_summary=issue_summary,
        root_cause=root_cause,
        skip_approved_by=skip_approved_by,
        skip_reason=skip_reason,
    )
    warnings: list[str] = []
    if errors:
        return None, errors, warnings

    if normalized_result in ("PASS", "SKIPPED"):
        errors.extend(
            validate_transition_readiness(
                task_dir,
                task_data,
                transition,
                gate=gate,
                mode="record",
            )
        )
        if errors:
            return None, errors, warnings

    contract, contract_errors = read_strategy_contract(task_dir) if is_full_task(task_dir, task_data) else ({}, [])
    if contract_errors:
        errors.extend(contract_errors)
        return None, errors, warnings

    current_contract_fingerprint = compute_contract_fingerprint(
        task_dir, task_data, contract
    )
    current_artifact_fingerprint = compute_artifact_fingerprint(
        task_dir, task_data, transition, gate
    )
    if contract_fingerprint and contract_fingerprint != current_contract_fingerprint:
        errors.append("provided contract fingerprint does not match current task artifacts")
    if artifact_fingerprint and artifact_fingerprint != current_artifact_fingerprint:
        errors.append("provided artifact fingerprint does not match current task artifacts")
    if errors:
        return None, errors, warnings

    previous = _get_gate_record(task_data, transition, gate)
    consecutive_failures = 0
    required_user_choice = None
    if normalized_result == "FAIL":
        consecutive_failures = _next_consecutive_failures(previous, issue_fingerprint)
        if consecutive_failures > 3:
            required_user_choice = {
                "required": True,
                "reason": "same gate and issue fingerprint failed more than three times",
                "options": [
                    "re-plan",
                    "continue-fixing",
                    "user-approved-skip-if-allowed",
                ],
            }
            warnings.append(
                "same gate and issue fingerprint has failed more than three times; ask the user to choose re-plan, continue fixing, or user-approved skip if allowed"
            )

    approved_skip = None
    if normalized_result == "SKIPPED":
        approved_skip = {
            "approved_by": skip_approved_by,
            "reason": skip_reason,
            "approved_at": utc_now(),
        }

    record = {
        "schema_version": SCHEMA_VERSION,
        "transition": transition,
        "gate": gate,
        "result": normalized_result,
        "reviewer": reviewer,
        "evidence": evidence,
        "checked_at": utc_now(),
        "contract_fingerprint": current_contract_fingerprint,
        "artifact_fingerprint": current_artifact_fingerprint,
        "issue_fingerprint": issue_fingerprint if normalized_result == "FAIL" else None,
        "root_cause": root_cause if normalized_result == "FAIL" else None,
        "route": _route_for_fail_root_cause(root_cause) if normalized_result == "FAIL" else None,
        "consecutive_failures": consecutive_failures,
        "required_user_choice": required_user_choice,
        "approved_skip": approved_skip,
    }
    if issue_summary and normalized_result == "FAIL":
        record["issue_summary"] = issue_summary
    return record, [], warnings


def validate_start_execution(
    task_dir: Path,
    task_data: dict | None,
    approved: bool,
) -> GateGuardResult:
    """Validate start-execution readiness."""
    errors: list[str] = []
    if task_data is None:
        return GateGuardResult(ok=False, errors=["task.json"])

    status = task_data.get("status")
    if status not in ("planning", "in_progress"):
        errors.append(f"task status must be planning or in_progress, got {status!r}")

    errors.extend(_required_file_errors(task_dir, ["prd.md"]))

    has_design = (task_dir / "design.md").is_file()
    has_implement = (task_dir / "implement.md").is_file()
    if has_design != has_implement:
        errors.append("design.md and implement.md must be present together for Full Tasks")

    full_task = is_full_task(task_dir, task_data)
    contract: dict = {}
    required_gates: list[str] = []
    if full_task:
        contract, contract_errors = read_strategy_contract(task_dir)
        errors.extend(contract_errors)
        if not contract_errors:
            required_gates = required_gates_for_transition("start-execution", contract)

    contract_fingerprint = compute_contract_fingerprint(task_dir, task_data, contract)
    artifact_fingerprints = {
        BASELINE_GATE: compute_artifact_fingerprint(
            task_dir, task_data, "start-execution", BASELINE_GATE
        )
    }

    auto_gate_records: dict[str, dict] = {}
    for gate in required_gates:
        artifact_fingerprints[gate] = compute_artifact_fingerprint(
            task_dir, task_data, "start-execution", gate
        )
        gate_errors = _validate_gate_record_for_transition(
            task_data=task_data,
            transition="start-execution",
            gate=gate,
            contract_fingerprint=contract_fingerprint,
            artifact_fingerprint=artifact_fingerprints[gate],
        )
        if gate_errors and gate in START_EXECUTION_AUTO_GATES and _only_missing_gate_record(
            gate_errors
        ):
            readiness_errors = _start_execution_planning_gate_readiness_errors(
                task_dir,
                gate,
                full_task=full_task,
                contract=contract,
            )
            if readiness_errors:
                errors.extend(readiness_errors)
            else:
                auto_gate_records[gate] = make_planning_review_gate_record(
                    task_dir=task_dir,
                    task_data=task_data,
                    transition="start-execution",
                    gate=gate,
                    contract=contract,
                    contract_fingerprint=contract_fingerprint,
                    artifact_fingerprint=artifact_fingerprints[gate],
                )
        else:
            errors.extend(gate_errors)

    if approved:
        errors.extend(
            _validate_existing_execution_approval(
                task_data=task_data,
                contract_fingerprint=contract_fingerprint,
                artifact_fingerprint=artifact_fingerprints[BASELINE_GATE],
            )
        )

    if not approved:
        errors.append("--approved is required for mutation")

    baseline_record = None
    if not errors:
        baseline_record = make_baseline_record(
            task_dir, task_data, "start-execution", contract
        )

    return GateGuardResult(
        ok=not errors,
        errors=errors,
        contract_fingerprint=contract_fingerprint,
        artifact_fingerprints=artifact_fingerprints,
        required_gates=required_gates,
        baseline_record=baseline_record,
        is_full_task=full_task,
        auto_gate_records=auto_gate_records,
    )


def _validate_existing_execution_approval(
    task_data: dict,
    contract_fingerprint: str,
    artifact_fingerprint: str,
) -> list[str]:
    """Reject stale approval state before re-approving an in-progress task."""
    approval = task_data.get("execution_approval")
    if not isinstance(approval, dict):
        return []

    errors: list[str] = []
    if approval.get("transition") != "start-execution":
        errors.append("stale execution approval: transition mismatch")
    if approval.get("contract_fingerprint") != contract_fingerprint:
        errors.append("stale execution approval: contract fingerprint changed")
    if approval.get("artifact_fingerprint") != artifact_fingerprint:
        errors.append("stale execution approval: artifact fingerprint changed")
    if errors:
        errors.append(
            "return to Planning, refresh gates, run start-execution --check, and ask for explicit approval again"
        )
    return errors


def validate_start_execution_check(
    task_dir: Path,
    task_data: dict | None,
) -> GateGuardResult:
    """Validate start-execution preflight without requiring approval."""
    result = validate_start_execution(task_dir, task_data, approved=True)
    return result


def validate_transition_readiness(
    task_dir: Path,
    task_data: dict | None,
    transition: str,
    *,
    gate: str | None = None,
    mode: str = "record",
) -> list[str]:
    """Validate transition evidence and, in complete mode, required gate records."""
    if task_data is None:
        return ["task.json"]

    errors: list[str] = []
    if transition not in KNOWN_TRANSITIONS:
        errors.append(f"unknown transition: {transition}")
        return errors

    profile = task_closeout_profile(task_dir, task_data)

    if mode == "record":
        if not gate:
            errors.append("gate is required for record readiness checks")
            return errors
        required_signals = _evidence_requirements_for_gate(transition, gate)
        errors.extend(_evidence_errors_for_signals(task_dir, task_data, required_signals))
        return errors

    if transition == "child-review":
        if profile != "full":
            return errors
        contract, contract_errors = read_strategy_contract(task_dir)
        errors.extend(contract_errors)
        if contract_errors:
            return errors
        return errors + _complete_transition_gate_errors(
            task_dir,
            task_data,
            transition,
            contract,
            required_gates_for_transition(transition, contract),
        )

    if transition == "full-task-complete":
        if profile != "full":
            return errors
        contract, contract_errors = read_strategy_contract(task_dir)
        errors.extend(contract_errors)
        if contract_errors:
            return errors
        return errors + _complete_transition_gate_errors(
            task_dir,
            task_data,
            transition,
            contract,
            required_gates_for_transition(transition, contract),
        )

    if transition == "parent-integrated":
        if profile != "parent":
            return errors
        child_names = task_data.get("children")
        if isinstance(child_names, list):
            errors.extend(
                validate_parent_children_complete(
                    task_dir,
                    [name for name in child_names if isinstance(name, str)],
                )
            )
        errors.extend(
            _evidence_errors_for_signals(task_dir, task_data, ["integration"])
        )
        contract: dict = {}
        if (task_dir / "implement.md").is_file():
            contract, contract_errors = read_strategy_contract(task_dir)
            errors.extend(contract_errors)
            if contract_errors:
                return errors
        return errors + _complete_transition_gate_errors(
            task_dir,
            task_data,
            transition,
            contract,
            required_gates_for_transition(transition, contract),
        )

    return errors


def _complete_transition_gate_errors(
    task_dir: Path,
    task_data: dict,
    transition: str,
    contract: dict,
    required_gates: list[str],
) -> list[str]:
    errors: list[str] = []
    contract_fingerprint = compute_contract_fingerprint(task_dir, task_data, contract)
    for gate_name in required_gates:
        artifact_fingerprint = compute_artifact_fingerprint(
            task_dir, task_data, transition, gate_name
        )
        errors.extend(
            _validate_gate_record_for_transition(
                task_data=task_data,
                transition=transition,
                gate=gate_name,
                contract_fingerprint=contract_fingerprint,
                artifact_fingerprint=artifact_fingerprint,
            )
        )
        errors.extend(
            _evidence_errors_for_signals(
                task_dir,
                task_data,
                _evidence_requirements_for_gate(transition, gate_name),
            )
        )
    return errors


def _evidence_requirements_for_gate(transition: str, gate: str) -> list[str]:
    if gate == "code-review" and transition in ("full-task-complete", "child-review"):
        return ["validation", "check_evidence", "reviewed_change_set"]
    if gate == "integration-review" and transition == "parent-integrated":
        return ["integration"]
    if gate in ("architecture-review", "architecture-deep-review") and transition in (
        "full-task-complete",
        "child-review",
    ):
        return ["validation", "check_evidence"]
    return []


def _evidence_errors_for_signals(
    task_dir: Path,
    task_data: dict,
    required_signals: list[str],
) -> list[str]:
    status = verify_evidence_status(task_dir, task_data)
    label_map = {
        "validation": "verify.md missing substantive validation evidence",
        "check_evidence": "verify.md missing check evidence",
        "acceptance": "verify.md missing final acceptance evidence",
        "durable_learning": "verify.md missing durable-learning decision evidence",
        "integration": "verify.md missing final integration evidence",
        "reviewed_change_set": (
            "verify.md or handoff.md missing reviewed change-set evidence"
        ),
    }
    errors: list[str] = []
    for signal in required_signals:
        if not status.get(signal):
            errors.append(label_map.get(signal, f"missing evidence signal: {signal}"))
    return errors


def verify_evidence_status(task_dir: Path, task_data: dict) -> dict[str, bool]:
    """Return substantive evidence signals from verify.md and handoff.md."""
    verify_path = task_dir / "verify.md"
    content = ""
    if verify_path.is_file():
        try:
            content = verify_path.read_text(encoding="utf-8")
        except OSError:
            content = ""

    handoff_path = task_dir / "handoff.md"
    handoff_content = ""
    if handoff_path.is_file():
        try:
            handoff_content = handoff_path.read_text(encoding="utf-8")
        except OSError:
            handoff_content = ""

    child_names = task_data.get("children")
    has_children = isinstance(child_names, list) and bool(child_names)
    return {
        "validation": _has_substantive_validation_evidence(content),
        "check_evidence": _has_substantive_check_evidence(content),
        "acceptance": _has_substantive_acceptance_evidence(content),
        "durable_learning": _has_durable_learning_evidence(content),
        "integration": (
            _has_substantive_integration_evidence(content) if has_children else True
        ),
        "reviewed_change_set": (
            _has_substantive_reviewed_change_set(content)
            or _has_substantive_reviewed_change_set(handoff_content)
        ),
    }


def validate_archive(
    task_dir: Path,
    task_data: dict | None,
) -> GateGuardResult:
    """Validate archive readiness without mutating task files."""
    errors: list[str] = []
    if task_data is None:
        return GateGuardResult(ok=False, errors=["task.json"])

    errors.extend(_required_file_errors(task_dir, ["verify.md"]))
    errors.extend(_verify_evidence_errors(task_dir, task_data))

    parent_name = task_data.get("parent")
    if isinstance(parent_name, str) and parent_name:
        parent_dir = task_dir.parent / parent_name
        if not parent_dir.is_dir():
            errors.append(f"parent task not found: {parent_name}")
        else:
            errors.extend(validate_child_archive_state(parent_dir, task_dir.name))
            if get_child_state(parent_dir, task_dir.name) == "integrated":
                errors.extend(_required_file_errors(task_dir, ["handoff.md"]))

    child_names = task_data.get("children")
    if isinstance(child_names, list) and child_names:
        errors.extend(
            validate_parent_children_complete(
                task_dir,
                [name for name in child_names if isinstance(name, str)],
            )
        )

    profile = task_closeout_profile(task_dir, task_data)
    contract: dict = {}
    required_gates: list[str] = []
    artifact_fingerprints: dict[str, str] = {}
    baseline_record = None

    if profile == "full":
        contract, contract_errors = read_strategy_contract(task_dir)
        errors.extend(contract_errors)
        if not contract_errors:
            required_gates = required_gates_for_transition(
                "full-task-complete", contract
            )
            errors.extend(
                validate_transition_readiness(
                    task_dir,
                    task_data,
                    "full-task-complete",
                    mode="complete",
                )
            )
    elif profile == "parent":
        errors.extend(
            validate_transition_readiness(
                task_dir,
                task_data,
                "parent-integrated",
                mode="complete",
            )
        )
        required_gates = required_gates_for_transition("parent-integrated", contract)

    contract_fingerprint = compute_contract_fingerprint(task_dir, task_data, contract)

    if profile == "full" and not errors:
        artifact_fingerprints[BASELINE_GATE] = compute_artifact_fingerprint(
            task_dir, task_data, "full-task-complete", BASELINE_GATE
        )
        for gate in required_gates:
            artifact_fingerprints[gate] = compute_artifact_fingerprint(
                task_dir, task_data, "full-task-complete", gate
            )
        baseline_record = make_baseline_record(
            task_dir, task_data, "full-task-complete", contract
        )

    return GateGuardResult(
        ok=not errors,
        errors=errors,
        contract_fingerprint=contract_fingerprint,
        artifact_fingerprints=artifact_fingerprints,
        required_gates=required_gates,
        baseline_record=baseline_record,
        is_full_task=profile == "full",
        closeout_profile=profile,
    )


def _verify_evidence_errors(task_dir: Path, task_data: dict) -> list[str]:
    """Validate human-readable archive evidence in verify.md."""
    verify_path = task_dir / "verify.md"
    if not verify_path.is_file():
        return []

    try:
        verify_path.read_text(encoding="utf-8")
    except OSError:
        return ["verify.md could not be read for archive evidence"]

    errors: list[str] = []
    status = verify_evidence_status(task_dir, task_data)
    if not status["validation"]:
        errors.append("verify.md missing validation evidence")
    if not status["acceptance"]:
        errors.append("verify.md missing final acceptance evidence")
    if not status["durable_learning"]:
        errors.append("verify.md missing durable-learning decision evidence")
    if not status["integration"]:
        errors.append("verify.md missing final integration evidence")

    return errors


def _is_substantive_evidence(value: str | None) -> bool:
    if not value or not isinstance(value, str):
        return False
    stripped = value.strip()
    if len(stripped) < 3:
        return False
    return not PLACEHOLDER_VALUES_RE.match(stripped)


def _has_substantive_line_match(content: str, pattern: re.Pattern[str]) -> bool:
    if not content:
        return False
    for match in pattern.finditer(content):
        if match.lastindex and match.lastindex >= 1:
            if _is_substantive_evidence(match.group(1)):
                return True
            continue
        line = match.group(0)
        if ":" in line:
            value = line.split(":", 1)[1].strip()
            if _is_substantive_evidence(value):
                return True
    return False


def _has_substantive_validation_evidence(content: str) -> bool:
    return _has_substantive_line_match(content, VALIDATION_EVIDENCE_RE)


def _has_substantive_check_evidence(content: str) -> bool:
    return _has_substantive_line_match(content, CHECK_EVIDENCE_RE)


def _has_substantive_acceptance_evidence(content: str) -> bool:
    return (
        _has_substantive_line_match(content, ACCEPTANCE_EVIDENCE_RE)
        or _has_substantive_line_match(content, ACCEPTED_BY_USER_RE)
    )


def _has_substantive_integration_evidence(content: str) -> bool:
    return _has_substantive_line_match(content, INTEGRATION_EVIDENCE_RE)


def _has_substantive_reviewed_change_set(content: str) -> bool:
    if not content:
        return False
    for match in REVIEWED_CHANGE_SET_RE.finditer(content):
        if _is_substantive_evidence(match.group(1)):
            return True
    return False


def _has_validation_evidence(content: str) -> bool:
    return _has_substantive_validation_evidence(content)


def _has_final_acceptance_evidence(content: str) -> bool:
    return _has_substantive_acceptance_evidence(content)


def _has_durable_learning_evidence(content: str) -> bool:
    return bool(
        NO_DURABLE_LEARNING_RE.search(content)
        or _has_substantive_line_match(content, DURABLE_LEARNING_EVIDENCE_RE)
    )


def durable_learning_decision_status(content: str) -> dict[str, bool]:
    """Return which durable-learning outcomes are signaled in verify.md text."""
    return {
        "no_durable_learning": bool(NO_DURABLE_LEARNING_RE.search(content)),
        "spec_update": bool(
            re.search(
                r"(?im)^\s*(?:[-*]\s*)?(?:spec\s+updates?|spec\s+update\s+"
                r"(?:needed|evidence)|updated\s+spec)\s*:\s*\S",
                content,
            )
        ),
        "learning_artifact": bool(
            re.search(
                r"(?im)^\s*(?:[-*]\s*)?(?:learning\s+artifact|retrospective(?:\.md)?)\s*:\s*\S",
                content,
            )
            or re.search(
                r"(?im)^\s*(?:[-*]\s*)?(?:durable\s+learning|learning\s+decision)\s*:\s*\S",
                content,
            )
        ),
        "any": _has_durable_learning_evidence(content),
    }


def suggest_spec_targets(repo_root: Path, task_dir: Path, task_data: dict) -> list[str]:
    """Suggest existing spec paths from task scope; does not invent new rules."""
    suggestions: list[str] = []
    spec_root = repo_root / ".trellis" / "spec"
    if not spec_root.is_dir():
        return suggestions

    package = task_data.get("package")
    if isinstance(package, str) and package.strip():
        pkg_index = spec_root / package.strip() / "index.md"
        if pkg_index.is_file():
            suggestions.append(f".trellis/spec/{package.strip()}/index.md")

    scope = task_data.get("scope")
    if isinstance(scope, str) and scope.strip():
        scope_parts = [p for p in scope.strip().replace("\\", "/").split("/") if p]
        scope_path = spec_root.joinpath(*scope_parts) if scope_parts else spec_root
        if scope_path.is_dir():
            index = scope_path / "index.md"
            if index.is_file():
                suggestions.append(
                    f".trellis/spec/{scope_path.relative_to(spec_root).as_posix()}/index.md"
                )

    guide_paths = (
        "guides/durable-learning-decision-guide.md",
        "guides/index.md",
    )
    for rel in guide_paths:
        path = spec_root / rel
        if path.is_file():
            suggestions.append(f".trellis/spec/{rel}")

    return _dedupe_preserve_order(suggestions)[:6]


def build_spec_update_scaffold(
    repo_root: Path,
    task_dir: Path,
    task_data: dict,
    *,
    trigger: str | None = None,
) -> str:
    """Markdown checklist for spec capture; user/reviewer must confirm before editing specs."""
    targets = suggest_spec_targets(repo_root, task_dir, task_data)
    rel_task = f".trellis/tasks/{task_dir.name}"
    lines = [
        "## Spec update scaffold (reviewer-confirmed)",
        "",
        "_Suggestions only — do not treat this block as project policy until a human confirms._",
        "",
    ]
    if trigger:
        lines.extend([f"Trigger: {trigger.strip()}", ""])
    lines.extend(
        [
            "1. Decide outcome in verify.md:",
            "   - Routine: `Durable learning decision: no durable learning`",
            "   - Reusable insight: `Spec update evidence: .trellis/spec/<path>` after edits",
            f"   - Already documented: `Learning artifact: {rel_task}/handoff.md`",
            "",
            "2. Use `/trellis:update-spec` or `/trellis:break-loop` for depth; never auto-write specs.",
            "",
        ]
    )
    if targets:
        lines.append("3. Existing spec indexes to consider (from task scope):")
        for target in targets:
            lines.append(f"   - `{target}`")
        lines.append("")
    else:
        lines.append(
            "3. Browse `.trellis/spec/<package-or-layer>/index.md` for the right code-spec file."
        )
        lines.append("")
    lines.append(
        "4. Re-run `python ./.trellis/scripts/task.py archive <task> --check` after verify.md is final."
    )
    lines.append("")
    return "\n".join(lines)


def _learning_decision_draft_lines(task_dir: Path, task_data: dict) -> list[str]:
    """Default durable-learning block for prepare-archive-evidence."""
    repo_root = task_dir.parent.parent.parent
    targets = suggest_spec_targets(repo_root, task_dir, task_data)
    target_hint = targets[0] if targets else ".trellis/spec/<layer>/index.md"
    return [
        "Durable learning decision: no durable learning for this task scope.",
        "",
        "# Replace the line above with ONE of these before archive:",
        f"# Spec update evidence: {target_hint}",
        f"# Learning artifact: .trellis/tasks/{task_dir.name}/handoff.md",
        "# Spec update needed: (brief reason) — then run /trellis:update-spec and point Spec update evidence at the edited file",
        "",
    ]


ARCHIVE_EVIDENCE_DRAFT_MARKER = "<!-- trellis:archive-evidence-draft -->"


def _verify_evidence_status(task_dir: Path, task_data: dict) -> dict[str, bool]:
    """Return which archive evidence sections are present in verify.md."""
    status = verify_evidence_status(task_dir, task_data)
    return {
        "validation": status["validation"],
        "acceptance": status["acceptance"],
        "durable_learning": status["durable_learning"],
        "integration": status["integration"],
    }


def archive_repair_hints(
    errors: list[str],
    task_dir: Path,
    task_data: dict,
    guard: GateGuardResult,
) -> list[str]:
    """Map archive validation errors to actionable next-step hints."""
    hints: list[str] = []
    task_ref = task_dir.name
    rel_task = f".trellis/tasks/{task_ref}"

    for error in errors:
        if error == "verify.md":
            hints.append(
                f"Create verify.md, then run: python ./.trellis/scripts/task.py "
                f"prepare-archive-evidence {rel_task}"
            )
            continue
        if error == "verify.md missing validation evidence":
            hints.append(
                "Add a grep-friendly line such as "
                "'Validation commands: <command> — <outcome>' to verify.md, "
                f"or run: python ./.trellis/scripts/task.py prepare-archive-evidence {rel_task}"
            )
            continue
        if error == "verify.md missing final acceptance evidence":
            hints.append(
                "Add 'Final acceptance evidence: <criteria met>' or "
                "'Accepted by user: <who/when>' to verify.md, "
                f"or run prepare-archive-evidence {rel_task}"
            )
            continue
        if error == "verify.md missing durable-learning decision evidence":
            hints.append(
                "Durable learning decision (pick one grep-friendly line in verify.md): "
                "'Durable learning decision: no durable learning' for routine work; "
                "'Spec update evidence: .trellis/spec/<path>' after /trellis:update-spec; "
                "'Learning artifact: <path>' when handoff/retrospective already captures the insight. "
                f"Or run: python ./.trellis/scripts/task.py prepare-archive-evidence {rel_task}"
            )
            continue
        if error == "verify.md missing final integration evidence":
            hints.append(
                "Parent tasks need 'Final integration evidence: <child handoffs / task-map>'. "
                f"Run prepare-archive-evidence {rel_task} to draft a section from task-map.md"
            )
            continue
        if error.startswith("missing gate record:"):
            _rest = error.split(":", 1)[1].strip()
            _transition, gate = _rest.split("/", 1)
            transition = _transition.strip()
            if transition == "parent-integrated":
                hints.append(
                    f"Parent archive needs record-gate for parent-integrated/{gate}: "
                    f"python ./.trellis/scripts/task.py record-gate {rel_task} "
                    f"--transition parent-integrated --gate {gate} --result PASS "
                    f"--reviewer parent --evidence task-map.md"
                )
            elif transition == "child-review":
                hints.append(
                    f"Full Child acceptance needs record-gate for child-review/{gate}: "
                    f"python ./.trellis/scripts/task.py record-gate {rel_task} "
                    f"--transition child-review --gate {gate} --result PASS "
                    f"--reviewer parent --evidence verify.md"
                )
            else:
                hints.append(
                    f"Record reviewer gate after explicit review (never auto-PASS): "
                    f"python ./.trellis/scripts/task.py record-gate {rel_task} "
                    f"--transition {transition} --gate {gate} --result PASS "
                    f"--reviewer <reviewer-id> --evidence verify.md"
                )
            continue
        if error == "verify.md missing check evidence":
            hints.append(
                "Add a grep-friendly line such as "
                "'Check evidence: <trellis-check summary or manual review notes>' to verify.md"
            )
            continue
        if error == (
            "verify.md or handoff.md missing reviewed change-set evidence"
        ):
            hints.append(
                "Add 'Reviewed change-set: <git ref or diff summary>' to verify.md or handoff.md"
            )
            continue
        if error == "verify.md missing substantive validation evidence":
            hints.append(
                "Replace placeholder validation lines with substantive command/outcome text in verify.md"
            )
            continue
        if error.startswith("gate failed:"):
            hints.append(
                "Resolve the FAIL gate (fix, re-review, or user-approved SKIPPED) "
                "before archive."
            )
            continue
        if error.startswith("stale "):
            hints.append(
                "Artifacts changed since the gate was recorded. Re-run review and "
                "record-gate for full-task-complete, then archive --check again."
            )
            continue
        if "child" in error and "integrated or cancelled" in error:
            hints.append(
                "Advance each child in parent task-map to integrated or cancelled "
                "via integrate-child before parent archive."
            )
            continue
        if error == "handoff.md" or error.startswith("handoff.md"):
            hints.append(
                "Integrated children require handoff.md on the child task before archive."
            )
            continue

    if not hints and not guard.ok:
        hints.append(
            f"Run: python ./.trellis/scripts/task.py prepare-archive-evidence {rel_task} "
            "then archive --check again."
        )

    if guard.is_full_task and guard.required_gates:
        missing_reviewer = any(
            e.startswith("missing gate record: full-task-complete/")
            for e in errors
        )
        if missing_reviewer and not any("record-gate" in h for h in hints):
            for gate in guard.required_gates:
                hints.append(
                    f"Full Task archive needs record-gate for full-task-complete/{gate} "
                    "(reviewer action required)."
                )

    return _dedupe_preserve_order(hints)


def _dedupe_preserve_order(items: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        if item in seen:
            continue
        seen.add(item)
        out.append(item)
    return out


def build_archive_evidence_draft(
    task_dir: Path,
    task_data: dict,
    guard: GateGuardResult | None = None,
) -> str:
    """Build markdown sections that satisfy archive evidence regex checks."""
    if guard is None:
        guard = validate_archive(task_dir, task_data)

    status = _verify_evidence_status(task_dir, task_data)
    child_names = task_data.get("children")
    has_children = isinstance(child_names, list) and bool(child_names)
    lines = [
        "",
        "## Archive evidence (draft)",
        "",
        ARCHIVE_EVIDENCE_DRAFT_MARKER,
        "",
        "_Auto-drafted by prepare-archive-evidence. Edit placeholders before archive._",
        "",
    ]

    if not status["validation"]:
        lines.extend(
            [
                "Validation commands: (fill in commands and outcomes, e.g. pnpm test — pass)",
                "",
            ]
        )
    if not status["acceptance"]:
        lines.extend(
            [
                "Final acceptance evidence: (describe acceptance criteria met for this task)",
                "",
            ]
        )
    if not status["durable_learning"]:
        lines.extend(_learning_decision_draft_lines(task_dir, task_data))
    if has_children and not status["integration"]:
        summary = _integration_draft_summary(task_dir, child_names)
        lines.extend(
            [
                f"Final integration evidence: {summary}",
                "",
            ]
        )

    if guard.is_full_task and guard.required_gates:
        rel_task = f".trellis/tasks/{task_dir.name}"
        lines.extend(
            [
                "## Completion gate preparation (not recorded)",
                "",
                "Reviewer gates are **not** recorded by this helper. After review, run:",
                "",
            ]
        )
        for gate in guard.required_gates:
            lines.append(
                f"- `python ./.trellis/scripts/task.py record-gate {rel_task} "
                f"--transition full-task-complete --gate {gate} --result PASS "
                f"--reviewer <reviewer-id> --evidence verify.md`"
            )
        lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def _integration_draft_summary(task_dir: Path, child_names: list) -> str:
    """Summarize child integration states for a parent integration evidence line."""
    names = [n for n in child_names if isinstance(n, str)]
    if not names:
        return "parent children integrated per task-map.md"

    data, _body = load_task_map(task_dir)
    states: list[str] = []
    if isinstance(data, dict):
        children = data.get("children")
        if isinstance(children, list):
            by_id = {
                entry.get("id"): entry.get("state")
                for entry in children
                if isinstance(entry, dict) and entry.get("id")
            }
            for name in names:
                state = by_id.get(name, "unknown")
                states.append(f"{name}={state}")

    if states:
        return "children " + ", ".join(states) + " per task-map.md"
    return "all structural children terminal in task-map.md before parent archive"


def prepare_archive_evidence(
    task_dir: Path,
    task_data: dict | None,
    *,
    dry_run: bool = False,
) -> tuple[bool, list[str]]:
    """
    Append missing archive evidence sections to verify.md without rewriting user text.

    Returns (changed, messages).
    """
    messages: list[str] = []
    if task_data is None:
        return False, ["task.json missing or invalid"]

    verify_path = task_dir / "verify.md"
    guard = validate_archive(task_dir, task_data)

    if verify_path.is_file():
        try:
            existing = verify_path.read_text(encoding="utf-8")
        except OSError:
            return False, ["verify.md could not be read"]
        if ARCHIVE_EVIDENCE_DRAFT_MARKER in existing:
            messages.append(
                "verify.md already contains an archive evidence draft block; "
                "edit it in place instead of re-running prepare."
            )
            still_missing = _verify_evidence_errors(task_dir, task_data)
            if not still_missing:
                return False, messages
            messages.append(
                "Some evidence is still missing after the draft block; "
                "fill placeholders or add lines outside the draft section."
            )
            return False, messages
        content = existing
    else:
        content = "# Verification Evidence\n"

    draft = build_archive_evidence_draft(task_dir, task_data, guard)
    status = _verify_evidence_status(task_dir, task_data)
    child_names = task_data.get("children")
    has_children = isinstance(child_names, list) and bool(child_names)
    needs_draft = (
        not status["validation"]
        or not status["acceptance"]
        or not status["durable_learning"]
        or (has_children and not status["integration"])
        or (guard.is_full_task and guard.required_gates)
    )
    if not needs_draft:
        messages.append("No missing archive evidence sections to draft.")
        return False, messages

    new_content = content.rstrip() + "\n" + draft
    if dry_run:
        messages.append("Dry run: would append archive evidence draft to verify.md")
        return True, messages

    try:
        verify_path.write_text(new_content, encoding="utf-8")
    except OSError as exc:
        return False, [f"failed to write verify.md: {exc}"]

    messages.append("Appended archive evidence draft to verify.md")
    remaining = _verify_evidence_errors(task_dir, task_data)
    gate_errors = [
        e
        for e in validate_archive(task_dir, task_data).errors
        if e.startswith("missing gate record:")
        or e.startswith("gate failed:")
        or e.startswith("stale ")
    ]
    if remaining:
        messages.append(
            "Still missing after draft (edit placeholders): " + "; ".join(remaining)
        )
    if gate_errors:
        messages.append(
            "Completion gates still require explicit record-gate: "
            + "; ".join(gate_errors)
        )
    return True, messages


def validate_reviewer_gate_input(
    transition: str,
    gate: str,
    result: str,
    reviewer: str,
    evidence: str,
    issue_fingerprint: str | None = None,
    issue_summary: str | None = None,
    root_cause: str | None = None,
    skip_approved_by: str | None = None,
    skip_reason: str | None = None,
) -> list[str]:
    """Validate CLI inputs for record-gate."""
    errors: list[str] = []

    if transition not in KNOWN_TRANSITIONS:
        errors.append(f"unknown transition: {transition}")
    if gate == BASELINE_GATE:
        errors.append("baseline-check is CLI-owned and cannot be recorded manually")
    elif gate not in REVIEW_GATES:
        errors.append(f"unknown gate: {gate}")
    if result not in RESULTS:
        errors.append(f"invalid result: {result}")
    if not _is_short_token(reviewer) or not REVIEWER_RE.match(reviewer):
        errors.append("reviewer must be a short identifier")
    if not _is_short_text(evidence):
        errors.append("evidence must be a short reference, not a review body")

    if result == "PASS":
        if issue_fingerprint:
            errors.append("--issue-fingerprint is only valid for FAIL")
        if root_cause:
            errors.append("--root-cause is only valid for FAIL")
        if skip_approved_by or skip_reason:
            errors.append("skip metadata is only valid for SKIPPED")
    elif result == "FAIL":
        if not _is_short_token(issue_fingerprint):
            errors.append("FAIL requires --issue-fingerprint")
        if root_cause not in FAIL_ROOT_CAUSES:
            errors.append(
                "FAIL requires --root-cause implementation-defect|contract-changing-defect|validation-environment-blocker"
            )
        if issue_summary and not _is_short_text(issue_summary, MAX_REASON):
            errors.append("--issue-summary must be short and single-line")
        if skip_approved_by or skip_reason:
            errors.append("skip metadata is only valid for SKIPPED")
    elif result == "SKIPPED":
        if issue_fingerprint or issue_summary or root_cause:
            errors.append("issue metadata is only valid for FAIL")
        if skip_approved_by != "user":
            errors.append("SKIPPED requires --skip-approved-by user")
        if not _is_short_text(skip_reason, MAX_REASON):
            errors.append("SKIPPED requires --skip-reason")

    return errors


def _route_for_fail_root_cause(root_cause: str | None) -> str | None:
    if root_cause is None:
        return None
    return FAIL_ROOT_CAUSES.get(root_cause)


def _validate_quality_gates(
    gates: dict,
    verification_profile: str | None,
) -> list[str]:
    errors: list[str] = []
    mode = gates.get("mode")
    if mode not in ALLOWED_GATE_MODES:
        errors.append("quality_gates.mode must be profile or explicit")

    profile = gates.get("profile")
    if profile and profile not in ALLOWED_VERIFICATION_PROFILES:
        errors.append(f"invalid quality_gates.profile: {profile}")

    enabled = gates.get("enabled", [])
    disabled = gates.get("disabled", [])
    if enabled is None:
        enabled = []
    if disabled is None:
        disabled = []

    if mode == "explicit":
        if not isinstance(enabled, list):
            errors.append("quality_gates.enabled must be a list in explicit mode")
        if not isinstance(disabled, list):
            errors.append("quality_gates.disabled must be a list in explicit mode")

    all_configured = []
    if isinstance(enabled, list):
        all_configured.extend(enabled)
    if isinstance(disabled, list):
        all_configured.extend(disabled)

    for gate in all_configured:
        if gate not in KNOWN_GATES:
            errors.append(f"unknown quality gate: {gate}")

    if BASELINE_GATE in disabled:
        errors.append("baseline-check cannot be disabled")

    active = set(enabled) if mode == "explicit" else set(
        PROFILE_DEFAULT_GATES.get(
            profile or verification_profile or "standard",
            PROFILE_DEFAULT_GATES["standard"],
        )
    )
    if "architecture-deep-review" in active and "architecture-review" not in active:
        errors.append("architecture-deep-review requires architecture-review")

    return errors


def _parse_inline_list(value: str) -> list[str] | str:
    value = value.strip()
    if value.startswith("[") and value.endswith("]"):
        inner = value[1:-1].strip()
        if not inner:
            return []
        return [
            item.strip().strip("'\"")
            for item in inner.split(",")
            if item.strip()
        ]
    return value


def _hash_payload(payload: dict) -> str:
    body = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    digest = hashlib.sha256(body.encode("utf-8")).hexdigest()
    return f"sha256:{digest}"


def _stable_task_data(task_data: dict) -> dict:
    stable: dict = {}
    for key in STABLE_TASK_KEYS:
        if key in task_data:
            stable[key] = task_data.get(key)
    return stable


def _parent_contract_metadata(
    task_dir: Path,
    task_data: dict,
    transition: str,
) -> dict | None:
    if transition == "child-review":
        parent_name = task_data.get("parent")
        if not isinstance(parent_name, str) or not parent_name:
            return None
        parent_dir = task_dir.parent / parent_name
        data, _ = load_task_map(parent_dir)
        return _task_map_contract_metadata("child", parent_dir, data)

    if transition.startswith("parent-"):
        data, _ = load_task_map(task_dir)
        return _task_map_contract_metadata("parent", task_dir, data)

    return None


def _task_map_contract_metadata(
    role: str,
    parent_dir: Path,
    task_map_data: dict | None,
) -> dict:
    return {
        "role": role,
        "parent": parent_dir.name,
        "task_map_found": task_map_data is not None,
        "contract_epoch": (
            task_map_data.get("contract_epoch")
            if isinstance(task_map_data, dict)
            else None
        ),
    }


def _reviewed_change_set_metadata(
    task_dir: Path,
    transition: str,
) -> dict | None:
    evidence_files = _change_set_evidence_files_for(transition)
    if not evidence_files:
        return None

    files = []
    for name in evidence_files:
        path = task_dir / name
        try:
            content = path.read_text(encoding="utf-8") if path.is_file() else ""
        except OSError:
            content = ""
        files.append(
            {
                "path": name,
                "present": path.is_file(),
                "entries": _extract_reviewed_change_set_entries(content),
            }
        )
    return {"files": files}


def _change_set_evidence_files_for(transition: str) -> list[str]:
    if transition == "full-task-complete":
        return ["verify.md"]
    if transition == "child-review":
        return ["verify.md", "handoff.md"]
    if transition.startswith("parent-"):
        return ["task-map.md", "verify.md"]
    return []


def _extract_reviewed_change_set_entries(content: str) -> list[str]:
    return [
        match.group(1).strip()
        for match in REVIEWED_CHANGE_SET_RE.finditer(content)
    ]


def _only_missing_gate_record(errors: list[str]) -> bool:
    return bool(errors) and all(
        error.startswith("missing gate record:") for error in errors
    )


def make_planning_review_gate_record(
    task_dir: Path,
    task_data: dict,
    transition: str,
    gate: str,
    contract: dict,
    contract_fingerprint: str,
    artifact_fingerprint: str,
) -> dict:
    """Build a CLI-owned PASS record when planning artifacts satisfy the gate."""
    _ = task_dir, task_data, contract
    evidence_by_gate = {
        "requirements-review": "prd.md",
        "architecture-review": "design.md+implement.md",
    }
    return {
        "schema_version": SCHEMA_VERSION,
        "transition": transition,
        "gate": gate,
        "result": "PASS",
        "reviewer": AUTO_PLANNING_REVIEWER,
        "evidence": evidence_by_gate.get(gate, "planning-artifacts"),
        "checked_at": utc_now(),
        "contract_fingerprint": contract_fingerprint,
        "artifact_fingerprint": artifact_fingerprint,
        "issue_fingerprint": None,
        "root_cause": None,
        "route": None,
        "consecutive_failures": 0,
        "required_user_choice": None,
        "approved_skip": None,
        "auto_recorded": True,
        "auto_record_reason": "planning-artifacts",
    }


def _start_execution_planning_gate_readiness_errors(
    task_dir: Path,
    gate: str,
    *,
    full_task: bool,
    contract: dict,
) -> list[str]:
    if gate == "requirements-review":
        return _prd_requirements_review_errors(task_dir)
    if gate == "architecture-review":
        errors = _required_file_errors(task_dir, ["design.md", "implement.md"])
        if not full_task:
            errors.append(
                "architecture-review requires design.md and implement.md (Full Task)"
            )
        errors.extend(validate_strategy_contract(contract))
        return errors
    return [f"planning gate readiness check unsupported: {gate}"]


def _prd_requirements_review_errors(task_dir: Path) -> list[str]:
    path = task_dir / "prd.md"
    if not path.is_file():
        return ["prd.md missing for requirements-review"]
    try:
        content = path.read_text(encoding="utf-8")
    except OSError:
        return ["prd.md could not be read for requirements-review"]
    if not content.strip():
        return ["prd.md is empty (requirements-review)"]
    if not PRD_ACCEPTANCE_CRITERIA_HEADING_RE.search(content):
        return [
            "prd.md missing Acceptance Criteria heading (complete PRD Grill before start-execution)"
        ]
    criteria: list[str] = []
    for match in PRD_ACCEPTANCE_ITEM_RE.finditer(content):
        text = match.group(1).strip()
        if text and not PRD_PLACEHOLDER_RE.match(text):
            criteria.append(text)
    if not criteria:
        return [
            "prd.md needs at least one non-placeholder Acceptance Criteria item (replace TBD checkboxes)"
        ]
    return []


def start_execution_repair_hints(
    errors: list[str],
    task_dir: Path,
) -> list[str]:
    """Map start-execution validation errors to actionable planning hints."""
    hints: list[str] = []
    rel_task = f".trellis/tasks/{task_dir.name}"
    for error in errors:
        if error.startswith("missing gate record:"):
            _rest = error.split(":", 1)[1].strip()
            _transition, gate = _rest.split("/", 1)
            if gate in START_EXECUTION_AUTO_GATES:
                hints.append(
                    "Complete planning artifacts so Trellis can auto-record this gate on "
                    f"`start-execution --approved` (requirements: prd.md Acceptance Criteria; "
                    "architecture: design.md + valid implement.md contract)."
                )
            else:
                hints.append(
                    f"python ./.trellis/scripts/task.py record-gate {rel_task} "
                    f"--transition start-execution --gate {gate} --result PASS "
                    f"--reviewer <reviewer-id> --evidence verify.md"
                )
            continue
        if "Acceptance Criteria" in error or "TBD" in error:
            hints.append(
                "Finish PRD Grill in trellis-brainstorm: fill Goal, Acceptance Criteria "
                "(non-TBD checkboxes), then re-run start-execution --check."
            )
            continue
        if "Development Strategy Contract" in error or error.startswith("invalid "):
            hints.append(
                "Fix the Development Strategy Contract block in implement.md "
                "(execution_mode, isolation, verification_profile, quality_gates)."
            )
            continue
        if error == "design.md and implement.md must be present together for Full Tasks":
            hints.append(
                "Add both design.md and implement.md for Full Tasks, or stay PRD-only for Lite."
            )
    return _dedupe_preserve_order(hints)


def _artifact_files_for(transition: str, gate: str) -> list[str]:
    if transition == "start-execution":
        return ["prd.md", "design.md", "implement.md"]
    if transition == "full-task-complete":
        return ["prd.md", "design.md", "implement.md", "verify.md"]
    if transition == "child-review":
        return ["prd.md", "design.md", "implement.md", "verify.md", "handoff.md"]
    if transition in ("parent-accepted", "parent-integrated"):
        return ["task-map.md", "verify.md"]
    _ = gate
    return ["prd.md", "verify.md"]


def _read_artifact_files(task_dir: Path, names: list[str]) -> list[dict]:
    files = []
    for name in names:
        path = task_dir / name
        try:
            content = path.read_text(encoding="utf-8") if path.is_file() else None
        except OSError:
            content = None
        files.append({"path": name, "content": content})
    return files


def _required_file_errors(task_dir: Path, names: list[str]) -> list[str]:
    errors = []
    for name in names:
        path = task_dir / name
        if not path.is_file():
            errors.append(name)
            continue
        try:
            if not path.read_text(encoding="utf-8").strip():
                errors.append(f"{name} is empty")
        except OSError:
            errors.append(f"{name} could not be read")
    return errors


def _get_gate_record(task_data: dict, transition: str, gate: str) -> dict | None:
    qgr = task_data.get("quality_gate_results")
    if not isinstance(qgr, dict):
        return None
    transitions = qgr.get("transitions")
    if not isinstance(transitions, dict):
        return None
    transition_records = transitions.get(transition)
    if not isinstance(transition_records, dict):
        return None
    record = transition_records.get(gate)
    return record if isinstance(record, dict) else None


def _validate_gate_record_for_transition(
    task_data: dict,
    transition: str,
    gate: str,
    contract_fingerprint: str,
    artifact_fingerprint: str,
) -> list[str]:
    errors: list[str] = []
    record = _get_gate_record(task_data, transition, gate)
    if record is None:
        errors.append(f"missing gate record: {transition}/{gate}")
        return errors

    result = record.get("result")
    if result == "FAIL":
        errors.append(f"gate failed: {transition}/{gate}")
        return errors
    if result not in ("PASS", "SKIPPED"):
        errors.append(f"gate record has invalid result: {transition}/{gate}")
        return errors
    if record.get("contract_fingerprint") != contract_fingerprint:
        errors.append(f"stale contract fingerprint: {transition}/{gate}")
    if record.get("artifact_fingerprint") != artifact_fingerprint:
        errors.append(f"stale artifact fingerprint: {transition}/{gate}")
    if result == "SKIPPED":
        approved_skip = record.get("approved_skip")
        if not isinstance(approved_skip, dict):
            errors.append(f"SKIPPED gate lacks approval metadata: {transition}/{gate}")
        elif approved_skip.get("approved_by") != "user" or not approved_skip.get("reason"):
            errors.append(f"invalid SKIPPED approval metadata: {transition}/{gate}")
    return errors


def _next_consecutive_failures(
    previous: dict | None,
    issue_fingerprint: str | None,
) -> int:
    if not previous or previous.get("result") != "FAIL":
        return 1
    if previous.get("issue_fingerprint") != issue_fingerprint:
        return 1
    previous_count = previous.get("consecutive_failures")
    return int(previous_count) + 1 if isinstance(previous_count, int) else 2


def _is_short_token(value: str | None, max_len: int = MAX_SHORT_FIELD) -> bool:
    if not value or not isinstance(value, str):
        return False
    if len(value) > max_len:
        return False
    if any(ch.isspace() for ch in value):
        return False
    return True


def _is_short_text(value: str | None, max_len: int = MAX_SHORT_FIELD) -> bool:
    if not value or not isinstance(value, str):
        return False
    if len(value) > max_len:
        return False
    if "\n" in value or "\r" in value:
        return False
    return True
