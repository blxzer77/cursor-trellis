"""Classify agent tool names for retrieval execution telemetry (Cursor-first)."""

from __future__ import annotations

import re
from dataclasses import dataclass

CODEGRAPH_PATTERNS = (
    re.compile(r"^codegraph_", re.I),
    re.compile(r"^project-0-.*-codegraph-", re.I),
    re.compile(r"codegraph_search", re.I),
    re.compile(r"codegraph_explore", re.I),
    re.compile(r"codegraph_callers", re.I),
    re.compile(r"codegraph_node", re.I),
)

PLATFORM_SEMANTIC_PATTERNS = (
    re.compile(r"@codebase", re.I),
    re.compile(r"semantic.?search", re.I),
    re.compile(r"DEEP_SEARCH", re.I),
    re.compile(r"codebase.?search", re.I),
    re.compile(r"SemanticSearch", re.I),
    re.compile(r"Instant Search", re.I),
    re.compile(r"Cursor.*semantic", re.I),
    re.compile(r"built-?in.*codebase", re.I),
)

FAST_CONTEXT_PATTERNS = (
    re.compile(r"fast_context_search", re.I),
    re.compile(r"fast-context", re.I),
    re.compile(r"fast_context", re.I),
)

GREP_PATTERNS = (
    re.compile(r"^grep$", re.I),
    re.compile(r"^Grep$", re.I),
    re.compile(r"^rg$", re.I),
    re.compile(r"ripgrep", re.I),
    re.compile(r"Instant Grep", re.I),
)

READ_PATTERNS = (
    re.compile(r"^read$", re.I),
    re.compile(r"^Read$", re.I),
    re.compile(r"ReadFile", re.I),
    re.compile(r"Get-Content", re.I),
)

ROUTER_CLI_PATTERNS = (
    re.compile(r"route_codebase_retrieval", re.I),
    re.compile(r"retrieval-routing", re.I),
)

STRUCTURAL_ROUTE_IDS = frozenset(
    {
        "caller-chain-ast",
        "trap-demote-codegraph",
        "extension-codegraph",
        "ast-codegraph",
    }
)


def _matches(name: str, patterns: tuple[re.Pattern[str], ...]) -> bool:
    return any(p.search(name) for p in patterns)


def is_platform_semantic_tool_name(name: str) -> bool:
    return _matches(name.strip(), PLATFORM_SEMANTIC_PATTERNS)


def is_fast_context_tool_name(name: str) -> bool:
    return _matches(name.strip(), FAST_CONTEXT_PATTERNS)


@dataclass(frozen=True)
class ClassifiedToolCalls:
    tools_called: list[str]
    grep_count: int
    read_count: int
    codegraph_attempted: bool
    codegraph_executed: bool
    semantic_attempted: bool
    semantic_executed: bool
    router_cli_invoked: bool
    platform_semantic_executed: bool = False
    fast_context_count: int = 0
    cursor_fast_context_misuse: bool = False


def classify_tool_calls(
    raw: list[str],
    *,
    platform: str = "cursor",
    cursor_env: str | None = None,
    route_ids: list[str] | None = None,
) -> ClassifiedToolCalls:
    tools_called = list(raw)
    grep_count = 0
    read_count = 0
    codegraph_executed = False
    router_cli_invoked = False
    platform_semantic_executed = False
    fast_context_count = 0
    plat = (platform or "cursor").lower()

    for name in raw:
        trimmed = name.strip()
        if not trimmed:
            continue
        if _matches(trimmed, GREP_PATTERNS):
            grep_count += 1
        if _matches(trimmed, READ_PATTERNS):
            read_count += 1
        if _matches(trimmed, CODEGRAPH_PATTERNS):
            codegraph_executed = True
        if _matches(trimmed, ROUTER_CLI_PATTERNS):
            router_cli_invoked = True
        if is_fast_context_tool_name(trimmed):
            fast_context_count += 1
        if is_platform_semantic_tool_name(trimmed):
            platform_semantic_executed = True

    env = (cursor_env or "").strip().lower()
    if plat == "cursor":
        if env == "byok":
            semantic_executed = platform_semantic_executed or fast_context_count > 0
        else:
            semantic_executed = platform_semantic_executed
    else:
        semantic_executed = platform_semantic_executed or fast_context_count > 0

    semantic_attempted = semantic_executed or fast_context_count > 0

    misuse = (
        plat == "cursor"
        and fast_context_count > 0
        and env != "byok"
    )

    return ClassifiedToolCalls(
        tools_called=tools_called,
        grep_count=grep_count,
        read_count=read_count,
        codegraph_attempted=codegraph_executed,
        codegraph_executed=codegraph_executed,
        semantic_attempted=semantic_attempted,
        semantic_executed=semantic_executed,
        router_cli_invoked=router_cli_invoked,
        platform_semantic_executed=platform_semantic_executed,
        fast_context_count=fast_context_count,
        cursor_fast_context_misuse=misuse,
    )


def structural_routes_in_plan(route_ids: list[str]) -> bool:
    return any(
        "codegraph" in rid or rid in STRUCTURAL_ROUTE_IDS for rid in route_ids
    )


def semantic_routes_in_plan(route_ids: list[str]) -> bool:
    return any(rid in ("platform-semantic", "semantic-fast-context") for rid in route_ids)


def platform_semantic_route_order(routes: list[dict]) -> int | None:
    for route in routes:
        if isinstance(route, dict) and route.get("id") == "platform-semantic":
            order = route.get("order")
            if isinstance(order, int):
                return order
    return None