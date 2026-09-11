# Retrieval and assurance

English | [简体中文](retrieval.zh-CN.md)

Retrieval is a routing policy, not a promise that every host has the same
search tool. Pactile uses four intents and reports the minimum assurance that
the active host and Provider facts actually support.

| Intent       | First route                            | Optional route            | Required proof                                         |
| ------------ | -------------------------------------- | ------------------------- | ------------------------------------------------------ |
| `exact`      | `rg`, path and literal search          | None required             | Read the current file and range.                       |
| `structural` | Explicit codegraph or equivalent       | Host structural adapter   | Confirm returned symbol/range in source.               |
| `semantic`   | Project-authorized semantic Provider   | Host-native semantic tool | Check binding, freshness, and policy; then exact-read. |
| `external`   | Explicit Provider such as smart-search | Approved web fallback     | Preserve source URL, timestamp, and relevance.         |

Run the capability check before claiming optional readiness:

```bash
pactile capability-smoke --json
```

Host identity or a user-global route file never selects a Provider. If a
Provider is absent, stale, unauthorized, or beyond the privacy policy, label
the result `heuristic`, `degraded`, or `unsupported` and continue with exact
search where safe. Candidate retrieval is not final Evidence until a current
source, Git diff, test, or bounded receipt corroborates it.

## Privacy boundary

External intent may send only the user-approved query and permitted context to
the selected Provider. Never send credentials, private logs, hidden reasoning,
or an entire repository by default. See [Providers](providers.md) and
[privacy and permissions](privacy-and-permissions.md).
