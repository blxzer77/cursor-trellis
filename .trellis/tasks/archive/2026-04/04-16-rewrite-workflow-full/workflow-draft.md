# Development Workflow

---

## Core Principles

1. **Plan before code** — 先搞清楚做什么，再动手
2. **Specs injected, not remembered** — 规范通过 hook/skill 注入，不靠记忆
3. **Persist everything** — 调研、决策、经验全部落盘到文件，对话会压缩，文件不会
4. **Incremental development** — 一次只做一个 task
5. **Capture learnings** — 每次开发完回顾，把经验沉淀到 spec

---

## Trellis System

### What is Trellis

Trellis 是一个 AI 辅助开发的工作流框架。它通过以下机制让 AI agent 的产出更可靠：

- **Spec 系统**：项目编码规范持久化在 `.trellis/spec/` 下，AI 通过 skill 或 hook 读取，而不是靠"记住"
- **Task 系统**：每个开发任务一个目录，存放需求文档（prd.md）、调研产出、agent 上下文等
- **Workspace 系统**：记录每次会话的工作内容，用于跨 session 追踪进度
- **Hook 系统**（部分平台）：在 AI 调用工具前/后自动注入上下文或做质量检查
- **Skill 系统**：把工作流步骤封装为 AI 可自动加载的 skill，按 description 语义匹配触发

### Developer Identity

每个开发者/Agent 需要初始化身份（首次使用时）：

```bash
python3 ./.trellis/scripts/init_developer.py <your-name>
```

创建：
- `.trellis/.developer` — 身份文件（gitignored）
- `.trellis/workspace/<your-name>/` — 个人工作空间

### File Structure

```
.trellis/
├── .developer              # 当前开发者身份（gitignored）
├── .current-task            # 当前任务指针（gitignored）
├── workflow.md              # 本文档
├── config.yaml              # 项目配置（packages、hooks 等）
├── scripts/                 # Python 脚本
│   ├── get_context.py       # 获取会话上下文
│   ├── task.py              # 任务管理（create/start/finish/archive）
│   ├── add_session.py       # 记录 session 到 journal
│   ├── init_developer.py    # 初始化开发者身份
│   └── get_developer.py     # 获取当前开发者名
├── workspace/               # 工作记录
│   ├── index.md             # 全局索引
│   └── {developer}/         # 每个开发者的空间
│       ├── index.md         # 个人索引
│       └── journal-N.md     # 会话日志（每文件最多 2000 行）
├── tasks/                   # 任务目录
│   └── {MM-DD-name}/        # 每个任务一个目录
│       ├── prd.md           # 需求文档
│       ├── info.md          # 技术方案（可选）
│       ├── research/        # 调研产出（可选）
│       ├── implement.jsonl  # implement agent 上下文（Claude Code, Cursor, OpenCode, Codex, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid）
│       ├── check.jsonl      # check agent 上下文（Claude Code, Cursor, OpenCode, Codex, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid）
│       └── task.json        # 元数据
└── spec/                    # 编码规范
    ├── <package>/           # 按包组织
    │   └── <layer>/         # 按层组织（backend/frontend/unit-test 等）
    │       ├── index.md     # 入口 — Pre-Dev Checklist & Quality Check
    │       └── *.md         # 具体规范文档
    └── guides/              # 跨包思维指南
        ├── index.md
        └── *.md
```

### Spec System

`.trellis/spec/` 下存放项目的编码规范。按包（package）和层（layer）组织。

**发现可用 spec**：
```bash
python3 ./.trellis/scripts/get_context.py --mode packages
```

**读取 spec**：
```bash
cat .trellis/spec/<package>/<layer>/index.md    # 入口，包含 Pre-Dev Checklist
cat .trellis/spec/guides/index.md               # 思维指南（跨包通用）
```

每个 `index.md` 包含 **Pre-Development Checklist**（开发前必读的具体文件列表）和 **Quality Check**（开发后的检查清单）。index 是导航，具体规范在它指向的 `.md` 文件里。

