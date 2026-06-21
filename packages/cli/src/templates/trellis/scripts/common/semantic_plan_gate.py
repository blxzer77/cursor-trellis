"""REC-11: post-plan hints when platform-semantic is first-class in the router envelope."""

from __future__ import annotations

from typing import Any


def platform_semantic_order_from_envelope(envelope: dict[str, Any]) -> int | None:
    routes = envelope.get("routes")
    if not isinstance(routes, list):
        return None
    for route in routes:
        if not isinstance(route, dict):
            continue
        if route.get("id") == "platform-semantic":
            order = route.get("order")
            if isinstance(order, int):
                return order
    return None


def semantic_compliance_gate_hint(
    envelope: dict[str, Any],
    *,
    platform: str = "cursor",
    locale: str = "zh",
) -> str:
    """
    When platform-semantic is order 1 (or 2 on policy-first routes), append a
    hard compliance strip for eval / hook-injected plans (REC-06 + REC-11).
    """
    if platform != "cursor":
        return ""
    order = platform_semantic_order_from_envelope(envelope)
    if order is None or order > 2:
        return ""
    routes = envelope.get("routes") or []
    if not isinstance(routes, list):
        return ""
    if not any(isinstance(r, dict) and r.get("id") == "platform-semantic" for r in routes):
        return ""

    if locale != "zh":
        return (
            "**Plan gate (REC-11):** `platform-semantic` is step "
            f"#{order}. Before Top-1 you MUST run one Cursor built-in codebase "
            "semantic search and log the exact tool name. Do not use fast-context MCP. "
            "If semantic returns paths, corroborate with Read on candidate ranges."
        )
    return (
        "**计划门控（REC-11）：** 本问 `platform-semantic` 为第 "
        f"{order} 步。定 Top-1 前 **必须** 执行 1 次 Cursor **内置代码库语义搜索**，"
        "并在记录中写下宿主工具名；**禁止** fast-context MCP。"
        "语义命中路径后须 **Read** 验证候选片段（verified 层）。"
    )