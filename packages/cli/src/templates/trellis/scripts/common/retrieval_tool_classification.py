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

SEMANTIC_PATTERNS = (
    re.compile(r"fast_context_search", re.I),
    re.compile(r"@codebase", re.I),
    re.compile(r"semantic.?search", re.I),
    re.compile(r"DEEP_SEARCH", re.I),
    re.compile(r"codebase.?search", re.I),
)

GREP_PATTERNS = (
    re.compile(r"^grep$", re.I),
    re.compile(r"^rg$", re.I),
    re.compile(r"ripgrep", re.I),
    re.compile(r"Instant Grep", re.I),
)

READ_PATTERNS = (
    re.compile(r"^read$", re.I),
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


def classify_tool_calls(raw: list[str]) -> ClassifiedToolCalls:
    tools_called = list(raw)
    grep_count = 0
    read_count = 0
    codegraph_executed = False
    semantic_executed = False
    router_cli_invoked = False

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
        if _matches(trimmed, SEMANTIC_PATTERNS):
            semantic_executed = True
        if _matches(trimmed, ROUTER_CLI_PATTERNS):
            router_cli_invoked = True

    return ClassifiedToolCalls(
        tools_called=tools_called,
        grep_count=grep_count,
        read_count=read_count,
        codegraph_attempted=codegraph_executed,
        codegraph_executed=codegraph_executed,
        semantic_attempted=semantic_executed,
        semantic_executed=semantic_executed,
        router_cli_invoked=router_cli_invoked,
    )


def structural_routes_in_plan(route_ids: list[str]) -> bool:
    return any(
        "codegraph" in rid or rid in STRUCTURAL_ROUTE_IDS for rid in route_ids
    )


def semantic_routes_in_plan(route_ids: list[str]) -> bool:
    return any(rid in ("platform-semantic", "semantic-fast-context") for rid in route_ids)