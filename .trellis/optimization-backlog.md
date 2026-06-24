# Trellis 优化任务清单

> 创建时间：2026-06-15
> 状态标记：`[ ]` 待办 / `[x]` 已完成 / `[-]` 已取消
> 并行标记：同阶段内无依赖关系的任务可并行执行

---

## 执行顺序总览

```
Phase 1（可全并行，6 项）     Phase 2（可并行，3 项）      Phase 3（可并行，2 项）
┌──────────────────────┐     ┌──────────────────────┐     ┌──────────────────────┐
│ #1  技能调用优化       │     │ #2  Cursor 钩子优化   │     │ #4  Task Ladder 路由  │
│ #3  子代理定义调整     │──┐  │ #6  PC subagent 方案  │     │ #11 检索层完整评审     │
│ #5  smart-search 优先 │  │  │ #10 证据评分接通      │     └──────────────────────┘
│ #7  PC 编排优化       │──┤  └──────────────────────┘
│ #8  retrieval-pack 分析│─┤
│ #9  适配器体系审视     │─┘
└──────────────────────┘
```

**依赖关系**：
- `#2` 依赖 `#3`（钩子行为取决于子代理定义）
- `#6` 依赖 `#3` + `#7`（subagent 方案需要子代理定义 + 编排机制）
- `#10` 依赖 `#8`（需要先决定 retrieval-pack 去留）
- `#4` 依赖 `#1` + `#7`（路由优化受益于技能和编排改进）
- `#11` 依赖 `#8` + `#9` + `#10`（统筹前三项结论）

---

## Phase 1 — 基础优化（全部可并行）

> **Trellis Parent**：`.trellis/tasks/06-15-parent-phase1-optimization`（6 个 child 已链接，`task-map.md`：`execution_topology: parallel`）

> 无前置依赖，可同时启动

- [x] **1. 工作流技能调用逻辑和使用体验优化**
  - 范围：13 个工作流技能（trellis-start / continue / brainstorm / before-dev / check / break-loop / update-spec / finish-work / micro-grill / meta / skill-creator / spec-bootstrap / smart-search-cli）
  - 目标：优化调用逻辑，提升使用体验
  - 并行：与 #3 #5 #7 #8 #9 并行

- [x] **3. 子代理定义优化调整**
  - 范围：trellis-check / trellis-implement / trellis-research
  - 目标：优化子代理的定义和行为
  - 并行：与 #1 #5 #7 #8 #9 并行
  - 下游：#2 #6 依赖此项

- [x] **5. smart-search 优先于 Cursor 内置搜索**
  - 问题：用户说"搜索一下xxx"时，Cursor 调用内置搜索而非 smart-search
  - 目标：尽可能让 smart-search 优先，搜索强度在 Trellis 内做路由
  - 并行：与 #1 #3 #7 #8 #9 并行

- [x] **7. Parent/Child 编排整体优化**
  - 范围：task-map.md 状态机、worktree 管理、子任务提示生成
  - 目标：系统性改进父子任务编排体验
  - 并行：与 #1 #3 #5 #8 #9 并行
  - 下游：#4 #6 依赖此项

- [x] **8. 分析 retrieval-pack 模式作用**
  - 范围：`get_context.py --mode retrieval-pack` 完整调用链
  - 目标：评估是否有必要存在，决定保留 / 精简 / 移除
  - 现状：已建好但无任何 skill 或 hook 调用，处于"可用但未接入"状态
  - 并行：与 #1 #3 #5 #7 #9 并行
  - 下游：#10 #11 依赖此项

- [x] **9. 适配器体系重新审视**
  - 范围：当前 13 个适配器（rg / codegraph / language-server / fast-context-mcp / smart-search / artifact-search / session-memory / task-artifacts / codebase-evidence / mcp / browser / network / source-git-tests）
  - 设计原则：不应服务于特定基准测试，应面向通用开发场景
  - 目标：精简不必要的适配器，保留核心检索能力
  - 并行：与 #1 #3 #5 #7 #8 并行
  - 下游：#11 依赖此项

---

## Phase 2 — 平台与检索接通（可并行，需 Phase 1 部分完成）

