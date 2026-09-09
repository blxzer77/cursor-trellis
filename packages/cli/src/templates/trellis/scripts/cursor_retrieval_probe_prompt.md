# Pactile retrieval V3 — manual resolver probe

This compatibility asset probes the neutral request/resolver boundary. It does
not ask the planner to discover or select a host tool.

## Procedure

1. Generate a V3 plan with one of the four intents: `exact`, `semantic`,
   `structural`, or `external`.
2. For every `provider-request` step, pass its `providerRequirement` unchanged
   to the project resolver.
3. Record only the returned M0 resolution contract and its repeatable evidence
   references. Do not insert an implementation identity into the plan.
4. Treat every returned item as a candidate until source, Git, or repeatable
   test corroboration succeeds.

## Result form

```text
RETRIEVAL V3 RESOLVER PROBE
intent: exact|semantic|structural|external
plan_fingerprint: sha256:<hex>
resolver_status: ready|degraded|unavailable|unsupported|not-requested
minimum_assurance: best-effort|evidence-backed|verified
evidence_refs: <logical references, or none>
corroboration: source-reference|git-evidence|repeatable-test|none
verdict: pass|degraded|fail
notes: <bounded observations>
```

A `degraded`, `unavailable`, or `unsupported` result is valid plan data. It must
produce the corresponding generic stop reason; it must never trigger planner-
side selection of another implementation.
