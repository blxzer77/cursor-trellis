# PRD: Trellis 产品形态与分发策略

## 背景

团队在讨论 Trellis 的产品定位和分发策略。核心问题是：如何让 Trellis 这套开发流程治理能力，以更低门槛的方式被用户理解、尝试和采纳。

---

## 核心需求

### 需求一：用"糖衣"包装，降低认知门槛

**问题**：
- Trellis 本身是一个复杂的开发流程治理系统
- 用户对"CLI 工具"、"开发框架"这类概念有理解负担
- 传播和分发时，需要花大量精力解释"这是什么"

**期望**：
- 用"Claude Skill"或"Claude Plugin"这个用户**已经熟悉**的概念来包装
- 借势一个已被接受的心智模型
- 让用户愿意"先点开、先尝试"，再慢慢发现背后的能力

**类比**：给西兰花裹糖——把复杂的东西用更甜的包装让人愿意吃第一口

---

### 需求二：极简入口，用户无需记忆命令

**问题**：
- 用户是懒的
- 要求用户记住 `/start`、`/finish-work` 等多个命令是负担
- 每次写代码前手动输入 `/start` 是摩擦点

**期望**：
- 用一个极简的方式**一次性初始化**系统
- 初始化后，Trellis 工作流**自动注入**到每次 AI 会话中
- **不修改用户原有的使用习惯**——用户正常和 AI 对话即可
- 用户甚至可以不知道 Trellis 在后台运行

**理想流程**：
```
用户第一次：执行某个简单的初始化（如安装一个 skill）
          ↓
之后每次：打开 Claude Code，直接开始写代码
          ↓
Trellis 自动在后台生效（读 guidelines、记录 traces、执行检查等）
```

---

## 约束与边界

### 必须保证的特性

1. **强制植入** — Trellis 的上下文必须在每次会话中被加载，不能依赖 AI "选择"调用
2. **项目级配置** — 每个项目的 Trellis 配置可以不同，通过 Git 同步
3. **团队共享** — 同一个项目的团队成员共享同一套规范
4. **可审计** — 所有流程必须透明、可复盘，不能是黑盒

### 担忧与风险

1. **生态位竞争** — 如果做成 Skill，同类产品可能抢占位置
2. **AI 选择不确定性** — Skills 太多时，AI 可能不调用，或调用竞品
3. **上下文限制** — AI 上下文有限，skills 太多可能导致都不被调用

---

## 技术调研结果

### Claude Code 机制分析

| 机制 | 能否自动执行？ | 确定性 | 说明 |
|------|---------------|--------|------|
| **CLAUDE.md** | ❌ 不能 | - | 只是被动上下文，无法触发命令执行 |
| **Skills** | ⚠️ 部分 | 低 | AI 识别匹配后请求使用，仍需用户批准 |
| **SessionStart Hook** | ✅ 能 | **100%** | 每次会话开始时自动执行脚本 |
| **PreToolUse Hook** | ✅ 能 | 100% | 在特定工具调用前自动执行 |

### 关键发现

1. **`SessionStart` Hook 是唯一的真正自动化入口**
   - 在每次会话开始时自动执行
   - 可以运行脚本、注入上下文、设置环境变量
   - 100% 确定性，不依赖 AI 判断

2. **当前项目没有使用 SessionStart Hook**
   - 现有 hooks：`PreToolUse`（Task 调用前）、`SubagentStop`（check 完成后）
   - `/start` 是手动调用的 skill

3. **Skills 不能实现"无感自动"**
   - AI 会根据描述识别匹配
   - 但仍需用户批准才能执行
   - 存在生态位竞争风险

---

## 可行方案

### 方案 A：SessionStart Hook（推荐）

**原理**：用 SessionStart Hook 在每次会话开始时自动执行初始化脚本

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python3 \"$CLAUDE_PROJECT_DIR/.claude/hooks/session-init.py\"",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

