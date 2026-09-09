#!/usr/bin/env python3
"""
Router Copy Sync Guard — verify that codebase retrieval router copies stay
consistent across TS source, CLI template Python, and workspace dogfood
Python.

Invariant strategy:
  1. Byte-identical hash for Python copies (workspace ↔ CLI template).
     Rationale: both are the same language and should be exact copies;
     structural drift is caught trivially.
  2. Golden-route behavior smoke for TS ↔ Python equivalence.
     Rationale: TS and Python differ by language so byte-comparison is
     inappropriate; behavior-level fixtures confirm semantic parity.

Eval .cstl copies are NOT checked here (cross-repo CI is out of scope).
See verify.md for manual smoke steps.

Usage:
  python scripts/check_router_copy_sync.py           # from Trellis repo root
  python scripts/check_router_copy_sync.py --json     # machine-readable output
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

TRELLIS_ROOT = Path(__file__).resolve().parent.parent

TS_ROUTER = TRELLIS_ROOT / "packages" / "cli" / "src" / "utils" / "codebase-retrieval-router.ts"
CLI_TEMPLATE_PY = (
    TRELLIS_ROOT
    / "packages"
    / "cli"
    / "src"
    / "templates"
    / "trellis"
    / "scripts"
    / "common"
    / "codebase_retrieval_router.py"
)
WORKSPACE_PY = (
    TRELLIS_ROOT
    / ".cstl"
    / "scripts"
    / "common"
    / "codebase_retrieval_router.py"
)

WORKSPACE_LAUNCHER = TRELLIS_ROOT / ".cstl" / "scripts" / "route_codebase_retrieval.py"
CLI_TEMPLATE_LAUNCHER = (
    TRELLIS_ROOT
    / "packages"
    / "cli"
    / "src"
    / "templates"
    / "trellis"
    / "scripts"
    / "route_codebase_retrieval.py"
)
L1_GOLDEN_JSON = (
    TRELLIS_ROOT
    / "packages"
    / "cli"
    / "test"
    / "fixtures"
    / "retrieval-router-l1"
    / "cases.json"
)
EVIDENCE_GOLDEN_JSON = (
    TRELLIS_ROOT
    / "packages"
    / "cli"
    / "test"
    / "fixtures"
    / "retrieval-v3"
    / "evidence-cases.json"
)


@dataclass
class CheckResult:
    name: str
    passed: bool
    detail: str = ""


@dataclass
class SyncReport:
    checks: list[CheckResult] = field(default_factory=list)

    @property
    def all_passed(self) -> bool:
        return all(c.passed for c in self.checks)


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def check_python_hash(report: SyncReport) -> None:
    """Check 1: workspace .trellis Python ↔ CLI template Python byte-identical."""
    if not WORKSPACE_PY.is_file():
        report.checks.append(
            CheckResult(
                "python-hash",
                False,
                f"Workspace copy missing: {WORKSPACE_PY}",
            )
        )
        return
    if not CLI_TEMPLATE_PY.is_file():
        report.checks.append(
            CheckResult(
                "python-hash",
                False,
                f"CLI template copy missing: {CLI_TEMPLATE_PY}",
            )
        )
        return

    ws_hash = file_sha256(WORKSPACE_PY)
    tpl_hash = file_sha256(CLI_TEMPLATE_PY)
    passed = ws_hash == tpl_hash
    detail = (
        "byte-identical"
        if passed
        else f"DRIFT: workspace={ws_hash[:16]}… template={tpl_hash[:16]}… — "
        f"sync workspace from template:\n"
        f"  Copy-Item '{CLI_TEMPLATE_PY}' '{WORKSPACE_PY}' -Force"
    )
    report.checks.append(CheckResult("python-hash", passed, detail))


def check_launcher_hash(report: SyncReport) -> None:
    """Check 2: workspace launcher ↔ CLI template launcher byte-identical."""
    if not WORKSPACE_LAUNCHER.is_file() or not CLI_TEMPLATE_LAUNCHER.is_file():
        report.checks.append(
            CheckResult(
                "launcher-hash",
                False,
                "Launcher script missing in one or both locations.",
            )
        )
        return

    ws_hash = file_sha256(WORKSPACE_LAUNCHER)
    tpl_hash = file_sha256(CLI_TEMPLATE_LAUNCHER)
    passed = ws_hash == tpl_hash
    detail = (
        "byte-identical"
        if passed
        else f"DRIFT: workspace={ws_hash[:16]}… template={tpl_hash[:16]}… — "
        f"sync:\n  Copy-Item '{CLI_TEMPLATE_LAUNCHER}' '{WORKSPACE_LAUNCHER}' -Force"
    )
    report.checks.append(CheckResult("launcher-hash", passed, detail))


# ---------------------------------------------------------------------------
# Golden route smoke fixtures (O1 / O2 / O3)
# ---------------------------------------------------------------------------

def load_l1_golden_cases() -> list[dict[str, Any]]:
    """Load shared L1 golden cases (same file Vitest consumes)."""
    if not L1_GOLDEN_JSON.is_file():
        return []
    payload = json.loads(L1_GOLDEN_JSON.read_text(encoding="utf-8"))
    cases = payload.get("cases", [])
    if not isinstance(cases, list):
        return []
    return [c for c in cases if isinstance(c, dict)]


def golden_fixtures() -> list[dict[str, Any]]:
    """Normalize L1 JSON cases into sync-script fixture shape."""
    fixtures: list[dict[str, Any]] = []
    for case in load_l1_golden_cases():
        case_id = str(case.get("id", "unknown"))
        query = case.get("query")
        if not isinstance(query, str) or not query.strip():
            continue
        fixtures.append(
            {
                "label": case_id,
                "query": query,
                "expectedIntents": case.get("expectedIntents", []),
                "expectedStopCodes": case.get("expectedStopCodes", []),
            }
        )
    return fixtures


def run_ts_router(query: str) -> dict[str, Any] | None:
    """Run the TS router via the built CLI dist and return the plan envelope."""
    dist_path = TRELLIS_ROOT / "packages" / "cli" / "dist" / "utils" / "codebase-retrieval-router.js"
    if not dist_path.is_file():
        return None
    input_obj: dict[str, Any] = {"query": query}
    wrapper = f"""
