# Architect Brainstorm Notes

## Round 1

The architect recommended extending `channel` rather than adding a separate issue subsystem.

- Initial discussion proposed `scope`, `type`, and thread metadata, but later product review rejected `type` as over-modeled.
- Use a reserved `_global` bucket for cross-project channels.
- Keep `events.jsonl` as the durable source of truth.
- Avoid overloading `send --kind`; it currently stores `tag`, while `messages --kind` filters event kind.
- Treat managed resident agents as a wrapper over existing channel workers, not a new daemon model.
- Watch bucket lookup carefully because global/project channels with the same name can shadow each other.

## Round 2

The architect recommended a smaller v1.

- Ship `scope`, labels, thread events, thread listing, and structured `post`.
- Defer managed resident agents to v2.
- Use `kind: "thread"` plus `action` values instead of manythread-specific event kinds.
- Do not add `threads.json` in v1; reducethreads from `events.jsonl`.
- Add `--scope` to existing-channel commands and error on project/global ambiguity.

## Round 3

The architect pressure-tested whether managed resident agents belong in v1.

- Keep managed resident agents out of v1 unless product requirements demand automatic triage, background listening, SLA handling, automatic recovery, or exactly-once processing.
- Put future-agent hooks into v1 instead of operational lifecycle:
  - add `kind: "thread"` to channel event kind parsing and wake filtering;
  - reserve `action: "summary"` and `action: "processed"`;
  - store provenance fields such as `sourceProject`, `sourceCwd`, `sourceTask`, and `sourceChannel`;
  - allow `messages --thread` and `wait --kind thread --thread`.
- Do not make existing worker inbox consume thread events automatically.
- Do not add dormant managed-agent config in v1.

## Round 4

The architect pressure-tested CLI naming and scope resolution.

- Keep `post` as the structuredthread-event primitive.
- Do not encode thread events through `send`.
- Add `send --tag` and treat `send --kind` as a legacy alias for message tags.
- Keep `messages/wait --kind` as event kind filtering.
- Keep thread `action` separate from event `kind`.
- Add `--scope project|global` to existing-channel commands that can read, write, spawn, wait, delete, list, or prune channels.
- Refuse unscoped commands when a name exists in both project and global buckets.

## Round 5

The architect pressure-tested cross-layer implementation risk.

- Build a small shared channel kernel before command-specific changes:
  - scope resolver;
  - event schema;
  - thread reducer;
  - shared event filter.
- Do not let `create`, `post`, `messages`, `wait`, `list`, `prune`, `spawn`, and `supervisor` each implement their own `_global` or thread logic.
- Treat `TRELLIS_CHANNEL_ROOT` spec/code mismatch as release-blocking before writing integration tests.
- Make thread reducer replay `events.jsonl`; do not write `threads.json` in v1.
- Cover project/global collision, raw fidelity, wait wake behavior, global supervisor env, and legacy channel compatibility with integration tests.

## Accepted V1 Shape

```bash
trellis channel create trellis-issues --scope global --type thread --labels trellis,feedback,issue-board
trellis channel post trellis-issues --thread uninstall-overwrites-user-files --action opened --title "uninstall should not hash user files" --label bug --stdin
trellis channel post trellis-issues --thread uninstall-overwrites-user-files --action comment --stdin
trellis channel threads trellis-issues --status open
trellis channel thread show trellis-issues uninstall-overwrites-user-files
trellis channel thread status trellis-issues uninstall-overwrites-user-files --status triaged
trellis channel thread label trellis-issues uninstall-overwrites-user-files --add bug --remove needs-info
```

## Release-Blocking Design Points

- `kind: "thread"` must be accepted by event parsing, message filtering, wait filtering, and the wake set.
- `send --kind` must be documented as a legacy alias for message tag, not event kind.
- Project/global ambiguity must error before appending any JSONL line.
- `spawn --scope global` must preserve `_global` in detached supervisor state.
- `messages --raw` must preserve all thread and provenance fields.
- Legacy channels without `scope`, `labels`, `thread`, or `action` must keep working.

## Product Correction

Arbitrary `--type` should not ship in v1.

- Other channel-like systems usually rely on names, labels, folders,threads, or workflows rather than a hard purpose type enum.
- A purpose type field would look like a behavior switch even if it starts as a semantic hint.
- `inbox`, `issue-board`, `cr`, and `release-watch` are better represented as labels or naming conventions.
- Runtime behavior should come from commands and events: `post`, `thread`, `wait`, labels, status, and future worker listeners.

## Product Correction 2

Channel should have two structural interaction shapes, not arbitrary purpose types.

- Chat channel: the current behavior. Default create path. `messages` shows the message timeline.
- Thread channel: explicitly created with `--type thread`. `messages` pretty default shows the thread list, like a Feishu thread group; `messages --thread <key>` enters one thread.
- Labels describe usage, but do not decide behavior.
- Thread channel behavior is a structural `type: "thread"`, not a semantic purpose enum.

## Lark Naming Check

`lark-cli schema im.chats.create` shows Feishu group creation uses `group_message_type` with:

- `chat`: 对话消息
- `thread`: 话题消息

Trellis keeps the same two-shape model but exposes it as `--type chat|thread`, because the product language in this repo is thread channel and individual thread.

## Product Correction 3

All channels should carry orientation metadata for agents, not only thread channels.

- Add `description` to channel create events for both `chat` and `thread` channels.
- Add `linkedContext` as a list of either absolute file references or raw text entries.
- Use repeatable CLI shape `--linked-context-file <absolute-path>` and `--linked-context-raw <text>`.
- Do not support semantic kinds like `task`, `spec`, `url`, or `channel`; task/spec context should be represented by absolute file paths, and external context can be captured as raw text.
- Thread opened events may also carry their own `description` and `linkedContext`.
- Agents should read channel-level description/context first, then thread-level description/context when entering a thread.

## Functional Review

The architect reviewed the current product model and returned `approve-with-changes`.

- Keep `type=chat` as timeline-first and `type=thread` as board-first.
- Keep `thread` naming, but document the difference between `--type thread`, `threads`, and `--thread <key>`.
- `description` is stable summary; `text` is opened/comment body.
- Channel labels and thread labels are separate layers.
- Thread channel `messages` pretty output must show a view hint and `--raw` remains the only stable audit view.
- v1 must not add `send --thread`; `send` is the chat/message primitive and `post` is the structured thread event primitive.
