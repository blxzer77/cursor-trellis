# Trellis Framework Guidelines

This layer covers durable Trellis framework contracts: task records, workflow phases, memory/channel storage, template generation semantics, and project capability metadata.

## Source Areas

- `packages/core/src/task/` defines task record schemas, phases, paths, and records.
- `packages/core/src/mem/` defines memory/session context models and adapters.
- `packages/core/src/channel/` defines worker/channel state and event storage.
- `packages/cli/src/templates/trellis/` contains generated workflow, Python scripts, hooks, and spec scaffolds.
- `packages/cli/src/utils/project-capabilities.ts` owns MCP/capability template generation.
- `packages/cli/src/utils/readiness.ts` owns readiness probes.

## Guides

| Guide | Use When |
| --- | --- |
| [Workflow And Task Contracts](./workflow-and-task-contracts.md) | Changing tasks, phases, gates, archive behavior, or Python task script contracts. |
| [Template Generation](./template-generation.md) | Editing generated files, platform templates, hashes, migrations, or placeholder resolution. |
| [Capabilities And Readiness](./capabilities-and-readiness.md) | Changing project capabilities, MCP server config, smart-search readiness, or capability probes. |
| [Testing And Validation](./testing-and-validation.md) | Choosing checks for framework and CLI changes. |

## Pre-Development Checklist

- Identify whether the change touches source contracts, generated templates, tests, or all three.
- Search for the exact template text or config field before changing it.
- Update generated-template tests when template output changes.
- Preserve migration and uninstall behavior for user-owned files.
- Run focused Vitest files before broader `pnpm typecheck` or `pnpm test`.

