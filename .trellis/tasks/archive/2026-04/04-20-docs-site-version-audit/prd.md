# PRD: docs-site 版本同步审计 + 更新计划

## Goal

盘点 docs-site 里跟不上实际代码的过期文档，产出可执行的更新计划。Beta track 对齐 0.5.0-beta.8，Release track 对齐 0.4.0 GA。

## Research References

所有详细审计沉淀在 `research/`（4 个 sub-agent 并行完成 + 1 个用户观察补充）：

- [`research/beta-en-guide-audit.md`](research/beta-en-guide-audit.md) — Beta EN guide 20 个文件 **全部**需要更新（7 重写 / 5 大改 / 5 中改 / 2 小改 / 1 建议删除）
- [`research/beta-zh-mirror-audit.md`](research/beta-zh-mirror-audit.md) — ZH **100% 镜像** EN，0 条 ZH-only 偏差 → 修 EN 后机械翻译即可
- [`research/release-snapshot-audit.md`](research/release-snapshot-audit.md) — release/ 其实是 **0.3.x ~ 0.4.0-beta.0 过渡期**快照，不是想象的"0.5 内容错位"；真实问题是 split-command 没合并 + 平台列表不够
- [`research/ancillary-pages-audit.md`](research/ancillary-pages-audit.md) — showcase + use-cases 最过期（含已删命令 `/trellis:record-session`），marketplace / templates / blog 基本稳定
- [`research/ch10-platform-generalization.md`](research/ch10-platform-generalization.md) — 用户 review 时发现 ch10 custom-agents 整章**仅按 Claude Code 写**（工具列表 `mcp__exa__*` / `Read/Write/Edit` 都是 CC 专属命名），后续 P1b 改写时需按 Option C（CC 样例 + 跨平台差异速查）处理
- [`research/deleted-concepts-surface.md`](research/deleted-concepts-surface.md) — **系统性错位**扫描：Dispatch/Plan/Debug Agent + Ralph Loop + current_phase + worktree.yaml 这 6 个 0.5.0-beta.0 删除的概念在 guide 里总共 62 处残留（12 EN + 12 ZH 文件 + 2 blog），每章改写时必须对照此表扫残留。**`appendix-e` 整文件过期建议直接删**，`ch04` 4.4 小节（讲 Ralph Loop 数学）整段删

## 关键发现总结

### 1. Beta EN guide —— 全量需要大改

整套 guide/ 还停留在 **0.3-0.4 心智模型**：
- `implement / check / research / dispatch / plan / debug` 6 个 agent → 实际只剩 `trellis-implement / trellis-check / trellis-research` 3 个
- "13 slash commands + Ralph Loop" → 实际 skill-first 架构，剩 `/start` + `/finish-work` 两个 command + 5 个 auto-trigger skill
- "6 platforms + Claude Code 独占 hook" → 实际 10 平台，其中 Claude Code / Cursor 等 4 个有真 hook，其他是 class-2 pull-based
- 没提 Agent Trace / Plugin system 规划（这些是 0.5+ roadmap，应在 appendix 或单独页补）

### 2. Beta ZH —— 纯镜像，修完 EN 就行

ZH 完全跟 EN 对齐，审计发现的 58+ 问题全是从 EN 继承的。**策略确定**：先改完 EN，再用机械翻译（或 lark-mcp skill）同步 ZH。

### 3. Release track —— 认知修正（重要）

**我之前以为 release/ 装的是 0.5 内容（错位给 0.4 用户看）**。审计推翻：release/ 实际上停留在 0.4.0-beta.0 之前的 split-command 时代（`/before-backend-dev` + `/before-frontend-dev`、`/check-backend` + `/check-frontend`），这些在 0.4.0-beta.1 合并成了 `/before-dev` + `/check`。

所以 Release track 需要做的是**往后推到 0.4.0 GA**，不是往前回滚到 0.4.0。

另外磁盘上有 **78 个 orphan changelog 文件**（39 个 EN + 39 个 ZH），是 `release/changelog/v0.5.0-beta.*.mdx` —— docs.json 过滤没引用，但文件还在。

### 4. Ancillary —— 局部大问题 + 整体稳定

严重过期（~25 处）：
- `showcase/terminal-demo.mdx` + ZH 镜像：分支号 `feat/v0.4.0-beta` + 旧 agent 名 + 已删 `/trellis:record-session`
- `use-cases/open-typeless.mdx` + ZH 镜像：`/trellis:record-session` + 旧 agent
- `skills-market/trellis-meta.mdx`：提到 Antigravity（0.4 不存在）

