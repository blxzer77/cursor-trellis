# Spec System

English | [简体中文](spec-system.zh-CN.md)

This document covers the design of `.trellis/spec/`: the **progressive specification system** that holds project-specific engineering conventions, how it is loaded into agent context, and the two skills (`cstl-spec-bootstrap` and `cstl-update-spec`) that manage its lifecycle.

## What `.trellis/spec/` is

Agents that memorize conventions get them wrong. Trellis injects relevant specs — or requires the agent to read them — at the right time, instead of front-loading everything into one giant file. `.trellis/spec/` is the user's project-specific engineering spec library: executable contracts about how this codebase is built, not generic best practices.

The key property is **progressive loading**: the agent reads the spec slices relevant to the files it is about to edit, not the whole tree. This is enforced by the `cstl-before-dev` skill and the `implement.jsonl` / `check.jsonl` manifests.

## Directory model

### Single-repository

```text
.trellis/spec/
├── backend/
│   ├── index.md
│   └── ...
├── frontend/
│   ├── index.md
│   └── ...
└── guides/
    ├── index.md
    └── ...
```

### Monorepo

```text
.trellis/spec/
├── cli/
│   ├── backend/
│   │   ├── index.md
│   │   └── ...
│   └── unit-test/
│       ├── index.md
│       └── ...
├── docs-site/
│   └── docs/
│       ├── index.md
│       └── ...
└── guides/
    ├── index.md
    └── ...
```

`index.md` is the entry point for each layer — it lists the **Pre-Development Checklist** and **Quality Check** pointers. Specific guidelines live in sibling Markdown files the index points to. The index is a pointer, not the goal; `cstl-before-dev` forces reading the actual guideline files.

## Package configuration

`.trellis/config.yaml` declares packages:

```yaml
packages:
  cli:
    path: packages/cli
  docs-site:
    path: docs-site
    type: submodule
default_package: cli
```

Discover packages and spec layers at runtime:

```bash
python ./.trellis/scripts/get_context.py --mode packages
```

This command lists packages and their spec layers for the current project. It is the reference when configuring `implement.jsonl` / `check.jsonl` manifests.

## How specs enter tasks

Before a task enters implementation, planning may write relevant specs into `implement.jsonl` (for the implementer) and `check.jsonl` (for the checker):

```jsonl
{"file": ".trellis/spec/cli/backend/index.md", "reason": "CLI backend conventions"}
{"file": ".trellis/spec/cli/unit-test/conventions.md", "reason": "Test expectations"}
```

Subagents read these manifests on dispatch. If the `<!-- cstl-hook-injected -->` marker is present, the listed files are already auto-loaded above; otherwise the agent reads them from the dispatch prompt's `Selected task: <path>` line. See [subagents.md](subagents.md) for the context loading protocol.

On platforms without subagent support, the agent reads the relevant specs directly per the workflow.

## Code-Spec vs Guide

Trellis enforces a hard distinction between two spec types:

| Type | Location | Purpose | Content style |
| --- | --- | --- | --- |
| **Code-Spec** | `<layer>/*.md` | Tell the agent "how to implement safely" | Signatures, contracts, matrices, cases, test points |
| **Guide** | `guides/*.md` | Help the agent "what to think about" | Checklists, questions, pointers to specs |

Decision rule:

- "This is **how to write** the code" → put in a spec layer directory
- "This is **what to consider** before writing" → put in `guides/`

Guides should be short checklists that point to specs, not duplicate the detailed rules. For example, "Use API X not API Y" is a spec convention (concrete); "Remember to check X when doing Y" is a guide checklist item (abstract).

## What specs should contain

Specs hold executable engineering conventions for the project, not generic best practices:

- Where files should live
- How error handling should be expressed
- Input/output contracts for APIs, hooks, and commands
- Patterns that are forbidden
- Cases that require tests
- Project-specific pitfalls and how to avoid them

