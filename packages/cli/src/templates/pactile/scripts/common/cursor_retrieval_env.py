"""Legacy import-path shim for host-neutral retrieval planning.

V3 never reads process or user-global state to select a capability. Concrete
capability discovery belongs to the project resolver and adapters.
"""

from __future__ import annotations

from typing import Any


ENV_UNKNOWN = "unknown"
CursorRetrievalEnv = str


def detect_cursor_retrieval_env_info() -> dict[str, Any]:
    return {"env": ENV_UNKNOWN, "source": "neutral-compat", "detail": None}


def detect_cursor_retrieval_env() -> CursorRetrievalEnv:
    return ENV_UNKNOWN


def semantic_route_spec(_env: CursorRetrievalEnv) -> dict[str, object]:
    """Return a neutral requirement for legacy consumers."""
    return {
        "commands": [],
        "rationale_suffix": " Capability binding is deferred to the project resolver.",
        "platformNative": False,
        "semanticBackend": None,
    }
