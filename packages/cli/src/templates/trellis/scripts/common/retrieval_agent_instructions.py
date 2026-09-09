#!/usr/bin/env python3
"""Render a neutral V3 retrieval plan as bounded agent instructions."""

from __future__ import annotations

import re
from typing import Any


_SYMBOL_CANDIDATE = re.compile(
    r"`([^`]+)`|\b([A-Za-z_$][A-Za-z0-9_$]{2,})\b"
)
_SKIP_SYMBOLS = frozenset(
    {"where", "which", "what", "when", "how", "does", "find", "show", "source", "exact"}
)


def guess_symbol_from_query(query: str) -> str | None:
    for match in _SYMBOL_CANDIDATE.finditer(query):
        candidate = next((part for part in match.groups() if part), "").strip()
        if candidate and candidate.lower() not in _SKIP_SYMBOLS:
            return candidate
    return None


def _intent_label(intent: str, locale: str) -> str:
    if locale != "zh":
        return intent
    return {
        "exact": "精确",
        "semantic": "语义",
        "structural": "结构",
        "external": "外部",
    }.get(intent, intent)


def _step_instruction(plan: dict[str, Any], index: int, locale: str) -> str:
    step = plan["steps"][index]
    if step.get("kind") == "local-exact":
        symbol = guess_symbol_from_query(str(plan.get("query", "")))
        if locale != "zh":
            return (
                f"Use `rg` for the exact candidate `{symbol}` within the declared scope hints."
                if symbol
                else "Use `rg` for bounded local text, path, or symbol candidates within the declared scope hints."
            )
        return (
            f"在声明的 scope hints 内用 `rg` 精确定位候选 `{symbol}`。"
            if symbol
            else "在声明的 scope hints 内用 `rg` 做有界的本地文本、路径或符号定位。"
        )
    requirement = step.get("providerRequirement")
    if not isinstance(requirement, dict):
        return (
            "Stop because the Provider requirement is missing."
            if locale != "zh"
            else "Provider requirement 缺失，停止执行。"
        )
    if locale != "zh":
        return (
            f"Request the `{step['intent']}` intent from the project resolver with minimum assurance "
            f"`{requirement['minimumAssurance']}` and status `{requirement['status']}`. "
            "Do not infer or choose an implementation in the planner."
        )
    return (
        f"向项目 Resolver 请求 `{step['intent']}` intent，最低 assurance 为 "
        f"`{requirement['minimumAssurance']}`，当前状态为 `{requirement['status']}`。"
        "不得在 Planner 或说明文本中推断、选择具体实现。"
    )


def render_agent_instructions(plan: dict[str, Any], *, locale: str = "zh") -> str:
    if not isinstance(plan, dict) or plan.get("schemaVersion") != 3:
        raise TypeError("plan must be a V3 retrieval envelope")
    intents = plan.get("intents")
    steps = plan.get("steps")
    if not isinstance(intents, list) or not isinstance(steps, list):
        raise TypeError("plan intents and steps must be lists")
    if locale != "zh":
        lines = [
            f"Retrieval plan V{plan['schemaVersion']}",
            f"Intents: {', '.join(_intent_label(str(intent), locale) for intent in intents)}",
            f"Minimum assurance: {plan['minimumAssurance']}",
            "",
        ]
    else:
        lines = [
            f"检索计划 V{plan['schemaVersion']}",
            f"意图：{'、'.join(_intent_label(str(intent), locale) for intent in intents)}",
            f"最低 assurance：{plan['minimumAssurance']}",
            "",
        ]
    for index in range(len(steps)):
        lines.append(f"{index + 1}. {_step_instruction(plan, index, locale)}")
    lines.extend(
        [
            "",
            (
                "Verification: candidate -> corroborate with source/Git/repeatable tests -> classify evidence -> check assurance -> accept or stop."
                if locale != "zh"
                else "验证链：candidate → 源码/Git/可重复测试佐证 → Evidence 分类 → assurance 检查 → 接受或停止。"
            ),
        ]
    )
    from .semantic_plan_gate import semantic_compliance_gate_hint

    gate = semantic_compliance_gate_hint(plan, locale=locale)
    if gate:
        lines.extend(["", gate])
    reasons = plan.get("stopReasons")
    if isinstance(reasons, list) and reasons:
        codes = [str(reason.get("code")) for reason in reasons if isinstance(reason, dict)]
        lines.extend(
            [
                "",
                (
                    f"Blocking reasons: {', '.join(codes)}"
                    if locale != "zh"
                    else f"阻断原因：{'、'.join(codes)}"
                ),
            ]
        )
    return "\n".join(lines) + "\n"