import {{ routeCodebaseRetrieval }} from "./packages/cli/dist/utils/codebase-retrieval-router.js";
const plan = routeCodebaseRetrieval({json.dumps(input_obj)});
console.log(JSON.stringify(plan));
"""
    try:
        result = subprocess.run(
            ["node", "--input-type=module", "-e", wrapper],
            capture_output=True,
            text=True,
            cwd=str(TRELLIS_ROOT),
            timeout=30,
        )
        if result.returncode != 0:
            return None
        return json.loads(result.stdout)
    except Exception:
        return None


def run_py_router(query: str) -> dict[str, Any] | None:
    """Run the Python router (workspace copy) and return the plan envelope."""
    if not WORKSPACE_PY.is_file():
        return None
    # Package import: common.* lives under .cstl/scripts/
    scripts_root = WORKSPACE_PY.parent.parent
    script = (
        "import json, sys; "
        f"sys.path.insert(0, r'{scripts_root}'); "
        "from common.codebase_retrieval_router import route_codebase_retrieval; "
        f"print(json.dumps(route_codebase_retrieval({json.dumps(query)}), ensure_ascii=False))"
    )
    python_cmds = ["python", "python3"] if sys.platform == "win32" else ["python3", "python"]
    for cmd in python_cmds:
        try:
            result = subprocess.run(
                [cmd, "-c", script],
                capture_output=True,
                text=True,
                timeout=15,
            )
            if result.returncode == 0:
                return json.loads(result.stdout)
        except Exception:
            continue
    return None


def assert_fixture(
    envelope: dict[str, Any], fixture: dict[str, Any]
) -> list[str]:
    """Check L1 expect block against one envelope; returns list of failures."""
    failures: list[str] = []
    label = fixture["label"]
    intent_ids = envelope.get("intents", [])
    expected_intents = fixture.get("expectedIntents", [])
    if intent_ids != expected_intents:
        failures.append(
            f"[{label}] intents: expected {expected_intents}, got {intent_ids}"
        )
    stop_codes = [reason.get("code") for reason in envelope.get("stopReasons", [])]
    expected_stops = fixture.get("expectedStopCodes", [])
    if stop_codes != expected_stops:
        failures.append(
            f"[{label}] stop reasons: expected {expected_stops}, got {stop_codes}"
        )
    if envelope.get("schemaVersion") != 3:
        failures.append(f"[{label}] schemaVersion must equal 3")
    return failures


def check_ts_golden(report: SyncReport) -> None:
    """Check 3: TS L1 golden route behavior."""
    fixtures = golden_fixtures()
    if not fixtures:
        report.checks.append(
            CheckResult("ts-golden-smoke", False, f"L1 golden missing: {L1_GOLDEN_JSON}")
        )
        return
    all_failures: list[str] = []
    for fixture in fixtures:
        envelope = run_ts_router(fixture["query"])
        if envelope is None:
            all_failures.append(f"[{fixture['label']}] TS router execution failed")
            continue
        all_failures.extend(assert_fixture(envelope, fixture))

    passed = len(all_failures) == 0
    detail = (
        f"all {len(fixtures)} L1 fixtures passed"
        if passed
        else "\n".join(all_failures)
    )
    report.checks.append(CheckResult("ts-golden-smoke", passed, detail))


def check_py_golden(report: SyncReport) -> None:
    """Check 4: Python L1 golden route behavior."""
    fixtures = golden_fixtures()
    if not fixtures:
        report.checks.append(
            CheckResult("py-golden-smoke", False, f"L1 golden missing: {L1_GOLDEN_JSON}")
        )
        return
    all_failures: list[str] = []
    for fixture in fixtures:
        envelope = run_py_router(fixture["query"])
        if envelope is None:
            all_failures.append(f"[{fixture['label']}] Python router execution failed")
            continue
        all_failures.extend(assert_fixture(envelope, fixture))

    passed = len(all_failures) == 0
    detail = (
        f"all {len(fixtures)} L1 fixtures passed"
        if passed
        else "\n".join(all_failures)
    )
    report.checks.append(CheckResult("py-golden-smoke", passed, detail))


def check_ts_py_parity(report: SyncReport) -> None:
    """Check 5: TS and Python envelopes agree on the complete V3 plan."""
    fixtures = golden_fixtures()
    all_failures: list[str] = []
    for fixture in fixtures:
        ts_env = run_ts_router(fixture["query"])
        py_env = run_py_router(fixture["query"])
        if ts_env is None or py_env is None:
            all_failures.append(
                f"[{fixture['label']}] parity: one or both routers failed to execute"
            )
            continue
        if ts_env != py_env:
            all_failures.append(
                f"[{fixture['label']}] parity: complete TS/Python plans differ"
            )
    passed = len(all_failures) == 0
    detail = "TS/Python full-plan parity confirmed" if passed else "\n".join(all_failures)
    report.checks.append(CheckResult("ts-py-full-plan-parity", passed, detail))


def load_evidence_golden_cases() -> list[dict[str, Any]]:
    """Load the shared V3 evidence ABI corpus used by Vitest and this guard."""
    if not EVIDENCE_GOLDEN_JSON.is_file():
        return []
    payload = json.loads(EVIDENCE_GOLDEN_JSON.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        return []
    return [case for case in payload if isinstance(case, dict)]


def run_ts_evidence_fixture(
    fixture: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]] | None:
    """Build and assess a corpus item through the compiled TS ABI."""
    dist_path = (
        TRELLIS_ROOT
        / "packages"
        / "cli"
        / "dist"
        / "pactile"
        / "retrieval"
        / "index.js"
    )
    if not dist_path.is_file():
        return None
    wrapper = """