**什么时候更新 spec**：
- 发现新的模式或约定
- 修完 bug 后总结出的防护措施
- 新的技术决策

### Task System

每个开发任务对应一个目录，存放该任务相关的所有文件。

```bash
python3 ./.trellis/scripts/task.py create "<title>" [--slug <name>]  # 创建
python3 ./.trellis/scripts/task.py start <dir>                       # 设为当前 task
python3 ./.trellis/scripts/task.py finish                            # 清除当前 task
python3 ./.trellis/scripts/task.py archive <name>                    # 归档到 archive/
python3 ./.trellis/scripts/task.py list                              # 列出活跃 task
```

**Current task 机制**：`task.py start` 把 task 路径写入 `.trellis/.current-task`。有 hook 的平台会在每次会话开始时自动注入当前 task 信息，AI 无需被告知就能知道在做什么。

### Workspace System

记录每次 AI 会话的工作内容，用于跨 session 追踪。

- `journal-N.md` — 会话日志，每个文件最多 2000 行，超出自动创建新文件
- `index.md` — 个人索引，记录 session 总数、最近活跃时间

通过 `add_session.py` 脚本一键记录：
```bash
python3 ./.trellis/scripts/add_session.py --title "Title" --commit "hash" --summary "Summary"
```

### Context Script

```bash
python3 ./.trellis/scripts/get_context.py              # 完整上下文
python3 ./.trellis/scripts/get_context.py --json        # JSON 格式
python3 ./.trellis/scripts/get_context.py --mode packages  # 可用 packages 和 spec layers
python3 ./.trellis/scripts/get_context.py --mode record    # 用于 session 记录的上下文
python3 ./.trellis/scripts/get_context.py --mode phase --step <X.X>  # 获取某个步骤的详细指引
```

---

## Phase Index

```
Phase 1: Plan    → 搞清楚做什么（brainstorm + research → prd.md）
Phase 2: Execute → 写代码并通过质量检查
Phase 3: Finish  → 沉淀经验 + 收尾记录
```

### Phase 1: Plan
- 1.0 创建 Task `[必做·一次]`
- 1.1 需求探索 `[必做·可重复]`
- 1.2 调研 `[可选·可重复]`
- 1.3 配置上下文 `[必做·一次]` — Claude Code, Cursor, OpenCode, Codex, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid
- 1.4 完成标志

### Phase 2: Execute
- 2.1 实现 `[必做·可重复]`
- 2.2 质量检查 `[必做·可重复]`
- 2.3 回退 `[按需]`

### Phase 3: Finish
- 3.1 质量验证 `[必做·可重复]`
- 3.2 Debug 复盘 `[按需]`
- 3.3 规范更新 `[必做·一次]`
- 3.4 收尾提醒

### Rules

1. 判断当前处于哪个 Phase，从那里的下一个步骤继续
2. 每个 Phase 内按步骤顺序执行，标记 `[必做]` 的不能跳过
3. Phase 之间可以回退（如 Execute 中发现 prd 有误 → 回到 Plan 修正）
4. 带 `[一次]` 标签的步骤，已完成则跳过，不要重复执行

### Skill Routing

当用户的请求匹配以下 skill 时，必须优先调用 skill，不要跳过 skill 直接操作。

| 用户意图 | 对应 skill |
|---|---|
| 想做新功能 / 需求不清晰 | trellis-brainstorm |
| 准备写代码 / 开始实现 | trellis-before-dev |
| 写完了 / 检查一下 | trellis-check |
| 卡住了 / 同一个 bug 修了好几次 | trellis-break-loop |
| 规范需要更新 | trellis-update-spec |

### DO NOT skip skills

| 你心里想的 | 为什么是错的 |
|---|---|
| "这很简单，直接写就行" | 简单的事经常变复杂，before-dev 不到一分钟 |
| "我已经在 plan mode 想过了" | plan mode 产出在内存里，sub-agent 读不到，必须落盘为 prd.md |
| "spec 我已经知道了" | 你上次读的 spec 可能已经更新了，重新读一遍 |
| "先写代码再检查" | check 能发现你自己注意不到的问题，越早跑越省事 |

