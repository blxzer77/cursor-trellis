#!/usr/bin/env python3
"""Cursor retrieval capability probe (Phase 1).

Auto-detects the current Cursor environment (Native vs Cursor++ BYOK) by reading
~/.ccursor/routes.json (byokMode), then runs the subset of retrieval-capability
probes that are CLI-reachable with deterministic known answers:

  P-01  Grep (rg)            — local IDE literal search
  P-02  Read                 — local IDE file read
  P-05  codegraph index      — on-disk .codegraph/ presence
  P-07  smart-search CLI     — doctor / status reachability
  D-01  Experiment D         — cursorEnv + BYOK fast-context install readiness

Probes P-03/04/06/08/09/10/D-01(manual inventory) require a live agent session and are documented in
cursor_retrieval_probe_prompt.md; their results are filled into
retrieval_probe_matrix_template.json manually.

This script does NOT depend on Cursor being open and does NOT modify any state.
"""

from __future__ import annotations

import argparse
import io
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

_SCRIPTS = Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

from common.cursor_retrieval_env import (  # noqa: E402
    ENV_BYOK,
    ENV_NATIVE,
    ENV_UNKNOWN,
    detect_cursor_retrieval_env_info,
)

if sys.platform.startswith("win"):
    for _stream_name in ("stdin", "stdout", "stderr"):
        _stream = getattr(sys, _stream_name, None)
        if _stream is None:
            continue
        if hasattr(_stream, "reconfigure"):
            try:
                _stream.reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                pass
        elif hasattr(_stream, "detach"):
            try:
                setattr(
                    sys,
                    _stream_name,
                    io.TextIOWrapper(_stream.detach(), encoding="utf-8", errors="replace"),
                )
            except Exception:
                pass

PROBE_VERSION = 1


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def detect_environment() -> dict[str, object]:
    """Alias for router/probe: same as detect_cursor_retrieval_env_info()."""
    return detect_cursor_retrieval_env_info()


def _probe_grep(repo_root: Path) -> dict[str, object]:
    """P-01: Grep a known literal in a known file under the repo.

    Known answer: 'TRELLIS_B2_WPeLc8' must appear in
    .trellis/local/cursor2plus/patch_wpelc8.py (the MARKER constant).
    """
    marker = "TRELLIS_B2_WPeLc8"
    target = repo_root / ".trellis" / "local" / "cursor2plus" / "patch_wpelc8.py"
    ok_file = target.is_file()
    found = False
    matches: list[str] = []
    if ok_file:
        try:
            text = target.read_text(encoding="utf-8", errors="ignore")
            for i, line in enumerate(text.splitlines(), 1):
                if marker in line:
                    matches.append(f"{i}:{line.strip()[:120]}")
            found = bool(matches)
        except OSError:
            pass
    return {
        "id": "P-01",
        "label": "Grep (rg) — local IDE literal search",
        "status": "pass" if found else "fail",
        "expected": marker,
        "target_file": str(target),
        "matches": matches[:5],
        "note": "Local IDE operation; not routed through BYOK proxy." if found else (
            "Target file missing or marker not found." if ok_file else "Target file missing."
        ),
    }


def _probe_read(repo_root: Path) -> dict[str, object]:
    """P-02: Read a known file and verify a known line content.

    Known answer: .cursor/mcp.json must contain a 'codegraph' server entry.
    """
    target = repo_root / ".cursor" / "mcp.json"
    ok_file = target.is_file()
    has_codegraph = False
    has_fast_context = False
    servers: list[str] = []
    if ok_file:
        try:
            data = json.loads(target.read_text(encoding="utf-8"))
            mcp = data.get("mcpServers", {})
            if isinstance(mcp, dict):
                servers = sorted(mcp.keys())
                has_codegraph = "codegraph" in mcp
                has_fast_context = "fast-context" in mcp
        except (OSError, json.JSONDecodeError):
            pass
    ok = has_codegraph
    return {
        "id": "P-02",
        "label": "Read — local IDE file read + JSON parse",
        "status": "pass" if ok else "fail",
        "expected": "mcpServers.codegraph present",
        "target_file": str(target),
        "configured_servers": servers,
        "has_codegraph": has_codegraph,
        "has_fast_context": has_fast_context,
        "note": "Local IDE operation; verifies MCP config on disk." if ok else "mcp.json missing or codegraph not configured.",
    }


