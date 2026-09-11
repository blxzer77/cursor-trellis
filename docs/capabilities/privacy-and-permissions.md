# Privacy and permissions

English | [简体中文](privacy-and-permissions.zh-CN.md)

Pactile is local project tooling. It records the minimum metadata needed to
rebuild projections and audit claims; it does not own host credentials, OAuth
state, or private reasoning.

| Data or action                         | Default boundary                                           | Evidence and consent                                                |
| -------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------- |
| `.pactile/` state and receipts         | Local project files                                        | User controls repository access and retention.                      |
| Host projections and native assets     | Host/user-owned unless a managed receipt says otherwise    | Ownership preimage and claimant ledger.                             |
| Provider query/context                 | Only the selected, approved Provider and permitted context | Manifest, policy ceiling, and bounded probe/result.                 |
| Credential/API key                     | Host secret store or environment; never a project template | Presence may be checked; value is never recorded.                   |
| Network, browser, GitHub, or MCP write | Not automatic                                              | Explicit user intent, host authorization, and a reviewable receipt. |
| Destructive purge                      | No default                                                 | Dry-run target fingerprint followed by exact explicit confirmation. |

Do not paste tokens, private logs, hidden model reasoning, or unrelated project
files into issues, Evidence, or Provider prompts. A Provider may be ready while
its requested assurance is insufficient; fail closed and explain the next safe
action.
