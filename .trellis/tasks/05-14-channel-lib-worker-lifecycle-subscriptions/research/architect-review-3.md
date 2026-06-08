# Architect Review 3

## Channel

- Channel: `channel-lib-worker-lifecycle-arch`
- Worker: `arch3`
- Final answer seq: `6015`
- Done seq: `6016`

## Verdict

Fix required before user planning review / `task.py start`.

## Findings

1. Worker reducer SOT still had drift risk.
   - `pendingMessageCount` referenced delivery cursor state, but `reduceWorkerRegistry(events)` cannot depend on host-local `.inbox-cursor`.
   - Resolution: pending must be derived only from durable events. `turn_started.inputSeq` is the durable consumed marker.

2. `inboxPolicy` durable source was ambiguous.
   - “spawned event or spawn config” is invalid because spawn config is host-local runtime state.
   - Resolution: `spawned.inboxPolicy?: InboxPolicy`; old events project to `explicitOnly`.

3. `interruptWorker` lacked runtime injection.
   - Core cannot call CLI adapters directly.
   - Resolution: `interruptWorker(input, runtime)` orchestrates provider interrupt through injected runtime; `requestInterrupt(input)` is durable-event-only.

4. Cross-channel cursor key was undefined.
   - `Record<string, number>` needs a stable key for global/project same-name channels.
   - Resolution: introduce `ChannelCursorKey` and `channelCursorKey(ref) = "${scope}/${project}/${name}"`.

5. `readChannelEvents({ limit })` without cursor was underspecified.
   - Resolution: `limit` only returns latest N events in ascending seq order.
