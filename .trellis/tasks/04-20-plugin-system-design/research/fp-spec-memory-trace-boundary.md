# FP 分析：`spec/` 改名 + trace/memory/spec 边界

> 创建日期：2026-04-22
> 触发：用户提出两个关联点 —
> 1. Trellis 的 `spec/` 语义模糊（像 PRD，但实际是 coding-doc）
> 2. trace 导出和 memory 是否一回事？能否类比 llm-wiki 的 `sources/` + `wiki/` 分层，把 `spec/`（或改名 `knowledge_base/`）和 memory 合一？以及 `spec/guides/` 能和 llm-wiki 擦出什么火花
>
> 方法论：`first-principles-thinking` skill，跑完 Phase 0–5。
> 注意：本文件只是思考沉淀，**未进入 PRD**。后续是否采纳由 brainstorm 决策。

---

## Axioms（不可再分的真命题）

1. **Markdown + frontmatter 是最小共享衬底** — 所有 agent 都能原生读写、可 diff / grep / PR review。低于这层（embedding / SQLite）就失去 agent-agnostic 性质。
2. **写入节奏决定存储契约** — append-only 日志（trace）与 edit-in-place 文档（spec / wiki）在并发、审核、冲突模型上根本不同。混在同一个目录要么丢 audit trail，要么丢可编辑性。
3. **信任等级是访问闸门** — AI 能否静默覆盖取决于该内容是否经过人类审核。没有显式标注就会出现"AI 改了一条 DoD 但没人知道"的静默退化。git 能追踪但不能阻止语义漂移。

---

## 问题本质

**Core problem**：当前 `.trellis/spec/` 把"人类审核的层级契约"和"人类审核的横向方法论"混在同一个词下，未来又要塞入"AI 自维护的记忆 wiki"。到底应不应该改名、怎么切分才让**命名 = 真实的认知状态（谁写的、谁批的、什么时候过期）**。

**Success criteria**：
- 每种产物有且只有一个规范路径
- 新人（人或冷启动 AI）看目录名就能判断能不能 AI 自改
- trace ↔ memory ↔ spec 之间的跃迁规则可形式化
- 不做破坏性改名（`spec/` 已被 skills/hooks/docs 固化引用）

---

## Assumptions Challenged

| # | Assumption | Challenge | Axioms | Verdict |
|---|------------|-----------|--------|---------|
| A1 | "spec" 语义 = PRD，所以必须改 | 业界 spec 实际是双义：PM 语境 = PRD，工程语境 = RFC/IETF/CRD 契约。Trellis 用的是后者，和 Kubernetes CRD spec、RFC spec 同血缘 | A3 | **Modify**：歧义真实存在，但根因不是"选错词"，而是 `spec/` 里层级契约 + 方法论 + 未来 memory 三种认知状态混同 |
| A2 | trace 和 memory 是一个东西（用户原始假设） | llm-wiki 里 `sources/`（raw, dated, immutable）和 `wiki/`（derived, topic, mutable）是**两个契约**。trace 是 sources 的一个**子集**（只覆盖 session auto-capture），但 sources 还包括人工贴的文章 / 调研 | A2 | **Partially**：trace ⊂ sources，不是 memory。memory/trace 共享衬底但写契约不能合并 |
| A3 | spec 改名 knowledge_base 后与 memory 合并 | spec 是人审 + PR 才改；memory 是 AI 自写 subagent 自改。合并 = 丢失"这是人类契约"的保证。AI 可能静默改 DoD | A3 + A2 | **Discard**：不合并。可共享上层伞命名但子目录必须分 |
| A4 | `guides/` 属于 `spec/` 下 | guides（code-reuse / cross-layer / cross-platform）是横向思维方法论，不是某层的 MUST。但它仍然**人审 + 稳定**，不是 AI 易变 | A3 | **Modify**：guides 不属于"layer contract"但属于"human-authored"认知类，与 layer spec 是兄弟，不是 memory 的兄弟 |
| A5 | 改名能解决命名问题 | 改名是单向门：破坏 skills/hooks/docs 引用 + 肌肉记忆 + SEO；新名字（knowledge_base）未必更清晰 | Reversibility filter | **Modify**：不做顶层改名，做**结构化分层**让歧义消失 |
| A6 | llm-wiki 的 sources→wiki 流水线 1:1 映射到 trace→memory | llm-wiki 假设人类决定 ingest 什么；Memory plugin 提的是 subagent 自动 ingest。auto-ingest + in-place 编辑 = jakevin7 警告的"错误级联" | A3 | **Modify**：trace→memory 之间必须有闸（显式 `/ingest` 或 PR 建议），不是直通管道 |

