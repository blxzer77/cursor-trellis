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
        expect = case.get("expect") or {}
        if not isinstance(expect, dict):
            expect = {}
        fixtures.append(
            {
                "label": case_id,
                "query": query,
                "cursorEnv": case.get("cursorEnv"),
                "expect": expect,
            }
        )
    return fixtures


def run_ts_router(
    query: str, cursor_env: str | None = None
) -> dict[str, Any] | None:
    """Run the TS router via the built CLI dist and return the plan envelope."""
    dist_path = TRELLIS_ROOT / "packages" / "cli" / "dist" / "utils" / "codebase-retrieval-router.js"
    if not dist_path.is_file():
        return None
    input_obj: dict[str, Any] = {"query": query}
    if cursor_env in ("native", "byok", "unknown"):
        input_obj["cursorEnv"] = cursor_env
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


def run_py_router(
    query: str, cursor_env: str | None = None
) -> dict[str, Any] | None:
    """Run the Python router (workspace copy) and return the plan envelope."""
    if not WORKSPACE_PY.is_file():
        return None
    # Package import: common.* lives under .cstl/scripts/
    scripts_root = WORKSPACE_PY.parent.parent
    kwargs = ""
    if cursor_env in ("native", "byok", "unknown"):
        kwargs = f", cursor_env={json.dumps(cursor_env)}"
    script = (
        "import json, sys; "
        f"sys.path.insert(0, r'{scripts_root}'); "
        "from common.codebase_retrieval_router import route_codebase_retrieval; "
        f"print(json.dumps(route_codebase_retrieval({json.dumps(query)}{kwargs}), ensure_ascii=False))"
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
    expect = fixture.get("expect") or {}
    if not isinstance(expect, dict):
        return [f"[{label}] expect block missing or invalid"]

    intent_ids = [i.get("id") for i in envelope.get("intents", [])]
    routes = envelope.get("routes", [])
    route_ids = [r.get("id") for r in routes]

    for intent_id in expect.get("intentsInclude") or []:
        if intent_id not in intent_ids:
            failures.append(
                f"[{label}] intentsInclude: expected '{intent_id}', got {intent_ids}"
            )
    for intent_id in expect.get("intentsExclude") or []:
        if intent_id in intent_ids:
            failures.append(
                f"[{label}] intentsExclude: unexpected '{intent_id}' in {intent_ids}"
            )
    for route_id in expect.get("routeIdPresent") or []:
        if route_id not in route_ids:
            failures.append(
                f"[{label}] routeIdPresent: expected '{route_id}', got {route_ids}"
            )
    for route_id in expect.get("routeIdAbsent") or []:
        if route_id in route_ids:
            failures.append(
                f"[{label}] routeIdAbsent: unexpected '{route_id}' in {route_ids}"
            )
    prefix = expect.get("primaryRouteIdsPrefix") or []
    if prefix:
        got_prefix = route_ids[: len(prefix)]
        if got_prefix != prefix:
            failures.append(
                f"[{label}] primaryRouteIdsPrefix: expected {prefix}, got {got_prefix}"
            )
    max_order = expect.get("maxOrder") or {}
    if isinstance(max_order, dict):
        for route_id, max_val in max_order.items():
            match = next((r for r in routes if r.get("id") == route_id), None)
            if match is None:
                failures.append(f"[{label}] maxOrder: route '{route_id}' not found")
            elif match.get("order", 999) > max_val:
                failures.append(
                    f"[{label}] maxOrder: '{route_id}' order={match.get('order')} "
                    f"> max={max_val}"
                )
    semantic_backend = expect.get("semanticBackend")
    if semantic_backend:
        semantic = next((r for r in routes if r.get("id") == "platform-semantic"), None)
        got = semantic.get("semanticBackend") if semantic else None
        if got != semantic_backend:
            failures.append(
                f"[{label}] semanticBackend: expected '{semantic_backend}', got '{got}'"
            )
    fallback_sub = expect.get("fallbackSubstring")
    if fallback_sub:
        texts = [f.get("when", "") for f in envelope.get("fallback", [])]
        if not any(fallback_sub in t for t in texts):
            failures.append(
                f"[{label}] fallbackSubstring: no fallback 'when' contains "
                f"'{fallback_sub}'; fallbacks={texts}"
            )
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
        envelope = run_ts_router(fixture["query"], fixture.get("cursorEnv"))
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
        envelope = run_py_router(fixture["query"], fixture.get("cursorEnv"))
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
    """Check 5: TS and Python envelopes agree on intent ids for each fixture."""
    fixtures = golden_fixtures()
    all_failures: list[str] = []
    for fixture in fixtures:
        ts_env = run_ts_router(fixture["query"], fixture.get("cursorEnv"))
        py_env = run_py_router(fixture["query"], fixture.get("cursorEnv"))
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
