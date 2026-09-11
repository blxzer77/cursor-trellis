# Recovery runbooks

English | [简体中文](recovery.zh-CN.md)

Use the symptom, evidence, recovery, and escalation sequence below. Recovery is
local and reversible until a user explicitly confirms a destructive purge.

| Symptom                  | Evidence                                             | Recovery                                                                                                 | Escalate when                                       |
| ------------------------ | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Adapter is `degraded`    | Capability JSON, projection receipt, ownership entry | Resolve the host dependency or conflict, then retry that Adapter; do not rebuild siblings.               | Receipt says interrupted or ownership is ambiguous. |
| Ownership conflict       | Preimage and current-byte fingerprint                | Preserve the file; choose explicit reuse, rename, or skip.                                               | The owner or claimant cannot be established.        |
| Stale purge preview      | New target fingerprint differs                       | Stop; run a fresh dry-run and review the changed target set.                                             | Active claims or unsafe target remain.              |
| Unsealed rollback target | Generation verification error                        | Select a sealed generation from install state/receipts.                                                  | No sealed generation is available.                  |
| Bin conflict             | Command resolves to an unexpected executable         | Inspect PATH and package bins; use the canonical `pactile` bin and do not remove a user's alias blindly. | The package manifest or installed bin is ambiguous. |

Never repair by deleting `.pactile/`, rewriting a legacy source, or copying a
secret into a template. Capture the minimal command output and open a governed
issue using [Support](../governance/index.md).