### 加载步骤详情

每到一个步骤，调用以下命令获取该步骤的详细指引：

```bash
python3 ./.trellis/scripts/get_context.py --mode phase --step <step>
# 例：python3 ./.trellis/scripts/get_context.py --mode phase --step 1.1
```

---

## Phase 1: Plan

目标：搞清楚要做什么，产出明确的需求文档和实现所需的上下文。

#### 1.0 创建 Task `[必做·一次]`

创建 task 目录并设为当前任务：

```bash
python3 ./.trellis/scripts/task.py create "<task title>" --slug <name>
python3 ./.trellis/scripts/task.py start <task-dir>
```

跳过条件：`.trellis/.current-task` 已指向一个 task。

#### 1.1 需求探索 `[必做·可重复]`

加载 `trellis-brainstorm` skill，按照 skill 指引和用户交互式探讨需求。

brainstorm skill 会引导你：
- 一次问一个问题
- 优先自己调研而非问用户
- 偏好给选项而非开放提问
- 每次用户回答后立即更新 `prd.md`

需求有变化时可以重新进入此步修正 `prd.md`。

#### 1.2 调研 `[可选·可重复]`

在需求探讨过程中，随时可以调研。调研不限于本地代码——可以利用任何可用的工具（MCP servers、skills、web search 等）调研外部信息，包括第三方库文档、行业实践、API 参考等。

[Claude Code, Cursor, OpenCode, Codex, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid]

调用 research sub agent：

- **Agent 类型**：`research`
- **任务描述**：调研 <具体问题>
- **关键要求**：调研结果必须持久化到 `{TASK_DIR}/research/` 目录

[/Claude Code, Cursor, OpenCode, Codex, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid]

[Kilo, Antigravity, Windsurf]

在主会话中直接调研，把发现写入 `{TASK_DIR}/research/` 目录。

[/Kilo, Antigravity, Windsurf]

**调研产出规范**：
- 每个调研主题一个文件（如 `research/auth-library-comparison.md`）
- 涉及第三方库的用法示例、API 参考、版本约束等写入文件
- 发现的相关 spec 文件路径，记录备用

brainstorm 和 research 可以自由交替——想到某个技术问题就去调研，调研完回来继续和用户讨论。

**关键原则**：调研产出必须写入文件，不能只存在于对话消息中。对话会被压缩，文件不会。

#### 1.3 配置上下文 `[必做·一次]`

[Claude Code, Cursor, OpenCode, Codex, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid]

当调研产出足够清晰后，初始化 agent 上下文文件：

```bash
python3 ./.trellis/scripts/task.py init-context "$TASK_DIR" <type>
# type: backend | frontend | fullstack
```

跳过条件：`implement.jsonl` 已存在。

追加额外发现的 spec 文件或代码模式 `[可选·可重复]`：

```bash
python3 ./.trellis/scripts/task.py add-context "$TASK_DIR" implement "<path>" "<reason>"
python3 ./.trellis/scripts/task.py add-context "$TASK_DIR" check "<path>" "<reason>"
```

这些 jsonl 文件会在 Phase 2 被 hook 自动注入到 sub agent 的 prompt 中。

[/Claude Code, Cursor, OpenCode, Codex, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid]

[Kilo, Antigravity, Windsurf]

跳过此步。上下文由 skill（trellis-before-dev）在 Phase 2 直接加载。

[/Kilo, Antigravity, Windsurf]

#### 1.4 完成标志

| 条件 | 必须 |
|------|:---:|
| `prd.md` 存在 | ✅ |
| 用户确认需求 | ✅ |
| `research/` 有调研产出（复杂任务） | 建议 |
| `info.md` 技术方案（复杂任务） | 可选 |

[Claude Code, Cursor, OpenCode, Codex, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid]

| `implement.jsonl` 存在 | ✅ |

