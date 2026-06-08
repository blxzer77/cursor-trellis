# Research Notes

## Source inputs

- `ts-sdk-author` skill: SDK package layout, public API boundaries, exports, build and verification strategy.
- Global `trellis-issue` thread discussing core SDK extraction.
- Trellis channel spec: `.trellis/spec/cli/backend/commands-channel.md`.
- Current channel source tree: `packages/cli/src/commands/channel/**`.
- Event attribution design note in `.trellis/tasks/05-13-channel-topics-managed-agents/design.md`.

## Decisions imported from discussion

- `@mindfoldhq/trellis-core` should be a real package, not a CLI wrapper.
- CLI should call core.
- Downstream Node consumers should call core in-process.
- Core first version should be Node-only ESM.
- Do not encode external product users/orgs in Trellis protocol.
- Keep `by/to/origin/meta` minimal and pass-through.
- First extraction should prioritize data/store/thread API before process runtime.
- `.trellis/tasks/05-13-channel-topics-managed-agents/design.md` is historical
  context. Current naming decisions in this task and
  `.trellis/spec/cli/backend/commands-channel.md` supersede its older
  `--type thread` wording; new APIs and writes use `threads`.

## Existing channel audit

GitNexus was reindexed for this Trellis worktree on 2026-05-13 and reports
12,920 nodes, 17,458 edges, 197 clusters, and 300 flows. The graph audit used
symbol context and impact checks for the current channel implementation.

Confirmed existing behavior:

- `ThreadState.status` already models lifecycle; `opened` defaults to `open`,
  `status` can set values such as `closed`, and `processed` sets
  `processed` when no explicit status is provided.
- `channel threads --status <status>` already filters reduced thread state by
  status.
- There is no existing thread archive/unarchive event. Adding archive would
  duplicate the status lifecycle axis.
- `ChannelMetadata` is currently projected from the create event only:
  `type`, `description`, `linkedContext`, and `labels`.
- Existing channel hiding behavior is `ephemeral`; it is tied to
  `channel run`, `channel list --all`, and `channel prune --ephemeral`.
- There is no existing channel display title event. A title feature should be
  added as display metadata, not as address rename.
- Channel address is the storage directory key; changing it requires a
  future storage move operation, not an append-only event.

GitNexus graph findings:

- `reduceThreads` is the current central thread projection. It is called by
  `channelThreadsList`, `channelThreadShow`, `printThreadBoard`, and channel
  tests. Upstream impact is high because thread projection flows into both
  `threads` and `messages --threads` display paths.
- `applyThreadAction` is already switch-based and is the right single place
  for thread lifecycle projection. Rename/context changes should extend this
  reducer path instead of adding ad hoc logic in command handlers.
- `readChannelMetadata` reads all events and then delegates to
  `metadataFromCreateEvent(events.find(isCreateEvent))`; current metadata is
  therefore create-event-only. Channel title/context projection needs a new
  metadata reducer rather than patching list/show separately.
- `channelList` only hides ephemeral channels unless `--all` is provided.
  There is no separate hidden/archive channel state to preserve.

## Architect review findings

`arch-trellis-core-sdk-review` completed an architecture brainstorm/review on
2026-05-13. The review accepted the overall package boundary and release
strategy, but found planning gaps to resolve before implementation starts:

- Public core API must explicitly include P0 mutations:
  channel/thread context add/delete/list, thread rename, channel title set/clear,
  `reduceChannelMetadata(events)`, and `reduceThreads(events)`.
- Thread rename needs conflict, alias-chain, old-key lookup, and late-event
  semantics before code starts.
- `appendEvent` sidecar seq needs concrete file format, lock behavior,
  corruption recovery, and concurrent append verification.
- CLI must not deep import core internal paths after extraction. Formatting can
  remain in CLI, but validation, normalization, and projection must come from
  core public API.
- Release verification must inspect packed tarballs so the published CLI depends
  on the exact same core version, not `workspace:*` or a loose range.
