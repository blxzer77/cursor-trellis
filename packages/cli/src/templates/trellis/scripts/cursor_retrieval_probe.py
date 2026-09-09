#!/usr/bin/env python3
"""Compatibility probe for the neutral Pactile retrieval V3 contract.

The probe performs no host discovery. It checks that each canonical intent
produces a deterministic plan and reports unresolved provider requirements as
data for the project resolver.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import cast

from common.codebase_retrieval_router import route_codebase_retrieval


def build_report() -> dict[str, object]:
    probes: list[dict[str, object]] = []
    for intent in ("exact", "semantic", "structural", "external"):
        first = route_codebase_retrieval(
            f"probe {intent}", intents=[intent], minimum_assurance="best-effort", required_evidence_kinds=[]
        )
        second = route_codebase_retrieval(
            f"probe {intent}", intents=[intent], minimum_assurance="best-effort", required_evidence_kinds=[]
        )
        probes.append(
            {
                "intent": intent,
                "status": "pass" if first == second else "fail",
                "fingerprint": first["fingerprint"],
                "stopReasons": first["stopReasons"],
            }
        )
    return {
        "schemaVersion": 3,
        "probeKind": "contract-only",
        "hostDiscoveryPerformed": False,
        "probes": probes,
    }


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="Emit JSON (default).")
    parser.add_argument("--out", type=Path, help="Optional report output path.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    report = build_report()
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)
    probes = cast(list[dict[str, object]], report["probes"])
    return 0 if all(probe["status"] == "pass" for probe in probes) else 1


if __name__ == "__main__":
    raise SystemExit(main())
