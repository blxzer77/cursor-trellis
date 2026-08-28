"""Stage 4 Full Quality helpers (controls, AC ledger, graded Independent Check).

Python projection of the Kernel Full Quality contract. Kernel remains the
writer; these helpers validate extras before archive and prefer persisted
required_controls over inferring Rigor from files.
"""

from __future__ import annotations

import hashlib
import re
from pathlib import Path
from typing import Any

FULL_QUALITY_SOURCE = "full-quality-contract"
FULL_QUALITY_SCHEMA_VERSION = 1
FULL_BASELINE_CONTROLS = (
    "definition",
    "execution-contract",
    "verification-plan",
    "evidence",
    "independent-check",
)
DEFAULT_CONTROL_SURFACES = {
    "definition": "prd.md",
    "execution-contract": "implement.md",
    "verification-plan": "implement.md",
    "evidence": "verify.md",
    "design": "design.md",
}
DESIGN_RISK_SIGNALS = {
    "architecture",
    "public-contract",
    "schema",
    "security",
    "secret",
    "framework-semantics",
    "runtime-semantics",
}
PLACEHOLDER_VALUE_RE = re.compile(
    r"(?i)^(TBD|TODO|待定|待补充|N/?A|NA|NONE|-|\.\.\.)$"
)
AC_ITEM_RE = re.compile(r"(?im)^\s*-\s*\[[ xX]\]\s+(.+)$")


class FullQualityError(RuntimeError):
    """Full Quality contract rejected a start/close request."""


def quality_fingerprint(payload: str) -> str:
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()
    return f"sha256:{digest}"


def resolve_required_controls(
    *,
    rigor: str = "lite",
    verification_profile: str | None = None,
    risk_signals: list[str] | None = None,
    policy_requires_design: bool = False,
    explicit_controls: list[str] | None = None,
    surfaces: dict[str, str] | None = None,
) -> dict[str, Any]:
    normalized = "full" if rigor == "full" else "lite"
    signals = [str(item).strip().lower() for item in (risk_signals or []) if item]
    design_required = normalized == "full" and (
        policy_requires_design
        or verification_profile == "architecture"
        or any(signal in DESIGN_RISK_SIGNALS for signal in signals)
    )
    if explicit_controls:
        controls = _unique(explicit_controls)
    elif normalized == "full":
        controls = list(FULL_BASELINE_CONTROLS)
        if design_required:
            controls.append("design")
    else:
        controls = ["definition", "evidence"]
    if design_required and "design" not in controls:
        controls.append("design")
    return {
        "schema_version": FULL_QUALITY_SCHEMA_VERSION,
        "source": FULL_QUALITY_SOURCE,
        "rigor": normalized,
        "controls": controls,
        "surfaces": {**DEFAULT_CONTROL_SURFACES, **(surfaces or {})},
        "resolved_from": {
            "verification_profile": verification_profile,
            "risk_signals": signals,
            "policy_requires_design": policy_requires_design,
        },
    }


def rigor_from_required_controls(task_data: dict | None) -> str | None:
    extras = task_data or {}
    bundle = extras.get("required_controls")
    if not isinstance(bundle, dict):
        return None
    rigor = bundle.get("rigor")
    if rigor in ("lite", "full"):
        return rigor
    return None


def parse_acceptance_items(prd_text: str) -> list[dict[str, str]]:
    items: list[dict[str, str]] = []
    index = 0
    for match in AC_ITEM_RE.finditer(prd_text):
        statement = match.group(1).strip()
        if not statement or PLACEHOLDER_VALUE_RE.match(statement):
            continue
        index += 1
        items.append({"id": f"AC-{index}", "statement": statement})
    return items


