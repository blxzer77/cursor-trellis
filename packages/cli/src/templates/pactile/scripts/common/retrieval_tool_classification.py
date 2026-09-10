"""Classify observed retrieval execution without selecting an implementation."""

from __future__ import annotations

import re
from dataclasses import dataclass


EXACT_PATTERNS = (
    re.compile(r"^grep$", re.I),
    re.compile(r"^rg$", re.I),
    re.compile(r"ripgrep", re.I),
    re.compile(r"find.?files?", re.I),
    re.compile(r"^glob$", re.I),
)
SEMANTIC_PATTERNS = (
    re.compile(r"semantic", re.I),
    re.compile(r"concept", re.I),
    re.compile(r"meaning", re.I),
)
STRUCTURAL_PATTERNS = (
    re.compile(r"structural", re.I),
    re.compile(r"callers?", re.I),
    re.compile(r"callees?", re.I),
    re.compile(r"dependenc", re.I),
    re.compile(r"call.?graph", re.I),
)
EXTERNAL_PATTERNS = (
    re.compile(r"external", re.I),
    re.compile(r"^web", re.I),
    re.compile(r"browser", re.I),
    re.compile(r"http.?fetch", re.I),
    re.compile(r"remote.?search", re.I),
)
READ_PATTERNS = (
    re.compile(r"^read$", re.I),
    re.compile(r"read.?file", re.I),
    re.compile(r"get-content", re.I),
    re.compile(r"source.?read", re.I),
)
GIT_PATTERNS = (
    re.compile(r"^git(?:\s|$)", re.I),
    re.compile(r"git.?diff", re.I),
    re.compile(r"git.?log", re.I),
    re.compile(r"git.?show", re.I),
)
TEST_PATTERNS = (
    re.compile(r"test", re.I),
    re.compile(r"vitest", re.I),
    re.compile(r"pytest", re.I),
    re.compile(r"check", re.I),
)
ROUTER_PATTERNS = (
    re.compile(r"route.?codebase.?retrieval", re.I),
    re.compile(r"retrieval.?plan", re.I),
)


def _matches(name: str, patterns: tuple[re.Pattern[str], ...]) -> bool:
    return any(pattern.search(name) for pattern in patterns)


@dataclass(frozen=True)
class ClassifiedToolCalls:
    exact_count: int
    semantic_count: int
    structural_count: int
    external_count: int
    read_count: int
    git_count: int
    test_count: int
    router_cli_invoked: bool
    unclassified_count: int
    # Read-only aliases retained for pre-V3 evidence readers.
    tools_called: list[str]
    grep_count: int
    codegraph_attempted: bool
    codegraph_executed: bool
    semantic_attempted: bool
    semantic_executed: bool
    platform_semantic_executed: bool
    fast_context_count: int = 0
    cursor_fast_context_misuse: bool = False


def classify_tool_calls(
    raw: list[str],
    **_compatibility_options: object,
) -> ClassifiedToolCalls:
    exact = semantic = structural = external = read = git = test = unclassified = 0
    router = False
    for raw_name in raw:
        name = raw_name.strip() if isinstance(raw_name, str) else ""
        if not name:
            unclassified += 1
            continue
        classified = False
        if _matches(name, EXACT_PATTERNS):
            exact += 1
            classified = True
        if _matches(name, SEMANTIC_PATTERNS):
            semantic += 1
            classified = True
        if _matches(name, STRUCTURAL_PATTERNS):
            structural += 1
            classified = True
        if _matches(name, EXTERNAL_PATTERNS):
            external += 1
            classified = True
        if _matches(name, READ_PATTERNS):
            read += 1
            classified = True
        if _matches(name, GIT_PATTERNS):
            git += 1
            classified = True
        if _matches(name, TEST_PATTERNS):
            test += 1
            classified = True
        if _matches(name, ROUTER_PATTERNS):
            router = True
            classified = True
        if not classified:
            unclassified += 1
    return ClassifiedToolCalls(
        exact_count=exact,
        semantic_count=semantic,
        structural_count=structural,
        external_count=external,
        read_count=read,
        git_count=git,
        test_count=test,
        router_cli_invoked=router,
        unclassified_count=unclassified,
        tools_called=list(raw),
        grep_count=exact,
        codegraph_attempted=structural > 0,
        codegraph_executed=structural > 0,
        semantic_attempted=semantic > 0,
        semantic_executed=semantic > 0,
        platform_semantic_executed=semantic > 0,
    )


def structural_routes_in_plan(intents: list[str]) -> bool:
    return "structural" in intents


def semantic_routes_in_plan(intents: list[str]) -> bool:
    return "semantic" in intents


def platform_semantic_route_order(steps: list[dict[str, object]]) -> int | None:
    for step in steps:
        if step.get("intent") == "semantic" and step.get("kind") == "provider-request":
            order = step.get("order")
            return order if isinstance(order, int) else None
    return None


def observed_intent_count(classified: ClassifiedToolCalls, intent: str) -> int:
    return {
        "exact": classified.exact_count,
        "semantic": classified.semantic_count,
        "structural": classified.structural_count,
        "external": classified.external_count,
    }.get(intent, 0)
