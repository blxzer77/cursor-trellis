#!/usr/bin/env python3
"""
Render codebase retrieval plan envelopes as agent-executable instructions.

Complements JSON telemetry envelopes from codebase_retrieval_router.py; does not
invoke tools. Cursor platform maps routes to native tool names (Grep, codegraph,
built-in semantic search, GO_TO_DEFINITION).
"""

from __future__ import annotations

import re
from typing import Any

from .codebase_retrieval_router import PLATFORM_CURSOR

_SYMBOL_CANDIDATE = re.compile(
    r"\b([A-Za-z_][\w$]{2,})\b|"
    r"`([^`]+)`|"
    r"「([^」]+)」",
)

_SKIP_SYMBOLS = frozenset(
    {
        "openclaw",
        "which",
        "where",
        "what",
        "who",
        "how",
        "list",
        "give",
        "tell",
        "define",
        "defined",
        "calls",
        "call",
        "invoke",
        "invoked",
        "file",
        "files",
        "module",
        "modules",
        "package",
        "packages",
        "extension",
        "extensions",
        "src",
        "the",
        "and",
        "for",
        "with",
        "from",
        "that",
        "this",
        "AGENTS",
        "README",
        "Cursor",
    },
)


def _plan_dict(plan: dict[str, object] | Any) -> dict[str, object]:
    if isinstance(plan, dict):
        return plan
    raise TypeError("plan must be a dict envelope from route_codebase_retrieval")


def _symbol_rank(candidate: str) -> int:
    if re.search(r"[a-z][A-Z]|[A-Z][a-z]", candidate):
        return 3
    if "_" in candidate or "$" in candidate:
        return 2
    if len(candidate) >= 10:
        return 1
    return 0


def guess_symbol_from_query(query: str) -> str | None:
    text = (query or "").strip()
    if not text:
        return None
    best: tuple[int, str] | None = None
    for match in _SYMBOL_CANDIDATE.finditer(text):
        candidate = next(g for g in match.groups() if g)
        if "/" in candidate or "." in candidate and candidate.count(".") > 2:
            continue
        if candidate.lower() in _SKIP_SYMBOLS:
            continue
        if len(candidate) < 4:
            continue
        rank = _symbol_rank(candidate)
        if best is None or rank > best[0] or (rank == best[0] and len(candidate) > len(best[1])):
            best = (rank, candidate)
    return best[1] if best else None


def _intent_summary(intents: list[dict[str, object]]) -> str:
    if not intents:
        return "（未分类，按默认精确检索）"
    parts: list[str] = []
    for item in intents[:4]:
        ident = str(item.get("id", ""))
        conf = str(item.get("confidence", ""))
        parts.append(f"{ident}（{conf}）" if conf else ident)
    return "、".join(parts)


def _cursor_step_for_route(route: dict[str, object], *, symbol: str, query: str) -> str | None:
    role = str(route.get("role", ""))
    route_id = str(route.get("id", ""))

    if role == "verification":
        return None

    if route_id == "caller-chain-ast" or (
        role == "ast" and "caller" in route_id
    ):
        return (
            f"使用 **codegraph_callers**，符号 `{symbol}`，列出调用链；"
            "再补 codegraph_explore 若需跨文件流。"
        )
    if route_id.startswith("trap-demote") and role == "ast":
        return (
            f"使用 **codegraph_search** / **codegraph_explore**，消歧同名符号 `{symbol}`（跨 package trap）。"
        )
    if route_id.startswith("extension") and role == "ast":
        return (
            f"使用 **codegraph_search**，路径侧重 `extensions/`，符号 `{symbol}`。"
        )
    if role == "ast" or route_id in ("ast-codegraph",):
        return (
            f"使用 **codegraph_explore** 或 **codegraph_node**（`includeCode=true`），"
            f"围绕 `{symbol}` 或问题：{query[:120]}"
        )

    if route_id == "platform-semantic" or (
        role == "semantic" and str(route.get("sourceFamily")) == "platform-semantic"
    ):
        return (
            "使用 Cursor **内置代码库语义搜索**（Agent 语义搜索能力，等同 @codebase 语义索引；"
            "**不要**使用 fast-context MCP）。"
        )
    if role == "semantic":
        return (
            "使用 **fast_context_search**（非 Cursor 平台语义路由）；"
            "若在 Cursor 上应改用内置语义搜索。"
        )

    if route_id == "lsp-navigation" or role == "lsp":
        return (
            f"可选：若宿主暴露 **GO_TO_DEFINITION** / 查找引用，在已有候选上核对 `{symbol}`；"
            "非 Agent 默认保证，未调用时用 **Read** + **Grep** 验证。"
        )

    if route_id == "policy-docs-rg" or str(route.get("sourceFamily")) == "policy-docs":
        return (
            "使用 **Grep** 在 `AGENTS.md`、`**/AGENTS.md`、`.trellis/spec`、`README.md` "
            "中搜索策略/边界关键词。"
        )

    if role == "exact" or "rg" in route_id:
        return (
            f"使用 **Grep**（Instant Grep）搜索字面量/路径；优先与 `{symbol}` 或用户给出的路径相关模式。"
        )

    if route_id == "cross-cutting-discovery" or "deep" in route_id.lower():
        return (
            "复杂跨模块探索：可选用 **DEEP_SEARCH** 或 Explore 子任务，再用 Grep/codegraph 验证。"
        )

    return f"按路由 `{route_id}`（{role}）执行，再 Read 源码确认。"