---

## Ground Truths

1. **Trellis 有 3 个认知面，不是 2 个**：
   - (a) 层级契约 `spec/{layer}/*` — 人审，PR 改
   - (b) 横向方法论 `spec/guides/*` — 人审，稳定
   - (c) 目前不存在 — AI 自维护会话学习 + 外源 ingest（Memory plugin 要新建）

2. **Trace 的写契约 = immutable + 时间索引**：per-session JSONL append-only。等价于 llm-wiki `sources/YYYY-MM-DD/` 的角色，但只是**一种** source（auto-captured），不是唯一种类。

3. **Memory wiki 的写契约 = mutable + 主题索引 + 强 frontmatter**：edit-in-place .md，要求 bounded size / sources 可追溯 / 可 revert commit。和 trace 的 append-only 根本不同。

4. **"spec" 的歧义来自目录 flatten，不是词选错**：layer contract / methodology / 未来 memory 在同一层暴露，读者无法一眼判断认知类型。

5. **llm-wiki 架构可直接映射但要拆角色**：
   - `sources/` ← trace 导出 + 人工贴源
   - `wiki/` ← Memory plugin 产物 +（可选）guides 的演化
   - `wiki-agent.md` 项目覆盖 ← 对齐 Trellis 已有 CLAUDE.md / AGENTS.md bootstrap
   - `_index.md` 路由表 ← **Trellis spec/ 当前缺失的关键件**

---

## Reasoning Chain

- **GT#4 + GT#1 → 顶层改名不能消除歧义，靠认知类型命名子目录才行**
- **GT#1 + GT#3 + A2 → memory 和 trace 必须是两个目录，不能共享根**
- **GT#5 + GT#1(b) → guides 应留在 `spec/`（人审层），不下沉到 `memory/`（AI 易变层）**
- **GT#2 + A6 → trace 不是 sources 本身，而是"一种 source 来源"；trace → `memory/sources/` 的摘要是一次可控提升，不是直通**

---

## 推荐布局（最小改动版）

```
.trellis/
  spec/                          ← 不改名。认知定位锁定为"human-authored contracts"
    {layer}/*.md                 ← layer contract（现状）
    guides/*.md                  ← horizontal methodology（现状）
    _index.md                    ← NEW: llm-wiki 风格路由表（当前缺失，真正解决歧义的关键件）
  memory/                        ← NEW 顶层。认知定位锁定为"AI-curated"
    wiki/*.md                    ← derived pages（主题索引，edit-in-place）
    sources/YYYY-MM-DD/*.md      ← raw 入口（包含 trace 摘要 + 人贴源）
    wiki-agent.md                ← 项目级 ingest 规则（对齐 llm-wiki）
    _index.md
  tasks/{task}/traces/           ← 认知定位锁定为"ephemeral per-session"
    session-{uuid}.jsonl         ← trace firehose 原始物（不直接进 memory/sources）
```

三层认知状态的闸门：

```
traces/           (ephemeral, machine-only)
   ↓ summarizer（显式 /ingest 或 subagent + PR 建议）
memory/sources/   (raw, dated, immutable; AI 可写但不可改)
   ↓ curation agent（wiki-agent.md 规则）
memory/wiki/      (derived, topic, mutable; AI 可改)
   ↑
   （高价值观察若要晋升为人审契约，走 PR）
   ↓
spec/guides/ or spec/{layer}/ (human-authored, PR-gated)
```

---

## Key Insights（FP 揭示、惯性思维错过的）

1. **用户以为是"spec 这个词选错了"，真相是**：`spec/` 目录下混了多种**认知状态**（layer contract / methodology / 未来 memory），而目录层级没暴露这个差异。**路由 `_index.md` 比改名更有效**。

