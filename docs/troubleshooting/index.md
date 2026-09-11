# Troubleshooting index

English | [简体中文](index.zh-CN.md)

Start with read-only evidence. Do not delete a host file, bypass a fingerprint,
or repeat a destructive command while the cause is unknown.

| Symptom                           | Runbook                                   | First evidence                                                          |
| --------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------- |
| Capability is missing or stale    | [Doctor-style checks](doctor.md)          | `pactile capability-smoke --json`.                                      |
| Projection or migration stopped   | [Recovery](recovery.md)                   | Install state, ownership ledger, receipt, and current-byte fingerprint. |
| Need to know a supported boundary | [Known limitations](known-limitations.md) | Mode, Provider readiness, and host-specific evidence.                   |

Common sequence:

```bash
pactile capability-smoke --json
pactile update --dry-run
pactile validate-rules
```

Keep the output, command exit status, and the affected path. Redact tokens,
private logs, and user content before sharing.