> **Trellis Parent（#2 + #6）**：`.trellis/tasks/06-15-parent-phase2-hooks-pc`（`execution_topology: parallel`，children: `06-15-child-phase2-cursor-hooks`, `06-15-child-phase2-pc-subagent`）

- [x] **2. Cursor 平台钩子针对性优化**
  - 范围：`.cursor/hooks/`（inject-subagent-context / inject-shell-session-context / session-start）
  - 目标：针对 Cursor 平台特性做定制化优化
  - 前置：`#3`（子代理定义确定后，钩子行为才能对齐）
  - 并行：与 #6 #10 并行

- [x] **6. Parent/Child 任务开启 subagent**
  - 目标：针对 Cursor 优化，Parent/Child 场景开启 subagent，以 agent 模式指派
  - 备注：需进一步讨论具体方案
  - 前置：`#3`（子代理定义）+ `#7`（编排机制）
  - 并行：与 #2 #10 并行

- [x] **10. 证据评分接通日常工作流** — task `06-15-child-phase2-evidence-scoring`
  - 范围：`retrieval_evidence.py` 评分引擎
  - 目标：与 retrieval-pack 一并考虑接入方案
  - 现状：仅通过 retrieval-pack 调用，常规 `--mode default` 不使用
  - 前置：`#8`（retrieval-pack 去留决定）
  - 并行：与 #2 #6 并行

---

## 已完成（来自 06-18-release-prep-trim Grill 拆分）

- [x] **C1. 建立 CHANGELOG 机制**
  - 问题：仓库根 + `packages/cli/` 均无 CHANGELOG，版本仅靠 git tag 追溯
  - 完成：`packages/cli/CHANGELOG.md` 已建立（Keep a Changelog 格式），覆盖 1.0.0-1.1.0；`package.json` files[] 已纳入 CHANGELOG.md，未来 npm 包会随附
  - 提交：`c5732f6d docs(changelog): add CHANGELOG.md and include in npm package`
  - 备注：已发布的 1.1.0 tarball 不含 CHANGELOG（发布后才补），从下一个版本开始 npm 包会包含

---

## Phase 3 — 长期迭代与统筹（可并行，需 Phase 1+2 部分完成）

- [x] **4. Task Ladder 路由长期优化** — task `06-15-child-phase3-task-ladder`
  - 范围：`workflow.md` 中的请求分类和路由逻辑
  - 目标：持续迭代路由精度和覆盖面
  - 前置：`#1`（技能优化）+ `#7`（编排优化）完成后路由逻辑才有稳定基础
  - 并行：与 #11 并行
  - 备注：此项为持续迭代型，无明确终点

- [x] **11. 检索层完整设计评审和接入计划** — task `06-15-child-phase3-retrieval-review`
  - 范围：适配器精简 / 评分逻辑 / 调用链 / 技能集成
  - 目标：统筹 #8-#10，输出完整的设计评审报告和日常工作流接入计划
  - 前置：`#8` + `#9` + `#10` 全部完成
  - 并行：与 #4 并行

---

## Phase 4 — 发布后复评（2026-06-19）

> 来源：1.1.0 发布后对 Trellis 用户功能全集（CLI / channel / 工作流 / skill / spec / 检索子系统）逐项复评，用户反馈仍存在的 5 个问题。
> 关联：多数为 Phase 1–3 已完成主题（#1 / #4 / #5 / #7 / #9 / #11）在新版本上的**二次迭代**，非重复项。
> 状态标记同上；`[ ]` 待办。

### 执行顺序总览

```
第一波（可全并行）              第二波（可并行）
┌──────────────────────┐     ┌──────────────────────┐
│ #12 smart-search 优先 │     │ #15 Request Triage 强化│
│ #13 skill 命令面瘦身   │──┐  │ #16 Parent/Child Cursor│
│ #14 fast-context 判定 │  └──→（软依赖 #13）          │
└──────────────────────┘     └──────────────────────┘
```

**依赖关系**：
- `#15` 软依赖 `#13`（skill 暴露面变化会影响 triage 的路由措辞）
- `#12` `#13` `#14` `#16` 无前置依赖，可立即并行启动
- 建议优先 `#12`（高价值、低风险、规则层即可见效）

### 第一波 — 可全并行

