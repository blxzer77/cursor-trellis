"""Neutral semantic-intent reminder for V3 retrieval plans."""

from __future__ import annotations

from typing import Any


def platform_semantic_order_from_envelope(envelope: dict[str, Any]) -> int | None:
    steps = envelope.get("steps")
    if not isinstance(steps, list):
        return None
    for step in steps:
        if (
            isinstance(step, dict)
            and step.get("intent") == "semantic"
            and step.get("kind") == "provider-request"
        ):
            order = step.get("order")
            return order if isinstance(order, int) else None
    return None


def semantic_compliance_gate_hint(
    envelope: dict[str, Any], *, locale: str = "zh"
) -> str:
    steps = envelope.get("steps")
    if not isinstance(steps, list):
        return ""
    step = next(
        (
            item
            for item in steps
            if isinstance(item, dict)
            and item.get("intent") == "semantic"
            and item.get("kind") == "provider-request"
        ),
        None,
    )
    if not isinstance(step, dict) or not isinstance(step.get("providerRequirement"), dict):
        return ""
    requirement = step["providerRequirement"]
    if locale != "zh":
        return (
            f"**Semantic retrieval gate:** step #{step['order']} requests a project-resolved "
            f"semantic capability at minimum assurance `{envelope.get('minimumAssurance')}` "
            f"(status: `{requirement.get('status')}`). Treat every result as a candidate until source, Git, "
            "or repeatable-test corroboration succeeds."
        )
    return (
        f"**语义检索门控：** 第 {step['order']} 步请求由项目 Resolver 解析的语义能力，"
        f"最低 assurance 为 `{envelope.get('minimumAssurance')}`（状态：`{requirement.get('status')}`）。"
        "所有结果在源码、Git 或可重复测试完成佐证前都只能作为 candidate。"
    )
