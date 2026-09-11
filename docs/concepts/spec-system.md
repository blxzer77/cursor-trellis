# Spec system

English | [简体中文](spec-system.zh-CN.md)

The Pactile spec system is the project's durable library of repository-specific engineering contracts under `.pactile/spec/`. It lets an Agent load the conventions relevant to the files it will change without front-loading the entire library into every turn.

## Definition

A project spec records how this repository actually works: file placement, interfaces, error behavior, required tests, forbidden patterns, and known pitfalls. It is project knowledge, not Pactile product documentation and not a transcript of one task.

Pactile does not install an empty spec skeleton merely to make the directory exist. A first spec tree is bootstrapped from repository evidence only when the project needs one.

## Responsibilities

- organize durable conventions by package, layer, or concern;
- expose small index pages that route an Agent to the relevant detailed files;
- support progressive loading through task context and package/file scope;
- separate implementation context from independent-check context when manifests are used;
- accept reusable learning through a reviewed closeout flow.

## Boundary

Specs do not contain generic best practices, placeholders, temporary task requirements, chat summaries, or an immutable copy of Pactile's bundled framework. `prd.md` defines one task; `.pactile/spec/` defines reusable project conventions. A checklist that says what to consider belongs in a guide; a concrete repository contract belongs in a spec.

## Progressive loading

```text
task definition and touched files
  -> package/layer scope
  -> relevant spec indexes
  -> selected detailed specs and guides
  -> implementation or independent check
```

The Agent reads the smallest sufficient slice. For a sub-agent-capable workflow, `implement.jsonl` and `check.jsonl` can provide curated spec and research manifests. Other workflows load the same project knowledge through the before-development routing. The manifests are context routes, not duplicate authorities.

## Typical shape

The exact tree is project-owned. A monorepo might use:

```text
.pactile/spec/
  cli/
    backend/
      index.md
      command-contracts.md
    unit-test/
      index.md
  docs-site/
    docs/
      index.md
  guides/
    index.md
    debugging.md
```

A single-package repository may omit the package level. The useful boundary is the one reflected by the real code, not a mandatory template shape.

## Lifecycle

### Bootstrap

The one-time `pactile-spec-bootstrap` skill analyzes repository evidence, chooses boundaries, writes real patterns, and rejects placeholder-only content. It is a maintainer workflow, not a step that every initialized project must run.

### Read before development

Before implementation or checking, Pactile routes from the task and affected files to relevant indexes and detailed specs. Implementers and reviewers may receive different curated manifests so a check does not merely repeat the implementation narrative.

### Update from durable learning

A completed task may reveal a reusable convention. The closeout flow must:

1. decide whether the learning is reusable;
2. propose the target spec and concrete change;
3. obtain explicit confirmation for `update-spec`;
4. write the spec and record the update Evidence.

Routine work records `no-update` with a reason. An uncertain decision may ask once; it must not silently edit long-term knowledge. Execute-phase code work does not opportunistically rewrite specs.

## User scenario

A task changes the CLI's error contract. Its implementation context loads the command and error specs; its check context loads the same contract plus the relevant test rules. During closeout, the team identifies a newly discovered cross-platform exit-code rule. The task proposes a focused update to the command contract, receives confirmation, writes it, and records the spec path as Evidence. A later task can retrieve the rule without replaying the earlier conversation.

## What to inspect

- the task PRD for requirements that apply only to this change;
- the relevant `.pactile/spec/` files for reusable project rules;
- `implement.jsonl` or `check.jsonl` when a curated context manifest is present;
- closeout Evidence for whether durable learning was written, declined, or left unresolved.

Continue with [Task system](task-system.md) and [Kernel, Evidence, and Trace](kernel-evidence-trace.md).