- [x] **12. smart-search 在 web 检索中强优先（二次强化）**
  - 关联旧项：`#5`（已完成，本次为发布后复评）
  - 问题：web search/fetch 仍经常先走 Cursor 内置，而非 smart-search
  - 完成（2026-06-19）：三层强化。
    ① AGENTS.md 模板源 `Trellis/packages/cli/src/templates/markdown/agents.md` TRELLIS:START 块新增「Web research routing (smart-search first)」段；
    ② retrieval-daily-guide 模板源 `.../markdown/spec/guides/retrieval-daily-guide.md.txt` 顶部新增「Web research rule (mandatory first)」段 + 矩阵行措辞从 "Default" 升级为 "Mandatory first…downgrade-only"；
    ③ 工作区即时生效：同步改 `AGENTS.md` + `.trellis/spec/guides/retrieval-daily-guide.md`。
  - 验证：`pnpm typecheck` + `pnpm lint` 双绿；无针对该模板的快照测试需更新。
  - 备注：`smart-search-cli/SKILL.md` §4 已足够强（MUST NOT），未动；`capabilities.md` 暂未加显式优先级声明（routing 规则已隐含，避免冗余）。

- [x] **13. skill 用户命令面瘦身（只留少量显式可调用）**
  - 关联旧项：`#1`（技能调用优化，已完成）
  - 问题：可直接 `/skill-name` 调用的 skill 太多，显得繁琐
  - 调研结论：暴露机制已澄清——Cursor 的 `configureCursor()` 本来就只把 continue + finish-work 写入 `.cursor/commands/`（用户可 `/` 调），其余全进 `.cursor/skills/`（agent 自动触发）。用户感知"很多可调"是 **Cursor UI 把 skills/ 也列进 / 面板**的平台行为，非配置器侧可屏蔽。
  - 完成（2026-06-19，A 方案·文档澄清，零代码风险）：AGENTS.md 模板源 + 工作区 AGENTS.md 新增「Command surface」段，明确「User-invocable: /trellis-continue, /trellis-finish-work（+ agent-less 平台的 start）；Internal auto-triggered（do NOT call manually）: brainstorm/before-dev/check/break-loop/update-spec/micro-grill/meta/spec-bootstrap/skill-creator/smart-search-cli」。
  - 取舍：未改 `SKILL_DESCRIPTIONS`（shared.ts）——frontmatter description 供 skill matcher 跨平台匹配，加 "do not invoke manually" 会**降低自动触发命中率**，得不偿失。改用 AGENTS.md 命令面声明（注入时机最早、不影响 matcher）实现同等澄清效果。
  - 修正认知：用户原列"4 个保留"含 `trellis-cursor2plus-setup`，但该 skill 代码层面 Cursor **从不下发**（属 `.claude/skills` bundled 体系），实际用户命令面是 continue + finish-work 两个。
  - 验证：`pnpm typecheck` + `pnpm lint` 双绿。
  - 下游：`#15` 软依赖此项已解除（命令面声明已就位）。

- [-] **14. fast-context-mcp 调用频次判定**
  - 关联旧项：`#9`（适配器审视）、`#11`（检索评审）
  - 观察：fast-context 很少被调用，codegraph 频繁
  - 判定（2026-06-19）：**正常现象，非过度回避**。retrieval-daily-guide 把 fast-context 定位为「Unknown keywords / When you do not know what to grep」的兜底；capabilities.md 对 policy/storage/env/扩展消歧类显式降级 semantic Top-1。近期任务多为精确符号/路径/策略文档类（本任务即典型），正确路由本就是 rg + codegraph + 文档直读，fast-context 不该频繁出现。
  - 处置：**进入观察期**（用户选 instrument）。维持现状不改路由；两周后若发现概念性/命名模糊/跨切面探索任务仍不触发 fast-context，再回头放宽门槛。
  - 状态标记 `[-]`：判定完成 + 暂不改，转入持续观察（非取消；若观察期内出现反例可重启为 `[ ]`）。

### 第二波 — 可并行（含软依赖）

