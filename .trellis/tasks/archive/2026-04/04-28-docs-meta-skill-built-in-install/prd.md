# brainstorm: docs meta-skill built-in install

## Goal

把文档站/marketplace 里的 `trellis-meta` 提升为 Trellis 内置 skill：用户运行 `trellis init --<platform>` 后，所选平台的 skill 目录自动获得 `trellis-meta`，语义上与 `trellis-brainstorm` 这类内置 skill 一致，不再要求用户额外跑 marketplace 安装命令。

## What I already know

* 用户目标是让 `trellis init` 后自动安装 `trellis-meta` 到对应平台目录，“就跟 brainstorm 一样”。
* `trellis-meta` 当前源头是 `marketplace/skills/trellis-meta/SKILL.md`，并依赖 `references/` 目录。
* 现有内置 workflow skill 源头是 `packages/cli/src/templates/common/skills/*.md`，经 `resolveSkills()` / `resolveAllAsSkills()` 写入各平台。
* `common/skills` 现阶段只支持单文件 skill body，frontmatter 由 `wrapWithSkillFrontmatter()` 自动生成。
* 各平台 `collectTemplates()` 是 update hash tracking 的 source of truth；init 写什么，collect 就必须返回什么。
* 官方 marketplace 子模块已在 upstream `mindfold-ai/marketplace` 最新 `main` 提交 `76a36ea`；误差主要是 `trellis-meta` 内容停在 0.4 时代，而不是子模块没更新。
* 当前分支和 npm `beta` 都是 `0.5.0-beta.16`，npm stable `latest` 仍是 `0.4.0`；`trellis-meta` 自身声明的是 `0.4.0-beta.8`。
* `trellis-meta` 的产品目标是让用户自己的 AI 读完后理解 Trellis 的架构、原理和本地改造入口，然后按用户需求魔改本地 Trellis 架构。
* 用户本地大概率没有 Trellis 源码；`trellis-meta` 应指导 AI 修改 `trellis init` 落到项目里的 `.trellis/`、`.claude/`、`.codex/`、`.cursor/` 等本地文件，而不是指导用户 fork/修改 Trellis CLI 仓库本身。

## Research References

* [`research/repo-install-paths.md`](research/repo-install-paths.md) — 现有内置 skill 分发链路、`trellis-meta` 当前状态、推荐方案。
* [`research/marketplace-meta-skill-drift.md`](research/marketplace-meta-skill-drift.md) — marketplace `trellis-meta` 相对当前 0.5 beta 架构的误差分类、证据和更新策略。

## Assumptions

* 目标 skill 名保持 `trellis-meta`，不改成 `meta` 或其他别名。
* `trellis-meta` 是面向“理解/修改 Trellis 本身”的能力，不参与 task workflow phase routing。
* 该变更应覆盖所有支持 skill 的平台，而不是只覆盖 Claude Code 或 Codex。
* marketplace 里的 `trellis-meta` 至少短期保留，以免已有文档/外部安装方式突然断裂。
* `trellis-meta` 里的源码路径只能作为“上游实现参考”，不能假设用户项目里存在这些路径。

## Open Questions

* `trellis-meta` built-in 后，技能市场页面是保留为兼容入口，还是改成“已内置，无需安装”的说明并弱化 `npx skills add`？

## Requirements

* `trellis init` 为所选平台自动写入 `trellis-meta`：
  * Claude Code: `.claude/skills/trellis-meta/SKILL.md` plus references if retained.
  * Cursor: `.cursor/skills/trellis-meta/SKILL.md` plus references.
  * OpenCode: `.opencode/skills/trellis-meta/SKILL.md` plus references.
  * Codex shared layer: `.agents/skills/trellis-meta/SKILL.md` plus references.
  * Kiro: `.kiro/skills/trellis-meta/SKILL.md` plus references.
  * Gemini CLI: `.gemini/skills/trellis-meta/SKILL.md` plus references.
  * Qoder: `.qoder/skills/trellis-meta/SKILL.md` plus references.
  * CodeBuddy: `.codebuddy/skills/trellis-meta/SKILL.md` plus references.
  * GitHub Copilot: `.github/skills/trellis-meta/SKILL.md` plus references.
  * Droid: `.factory/skills/trellis-meta/SKILL.md` plus references.
  * Pi Agent: `.pi/skills/trellis-meta/SKILL.md` plus references.
  * Kilo: `.kilocode/skills/trellis-meta/SKILL.md` plus references.
  * Antigravity: `.agent/skills/trellis-meta/SKILL.md` plus references.
  * Windsurf: `.windsurf/skills/trellis-meta/SKILL.md` plus references.