def _probe_codegraph_index(repo_root: Path) -> dict[str, object]:
    """P-05: codegraph index on disk (.codegraph/ directories).

    Mirrors codegraph_session_smoke.py logic.
    """
    found: list[Path] = []
    direct = repo_root / ".codegraph"
    if direct.is_dir():
        found.append(direct.resolve())
    for child in sorted(repo_root.iterdir()):
        if not child.is_dir():
            continue
        nested = child / ".codegraph"
        if nested.is_dir() and nested.resolve() not in found:
            found.append(nested.resolve())
    ok = len(found) > 0
    return {
        "id": "P-05",
        "label": "codegraph index — on-disk .codegraph/ presence",
        "status": "pass" if ok else "fail",
        "expected": "at least one .codegraph/ dir under workspace root or top-level subproject",
        "index_paths": [str(p) for p in found],
        "note": "Local disk; MCP must also be enabled in Cursor for live calls." if ok else "Run codegraph init to index.",
    }


def _probe_smart_search(repo_root: Path) -> dict[str, object]:
    """P-07: smart-search CLI reachability (resolve, do not execute search).

    Reuses common.smart_search_resolve to find the executable; reports resolved
    argv without running a network search. A separate `doctor` invocation is
    attempted if the resolved entrypoint is the smart-search package CLI.
    """
    scripts_dir = repo_root / ".trellis" / "scripts"
    if str(scripts_dir) not in sys.path:
        sys.path.insert(0, str(scripts_dir))
    resolved: list[str] | None = None
    resolve_error = ""
    try:
        from common.smart_search_resolve import resolve_smart_search_argv  # type: ignore[import-not-found]

        resolved = resolve_smart_search_argv(repo_root)
    except Exception as exc:
        resolve_error = f"{type(exc).__name__}: {exc}"

    doctor_status = "skipped"
    doctor_output = ""
    if resolved:
        import subprocess

        entry = resolved[-1] if resolved else ""
        try:
            proc = subprocess.run(
                resolved + (["doctor"] if entry.endswith((".js", ".cmd", ".bat")) or "smart-search" in str(resolved) else []),
                capture_output=True,
                text=True,
                timeout=12,
                cwd=str(repo_root),
                encoding="utf-8",
                errors="replace",
            )
            doctor_output = (proc.stdout or "") + (proc.stderr or "")
            doctor_status = "ok" if proc.returncode == 0 else f"exit={proc.returncode}"
        except (subprocess.SubprocessError, OSError) as exc:
            doctor_status = f"error: {type(exc).__name__}"
            doctor_output = str(exc)

    ok = bool(resolved)
    return {
        "id": "P-07",
        "label": "smart-search CLI — resolve + doctor",
        "status": "pass" if ok else "fail",
        "expected": "smart-search argv resolved",
        "resolved_argv": resolved,
        "resolve_error": resolve_error,
        "doctor_status": doctor_status,
        "doctor_output_excerpt": doctor_output[:400],
        "note": "Local CLI; not routed through BYOK proxy." if ok else "smart-search not resolvable.",
    }


def _probe_d01_semanticsearch_drop(
    env_info: dict[str, object],
    mcp_config: dict[str, object],
) -> dict[str, object]:
    """D-01 (auto): Experiment D readiness — BYOK needs fast-context in mcp.json.

    Does not prove SemanticSearch absence (that is manual D-01 + P-08). Pass when:
    - Native: env is native (built-in semantic path expected in manual probes).
    - BYOK: fast-context configured in .cursor/mcp.json.
    """
    env = str(env_info.get("env") or ENV_UNKNOWN)
    byok_mode = env_info.get("byokMode")
    fc = bool(mcp_config.get("fast_context_configured"))
    cg = bool(mcp_config.get("codegraph_configured"))
    if env == ENV_BYOK:
        ok = fc and cg
        status = "pass" if ok else "fail"
        note = (
            "BYOK: fast-context + codegraph in mcp.json — ready for P-08-SA / REC-11."
            if ok
            else "BYOK: missing fast-context and/or codegraph in mcp.json; "
            "select codebase-retrieval at init or add servers manually."
        )
    elif env == ENV_NATIVE:
        ok = True
        status = "pass"
        note = (
            "Native: use manual D-01 / P-08 for built-in SemanticSearch inventory; "
            f"fast-context configured={fc} (optional on Native)."
        )
    else:
        ok = fc
        status = "degraded" if fc else "fail"
        note = (
            "cursorEnv unknown; fast-context in mcp.json supports BYOK concept recall if env is byok."
            if fc
            else "cursorEnv unknown and fast-context not in mcp.json."
        )
    return {
        "id": "D-01",
        "label": "Experiment D — SemanticSearch drop readiness (env + MCP)",
        "status": status,
        "expected": "BYOK → fast-context+codegraph in mcp.json; Native → env native",
        "cursor_env": env,
        "byokMode": byok_mode,
        "fast_context_configured": fc,
        "codegraph_configured": cg,
        "manual_followup": "cursor_retrieval_probe_prompt.md PROBE D-01 (tool inventory)",
        "related_probes": ["P-08", "P-08-SA"],
        "note": note,
    }


