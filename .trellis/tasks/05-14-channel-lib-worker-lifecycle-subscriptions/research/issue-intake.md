# Issue Intake

## Source

- Channel: global `trellis-issue`
- Thread: external daemon/core SDK needs
- Event: `thread comment`, seq `18`
- Timestamp: `2026-05-14T11:38:56.022Z`

## Summary

The new issue says an external daemon wants to lower agent execution to `@mindfoldhq/trellis-core` channel APIs, but core currently lacks the runtime side of channel-as-lib: spawn, supervisor, inbox watcher, worker registry, interrupt, paginated event reads, and cross-channel subscription. The issue asks Trellis to turn those CLI/runtime policies into explicit reusable core contracts instead of copying CLI hardcoded behavior.

## Requested Design Areas

1. `inboxPolicy` for `channel.spawn`.
2. Core worker registry and liveness projection.
3. `undeliverable` signal for messages sent to nonexistent or terminal workers.
4. First-class `interruptWorker` and provider-level interrupt behavior.
5. Worker turn activity state and queue-till-boundary delivery.
6. Cursor pagination for `readChannelEvents`.
7. Cross-channel subscription with per-channel cursor and dynamic discovery.

## Explicit Non-Gaps From The Issue

- Post-spawn context injection is not needed for this design.
- Single-channel resumable watch already exists.
- Channel metadata and thread reducers already exist and should be reused.
- Product-specific per-turn runtime timeline reducers belong outside Trellis core.

## Initial Interpretation

This is not a new product feature by itself. It is a package boundary and API design task: move reusable channel runtime substrate into core while keeping CLI and external products as consumers.