**Hook 脚本可以**：
- 读取 workflow.md、guidelines
- 获取 git 状态、当前 feature
- 返回 JSON 的 `additionalContext` 注入到会话

| 优势 | 劣势 |
|------|------|
| 100% 确定性 | 用户需要有 `.claude/settings.json` |
| 用户完全无感 | 初始化时需要配置 hooks |
| 不依赖 AI 判断 | Hook 脚本需要维护 |

**用户体验**：
```
用户：安装 Trellis（npm install / git clone）
      ↓
Trellis 自动配置 .claude/settings.json
      ↓
之后每次：用户直接使用 Claude Code，Trellis 自动生效
```

---

### 方案 B：CLAUDE.md 指令（简单但不可靠）

**原理**：在 CLAUDE.md 中写明"会话开始时执行 /start"

```markdown
## Session Start Behavior

When starting a new session for code development:
1. Always execute the `/start` skill first
2. Wait for initialization to complete before proceeding
```

| 优势 | 劣势 |
|------|------|
| 实现简单 | 依赖 AI 遵守指令 |
| 无需额外配置 | **不是 100% 确定** |
| | AI 可能忘记或判断不需要 |

**不推荐**：无法满足"强制植入"需求

---

### 方案 C：混合方案

**原理**：
- SessionStart Hook：注入核心上下文（git 状态、当前 feature、基础 guidelines）
- CLAUDE.md：补充行为指引
- /start Skill：保留用于手动完整初始化

| 优势 | 劣势 |
|------|------|
| 平衡自动化与灵活性 | 架构稍复杂 |
| 核心上下文 100% 注入 | 需要维护多处 |
| 用户仍可手动 /start | |

---

## 方案对比

| 维度 | 方案 A | 方案 B | 方案 C |
|------|--------|--------|--------|
| 植入确定性 | ✅ 100% | ⚠️ 不确定 | ✅ 核心 100% |
| 实现复杂度 | 中 | 低 | 高 |
| 用户初始化成本 | 中（需配置 hooks） | 低 | 中 |
| 日常使用成本 | 无 | 无 | 无 |
| 灵活性 | 低 | 高 | 高 |

**推荐**：方案 A 或 方案 C

---

## 成功标准

| 指标 | 描述 |
|------|------|
| 初始化成本 | 用户从 0 到开始使用，步骤 ≤ 3 |
| 日常使用成本 | 用户日常使用时，无需记忆或输入任何命令 |
| 植入确定性 | 100% 的会话中，Trellis 上下文都被加载 |
| 可理解性 | 用户能用一句话解释"Trellis 是什么" |

---

## 讨论记录

### 2025-01-20 Session

**参与者**: kleinhe + AI

**讨论脉络**：
1. 昨天讨论了用 Skill 包装 Trellis 的可能性（入口 skill 思路）
2. 今天进一步明确：Trellis 和普通 Skill 有本质区别（强制 vs 可选）
3. 但"Skill"作为包装形态仍有价值——借势已有心智模型
4. 核心矛盾：如何既享受 Skill 的易理解性，又保证 100% 植入确定性
5. 需求梳理为两个层面：糖衣（传播）+ 极简（体验）

**技术调研结果**：
- CLAUDE.md：被动上下文，无法自动执行
- Skills：需要 AI 识别 + 用户批准，不是 100% 确定
- **SessionStart Hook：唯一的真正自动化入口，100% 确定性**
- 当前项目没有使用 SessionStart Hook

**可行方案**：
- 方案 A：SessionStart Hook（推荐）— 100% 确定性
- 方案 B：CLAUDE.md 指令 — 简单但不可靠
- 方案 C：混合方案 — 平衡自动化与灵活性

**下一步待决策**：
- [ ] 选择实施方案
- [ ] 设计"糖衣"层面的产品包装（如何向用户解释 Trellis）
- [ ] 设计安装/初始化流程

---

### 2026-01-20 Session #2: Tagline 命名讨论

**参与者**: kleinhe + AI

