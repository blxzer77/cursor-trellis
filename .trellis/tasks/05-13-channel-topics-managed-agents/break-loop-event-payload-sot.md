# Bug Analysis: Event Payload Contract Drift

### 1. Root Cause Category

- **Category**: B - Cross-Layer Contract; C - Change Propagation Failure
- **Specific Cause**: Thread channels added new event fields (`thread`,
  `action`, `description`, `linkedContext`, labels, assignees, `lastSeq`), but
  the first pass let UI commands, reducers, and filters read raw event payloads
  independently. `events.jsonl` was the storage SOT, but the payload contract
  was not centralized.

### 2. Why Fixes Failed

1. Initial reducer fix: added `lastSeq`, but reducer still accepted
   `Record<string, unknown>`, so the event contract remained outside the event
   layer.
2. Pretty-output fix: displayed `description` and `linkedContext`, but did so
   with local casts in `messages.ts`, duplicating field interpretation.
3. Review pass: found behavior gaps, but did not initially enforce the
   architecture rule that all consumers must share event type guards and
   projections.

### 3. Prevention Mechanisms

| Priority | Mechanism | Specific Action | Status |
|----------|-----------|-----------------|--------|
| P0 | Architecture | `store/events.ts` owns event variants, `isThreadEvent`, and `metadataFromCreateEvent` | DONE |
| P0 | Code reuse | `store/schema.ts` owns `asStringArray` and `asLinkedContextEntries` normalization | DONE |
| P0 | Documentation | Update cross-layer and code-reuse thinking guides with event payload SOT rules | DONE |
| P1 | Test coverage | Add broader regressions for global supervisor scope and live `wait --kind thread --thread` | TODO |
| P1 | Review checklist | In channel spec, require UI commands to import shared projections instead of casting payload fields | DONE |

### 4. Systematic Expansion

- **Similar Issues**: Any command reading JSONL/RPC/config payloads with
  repeated local casts can drift in the same way.
- **Design Improvement**: Treat append-only logs as layered contracts:
  writer assigns identity, event layer decodes, filter layer selects, reducer
  projects state, UI formats only.
- **Process Improvement**: When a new `kind` or `action` appears, review must
  grep for local casts and repeated field extraction before approving.

### 5. Knowledge Capture

- [x] Updated `.trellis/spec/guides/cross-layer-thinking-guide.md`
- [x] Updated `.trellis/spec/guides/code-reuse-thinking-guide.md`
- [x] Updated `.trellis/spec/guides/index.md`
- [x] Synced guide templates under `packages/cli/src/templates/markdown/spec/guides/`
- [x] Updated `.trellis/spec/cli/backend/commands-channel.md`