[/Claude Code, Cursor, OpenCode, Codex, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid]

---

## Phase 2: Execute

目标：把 prd 变成代码并通过质量检查。

#### 2.1 实现 `[必做·可重复]`

[Claude Code, Cursor, OpenCode, Codex, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid]

调用 implement sub agent：

- **Agent 类型**：`implement`
- **任务描述**：按照 prd.md 实现需求，参考 `{TASK_DIR}/research/` 下的调研材料，跑完项目 lint 和 type-check 再结束

平台 hook 会自动完成：
- 读取 `implement.jsonl` → 注入对应 spec 文件内容到 agent prompt
- 注入 prd.md 内容

[/Claude Code, Cursor, OpenCode, Codex, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid]

[Kilo, Antigravity, Windsurf]

1. 加载 `trellis-before-dev` skill 读取项目规范
2. 阅读 `{TASK_DIR}/prd.md` 了解需求
3. 参考 `{TASK_DIR}/research/` 下的调研材料
4. 按需求实现代码
5. 跑完项目的 lint 和 type-check

[/Kilo, Antigravity, Windsurf]

#### 2.2 质量检查 `[必做·可重复]`

[Claude Code, Cursor, OpenCode, Codex, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid]

调用 check sub agent：

- **Agent 类型**：`check`
- **任务描述**：审查所有代码变更，对照 spec 和 prd 要求，发现问题直接修复，确保 lint 和 type-check 通过

check agent 的任务：
- 对照 spec 检查代码变更
- 自动修复发现的问题
- 运行 lint 和 typecheck 验证

[/Claude Code, Cursor, OpenCode, Codex, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid]

[Kilo, Antigravity, Windsurf]

加载 `trellis-check` skill，按照 skill 指引验证代码：
- spec 合规性
- lint / type-check / tests
- 跨层一致性（如果涉及多层改动）

如有问题 → 修复 → 重新 check，直到通过。

[/Kilo, Antigravity, Windsurf]

#### 2.3 回退 `[按需]`

- check 发现 prd 有误 → 回到 Phase 1 修正 prd.md，然后重新 2.1
- implement 方向错误 → 回退代码，重新 2.1
- 需要补充调研 → 调研（同 Phase 1.2），产出写入 `research/`

---

## Phase 3: Finish

目标：确保代码质量、沉淀经验、记录工作。

#### 3.1 质量验证 `[必做·可重复]`

加载 `trellis-check` skill，做最终质量验证：
- spec 合规性
- lint / type-check / tests
- 跨层一致性（如果涉及多层改动）

如有问题 → 修复 → 重新 check，直到通过。

#### 3.2 Debug 复盘 `[按需]`

如果本次开发过程中经历了反复调试（同一个问题修了多次），加载 `trellis-break-loop` skill：
- 分析 bug 根因类别
- 总结为什么之前的修复失败
- 提出预防机制

目的是把调试经验沉淀下来，避免同类问题再次出现。

#### 3.3 规范更新 `[必做·一次]`

加载 `trellis-update-spec` skill，回顾本次开发是否产生了值得记录的新经验：
- 新发现的模式或约定
- 踩过的坑
- 新的技术决策

有则更新 `.trellis/spec/` 下对应的文档。即使结论是"没有需要更新的"，也要走一遍这个判断。

#### 3.4 收尾提醒

上述步骤完成后，提醒用户可以运行 `/finish-work` 来收尾（归档 task、记录 session）。

---

## Best Practices

### DO

1. 每个步骤加载对应的 skill，不要跳过
2. 调研产出写入 `{TASK_DIR}/research/`，不要只存在对话中
3. 一次只做一个 task
4. 频繁跑 lint 和 tests
5. 开发完回顾——有什么值得记录到 spec 的

### DON'T

1. 不要跳过读 spec 直接写代码
2. 不要让 journal 单文件超过 2000 行
3. 不要同时开发多个不相关的 task
4. 不要忘记更新 spec（即使觉得"没什么好更新的"，也要走一遍判断）
