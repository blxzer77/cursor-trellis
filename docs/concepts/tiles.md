# Tiles

English | [简体中文](tiles.zh-CN.md)

## Definition

A Tile is a small, versioned capability contract that the model or user can select and compose for one task. It states what the capability needs and permits; it does not prescribe private reasoning or embed a host-specific script.

## Responsibilities

A Tile declares:

- stable identity and semantic version;
- trigger and supported intent;
- logical inputs, outputs, dependencies, and conflicts;
- filesystem, process, network, credential, privacy, telemetry, destination, and cost ceilings;
- minimum assurance and required Evidence kinds;
- bounded fallback policy, stop conditions, and attempt limit.

The compiler checks dependencies, conflicts, policy ceilings, deterministic ordering, and fallback bounds before execution. The model still chooses the useful Tiles and interprets the task; the Kernel is not a central planner.

## Boundaries

A Tile contains no steps DSL, tool or MCP server name, Cursor/Codex path, prompt transcript, arbitrary URL, credential value, or private chain of thought. An intent such as `structural` or `external` is resolved later through Middleware. MCP is one possible Provider integration, not a Tile.

Fallback cannot broaden permission, destination, egress, credential, telemetry, cost, or assurance policy. Network-forbidden Tiles cannot smuggle remote behavior through a fallback.

## User scenario

A repository investigation needs exact symbol lookup and a structural dependency view. The model selects two Tiles with compatible outputs. The compiler orders them, verifies that neither requests network access, and records the selection. If the structural Provider is unavailable, the declared fallback can use local exact search only when it remains within the original ceiling and still meets the minimum assurance; otherwise the result is degraded with an explicit action.

## What to inspect

- The Tile manifest tells you the maximum authority requested.
- The resolved Provider tells you the actual origin, assurance, readiness, and Evidence.
- Trace tells you whether the Tile was selected, invoked, skipped, failed, or completed.
- A policy denial is a valid outcome, not a reason to silently run a broader tool.

See [Kernel, Evidence, and Trace](kernel-evidence-trace.md) and [Capabilities](../capabilities/index.md).