def _generic_step_for_route(route: dict[str, object], *, symbol: str, query: str) -> str | None:
    role = str(route.get("role", ""))
    if role == "verification":
        return None
    commands = route.get("commands")
    cmd_hint = ""
    if isinstance(commands, list) and commands:
        cmd_hint = str(commands[0])[:160]
    return f"执行路由 `{route.get('id')}`（{role}）：{cmd_hint or query[:80]}"


def render_agent_instructions(
    plan: dict[str, object],
    *,
    platform: str = PLATFORM_CURSOR,
    locale: str = "zh",
) -> str:
    """
    Turn a route_codebase_retrieval envelope into numbered agent steps.
    """
    envelope = _plan_dict(plan)
    query = str(envelope.get("query", ""))
    intents = envelope.get("intents")
    routes = envelope.get("routes")
    fallback = envelope.get("fallback")
    verification = envelope.get("verification")

    intent_list = intents if isinstance(intents, list) else []
    route_list = routes if isinstance(routes, list) else []
    fallback_list = fallback if isinstance(fallback, list) else []
    verification_list = verification if isinstance(verification, list) else []

    symbol = guess_symbol_from_query(query) or "<symbol>"

    if locale != "zh":
        header = f"## Codebase retrieval plan ({platform})\n"
    else:
        header = f"## 代码库检索计划（{platform}）\n"

    lines = [
        header.rstrip(),
        f"问题：{query or '（空）'}",
        f"意图：{_intent_summary(intent_list)}",
        "",
    ]

    step = 0
    use_cursor = platform == PLATFORM_CURSOR
    sorted_routes = sorted(
        route_list,
        key=lambda r: int(r.get("order", 0)) if isinstance(r, dict) else 0,
    )
    for route in sorted_routes:
        if not isinstance(route, dict):
            continue
        text = (
            _cursor_step_for_route(route, symbol=symbol, query=query)
            if use_cursor
            else _generic_step_for_route(route, symbol=symbol, query=query)
        )
        if not text:
            continue
        step += 1
        lines.append(f"{step}. {text}")

    if step == 0:
        step += 1
        lines.append(
            f"{step}. 使用 **Grep** 搜索关键词，再 **Read** 打开候选文件验证。"
        )

    if fallback_list:
        lines.append("")
        lines.append("**降级**：")
        for hint in fallback_list[:3]:
            if not isinstance(hint, dict):
                continue
            when = str(hint.get("when", ""))
            action = str(hint.get("action", ""))
            if when and action:
                lines.append(f"- 当 {when} → {action}")

    if verification_list:
        lines.append("")
        lines.append("**验证**（下结论前）：")
        for ver in verification_list[:4]:
            if not isinstance(ver, dict):
                continue
            req = str(ver.get("requirement", ""))
            if req:
                lines.append(f"- {req}")

    if use_cursor:
        lines.append("")
        lines.append(
            "**codegraph 独用场景**：调用链、跨包 trap、extension 符号、影响面；"
            "纯字面搜索用 Grep，单点定义用 GO_TO_DEFINITION。"
        )

    try:
        from .retrieval_result_ranking import (  # noqa: PLC0415
            intent_ids_from_router_envelope,
            result_layer_ranking_hint,
        )

        intent_ids = intent_ids_from_router_envelope(envelope)
        ranking_hint = result_layer_ranking_hint(intent_ids, locale=locale)
        if ranking_hint:
            lines.append("")
            lines.append(ranking_hint.rstrip())
    except Exception:
        pass

    return "\n".join(lines).strip() + "\n"