def _probe_mcp_config(repo_root: Path) -> dict[str, object]:
    """Supplemental: read .cursor/mcp.json to report configured MCP servers.

    Tells the user which MCP-based probes (P-03/04/06) should be runnable.
    """
    target = repo_root / ".cursor" / "mcp.json"
    servers: dict[str, object] = {}
    if target.is_file():
        try:
            data = json.loads(target.read_text(encoding="utf-8"))
            mcp = data.get("mcpServers", {})
            if isinstance(mcp, dict):
                servers = mcp
        except (OSError, json.JSONDecodeError):
            pass
    return {
        "codegraph_configured": "codegraph" in servers,
        "fast_context_configured": "fast-context" in servers,
        "all_servers": sorted(servers.keys()),
        "mcp_json_path": str(target),
    }


def run_auto_probes(repo_root: Path) -> dict[str, object]:
    env_info = detect_environment()
    mcp_config = _probe_mcp_config(repo_root)
    return {
        "probe_version": PROBE_VERSION,
        "env": env_info,
        "probed_at": _utc_now(),
        "repo_root": str(repo_root),
        "auto_results": [
            _probe_grep(repo_root),
            _probe_read(repo_root),
            _probe_codegraph_index(repo_root),
            _probe_smart_search(repo_root),
            _probe_d01_semanticsearch_drop(env_info, mcp_config),
        ],
        "mcp_config": mcp_config,
        "manual_probe_ids": ["P-03", "P-04", "P-06", "D-01", "P-08", "P-09", "P-10"],
        "manual_probe_doc": "cursor_retrieval_probe_prompt.md",
        "matrix_template": "retrieval_probe_matrix_template.json",
    }


def _format_human(report: dict[str, object]) -> str:
    env_info = report.get("env", {})
    env = env_info.get("env", "unknown")
    lines = [
        f"Cursor retrieval probe (Phase 1)",
        f"  environment : {env}  (source: {env_info.get('source', '?')}, byokMode={env_info.get('byokMode')})",
        f"  repo_root   : {report.get('repo_root')}",
        f"  probed_at   : {report.get('probed_at')}",
        "",
        "Auto probes (CLI-reachable):",
    ]
    for r in report.get("auto_results", []):
        status = r.get("status", "?")
        tag = "PASS" if status == "pass" else "FAIL"
        lines.append(f"  [{tag}] {r.get('id')} {r.get('label')}")
        if r.get("note"):
            lines.append(f"        {r['note']}")
    mcp = report.get("mcp_config", {})
    lines.append("")
    lines.append("MCP config (for manual probes P-03/04/06 and D-01 BYOK readiness):")
    lines.append(f"  codegraph     : {'configured' if mcp.get('codegraph_configured') else 'MISSING'}")
    lines.append(f"  fast-context  : {'configured' if mcp.get('fast_context_configured') else 'MISSING'}")
    lines.append(f"  all servers   : {', '.join(mcp.get('all_servers', [])) or '(none)'}")
    lines.append("")
    lines.append("Manual probes (run via cursor_retrieval_probe_prompt.md):")
    for pid in report.get("manual_probe_ids", []):
        lines.append(f"  {pid}")
    lines.append("")
    redirect = env_info.get("redirect_endpoints", [])
    if env == "byok" and isinstance(redirect, list) and redirect:
        lines.append(f"BYOK redirect endpoints ({len(redirect)}):")
        for ep in redirect[:8]:
            lines.append(f"  - {ep}")
        if len(redirect) > 8:
            lines.append(f"  ... +{len(redirect) - 8} more")
        lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Cursor retrieval capability probe (Phase 1)")
    parser.add_argument("--root", type=Path, default=None, help="Workspace root (default: Trellis repo root)")
    parser.add_argument("--json", action="store_true", help="Machine-readable JSON report")
    parser.add_argument("--out", type=Path, default=None, help="Write report JSON to this path")
    args = parser.parse_args()

    if args.root is not None:
        repo_root = args.root.resolve()
    else:
        try:
            from common.paths import get_repo_root  # type: ignore[import-not-found]
            repo_root = get_repo_root()
        except Exception:
            repo_root = Path.cwd().resolve()

    report = run_auto_probes(repo_root)

    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(
            json.dumps(report, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        print(f"wrote {args.out}", file=sys.stderr)

    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        print(_format_human(report))

    any_fail = any(r.get("status") != "pass" for r in report.get("auto_results", []))
    return 1 if any_fail and args.json else 0


if __name__ == "__main__":
    raise SystemExit(main())
