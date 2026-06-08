# Core channel durable idempotency design

## Boundary

This task changes `@mindfoldhq/trellis-core` channel mutation semantics only.
The CLI remains a caller of core APIs and does not gain new flags.

Core remains the owner of:

- event schema
- event append and seq allocation
- channel lock discipline
- replay/reducer contracts

## API Contract

Add `idempotencyKey?: string` directly to `SendMessageOptions` and
`PostThreadOptions`. Do not add it to `MutationCommonOptions` unless every
mutation API that inherits the shared type persists and tests the key.

```ts
await sendMessage({ channel, by, text, idempotencyKey });
await postThread({ channel, by, action, thread, text, idempotencyKey });
```

The event log persists the key on the event:

```json
{
  "kind": "message",
  "by": "main",
  "text": "hello",
  "idempotencyKey": "server-command-123",
  "seq": 2,
  "ts": "..."
}
```

## Append Semantics

`appendEvent` validates input, ensures the channel directory exists, and then
enters the channel lock. Inside the lock:

1. If no `idempotencyKey` is present, preserve the current fast path.
2. If an `idempotencyKey` is present, read the durable event log and find an
   event with the same key.
3. If no match exists, allocate the next seq and append normally.
4. If a match exists with the same `kind`, return the existing event.
5. If a match exists with a different `kind`, throw a clear error.

The lookup happens inside the lock so two concurrent writers using the same
key cannot both observe absence and append duplicates.

## Delivery Side Effects

`sendMessage` strict delivery modes append `undeliverable` events after the
message event is durable. A replayed `sendMessage` returns the original message
event, then re-runs delivery classification from the persisted message event
(`event.to`), not from the retry payload (`opts.to`).

To prevent duplicate strict-delivery side effects, generated `undeliverable`
events use a deterministic derived key when the message call has a key:

```ts
`${idempotencyKey}:undeliverable:${targetWorker}`
```

That keeps the original message key scoped to the message event while making
side-effect event replay stable.

## Validation

- Reject empty or whitespace-only keys.
- Preserve existing `origin` and `meta` validation.
- Do not validate global uniqueness across channels; idempotency is scoped to
  one channel event log.

## Compatibility

- Existing events without `idempotencyKey` replay exactly as before.
- Existing callers that do not pass a key keep append-only behavior.
- The JSONL schema is append-compatible because the new field is optional.
- No migration is needed.

## Tradeoffs

The first implementation scans `events.jsonl` only when an idempotency key is
provided. This keeps normal `.seq` sidecar appends on their current path while
giving retrying callers durable correctness. A sidecar index can be added later
if keyed writes become frequent enough to show measurable cost.
