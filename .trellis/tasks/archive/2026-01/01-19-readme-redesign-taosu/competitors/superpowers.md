# Superpowers Claude Code Plugin 深度研究报告

> 研究时间: 2026-01-20
> 目的: 为 Trellis 项目 README 和 Use Case 提供借鉴

## 概述

**Superpowers** 是由 Jesse Vincent ([@obra](https://github.com/obra)) 开发的 Claude Code 插件，目前在 GitHub 上有 **29.5k+ stars**。它是一个 agentic skills 框架，核心理念是：**让 AI 在写代码之前先思考和规划**。

**核心问题解决**：Claude Code 默认行为是立即开始写代码，跳过规划阶段。这导致：
- 遗漏文件
- 引入 bug
- 偏离用户真实需求

## 安装方式

```bash
# 在 Claude Code 中执行
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace
```

或手动添加到 `.claude/plugins.json`：
```json
{
  "plugins": {
    "superpowers": {
      "type": "github",
      "owner": "obra",
      "repo": "superpowers"
    }
  }
}
```

## 核心工作流程

### 三阶段开发流程

| 阶段 | 命令 | 作用 |
|------|------|------|
| 1. Brainstorm | `/superpowers:brainstorm` | 澄清需求，探索替代方案，分块展示设计供用户审批 |
| 2. Write Plan | `/superpowers:write-plan` | 创建详细实施计划，任务粒度为 2-5 分钟 |
| 3. Execute Plan | `/superpowers:execute-plan` | 分批执行计划，每个任务有 review checkpoint |

### 计划文件结构

```
~/.config/superpowers/
└── plans/
    └── feature-name/
        ├── PLAN.md         # 完整路线图
        ├── progress.md     # 当前状态和已完成任务
        └── verification.md # 测试命令和成功标准
```

## 内置 Skills 列表

### 测试与调试

| Skill | 描述 |
|-------|------|
| `test-driven-development` | RED-GREEN-REFACTOR 循环：先写失败测试 → 写代码通过 → 重构 |
| `systematic-debugging` | 4 阶段方法：根因调查 → 模式分析 → 假设测试 → 实现 |
| `verification-before-completion` | 必须运行验证命令确认输出后才能声称工作完成 |

### 协作技能

| Skill | 描述 |
|-------|------|
| `brainstorming` | 交互式设计精化 |
| `writing-plans` | 创建实施计划 |
| `executing-plans` | 执行计划 |
| `dispatching-parallel-agents` | 分派并行子代理 |
| `requesting-code-review` | 请求代码审查 |
| `receiving-code-review` | 接收代码审查 |
| `using-git-worktrees` | 使用 git worktree 隔离开发 |
| `finishing-a-development-branch` | 完成开发分支 |
| `subagent-driven-development` | 子代理驱动开发 |

### 元技能

| Skill | 描述 |
|-------|------|
| `writing-skills` | 教 Claude 如何创建新 skill |
| `using-superpowers` | 入门指南 |

## 生态系统：相关插件

Superpowers Marketplace 包含 6 个插件：

| 插件 | 版本 | 描述 |
|------|------|------|
| **superpowers** | v3.4.1 | 核心 skills 库：TDD、调试、协作模式 |
| **superpowers-chrome** | v1.5.0 | Chrome DevTools Protocol 直接访问，零依赖 |
| **superpowers-lab** | v0.1.0 | 实验性 skills：tmux 自动化控制交互式 CLI (vim, git rebase -i) |
| **episodic-memory** | v1.0.9 | 语义搜索对话历史，跨 session 记忆 |
| **elements-of-style** | v1.0.0 | 基于 Strunk《风格的要素》的写作指导 |
| **superpowers-developing-for-claude-code** | v0.2.0 | 开发 Claude Code 插件/skills 的资源 |

## 技术实现原理

### Bootstrap 机制

安装后，Claude Code 启动时会注入 prompt：
```
<<session-start-hook>><<EXTREMELY_IMPORTANT>>
You have Superpowers.
**RIGHT NOW, go read**: @~/.claude/plugins/cache/Superpowers/skills/getting-started/SKILL.md
<</EXTREMELY_IMPORTANT>><</session-start-hook>>
```

这个 bootstrap 教会 Claude：
1. 你有 skills，它们给你 Superpowers
2. 通过脚本搜索 skills，通过读取来使用
3. **如果有对应 skill，必须使用它**

### SKILL.md 格式

每个 skill 是一个文件夹，包含 `SKILL.md` 文件：
- YAML frontmatter 定义元数据
- Markdown 正文定义指令
- 可包含额外资源文件

Skills 按需加载，初始只消耗 ~50-100 tokens，激活后展开完整指令。

### 命名心理学

作者发现 plugin 命名影响 Claude 是否愿意使用 skills：
- `superpowers:writing-plans` → Claude 愿意使用
- `superpowers-testing:writing-plans` → Claude 会犹豫
- `superpowers-do-not-use:xxx` → Claude 会拒绝

最终选择 `superpowers-lab` 作为实验性 skills 的命名空间。

## 实际使用案例

### Next.js 16 迁移 (来自 Trevor Lasn 的案例)

使用 `/superpowers:write-plan` 生成 500 行计划：
- 识别出 23 个需要修改的 API route 文件
- 找到 2 个使用 `new Date()` 会破坏 prerendering 的组件
- 列出需要 Suspense boundaries 的 context providers
- 包含 4 天时间线和测试 checkpoints
- 定义成功标准 (build pass, CLS=0.000, Lighthouse≥95)
- 包含回滚计划

### 推荐工作流 (来自 st0012.dev)

1. `/superpowers:brainstorm I want to build X. Help me clarify constraints`
2. `/superpowers:write-plan` 生成计划文档
3. 手动修改计划，与 Claude 反复确认细节
4. `/superpowers:execute-plan` 在 subagent 中执行

**技巧**：也可以用自然语言调用，如 "Use superpower to help me brainstorm this task"

## 核心价值

1. **Token 效率**：工作拆分为 5 分钟块，进度写入 markdown 文件，避免 context 爆炸
2. **跨 session 持续性**：计划存在文件中，不会因对话结束丢失
3. **强制纪律**：从"急躁的初级开发者"变成"有纪律的高级工程师"
4. **自主长时间工作**：可以连续工作数小时而不偏离轨道

---

## 对 Trellis 的启发

### README 借鉴点

1. **问题驱动的开篇**：Superpowers 清晰描述了它解决的痛点（Claude 跳过规划直接写代码）
2. **快速上手**：安装命令放在显眼位置
3. **工作流可视化**：用表格展示三阶段流程
4. **具体案例**：Next.js 16 迁移案例非常有说服力

### Use Case 借鉴点

1. **定量结果**：23 个文件、500 行计划、4 天时间线
2. **Before/After 对比**：展示使用前后的差异
3. **实际用户引用**：引用真实用户的工作流

## README 中的 Use Case

**注意**：Superpowers 的 GitHub README 相对简洁，主要展示**三阶段工作流**作为核心 Use Case。

### README 中的工作流 Use Case

| 命令 | Use Case |
|------|----------|
| `/superpowers:brainstorm` | 澄清需求，探索替代方案，分块展示设计供用户审批 |
| `/superpowers:write-plan` | 创建详细实施计划，任务粒度为 2-5 分钟 |
| `/superpowers:execute-plan` | 分批执行计划，每个任务有 review checkpoint |

### README 中的 Skills 列表（部分）

**测试与调试**：
- `test-driven-development` - RED-GREEN-REFACTOR 循环
- `systematic-debugging` - 4 阶段调试方法
- `verification-before-completion` - 运行验证命令后才能完成

**协作技能**：
- `brainstorming` - 交互式设计精化
- `dispatching-parallel-agents` - 分派并行子代理
- `using-git-worktrees` - 使用 git worktree 隔离开发

### Use Case 展示风格
- **命令驱动**：用斜杠命令展示用途
- **工作流导向**：三阶段流程（Brainstorm → Plan → Execute）
- **Skills 即 Use Case**：每个 skill 名称就是一个用途

### 外部博客中的案例（非 README）
- Next.js 16 迁移：23 个文件、500 行计划、4 天时间线
- 这些案例在 README 中没有直接展示

---

### 差异化机会

Trellis 可以强调：
- **多开发者支持**：Superpowers 似乎是单人使用，Trellis 支持团队
- **Feature 追踪**：完整的 feature 生命周期管理
- **Agent Traces**：可追溯的 AI 工作记录
- **结构化指南**：`spec/` 目录的规范化开发指南

---

## Sources

- [GitHub - obra/superpowers](https://github.com/obra/superpowers)
- [GitHub - obra/superpowers-marketplace](https://github.com/obra/superpowers-marketplace)
- [Superpowers: How I'm using coding agents in October 2025](https://blog.fsck.com/2025/10/09/superpowers/)
- [Superpowers 2.0 came out yesterday](https://blog.fsck.com/2025/10/12/superpowers-20-came-out-yesterday-and-might-already-be-obsolete/)
- [A new plugin for "in development" superpowers](https://blog.fsck.com/2025/10/23/naming-claude-plugins/)
- [How I force Claude Code to plan before coding with Superpowers](https://www.trevorlasn.com/blog/superpowers-claude-code-skills)
- [A Claude Code workflow with the superpowers plugin](https://st0012.dev/links/2026-01-15-a-claude-code-workflow-with-the-superpowers-plugin/)
- [This Plugin Makes Claude Code Work for Hours Without Going Off the Rails](https://levelup.gitconnected.com/this-plugin-makes-claude-code-work-for-hours-without-going-off-the-rails-f176e474b284)
- [Claude Code Marketplace - obra/superpowers](https://claudecodemarketplace.com/marketplace/obra/superpowers-marketplace)
