"""Detect Cursor Native vs Cursor++ BYOK for retrieval routing."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

ENV_NATIVE = "native"
ENV_BYOK = "byok"
ENV_UNKNOWN = "unknown"

CursorRetrievalEnv = str  # native | byok | unknown


def ccursor_home() -> Path:
    env = os.environ.get("TRELLIS_CCURSOR_HOME", "").strip()
    if env:
        return Path(env).expanduser()
    return Path.home() / ".ccursor"


def detect_cursor_retrieval_env() -> CursorRetrievalEnv:
    """Return native | byok | unknown.

    Override: TRELLIS_CURSOR_BYOK=1|0
    """
    info = detect_cursor_retrieval_env_info()
    env = info.get("env")
    if env in (ENV_NATIVE, ENV_BYOK, ENV_UNKNOWN):
        return str(env)
    return ENV_UNKNOWN


def detect_cursor_retrieval_env_info() -> dict[str, Any]:
    """Full detection record (for probes and envelopes)."""
    env_override = os.environ.get("TRELLIS_CURSOR_BYOK", "").strip()
    if env_override == "1":
        return {"env": ENV_BYOK, "source": "env-override", "byokMode": 1}
    if env_override == "0":
        return {"env": ENV_NATIVE, "source": "env-override", "byokMode": 0}

    routes_path = ccursor_home() / "routes.json"
    if not routes_path.is_file():
        return {
            "env": ENV_UNKNOWN,
            "source": "routes-not-found",
            "byokMode": None,
            "routes_path": str(routes_path),
        }
    try:
        routes = json.loads(routes_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return {
            "env": ENV_UNKNOWN,
            "source": "routes-parse-error",
            "byokMode": None,
            "error": str(exc),
            "routes_path": str(routes_path),
        }
    byok = routes.get("byokMode")
    env = ENV_BYOK if byok == 1 else ENV_NATIVE if byok == 0 else ENV_UNKNOWN
    redirect = routes.get("redirect", [])
    return {
        "env": env,
        "source": "routes.json",
        "byokMode": byok,
        "routes_path": str(routes_path),
        "redirect_endpoints": list(redirect) if isinstance(redirect, list) else [],
    }


def is_byok(env: CursorRetrievalEnv | None = None) -> bool:
    return (env or detect_cursor_retrieval_env()) == ENV_BYOK


def is_byok_conservative(env: CursorRetrievalEnv | None = None) -> bool:
    """Conservative semantic routing: BYOK plus unknown (no routes.json / ambiguous byokMode)."""
    resolved = env or detect_cursor_retrieval_env()
    return resolved == ENV_BYOK or resolved == ENV_UNKNOWN


def semantic_route_spec(cursor_env: CursorRetrievalEnv) -> dict[str, object]:
    """platform-semantic route fields for conceptual / optional semantic slots."""
    if is_byok_conservative(cursor_env):
        unknown_caveat = (
            " Unknown cursorEnv: conservative fast-context primary (same as BYOK)."
            if cursor_env == ENV_UNKNOWN
            else ""
        )
        return {
            "commands": ["fast_context_search (fast-context MCP)"],
            "rationale_suffix": (
                " Cursor++ BYOK: built-in semantic unavailable; fast-context MCP primary."
                + unknown_caveat
            ),
            "platformNative": False,
            "semanticBackend": "fast-context-mcp",
        }
    return {
        "commands": ["cursor @codebase or built-in semantic search"],
        "rationale_suffix": " Cursor built-in semantic search.",
        "platformNative": True,
        "semanticBackend": "cursor-builtin",
    }