def evaluate_independent_check(
    *,
    mode: str,
    independent_worker_available: bool,
    evidence: str,
    code_fingerprint: str,
    attempted_writes: bool = False,
) -> dict[str, Any]:
    if attempted_writes:
        raise FullQualityError("Independent Check is read-only; repairs return to Execute")
    if mode not in ("self-review", "true-independent"):
        raise FullQualityError("Independent Check mode must be self-review or true-independent")
    if mode == "true-independent" and not independent_worker_available:
        return {
            "schema_version": FULL_QUALITY_SCHEMA_VERSION,
            "mode": "true-independent",
            "readonly": True,
            "result": "BLOCKED",
            "evidence": evidence.strip(),
            "independent_worker": False,
            "code_fingerprint": code_fingerprint,
        }
    if not evidence.strip() or PLACEHOLDER_VALUE_RE.match(evidence.strip()):
        raise FullQualityError(
            "Independent Check PASS/FAIL requires non-empty evidence (no fake-green)"
        )
    return {
        "schema_version": FULL_QUALITY_SCHEMA_VERSION,
        "mode": mode,
        "readonly": True,
        "result": "PASS",
        "evidence": evidence.strip(),
        "independent_worker": independent_worker_available,
        "code_fingerprint": code_fingerprint,
    }


def full_quality_archive_errors(task_dir: Path, task_data: dict | None) -> list[str]:
    """Return archive errors for persisted Full required_controls only.

    Lite and legacy file-heuristic Full are unchanged: this does not force
    Independent Check onto Lite.
    """
    data = task_data or {}
    bundle = data.get("required_controls")
    if not isinstance(bundle, dict) or bundle.get("rigor") != "full":
        return []
    errors: list[str] = []
    controls = bundle.get("controls")
    if not isinstance(controls, list):
        controls = list(FULL_BASELINE_CONTROLS)
    surfaces = bundle.get("surfaces") if isinstance(bundle.get("surfaces"), dict) else {}
    seen: set[str] = set()
    for control in controls:
        if control in ("independent-check",):
            continue
        relative = surfaces.get(control) or DEFAULT_CONTROL_SURFACES.get(control)
        if not relative or relative in seen:
            continue
        seen.add(relative)
        path = task_dir / relative
        if not path.is_file() or not path.read_text(encoding="utf-8").strip():
            errors.append(f"Full required control {control} missing surface {relative}")

    ledger = data.get("ac_evidence_ledger")
    if not isinstance(ledger, dict):
        errors.append("Full Close requires a machine-readable AC → Evidence ledger")
    else:
        definition = surfaces.get("definition") or DEFAULT_CONTROL_SURFACES["definition"]
        prd_path = task_dir / definition
        prd_text = prd_path.read_text(encoding="utf-8") if prd_path.is_file() else ""
        acceptance = parse_acceptance_items(prd_text)
        mapped = {
            item.get("ac_id"): item
            for item in ledger.get("items", [])
            if isinstance(item, dict)
        }
        if not acceptance:
            errors.append(f"{definition} has no Acceptance Criteria items to map")
        for item in acceptance:
            mapping = mapped.get(item["id"])
            ref = mapping.get("evidence_ref") if isinstance(mapping, dict) else ""
            if not isinstance(ref, str) or not ref.strip() or PLACEHOLDER_VALUE_RE.match(ref.strip()):
                errors.append(f"AC → Evidence ledger missing mapping for {item['id']}")
        current_source = quality_fingerprint(prd_text)
        if ledger.get("source_fingerprint") and ledger.get("source_fingerprint") != current_source:
            errors.append("AC → Evidence ledger is stale after Definition/code change")

    check = data.get("independent_check")
    if not isinstance(check, dict):
        errors.append("Full Close requires a graded Independent Check verdict")
    else:
        if check.get("readonly") is False:
            errors.append("Independent Check is read-only; repairs return to Execute")
        mode = check.get("mode") or check.get("assurance")
        if mode == "true-independent" and check.get("independent_worker") is not True:
            errors.append("true-independent Check cannot be satisfied without an independent worker")
        if check.get("result") != "PASS":
            errors.append("Full Close requires Independent Check result PASS")
        evidence = check.get("evidence")
        if not isinstance(evidence, str) or not evidence.strip():
            errors.append("Independent Check PASS requires non-empty evidence (no fake-green)")
        ledger = data.get("ac_evidence_ledger")
        if (
            isinstance(ledger, dict)
            and isinstance(ledger.get("tested_code_fingerprint"), str)
            and isinstance(check.get("code_fingerprint"), str)
            and check.get("code_fingerprint") != ledger.get("tested_code_fingerprint")
        ):
            errors.append("Independent Check verdict is stale after code change")
    return errors


def _unique(values: list[str]) -> list[str]:
    out: list[str] = []
    for value in values:
        item = value.strip()
        if item and item not in out:
            out.append(item)
    return out