- [x] **15. Request Triage 分流强化** — task `06-19-triage-hardgate`
  - 关联旧项：`#4`（Task Ladder 路由，已完成，持续迭代型）
  - 问题：分流不强，用户「使用得不够重」
  - 范围：`Trellis/packages/cli/src/templates/.../workflow.md` 的 Request Triage + Task Ladder 段、`trellis-start` skill 执行强度
  - 目标：把分流从「软问询」升级为**硬门**——强制显式分类（No Task / Micro-Grill / Lite / Full）并留证据，复用 `[required·once]` + workflow-state 面包屑不变式机制
  - 前置：软依赖 `#13`（skill 暴露面）
  - 并行：与 #16 并行
  - 形态：建议 Full Task（brainstorm → plan）
  - **完成（2026-06-19）**：走 brainstorm → PRD Grill → 实现。
    - **micro-grill 决议**：Q1=方案①（只做文本层强化，Cursor per-turn 注入拆独立 Full Task）；Q2=(a) 口述留证（`[Triage: <Mode>] <reason>`，不改 task.py schema）；Q3=加触发信号列。
    - **改动**：模板源 + 工作区各改 2 处——`workflow.md` 的 `### Request Triage` 段升级为决策树 + 硬门措辞 + 留证格式；`### Task Ladder And Routing` 表新增 "Trigger signals" 列。
    - **验证**：`pnpm typecheck`+`pnpm lint`+`pnpm test`（1375 passed / 4 skipped, exit 0）三绿；`trellis update --dry-run` 检测到 `.trellis/workflow.md` 变更。详见 `06-19-triage-hardgate/verify.md`。
    - **拆出的后续**：Cursor per-turn `UserPromptSubmit` 注入（解决 Cursor 平台结构性缺口，policy 标 deferred 的架构决策）——独立 Full Task。

- [ ] **16. Parent/Child 在 Cursor 上的体验优化**
  - 关联旧项：`#7`（PC 编排）、`#6`（PC subagent）
  - 问题：Cursor 上 PC 体验待优化
  - 范围：`.trellis/spec/guides/cursor-subagent-policy.md`、`generate-child-prompt --mode subagent`、`Trellis/packages/cli/src/configurators/cursor.ts`
  - 目标：先研究 Cursor 子任务派发痛点（readonly SubAgent、fork_turns 隔离、父子上下文继承）再定方案
  - 并行：与 #15 并行
  - 形态：建议 Full Task，先做痛点研究
  - **状态（2026-06-19）：暂缓。** 调研发现 PC 代码骨架已相当成熟（`parent_orchestration.py` 580 行 + policy 文档完备：generate-child-prompt 已生成完整派发提示、Parent/Child 状态机分离、merge_limit:1 防冲突、Cursor++ v0.0.11+ 已修复 SubAgent readonly）。用户确认当前无具体痛点。列出的 6 个候选痛点（worktree 混乱/写拦截/Parent 阻塞/证据把控/per-child 模型繁琐/inline-subagent 困惑）均未被命中。**等实际使用中痛点自然浮现再重启为活跃任务。**

- [ ] **17. Cursor commands-only 策略的旧 skill 残留清理迁移**
  - 来源：2026-06-21 安装 `@blxzer/cursor-trellis@0.1.0` 后复查发现，源码侧 `configureCursor()` 已是 commands-only policy，但旧项目里仍残留 `.cursor/skills/` 与 `.agents/skills/`，导致 Cursor `/` 面板暴露大量内部 Trellis skills，并与 `.cursor/commands/trellis-continue.md` / `trellis-finish-work.md` 形成重复。
  - 范围：`Trellis/packages/cli/src/commands/update.ts`、`Trellis/packages/cli/src/configurators/cursor.ts`、update migration / rollout evidence、相关 tests。
  - 目标：在 Cursor-only / commands-only 策略下，`trellis update` 能识别并安全处理旧 `.cursor/skills/` 残留；对 shared `.agents/skills/` 需按已配置平台谨慎判断，避免破坏 Codex/Gemini 等共享 skill 入口。
  - 建议方案：默认 dry-run/report 提示；apply 阶段优先备份后移除 `.cursor/skills/`，对 `.agents/skills/` 仅在确认未配置依赖 shared skills 的平台时清理，或提供显式迁移选项。
  - 验证：新增 regression/integration 测试，覆盖 Cursor 只生成 commands、旧 `.cursor/skills` 不再留在 `/` 面板暴露面、`continue`/`finish-work` 不出现 command+skill 双入口。
  - 形态：建议 Full Task，先设计迁移边界再实现。
