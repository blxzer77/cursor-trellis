---
name: trellis-micro-grill
description: "Clarifies small underspecified Trellis requests with one high-value question at a time before direct execution. Use when a request is likely small, missing details would materially change the result, and creating a Trellis task would be premature."
---

# Trellis Micro-Grill

## Goal

Clarify a small request just enough to execute it directly without creating Trellis task artifacts by default.

## Hard Constraints

- Always ask exactly one high-value question at a time.
- Always inspect local files first when the missing answer is discoverable from the project.
- Always include a recommended answer when enough evidence exists.
- Always use Simplified Chinese for user-facing questions.
- Never create Trellis task artifacts by default.
- Never keep grilling after the request is clear enough to execute.
- Never repeat already answered questions after escalation.

## Thinking Principles

These two principles shape *which* question is worth asking and *what* to recommend — apply them inside the one-question-per-message contract above.

### First Principles

Pick the question whose answer most changes the result by tracing the request back to its root user value, not to how similar requests are usually handled.

- Separate the **root need** from **inherited shape** ("I want X like Y") — grill the root need first.
- Prefer the question that, once answered, collapses the most other candidate questions.

### Occam's Razor

Your recommended answer defaults to the **minimal sufficient** option that still satisfies the likely acceptance bar. Complexity must be justified by evidence you can cite, not added speculatively. If two clarifications are equally valid, recommend the simpler one.

## Workflow

1. Confirm internally that the request is small, underspecified, and not already covered by a selected Trellis task.
2. Inspect relevant local context first if it can answer the missing detail.
3. Ask one question whose answer would most change the result.
4. Include a recommended answer with the concrete tradeoff.
5. After the user answers, summarize the clarified requirement in one or two Chinese sentences.
6. Execute directly once the requirement is clear enough.

## Escalation

Escalate once when the clarified work no longer fits Micro-Grill:

- Use Lite Task when there is one independently verifiable deliverable that needs persistence, review, or continuation.
- Use Full Task when one deliverable has broad impact, platform-adapter changes, external research dependency, or durable design risk.
- Use Parent/Child when there are multiple independently verifiable deliverables, staged execution, parallel execution, or Parent-controlled integration needs.

When escalating, hand the clarified answers into `trellis-brainstorm` and update Trellis artifacts there.

## When NOT to Use

- Do not use for multi-deliverable work.
- Do not use for cross-platform workflow changes.
- Do not use for risky refactors, migrations, prompt deployments, or durable architecture decisions.
- Do not use when the request is already clear enough to execute.
- Do not use when there is already a selected Trellis task for the work.