When the agent learns a new rule during implementation or debugging, it should update `.trellis/spec/` (via `cstl-update-spec`) rather than only summarizing it in chat.

## Lifecycle: `cstl-spec-bootstrap` (creation)

The `cstl-spec-bootstrap` skill handles spec tree creation or restructuring. Single-owner full flow:

1. **Analyze repository** — use source analysis (GitNexus / ABCoder / direct source reading) to extract actual conventions, not template guesses
2. **Decouple spec boundaries** — separate concerns into layer/package directories; avoid one giant spec file
3. **Fill specs with real patterns** — actual signatures, actual contracts, actual error matrices observed in the code
4. **Verify no placeholders** — the `PLACEHOLDER_VALUES_RE` regex (`TBD|TODO|待定|待补充|N/A|NA|NONE|-|…`) rejects placeholder content

Boundaries: no template clichés; one owner owns the whole bootstrap. The skill has references for `mcp-setup`, `repository-analysis`, and `spec-task-planning`.

## Lifecycle: `cstl-update-spec` (maintenance)

The `cstl-update-spec` skill is the semi-automatic flow for sinking durable learning back into specs. Triggered in Phase 3.3 when the durable learning decision is `update-spec`.

**Flow** (required — silent spec edits are forbidden):

1. **Detect** — did this task produce reusable code-spec or guide-worthy learning?
2. **Proposal** — write `{TASK}/research/learning-proposal.md` with target spec paths and draft bullets. **Do not edit `.trellis/spec/` yet.**
3. **Confirm** — user explicitly approves; `Learning decision: update-spec` appears in `verify.md`
4. **Write** — only then edit spec files; add `Spec update evidence: .trellis/spec/...` to `verify.md`

**Forbidden**: silent spec edits; writing spec when decision is `no-update` or `unsure` without follow-up; auto-updating spec from hooks or check alone.

### Code-Spec depth (7 sections)

For infra or cross-layer contract changes, `cstl-update-spec` mandates all 7 sections:

1. **Scope / Trigger** — why this requires code-spec depth
2. **Signatures** — command / API / DB signatures
3. **Contracts** — request fields, response fields, environment keys (required/optional)
4. **Validation & Error Matrix** — `<condition>` → `<error>`
5. **Good / Base / Bad Cases** — concrete examples
6. **Tests Required** — unit / integration / E2E with assertion points
7. **Wrong vs Correct** — at least one contrastive pair

Mandatory triggers: new/changed command or API signature, cross-layer request/response contract change, DB schema/migration change, infra integration (storage, queue, cache, secrets, env wiring).

## Local customization points

| Need | Edit location |
| --- | --- |
| Add a new spec layer | `.trellis/spec/<package>/<layer>/index.md` + guideline files |
| Change monorepo spec mapping | `packages` / `default_package` / `spec_scope` in `.trellis/config.yaml` |
| Change which specs the implementer reads | the task's `implement.jsonl` |
| Change which specs the checker reads | the task's `check.jsonl` |
| Change when specs should be updated | Phase 3.3 in `.trellis/workflow.md` and the `cstl-update-spec` skill |

## Boundaries

`.trellis/spec/` is the user's project specification, **not** a permanent copy of Trellis built-in templates. The agent encourages the user to update it according to the actual project code, instead of treating Trellis default templates as immutable documents. The bootstrap skill extracts real patterns; the update skill sinks new learning; neither freezes the tree.

## See also

- [Task system design](task-system.md) — `implement.jsonl` / `check.jsonl` manifests, Phase 3.3 learning decision
- [Internal skills](skills.md) — `cstl-spec-bootstrap` and `cstl-update-spec` definitions
- [Workflow in Cursor](workflow.md) — Phase 2.1 (`cstl-before-dev` spec reading) and Phase 3.3 (learning decision)
- [Cursor integration](cursor.md) — context injection, `preToolUse` hook limits