**讨论背景**：
用户提出考虑用"AI coding 治理框架"作为 Trellis 的 tagline，需要分析这个定位是否合适。

**关键发现**：

#### 1. Claude Code Plugin vs Trellis 的区别

| 特性 | Claude Code Plugin（全局） | Trellis（项目级） |
|------|---------------------------|-------------------|
| 安装位置 | `~/.claude/plugins/` | 项目 `.claude/` + `.trellis/` |
| 作用范围 | 所有项目共享 | 仅当前项目 |
| 安装方式 | `npm install -g` 或 `/plugin` | `trellis init` |

**结论**：Trellis 利用的是 Claude Code 的**项目级配置能力**，而不是全局 Plugin 系统。这是设计选择——每个项目需要不同的规范和追踪。

#### 2. 竞品分析：最接近的项目

**AI Governor Framework** (github.com/Fr-e-d/AI-Governor-Framework)
- Tagline: *"Turn any AI coding assistant into a disciplined, project-aware engineering partner that respects your architecture and coding standards"*
- 定位和 Trellis 几乎一致
- 注意：用的是 "Governor" 而不是 "Governance"——更生动

**Project CodeGuard**
- 定位: *"AI model-agnostic security framework"*
- 专注于安全规则嵌入

#### 3. "治理框架"这个词的问题

| 方面 | 分析 |
|------|------|
| **联想** | 企业合规、官僚流程、管束控制 |
| **语气** | 偏正式、偏冷 |
| **使用场景** | 数据治理、社区治理、企业 IT 治理 |
| **开发者友好度** | 低 - 听起来像是"要管你"而不是"帮你" |

**关键发现**：开源界几乎没有热门项目用"治理框架"做 tagline。

#### 4. 开源界更火的定位词汇

| 词汇 | 代表项目 | Stars |
|------|----------|-------|
| Agent Orchestration Framework | n8n, LangGraph, CrewAI | 50K+ |
| Agent Framework | Microsoft Agent Framework, Swarms | 10K+ |
| Workflow Automation | n8n, Temporal | 50K+ |
| Developer Tooling | 各种 CLI 工具 | - |

#### 5. Trellis 核心价值 vs "治理"能否表达

| 问题 | Trellis 的解法 | "治理"能表达？ |
|------|----------------|----------------|
| AI 不了解项目上下文 | 持久化规范、会话追踪 | ❌ 不直观 |
| 规范写了但不遵守 | 按需注入、Hook 自动执行 | ❌ 太抽象 |
| 工作流需要人监督 | Slash Command 封装流程 | ❌ 联想不到 |
| 多 Agent 配置复杂 | `/parallel` 一键启动 | ❌ 完全不沾边 |

#### 6. 推荐的定位方向

**方向 A: 用比喻（像 Trellis 这个名字本身）**
> *"Guide AI's wild growth along a disciplined path"*
> *"让 AI 的能力沿着正确的方向生长"*

Trellis（藤架）本身就是完美的比喻——**引导而非管束**。

**方向 B: 强调"让 AI 更懂项目"**
> *"Project-aware AI coding framework"*
> *"Make AI respect your architecture"*

类似 AI Governor Framework 的思路。

**方向 C: 强调"工作流自动化"**
> *"AI Coding Workflow Framework"*
> *"From prompt to production, on rails"*

**方向 D: 借鉴 Anthropic 自己的用词**
Anthropic 的文章标题是 *"Effective **Harnesses** for Long-Running Agents"*
> *"AI Coding Harness"*（AI 编码缰绳/驾驭工具）

**结论**：
- **不推荐**用"AI coding 治理框架"作为 tagline
- **推荐**继续用 Trellis 的**藤架比喻**，或更开发者友好的词：harness（驾驭）、rails（轨道）、guide（引导）

**用户反馈**：认可这个命名思路分析。

---

## 待办事项

- [ ] 选择实施方案（SessionStart Hook vs 混合方案）
- [ ] 确定最终 tagline 方向
- [ ] 设计安装/初始化流程
