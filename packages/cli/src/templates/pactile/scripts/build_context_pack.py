#!/usr/bin/env python3
"""
Build a bounded retrieval context pack from scored evidence JSON.

Session five-layer compilation lives in `compile_session_pack.py` /
`common/session_pack.py` and reuses this budget envelope (max items /
estimated tokens). Do not change Wave 1 ranking or collected-evidence
semantics here.
"""

from __future__ import annotations

from common.context_pack import main


if __name__ == "__main__":
    raise SystemExit(main())
