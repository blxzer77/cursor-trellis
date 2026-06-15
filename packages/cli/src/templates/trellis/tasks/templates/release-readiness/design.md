# Design — Release readiness

## Boundary

This task is **readiness only**. It produces evidence and recommendations; it does not change registry or remote git state.

## Release status model (this task)

Use these labels in `handoff.md` and `verify.md` (not `task.json.status` — see workflow release guidance).

| Status | Meaning |
| --- | --- |
| **ready to publish** | Evidence complete; operator may proceed after explicit approval |
| **not published** | No remote release actions were performed in this task |
| **blocked** | A required gate failed; publish must not proceed until fixed or waived |
| **waived** | User explicitly accepted a known blocker; document approver + rationale |
| **deferred** | Publish intentionally postponed (e.g. wait for another child / dogfood) |

**published** belongs only in a **release-execution** task after verified remote actions.

## Evidence contract (`verify.md`)

Include grep-friendly sections (archive checks may reference these families):

1. **Version recommendation** — current vs proposed; channel; dist-tag expectation.
2. **Changelog / release notes** — draft text or path to notes file.
3. **Migration manifest** — new/updated manifest id or “no manifest change”.
4. **Build evidence** — commands + pass/fail summary.
5. **Test evidence** — focused suite scope; note full-suite gaps if publish pipeline would fail.
6. **Pack dry-run evidence** — `npm pack --dry-run` / `publish-plan` / `verify-packed-cli` as applicable.
7. **Prepublish blockers** — table with severity and disposition (`blocking` / `fixed` / `waived` / `deferred`).

## Trellis CLI reference commands (dry-run / check only)

From the Trellis monorepo `packages/cli` (adjust paths for other products):

```bash
node scripts/check-manifest-continuity.js
node scripts/release-preflight.js check-versions
node scripts/release-preflight.js publish-plan
node scripts/release-preflight.js verify-packed-cli
pnpm --filter @blxzer/trellis exec npm pack --dry-run
```

Do **not** run `scripts/release.js`, `npm publish`, or `git push` in readiness.

## Safety

- Agents must not run publish/tag/push even if checks are green.
- Waiving a blocker requires explicit user words in chat or `handoff.md`, not agent assumption.