2. **用户以为 trace 和 memory 可能是同一个东西，真相是**：trace 是 memory/sources 的**众多输入之一**，在 llm-wiki 模型里属于同一条 raw → derived 流水线的上游。**但不能省略中间的 curation 闸**（否则 jakevin7 警告的"一个错误引起更多错误"必然发生）。

3. **spec/guides 和 llm-wiki 的交集点是"wiki-agent.md 项目级规则"这个概念**，而不是 guides 本身的内容。guides 留在 spec（人审），但可以把 guides 里的 MUST/NEVER 标准抽取出来喂给 memory 的 ingest filter（即 `memory/wiki-agent.md` 可以 reference `spec/guides/*.md`，而不是复制内容）。

---

## Trade-offs

- **不改 `spec/` 名** = 留下文档里的口径解释成本（FAQ 一条说明"Trellis 用的是 RFC 语义 spec"）
- **`memory/` 作为新顶层** = 增加一个根目录，但换来认知清晰
- **trace 不直接进 memory/sources/** = 需要一层摘要 agent/hook，多一次 LLM 调用，但换来抗漂移

---

## 三处 llm-wiki 可借火花

1. **`_index.md` 路由表装进 `spec/`** — 这是真正解决"spec 看起来像 PRD"歧义的关键件：让人/AI 看一眼就知道 `spec/cli/backend` 是层契约、`spec/guides` 是方法论
2. **`sources/` + frontmatter 模式（`ingested: YYYY-MM-DD` / `wiki_pages: [...]`）直接在 `memory/` 采用** — 已在 PRD "Incremental guard" 项捕获
3. **`wiki-agent.md` 项目级 ingest 规则 + Trellis 已有 CLAUDE.md/AGENTS.md bootstrap 结合成双层配置** — CLAUDE.md/AGENTS.md 做"平台 bootstrap"，`memory/wiki-agent.md` 做"memory 专属 ingest 规则"，职责不重叠

---

## Validation

- [x] **Traceability**：每条结论可回溯到 GT（路由表 ← GT#4+5，memory 分离 ← GT#1+3，trace 子集 ← GT#2，guides 位置 ← GT#1）
- [x] **Completeness**：每个 GT 都被至少一个结论覆盖
- [x] **Honesty**：未跳步，Phase 0–5 全走

### Pre-mortem（12 个月后失败三问）

1. **可能失败 1**：用户仍分不清 `spec/guides/`（PR-reviewed 方法论）和 `memory/wiki/`（AI-volatile 知识）。
   - **缓解**：frontmatter 加 `review_status: human-authored` 或 `spec/**` 设 CODEOWNERS
2. **可能失败 2**：auto-ingest trace → memory 创建漂移（jakevin7 警告）。
   - **缓解**：trace → memory 走显式 `/ingest` 原子 commit，或 subagent 产 PR 建议而非直写
3. **可能失败 3**：迁移破坏现有用户。
   - **缓解**：无破坏 — `memory/` 是新增目录，`spec/` 结构不动，零 migration 风险

---

## 后续决策 Open Questions

- OQ1：`memory/` 作为顶层 vs 作为 `.trellis/knowledge/memory/` 嵌套？（影响是否引入伞目录）
- OQ2：`spec/_index.md` 是否作为独立子任务先落地，不等 plugin 机制？（低成本高价值，可立即执行）
- OQ3：trace → memory/sources/ 的摘要 agent 算 Memory plugin 的一部分还是 Trace plugin 的 exporter？（影响插件边界）
- OQ4：spec/guides 要不要也加 frontmatter `review_status:` 和 `applies_to:`，作为和 memory/wiki 的对称结构？

---

## 与现有 PRD 的关系

- 本分析**不改变** Memory plugin 采用 llm-wiki vault 的大方向
- 本分析**新增**一条目录语义澄清：`memory/` 作为顶层而非藏在某处，`trace` 不直接 flow 进 memory
- 本分析**建议**把 `spec/_index.md` 拆为独立微任务（可能独立于 plugin 机制先做）
- 本分析**保留** PRD 里的 ingest 原子化、可撤销、wiki-agent.md 等机制

