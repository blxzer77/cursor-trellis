# Repo Research: Built-in `trellis-meta` Install Path

## 结论

`trellis-meta` 现在是 marketplace skill，不在 `trellis init` 的内置模板链路里。要让它像 `trellis-brainstorm` 一样随平台安装，必须接入 `packages/cli/src/templates/common/` 到各平台 configurator 的模板生成路径，并同步 update hash tracking、init 测试和文档站。

## 现有内置 skill 链路

* 内置 workflow skill 源头在 `packages/cli/src/templates/common/skills/*.md`。
* `packages/cli/src/templates/common/index.ts` 只读取 `common/skills/*.md` 单文件模板。
* `packages/cli/src/configurators/shared.ts` 提供：
  * `resolveSkills(ctx)`：把 `common/skills` 渲染成 `trellis-{name}/SKILL.md`，用于大部分平台。
  * `resolveAllAsSkills(ctx)`：把 commands + skills 全部渲染成 `trellis-{name}/SKILL.md`，用于 Codex shared layer 和 Kiro。
  * `wrapWithSkillFrontmatter()`：自动补 YAML frontmatter；模板文件本身不能带 frontmatter。
* 各平台 `configure*()` 和 `collectTemplates()` 都依赖这些 helper，所以 init 与 update hash tracking 必须一起改，避免 init/update 写出的文件不一致。

## 当前 `trellis-meta` 状态

* marketplace 源头在 `marketplace/skills/trellis-meta/SKILL.md`，并有 `references/` 目录。
* docs-site 的技能市场页面仍指导用户运行 `npx skills add mindfold-ai/marketplace --skill trellis-meta`。
* `trellis-meta` 的现有 frontmatter name 已经是 `trellis-meta`，与内置命名目标一致。
* 现有内容包含过期平台描述和 Claude-centric 安装说明；如果变成 built-in，需要同步改成 Trellis 0.5 平台矩阵和 `trellis init` 安装语义。

## 关键约束

1. 不能简单把 `marketplace/skills/trellis-meta/SKILL.md` 原样放进 `common/skills/meta.md`：
   * `common/skills` 模板会被 `wrapWithSkillFrontmatter()` 再包一层 frontmatter。
   * `common/skills` 目前只支持单个 `.md` 文件，无法自动带上 `references/`。
2. 如果保留 `references/`，需要新增可复制多文件 skill 目录的内置 skill 支持。
3. 如果压成单文件，代码改动小，但每个平台都会写入一个很大的 `SKILL.md`，并丢失按主题懒加载 reference 的结构。
4. 该变更会新增用户项目落盘文件，`trellis update` 必须能追踪 template hash；这通常不需要 migration，因为是新增文件而不是重命名/删除旧文件。

## 可行方案

### A. 增强现有 built-in skill 链路，支持多文件 skill（推荐）

在现有 `common/skills` 内置分发链路上升级模板模型：继续由共享 helper 统一产出各平台 skill，只是让模板源除了单文件 `.md` body 之外，也能包含完整 skill 目录。`trellis-meta` 作为多文件内置 skill 放进 CLI template tree，例如：

```text
packages/cli/src/templates/common/bundled-skills/trellis-meta/
  SKILL.md
  references/
```

新增 helper 读取完整目录，并接入 `resolveSkills()` / `writeSkills()` 同一层级的共享 configurator 逻辑；平台 configurator 在写 workflow skills 后继续通过同一套 skill 写入机制写 bundled skills。`collectTemplates()` 同样收集这些文件，保证 update hash tracking 与 init 一致。

优点：保留 `references/`，更符合 skill 的信息架构；强化的是现有 built-in 链路，不是新增并行安装器；后续可复用给其他多文件 built-in skill。缺点：要改共享 helper 和各平台收集逻辑，测试面更大。

### B. 压平成 `common/skills/meta.md`

把 meta-skill 内容改成 body-only 模板，放到 `packages/cli/src/templates/common/skills/meta.md`，补 `SKILL_DESCRIPTIONS.meta`。

优点：接入最小，所有平台自动拾取。缺点：丢失 `references/` 目录；`SKILL.md` 体积大；后续维护 marketplace 与 built-in 版本容易分叉。

### C. CLI 从 marketplace 目录读取并复制

让 CLI 直接读取 `marketplace/skills/trellis-meta` 作为模板源。

优点：避免手工复制源文件。缺点：npm package 目前只发布 `packages/cli/dist`、`bin`、README、LICENSE；`marketplace/` 不在 CLI 包内。要么改发布包结构，要么构建时复制 marketplace 到 dist，耦合更高。

## 推荐实现切分

1. 在 CLI template tree 增加 bundled skill 读取/写入 helper。
2. 把 `trellis-meta` 多文件 skill 复制进该 template tree，并更新 frontmatter/内容为 built-in 语义。
3. 在所有平台 configurator 的 init 路径写入 `trellis-meta`。
4. 在所有平台 `collectTemplates()` 路径收集 `trellis-meta` 文件，保证 `trellis update` 可更新和追踪 hash。
5. 更新 init/configurator 测试，覆盖至少：
   * 默认 Claude + Cursor 会写对应平台 `trellis-meta`。
   * Codex 写 `.agents/skills/trellis-meta`，并且 `.codex/skills` 不重复写。
   * 目录型 skill 的 `references/` 被写入并被 hash tracking 收集。
6. 更新 docs-site 英中页面：技能市场页改成 built-in 说明或明确 marketplace 是旧安装方式；multi-platform/custom-skills/install pages 的 skill 列表同步。

## 需要用户确认的产品边界

`trellis-meta` 变成 built-in 后，是否仍保留 marketplace 安装入口作为兼容说明，还是从技能市场里移除并只作为 `trellis init` 内置能力展示？
