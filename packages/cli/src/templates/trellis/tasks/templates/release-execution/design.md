# Design — Release execution

## Boundary

This task **may** mutate remotes **only** after explicit user approval captured in `verify.md` (quote or paraphrase the approval request/response).

## Release status model (this task)

| Status | When to use |
| --- | --- |
| **published** | npm and/or git remote actions completed for the approved version |
| **not published** | Execution aborted or only dry-run/preflight completed |
| **blocked** | Preflight failed; do not publish until fixed |
| **waived** | User approved proceeding despite a listed risk |
| **deferred** | User postponed publish after readiness |

Do not mark **ready to publish** here — that remains the readiness task outcome.

## Approval gate (mandatory)

Before any of the following, stop and obtain explicit user approval:

- `node scripts/release.js …` (bundles bump, commit, tag, push)
- `npm publish` / CI publish workflow dispatch
- `git tag` / `git push` (including `--tags`)
- GitHub **Create release** or promotion workflows

Document in `verify.md`:

```markdown
## Publish approval evidence

User explicitly approved: yes/no
Approved version: …
Approved dist-tag: …
Approved remote actions: tag / push / npm publish / …
```

## Evidence contract (`verify.md`)

1. **Readiness link** — path to readiness `handoff.md`.
2. **Publish approval evidence** — as above.
3. **Preflight results** — `check-versions`, `publish-plan`, `verify-packed-cli`.
4. **Execution log** — commands run (redact tokens); pass/fail.
5. **Post-publish smoke** — registry check, `trellis --version`, dogfood smoke commands.
6. **Validation evidence** — tests run after publish if applicable.

## Trellis CLI reference sequence (after approval)

Typical human/CI sequence (do not automate without approval):

```bash
cd packages/cli
node scripts/release-preflight.js check-versions
node scripts/release-preflight.js publish-plan
# After approval:
pnpm --filter @blxzer/trellis release:beta   # or patch/minor/major per policy
node scripts/release-preflight.js verify-npm --package all
```

`release.js` performs commit, tag, and push — treat it as a single approved bundle or decompose manually per policy.