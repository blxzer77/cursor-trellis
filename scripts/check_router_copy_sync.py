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

Eval .trellis copies are NOT checked here (cross-repo CI is out of scope).
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
    / ".trellis"
    / "scripts"
    / "common"
    / "codebase_retrieval_router.py"
)

WORKSPACE_LAUNCHER = TRELLIS_ROOT / ".trellis" / "scripts" / "route_codebase_retrieval.py"
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

GOLDEN_FIXTURES: list[dict[str, Any]] = [
    {
        "label": "O1-conceptual-semantic-order",
        "query": "how does retry work across modules",
        "assertions": [
            {"kind": "intent-present", "intentId": "cross-cutting-discovery"},
            {"kind": "route-order", "routeId": "semantic-fast-context", "maxOrder": 2},
        ],
    },
    {
        "label": "O3-chinese-policy-signal",
        "query": "为什么不能把 sidecar 当默认存储",
        "assertions": [
            {"kind": "intent-present", "intentId": "policy-document"},
        ],
    },
    {
        "label": "O2-exact-plus-policy-branch-fallback",
        "query": "routeCodebaseRetrieval storage policy sidecar forbidden in AGENTS.md",
        "assertions": [
            {"kind": "intent-present", "intentId": "exact-symbol-path"},
            {"kind": "intent-present", "intentId": "policy-document"},
            {"kind": "route-present", "routeId": "policy-docs-rg"},
            {"kind": "fallback-present", "substring": "no corroborated file/range candidates"},
        ],
    },
]


def run_ts_router(query: str) -> dict[str, Any] | None:
    """Run the TS router via the built CLI dist and return the plan envelope."""
    dist_path = TRELLIS_ROOT / "packages" / "cli" / "dist" / "utils" / "codebase-retrieval-router.js"
    if not dist_path.is_file():
        return None
    wrapper = f"""
import {{ routeCodebaseRetrieval }} from "./packages/cli/dist/utils/codebase-retrieval-router.js";
const plan = routeCodebaseRetrieval({{ query: {json.dumps(query)} }});
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
    script = (
        "import json, sys; "
        f"sys.path.insert(0, r'{WORKSPACE_PY.parent}'); "
        "from codebase_retrieval_router import route_codebase_retrieval; "
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
    """Check fixture assertions against one envelope; returns list of failures."""
    failures: list[str] = []
    label = fixture["label"]
    for assertion in fixture["assertions"]:
        kind = assertion["kind"]
        if kind == "intent-present":
            intent_ids = [i.get("id") for i in envelope.get("intents", [])]
            if assertion["intentId"] not in intent_ids:
                failures.append(
                    f"[{label}] intent-present: expected '{assertion['intentId']}', "
                    f"got {intent_ids}"
                )
        elif kind == "route-order":
            routes = envelope.get("routes", [])
            for r in routes:
                if r.get("id") == assertion["routeId"]:
                    if r.get("order", 999) > assertion["maxOrder"]:
                        failures.append(
                            f"[{label}] route-order: '{assertion['routeId']}' "
                            f"order={r.get('order')} > maxOrder={assertion['maxOrder']}"
                        )
                    break
            else:
                failures.append(
                    f"[{label}] route-order: route '{assertion['routeId']}' not found"
                )
        elif kind == "route-present":
            routes = envelope.get("routes", [])
            route_ids = [r.get("id") for r in routes]
            if assertion["routeId"] not in route_ids:
                failures.append(
                    f"[{label}] route-present: expected '{assertion['routeId']}', "
                    f"got {route_ids}"
                )
        elif kind == "fallback-present":
            fallbacks = envelope.get("fallback", [])
            texts = [f.get("when", "") for f in fallbacks]
            if not any(assertion["substring"] in t for t in texts):
                failures.append(
                    f"[{label}] fallback-present: no fallback 'when' contains "
                    f"'{assertion['substring']}'; fallbacks={texts}"
                )
    return failures


def check_ts_golden(report: SyncReport) -> None:
    """Check 3: TS golden route behavior smoke (O1/O2/O3 fixtures)."""
    all_failures: list[str] = []
    for fixture in GOLDEN_FIXTURES:
        envelope = run_ts_router(fixture["query"])
        if envelope is None:
            all_failures.append(f"[{fixture['label']}] TS router execution failed")
            continue
        all_failures.extend(assert_fixture(envelope, fixture))

    passed = len(all_failures) == 0
    detail = "all O1/O2/O3 fixtures passed" if passed else "\n".join(all_failures)
    report.checks.append(CheckResult("ts-golden-smoke", passed, detail))


def check_py_golden(report: SyncReport) -> None:
    """Check 4: Python golden route behavior smoke (O1/O2/O3 fixtures)."""
    all_failures: list[str] = []
    for fixture in GOLDEN_FIXTURES:
        envelope = run_py_router(fixture["query"])
        if envelope is None:
            all_failures.append(f"[{fixture['label']}] Python router execution failed")
            continue
        all_failures.extend(assert_fixture(envelope, fixture))

    passed = len(all_failures) == 0
    detail = "all O1/O2/O3 fixtures passed" if passed else "\n".join(all_failures)
    report.checks.append(CheckResult("py-golden-smoke", passed, detail))


def check_ts_py_parity(report: SyncReport) -> None:
    """Check 5: TS and Python envelopes agree on intent ids for each fixture."""
    all_failures: list[str] = []
    for fixture in GOLDEN_FIXTURES:
        ts_env = run_ts_router(fixture["query"])
        py_env = run_py_router(fixture["query"])
        if ts_env is None or py_env is None:
            all_failures.append(
                f"[{fixture['label']}] parity: one or both routers failed to execute"
            )
            continue
        ts_ids = sorted(i.get("id") for i in ts_env.get("intents", []))
        py_ids = sorted(i.get("id") for i in py_env.get("intents", []))
        if ts_ids != py_ids:
            all_failures.append(
                f"[{fixture['label']}] parity: TS intents={ts_ids} vs PY intents={py_ids}"
            )
    passed = len(all_failures) == 0
    detail = "TS/Python intent parity confirmed" if passed else "\n".join(all_failures)
    report.checks.append(CheckResult("ts-py-intent-parity", passed, detail))


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