稳定（几乎不用动）：marketplace 里的 skill 引用、templates/spec-*、contribute/*、blog/\*（timeless 内容）。

## Assumptions

- A1: 优先更新 Beta track（用户主要入口）；Release track 次优先
- A2: ZH 走"先 EN 后翻译"模式，不做独立 ZH 改动
- A3: Release track 走 **A + 部分 C** 策略：只修 split-command 错位 + 删 orphan beta changelog；暂不按 0.4.0 tag 做完整回滚
- A4: Agent Trace / Plugin 等 0.5-roadmap 功能文档作为**未来新增页**，不是这次更新范围
- A5: 更新走增量 PR 策略，不是一次性大 PR

## Requirements (按优先级)

### P0（用户首次接触，必须修）

**Beta EN + ZH**：
- [ ] `guide/ch01-what-is-trellis.mdx` — 重写核心介绍（10 平台、skill-first、3 个 trellis-agent）
- [ ] `guide/ch02-quick-start.mdx` — 改 init/update 命令示例、目录树、platform 列表
- [ ] `index.mdx` — 首页版本号 / 平台数
- [ ] `guide/ch05-commands.mdx` — command → skill 重新分类（只剩 start + finish-work 是真 command）
- [ ] `guide/ch13-multi-platform.mdx` — 10 平台能力矩阵
- [ ] `guide/appendix-b.mdx` — 命令参考表（大多数已是 skill）

**Ancillary**：
- [ ] `showcase/terminal-demo.mdx` + ZH — 分支号 + agent 名 + 已删命令
- [ ] `use-cases/open-typeless.mdx` + ZH — 已删命令 + 旧 agent

### P1（guide 中间章节 + marketplace 小改）

**Beta EN + ZH**：
- [ ] `guide/ch03-first-task.mdx` ~ `guide/ch04-architecture.mdx` — 第一个 task 流程 + 架构图更新
- [ ] `guide/ch06-task-management.mdx` ~ `guide/ch08-real-world.mdx` — 工作流章节更新
- [ ] `guide/ch09-custom-commands.mdx` ~ `guide/ch12-custom-skills.mdx` — 魔改篇适配 skill-first
- [ ] `guide/appendix-a.mdx` + `appendix-c.mdx` — 其他 appendix

**Ancillary**：
- [ ] `skills-market/trellis-meta.mdx` + ZH — 删 Antigravity 表述

### P2（低触达 / 时效性弱）

- [ ] `guide/appendix-d/e/f.mdx` — 附录小改
- [ ] `guide/resources.mdx` — 外部资源链接清理
- [ ] `blog/use-k8s-to-know-trellis.mdx` — agent 命名小改
- [ ] 考虑是否需要建新页：Agent Trace / Plugin system roadmap

### Release track（独立工作流）

- [ ] 改 `release/guide/ch02` 目录树示例：`before-backend-dev` / `check-backend` → 合并后命名
- [ ] 改 `release/guide/ch05` 命令参考表：合并 split-command 列
- [ ] 改 `release/guide/ch01` + `ch04`：平台列表从 6 扩到 12（0.4.0 GA 时的真实数字）
- [ ] `git rm` 78 个 orphan changelog 文件（`release/changelog/v0.5.0-beta.*.mdx` + ZH 镜像）
- [ ] ZH 镜像对应改动

### 可选 / 后续

- [ ] 新建 `guide/plugin-system.mdx`（当 plugin-system-design task 完成后）
- [ ] 新建 roadmap 页（Agent Trace / Plugin / Memory）

## 工作量估算

| 分组 | 文件数 | 估时 |
|---|---|---|
| P0 EN | 6 | 8-10h（重写为主） |
| P0 EN → ZH 翻译 | 6 | 3-4h |
| P0 Ancillary EN+ZH | 4 | 2h |
| P1 EN | 10 | 10-14h |
| P1 EN → ZH 翻译 | 10 | 4-5h |
| P1 Ancillary EN+ZH | 2 | 0.5h |
| P2 EN+ZH | 6 | 3h |
| Release track | 10 | 2-3h |
| Orphan changelog 清理 | 1 commit | 0.2h |
| **合计** | ~55 | **~35h** |

按单人 3-4h/day 节奏：**约 2 周完成 P0+P1**，P2 可择机。

## 执行策略建议

**3 种节奏可选，你挑一个**：

### S1. 速战速决（聚焦 P0）
- 只修 10 个 P0 文件（EN+ZH+Ancillary），1 周搞定
- 中间章节和 appendix 标为"适用于 0.5 beta，部分旧"的 banner，留给未来
- 优点：用户第一印象快速刷新；缺点：guide 中间不平均

### S2. 全量对齐（P0+P1）
- 2 周刷掉整套 Beta track
- Release track 同步走 A 策略（~3h 加餐）
- 优点：文档和代码真实同步；缺点：两周集中工作量大

### S3. 渐进（按章节 PR）
- 每周刷 3-5 章，6-8 周全部完成
- 每个 PR 独立 reviewable
- 优点：风险分散；缺点：持续时间长，文档中间处于半新半旧状态

## Out of Scope

- 新建 Agent Trace / Plugin system 文档（等主 task `04-20-plugin-system-design` 定稿）
- Release track 的完整 0.4.0 GA 回滚（B 策略不采纳）
- 建立文档 CI 检查（未来任务）

## Acceptance Criteria

- [ ] P0 所有文件 EN+ZH 双语更新完成
- [ ] 审计报告里列的 broken link / 已删命令 / 旧 agent 名 100% 清理
- [ ] Mintlify preview 能正常构建（MDX 语法不报错）
- [ ] 版本下拉切到 Release 仍能正常浏览（修完 release/ 后）
- [ ] Ancillary `showcase/terminal-demo.mdx` + `use-cases/open-typeless.mdx` 改到可信

## Open Questions

- Q1（Preference，待答）：**选 S1 / S2 / S3 哪个节奏？**
- Q2（Preference）：Release track 是否现在就修，还是等 Beta P0 完成后？
- Q3（Policy）：ZH 用机械翻译（lark-mcp skill / 手工）还是用 trellis-research / 专门 translate skill？
- Q4（Decision）：78 个 orphan changelog 文件 — `git rm` 还是保留？（保留的话 mintlify build 不会崩，只是磁盘多占）
