# Framework Docs (`.cstl/framework/`)

> **Ownership**: These files are **framework-managed**. `cstl update` refreshes them (with the same hash-conflict prompt as `workflow.md`). If you edit one, update will ask before overwriting — prefer putting project-specific norms in `.cstl/spec/` instead, which update never touches.

Versioned framework and platform-adapter documentation. Project/team knowledge lives in `.cstl/spec/` (user-owned); this directory documents how the framework itself behaves.

## Docs

| Doc | What it covers |
| --- | --- |
| [prd-grill-frontier.md](./prd-grill-frontier.md) | On-demand path to the PRD grill and Frontier discipline (bundled `brainstorm` skill is SSOT) |
| [internal-skills-cursor-reachability.md](./internal-skills-cursor-reachability.md) | How each internal workflow skill is reachable on Cursor (commands-only baseline) |
| [dogfood-only-surfaces.md](./dogfood-only-surfaces.md) | Which surfaces ship by default vs exist only in the maintainer harness |
| [cursor-subagent-policy.md](./cursor-subagent-policy.md) | When to spawn Trellis custom agents; model policy stays on the Cursor side |
| [retrieval-daily-guide.md](./retrieval-daily-guide.md) | Daily retrieval tool routing (search vs retrieval-pack scoring; web-research gate) |
| [cursor-native-modes-guide.md](./cursor-native-modes-guide.md) | Mapping Cursor Plan / Ask / Debug / Agent / Multitask onto Trellis phases |
| [cursor-context-injection-guide.md](./cursor-context-injection-guide.md) | Which Cursor injection channels actually reach the model |
| [cursor-semantic-compliance.md](./cursor-semantic-compliance.md) | Plan-vs-exec semantic compliance on Cursor |
| [injection-budget-guide.md](./injection-budget-guide.md) | Context injection budget across reliable Cursor channels |
| [execution-strategy.md](./execution-strategy.md) | Development Strategy Contract (`execution_mode` / isolation) |
| [verification-strength-guide.md](./verification-strength-guide.md) | How deeply tasks must be verified before closeout, graded by task mode |
| [artifact-locale-guide.md](./artifact-locale-guide.md) | How human-reviewed artifacts follow the user's language |

## Related

- `.cstl/workflow.md` — the workflow itself (also framework-managed)
- `.cstl/spec/guides/` — project thinking guides (user-owned; update never modifies)