* `trellis update` 的 template collection 必须包含 `trellis-meta` 全部落盘文件，让新增/更新能被 hash tracking 管理。
* `trellis-meta` 内容需要更新为 Trellis 当前架构、原理、source-of-truth 和本地改造方法，不能继续只讲 marketplace / Claude global install。
* `trellis-meta` 只记录最新 Trellis，不承担历史兼容说明；不符合当前架构的旧内容直接删除或重写。
* `trellis-meta` 必须明确本地改造边界：可改的是 init 后生成/更新到项目里的 `.trellis/` runtime/docs/scripts/specs、平台 hooks/settings/agents/skills/commands/workflows/prompts 等文件；不可把 fork Trellis CLI 源码作为默认路径。
* 文档站英中页面同步更新，避免继续声称 `trellis-meta` 必须手动安装。

## Acceptance Criteria

* [x] 新项目执行 `trellis init --claude -y` 后包含 `.claude/skills/trellis-meta/SKILL.md`。
* [x] 新项目执行 `trellis init --codex -y` 后包含 `.agents/skills/trellis-meta/SKILL.md`，并由 template hash tracking 记录。
* [x] 至少一个带 references 的平台样例测试证明 `references/` 被完整写入。
* [x] `collectPlatformTemplates()` 返回的路径与 init 实际写入路径一致。
* [x] `pnpm lint && pnpm typecheck && pnpm test` 通过。
* [x] docs-site 英中相关页面已同步，技能市场页面不再误导用户必须额外安装。

## Definition of Done

* Tests added/updated for changed init/update behavior.
* Lint, typecheck, and relevant tests pass.
* Docs-site English and Chinese pages are consistent.
* No unrelated working-tree changes are reverted or rewritten.
* Rollout impact is explicit: existing projects get the new file through `trellis update`; modified user files remain protected by hash tracking.

## Technical Approach

推荐方案是增强现有内置 skill 链路，而不是另做一套旁路安装器，也不是把 `trellis-meta` 压成单文件。`trellis-meta` 的价值来自 `references/` 分层资料；保留目录结构更适合 AI 按需读取，也让 `common/skills` 这条 built-in 分发链路升级为同时支持单文件 workflow skill 和多文件 built-in skill。

`trellis-meta` 内容本身要重构成“架构说明 + 本地改造手册”：入口 `SKILL.md` 负责路由，`references/architecture/` 解释 init 后本地 Trellis 文件的系统原理和 source-of-truth，`references/platforms/` 解释平台能力模型，`references/customize/` 解释如何按用户需求修改本地 `.trellis/` 与平台配置文件。上游 CLI 源码路径只作为参考，不作为用户默认改造对象。

Implementation shape:

* Add a template reader for multi-file built-in skills, likely under `packages/cli/src/templates/common/bundled-skills/`.
* Add shared helpers beside `resolveSkills()` / `writeSkills()` that write/copy an entire skill directory to a target platform skill root.
* Wire the helper into every platform configurator immediately after existing workflow skill writes, keeping one built-in skill pipeline.
* Wire the same helper into `collectTemplates()` for each platform so update tracking remains part of the same pipeline.
* Move or copy `trellis-meta` into the CLI template tree and update content for built-in semantics.
* Keep marketplace docs compatible until product decision says otherwise.

## Decision (ADR-lite)

**Context**: Existing built-in workflow skills are single-file templates. `trellis-meta` is a multi-file marketplace skill with references, so the current helper path cannot install it without flattening or losing files.

**Decision**: Strengthen the existing built-in skill path to support multi-file skill directories, then ship `trellis-meta` through that path.

**Consequences**: More implementation work than adding `common/skills/meta.md`, but it avoids bloating `SKILL.md`, preserves the reference structure, and creates a reusable internal mechanism for future built-in skills with assets without inventing a second installer.

## Out of Scope

* Building a general external marketplace installer into `trellis init`.
* Changing how third-party marketplace skills are installed.
* Auto-installing every marketplace skill.
* Renaming existing workflow skills.

## Technical Notes

* Files inspected:
  * `packages/cli/src/templates/common/index.ts`
  * `packages/cli/src/configurators/shared.ts`
  * `packages/cli/src/configurators/index.ts`
  * `packages/cli/src/configurators/codex.ts`
  * `packages/cli/src/configurators/claude.ts`
  * `packages/cli/src/types/ai-tools.ts`
  * `packages/cli/test/commands/init.integration.test.ts`
  * `packages/cli/test/configurators/platforms.test.ts`
  * `packages/cli/scripts/copy-templates.js`
  * `marketplace/skills/trellis-meta/SKILL.md`
  * `docs-site/skills-market/trellis-meta.mdx`
  * `docs-site/zh/skills-market/trellis-meta.mdx`
* Relevant specs:
  * `.trellis/spec/cli/backend/platform-integration.md`
  * `.trellis/spec/cli/backend/migrations.md`
  * `.trellis/spec/cli/unit-test/conventions.md`
  * `.trellis/spec/docs-site/docs/sync-on-change.md`
  * `.trellis/spec/docs-site/docs/style-guide.md`