import { readFileSync } from "node:fs";
import {
  assessRetrievalClaimV3,
  buildRetrievalRequestV3,
  createRetrievalPlanV3,
} from "./packages/cli/dist/pactile/retrieval/index.js";
const fixture = JSON.parse(readFileSync(0, "utf8"));
const plan = createRetrievalPlanV3(
  buildRetrievalRequestV3({
    query: `shared evidence fixture ${fixture.planIntent}`,
    intents: [fixture.planIntent],
    minimumAssurance: fixture.minimumAssurance,
    requiredEvidenceKinds: fixture.requiredEvidenceKinds,
  }),
  fixture.planIntent === "exact"
    ? {}
    : { providerAvailability: [{
        intent: fixture.planIntent,
        status: "ready",
        readiness: "ready",
      }] },
);
const verified = plan.minimumAssurance === "verified";
const input = {
  plan,
  intent: fixture.inputIntent ?? fixture.planIntent,
  candidateRefs: fixture.candidateRefs,
  corroboration: fixture.corroboration,
};
if (fixture.resolution === "valid" && fixture.planIntent !== "exact") {
  input.resolution = {
    schemaVersion: 1,
    intent: fixture.planIntent,
    minimumAssurance: plan.minimumAssurance,
    origin: "provider",
    providerId: "fixture.provider",
    providerVersion: "1.0.0",
    assurance: plan.minimumAssurance,
    readiness: "ready",
    requestedPolicy: plan.requestedPolicy,
    effectivePolicy: plan.requestedPolicy,
    evidenceRefs: ["evidence://provider/probe"],
    freshness: verified ? "fresh" : "unknown",
    probedAt: verified ? "2026-09-09T01:00:00.000Z" : null,
    probeResult: verified ? "passed" : "not-run",
    fallbackFromProviderId: null,
    ...(fixture.resolutionOverrides ?? {}),
    ...(fixture.resolutionExtra ?? {}),
  };
}
Object.assign(input, fixture.inputExtra ?? {});
console.log(JSON.stringify({ input, result: assessRetrievalClaimV3(input) }));
"""
    try:
        completed = subprocess.run(
            ["node", "--input-type=module", "-e", wrapper],
            capture_output=True,
            text=True,
            input=json.dumps(fixture, ensure_ascii=False),
            cwd=str(TRELLIS_ROOT),
            timeout=30,
        )
        if completed.returncode != 0:
            return None
        envelope = json.loads(completed.stdout)
        input_value = envelope.get("input")
        result = envelope.get("result")
        if not isinstance(input_value, dict) or not isinstance(result, dict):
            return None
        return input_value, result
    except Exception:
        return None


def run_py_evidence(input_value: dict[str, Any]) -> dict[str, Any] | None:
    """Assess a materialized TS corpus input through the Python mirror ABI."""
    scripts_root = CLI_TEMPLATE_PY.parent.parent
    script = (
        "import json, sys; "
        "sys.path.insert(0, sys.argv[1]); "
        "from common.codebase_retrieval_router import assess_retrieval_claim_v3; "
        "value = json.load(sys.stdin); "
        "print(json.dumps(assess_retrieval_claim_v3(value), "
        "ensure_ascii=False, separators=(',', ':')))"
    )
    python_cmds = ["python", "python3"] if sys.platform == "win32" else ["python3", "python"]
    for command in python_cmds:
        try:
            completed = subprocess.run(
                [command, "-c", script, str(scripts_root)],
                capture_output=True,
                text=True,
                input=json.dumps(input_value, ensure_ascii=False),
                timeout=30,
            )
            if completed.returncode == 0:
                result = json.loads(completed.stdout)
                return result if isinstance(result, dict) else None
        except Exception:
            continue
    return None


def check_ts_py_evidence_parity(report: SyncReport) -> None:
    """Check 6: shared valid/malformed evidence corpus is ABI-identical."""
    fixtures = load_evidence_golden_cases()
    if not fixtures:
        report.checks.append(
            CheckResult(
                "ts-py-evidence-parity",
                False,
                f"V3 evidence corpus missing: {EVIDENCE_GOLDEN_JSON}",
            )
        )
        return
    failures: list[str] = []
    for fixture in fixtures:
        label = str(fixture.get("name", "unknown"))
        ts_execution = run_ts_evidence_fixture(fixture)
        if ts_execution is None:
            failures.append(f"[{label}] TS evidence execution failed")
            continue
        input_value, ts_result = ts_execution
        py_result = run_py_evidence(input_value)
        if py_result is None:
            failures.append(f"[{label}] Python evidence execution failed")
            continue
        if ts_result != py_result:
            failures.append(f"[{label}] complete TS/Python assessments differ")
            continue
        expected = fixture.get("expected")
        if not isinstance(expected, dict) or any(
            ts_result.get(key) != value for key, value in expected.items()
        ):
            failures.append(f"[{label}] shared expected assessment did not match")
        serialized = json.dumps(ts_result, ensure_ascii=False, separators=(",", ":"))
        canaries = fixture.get("outputMustNotContain", [])
        if isinstance(canaries, list) and any(
            isinstance(canary, str) and canary in serialized for canary in canaries
        ):
            failures.append(f"[{label}] output exposed a forbidden corpus canary")
    passed = not failures
    detail = (
        f"all {len(fixtures)} valid/malformed evidence fixtures passed"
        if passed
        else "\n".join(failures)
    )
    report.checks.append(CheckResult("ts-py-evidence-parity", passed, detail))


def check_extra_workspace_copies(report: SyncReport, extra_root: Path) -> None:
    """Optional: harness/eval workspace .trellis copies vs CLI template."""
    extra_router = extra_root / ".trellis" / "scripts" / "common" / "codebase_retrieval_router.py"
    extra_launcher = extra_root / ".trellis" / "scripts" / "route_codebase_retrieval.py"
    label = extra_root.name or str(extra_root)

    if extra_router.is_file() and CLI_TEMPLATE_PY.is_file():
        passed = file_sha256(extra_router) == file_sha256(CLI_TEMPLATE_PY)
        detail = (
            f"{label} router byte-identical to template"
            if passed
            else f"DRIFT: sync Copy-Item '{CLI_TEMPLATE_PY}' '{extra_router}' -Force"
        )
        report.checks.append(CheckResult(f"extra-python-hash:{label}", passed, detail))
    if extra_launcher.is_file() and CLI_TEMPLATE_LAUNCHER.is_file():
        passed = file_sha256(extra_launcher) == file_sha256(CLI_TEMPLATE_LAUNCHER)
        detail = (
            f"{label} launcher byte-identical to template"
            if passed
            else f"DRIFT: sync Copy-Item '{CLI_TEMPLATE_LAUNCHER}' '{extra_launcher}' -Force"
        )
        report.checks.append(CheckResult(f"extra-launcher-hash:{label}", passed, detail))


def main() -> int:
    parser = argparse.ArgumentParser(description="Router copy sync guard")
    parser.add_argument("--json", action="store_true", help="Machine-readable JSON output")
    parser.add_argument(
        "--hash-only",
        action="store_true",
        help="Only byte-hash checks (no TS dist / golden smoke)",
    )
    parser.add_argument(
        "--extra-workspace-root",
        action="append",
        default=[],
        metavar="PATH",
        help="Also compare PATH/.trellis/scripts/* to CLI template (repeatable)",
    )
    args = parser.parse_args()

    report = SyncReport()

    check_python_hash(report)
    check_launcher_hash(report)
    for extra in args.extra_workspace_root:
        check_extra_workspace_copies(report, Path(extra).resolve())
    if not args.hash_only:
        check_ts_golden(report)
        check_py_golden(report)
        check_ts_py_parity(report)
        check_ts_py_evidence_parity(report)

    if args.json:
        output = {
            "allPassed": report.all_passed,
            "checks": [
                {"name": c.name, "passed": c.passed, "detail": c.detail}
                for c in report.checks
            ],
        }
        print(json.dumps(output, indent=2, ensure_ascii=False))
    else:
        for c in report.checks:
            icon = "PASS" if c.passed else "FAIL"
            print(f"[{icon}] {c.name}")
            if c.detail:
                for line in c.detail.splitlines():
                    print(f"      {line}")
        print()
        if report.all_passed:
            print("All sync guard checks passed.")
        else:
            print("Sync guard detected drift — fix before shipping.")

    return 0 if report.all_passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
