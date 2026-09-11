# Kernel, Evidence, and Trace

English | [简体中文](kernel-evidence-trace.zh-CN.md)

These three concepts answer different questions about durable work:

- **Kernel:** may this state transition happen?
- **Evidence:** what observable fact supports the claim?
- **Trace:** what observable composition events happened, and in what order?

Keeping them separate prevents a successful command, a log line, or an Agent explanation from silently becoming project authority.

## Kernel

### Definition

The Kernel is Pactile's host-neutral validator and mutation boundary for durable records. It checks a requested task, gate, archive, lifecycle, or record transition against canonical state before accepting the write.

### Responsibilities

- validate record shape, phase, transition, and required gates;
- compare contract and artifact fingerprints where freshness matters;
- require recorded approval for execution instead of treating a preflight as consent;
- apply an accepted transition to canonical `.pactile/` state and emit an audit fact;
- reject invalid or stale requests with a typed, inspectable outcome.

### Boundary

The Kernel does not choose Tiles, plan the model's work, decide whether a Provider is useful, write host projections, or infer user approval. A passing `--check` proves only that a request is structurally ready; it does not authorize the corresponding mutation.

## Evidence

### Definition

Evidence is a stable reference to an observable artifact or fact that supports a claim. It may point to a validation result, a receipt, a reviewed diff, a probe result, or another bounded record kept by its owning subsystem.

### Responsibilities

- make readiness, assurance, gates, and completion claims auditable;
- identify the artifact and outcome precisely enough to re-check;
- preserve the distinction between a claim, the Evidence supporting it, and the authority that accepts it;
- carry freshness information when the claim depends on current Provider readiness.

### Boundary

Evidence is not private reasoning, a prompt transcript, a credential, or an arbitrary inline output dump. A reference is not proof by itself: the referenced fact must exist, be relevant to the claim, and meet any required freshness or reviewer boundary. Provider origin such as `native` or `provider` is also not Evidence of `verified` assurance.

## Trace

### Definition

Trace is an append-only, fingerprint-chained sequence of observable capability-composition events. It can record discovery, eligibility, selection, ordering, invocation, completion, failure, skip or fallback, Provider resolution, and Evidence recording.

### Responsibilities

- preserve event order through contiguous sequence numbers and previous-event fingerprints;
- connect a task, Tile, intent, Provider resolution, artifact, and Evidence without copying their content;
- expose whether a capability completed, degraded, fell back, or stopped;
- make interruption, stale-head writes, malformed events, and chain breaks detectable.

### Boundary

Trace contains no prompt, rationale, scratchpad, hidden chain of thought, secret, credential value, arbitrary URL, or prose error payload. It uses bounded logical references and symbolic error codes. Its hash chain detects inconsistent history when compared with a trusted head; it is integrity Evidence, not a digital signature.

## How they work together

```text
model selects Tiles
  -> Trace records observable selection and ordering
  -> Provider resolution links readiness Evidence
  -> capability produces artifacts and Evidence
  -> Kernel validates the requested durable transition
  -> canonical record changes only if the transition is accepted
  -> Trace records the observable outcome
```

The order matters. A capability can complete without satisfying a task gate. Evidence can exist without authorizing a state transition. The Kernel can reject a transition while the Trace still truthfully records what was attempted.

## User scenario

An Agent finishes a documentation change and runs focused checks. The check reports become Evidence, and Trace records the selected checking capability and its outcome. The Kernel still refuses archive until the required review gate, final acceptance, durable-learning decision, and reviewed change set are present. Once those facts are recorded, the same requested archive transition is accepted without rewriting the earlier Trace.

## What to inspect

| Question                             | Inspect                                                             |
| ------------------------------------ | ------------------------------------------------------------------- |
| Was the durable transition allowed?  | Kernel result and canonical task/lifecycle record                   |
| Which fact supports the claim?       | Evidence reference and its owning artifact or receipt               |
| What observable capability path ran? | Trace events and trusted head                                       |
| Who may write host files?            | Projection Plan, Reconciler receipt, and Ownership ledger—not Trace |

The strict schemas and fingerprint rules are documented in the [v1 contract reference](../pactile/contracts-v1.md). Continue with [Projection and Ownership](projection-and-ownership.md), [Spec system](spec-system.md), and [Task system](task-system.md).
