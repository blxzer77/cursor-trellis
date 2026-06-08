# Architecture review 01

## Result

Do not start implementation until the workflow hash/update contract is explicit.

## Findings

1. `trellis workflow` cannot update `.trellis/.template-hashes.json` to the selected non-native workflow content while `trellis update` still collects bundled native `.trellis/workflow.md`.
   - If TDD content is recorded as the tracked hash, the next update sees the file as pristine and silently writes native workflow.
   - Required contract: non-native workflow templates are user-managed local workflow files, not native auto-update targets.

2. Marketplace resolver must be a content resolver, not the current spec installer.
   - Current `template-fetcher.ts` only supports `type: "spec"` and maps templates to install directories.
   - Required contract: a reusable resolver accepts `type + id + optional source` and returns single-file content for workflow callers.

3. Native workflow needs a source-of-truth rule before implementation.
   - `packages/cli/src/templates/trellis/workflow.md` remains the native source of truth.
   - If `marketplace/workflows/native/workflow.md` exists, tests must enforce byte identity with the bundled native workflow after the same Python literal replacement policy.

4. Non-interactive modified-file behavior for `trellis workflow` must be specified.
   - Non-interactive replacement should exit 1 on modified `.trellis/workflow.md` unless the user passes an explicit conflict flag.
   - `.new` path must be deterministic.

5. Init option names must avoid confusing spec templates with workflow templates.
   - Use `trellis init --workflow <id>`.
   - Use `--workflow-source <source>` for custom workflow marketplace sources.

6. Validation must include platform-filtered phase parsing and update-after-switch regression.

## Adopted design decision

`native` is Trellis-managed and tracked in `.template-hashes.json`. Any non-native workflow selected by `trellis init --workflow`, `trellis workflow --template`, or a custom workflow source is written to `.trellis/workflow.md` and then removed from `.template-hashes.json` with `removeHash(cwd, ".trellis/workflow.md")`.

This makes `trellis update` classify the workflow as modified instead of auto-updating it to native. It does not add long-lived `workflow.variant` state and keeps switching as an explicit project action.
