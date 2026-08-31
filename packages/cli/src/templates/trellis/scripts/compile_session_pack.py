#!/usr/bin/env python3
"""Compile a five-layer Session pack (`context-progressive`).

Usage:
    python compile_session_pack.py --json
    python compile_session_pack.py --json --task .cstl/tasks/<dir>
"""

from __future__ import annotations

from common.session_pack import main


if __name__ == "__main__":
    raise SystemExit(main())
