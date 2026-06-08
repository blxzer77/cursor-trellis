# Implement: workflow marketplace templates and switcher

## Implementation status

Implemented in the current working tree.

Completed:

- Marketplace workflow entries and workflow template files for `native`, `tdd`, and `channel-driven-subagent-dispatch`.
- `resolveWorkflowTemplate` / `listWorkflowTemplates` workflow resolver boundary.
- `trellis workflow` command with `--list`, `--template`, `--marketplace`, `--force`, and `--create-new`.
- `trellis init --workflow` and `--workflow-source`.
- Durable hash contract: `native` remains hash-tracked; non-native workflow writes remove `.trellis/workflow.md` from `.template-hashes.json`.
- Tests for native/non-native hash behavior, update-after-switch, custom workflow source, explicit `--template` modified-file failure, resolver path escape, and native marketplace mirror byte identity.

Remaining release-process step:

- Commit `marketplace/` submodule changes first, then update the parent repo gitlink. Until that happens, clean checkouts do not have the new workflow marketplace files.

## 0. Research and guardrails

- [ ] Read `.trellis/spec/cli/backend/index.md`.
- [ ] Read `.trellis/spec/cli/backend/commands-update.md`.
- [ ] Read `.trellis/spec/cli/backend/workflow-state-contract.md`.
- [ ] Read `.trellis/spec/cli/unit-test/index.md`, `conventions.md`, and `integration-patterns.md`.
- [ ] Inspect current `init.ts`, `configurators/workflow.ts`, `template-fetcher.ts`, template hash utilities, and marketplace index handling.

## 1. Marketplace workflow model

- [ ] Add `type: "workflow"` support to marketplace template types.
- [ ] Add workflow entries for `native`, `tdd`, and `channel-driven-subagent-dispatch`.
- [ ] Add workflow template files under `marketplace/workflows/`.
- [ ] Keep `packages/cli/src/templates/trellis/workflow.md` as native SoT.
- [ ] If a marketplace native mirror exists, add a byte-identity test against bundled workflow using the same Python literal replacement policy.
- [ ] Ensure every workflow template preserves `## Phase Index`, `## Phase 1: Plan`, `#### X.Y` headings, platform markers, and all required `[workflow-state:*]` blocks.

## 2. Workflow resolver

- [ ] Extract a reusable marketplace template resolver that takes `type + id + optional source`.
- [ ] Keep registry/index/download/proxy handling in one place.
- [ ] Return `{ id, type, name, description, path, content }` for `type: "workflow"`.
- [ ] Return workflow content to callers without making `init.ts` or `update.ts` parse raw marketplace structures.
- [ ] Give workflow-specific error messages for missing id, missing path, unsupported type, and download failure.

## 3. `trellis workflow` command

- [ ] Add top-level `trellis workflow` command.
- [ ] Add `--list` to show built-in and marketplace workflow templates.
- [ ] Add `--template <id>` for non-interactive replacement.
- [ ] Add `--marketplace <source>` for user-defined marketplace workflow templates.
- [ ] Add `--force` for explicit modified-file overwrite.
- [ ] Add `--create-new` to write `.trellis/workflow.md.new` without changing the active workflow.
- [ ] Add interactive picker for no-argument usage.
- [ ] Reuse template hash / modified-file protection for `.trellis/workflow.md`; non-interactive modified files exit 1 unless `--force` or `--create-new` is set.
- [ ] After successful `native` replacement, update `.trellis/.template-hashes.json` for `.trellis/workflow.md`.
- [ ] After successful non-native replacement, remove `.trellis/workflow.md` from `.trellis/.template-hashes.json`.

## 4. Init integration

- [ ] Add `trellis init --workflow <id>`.
- [ ] Add `trellis init --workflow-source <source> --workflow <id>` for custom workflow marketplace sources.
- [ ] Thread the selected workflow content into `createWorkflowStructure`.
- [ ] Write selected workflow content to `.trellis/workflow.md`.
- [ ] Ensure default/native init keeps `.trellis/workflow.md` hash-tracked.
- [ ] Ensure non-native init removes `.trellis/workflow.md` from hashes after `initializeHashes()`.
- [ ] Add init integration tests for default native and explicit TDD workflow.

## 5. Update boundary

- [ ] Keep `trellis update` native/default behavior unchanged.
- [ ] Do not introduce `workflow.variant` or config-driven update behavior.
- [ ] Add regression coverage that update still preserves modified `.trellis/workflow.md`.
- [ ] Add regression coverage that update after `trellis workflow --template tdd` does not silently restore native.
- [ ] Verify rerunning update after a successful update is idempotent.

## 6. TDD workflow content

- [ ] Draft TDD workflow from the native workflow structure.
- [ ] Update Phase 1 to require behavior list and public interface decisions.
- [ ] Update Phase 2.1 to enforce one-test red/green vertical slices.
- [ ] Update Phase 2.2 to check behavior tests, boundary-only mocks, and refactor-only-when-green.
- [ ] Keep Phase 3 finish semantics unchanged.
- [ ] Verify all `[workflow-state:*]` blocks exist and reflect TDD gates.

## 7. Channel-driven workflow content

- [ ] Use current local dogfooding `.trellis/workflow.md` as the source behavior.
- [ ] Remove local-only references that should not ship to all users.
- [ ] Preserve forum terminology and channel-driven implement/check/research dispatch.
- [ ] Verify phase parsing across supported platform markers.

## 8. Validation

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test test/commands/init.integration.test.ts`
- [ ] `pnpm test` for the new workflow command tests
- [ ] `pnpm test test/commands/update.integration.test.ts`
- [ ] `pnpm test test/utils/template-fetcher.test.ts`
- [ ] `pnpm test test/regression.test.ts`
- [ ] Parse all three workflow templates with `get_context.py --mode phase` and key steps.
- [ ] Validate SessionStart overview extraction for all three workflow templates.
- [ ] Validate per-turn workflow-state extraction for `no_task`, `planning`, `planning-inline`, `in_progress`, and `in_progress-inline`.
- [ ] Validate platform-filtered phase parsing for `--platform codex`, `--platform codex-sub-agent`, and `--platform claude`.
- [ ] Validate `trellis-start` / `start` skill path by running `get_context.py --mode phase` and `--step 2.1` after swapping each workflow template into `.trellis/workflow.md` in a temp project.
