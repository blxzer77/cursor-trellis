# Channel-Driven Sub-Agent Dispatch 工作流（中文草稿）

---

## 核心原则

1. **先计划，再写代码**：先明确任务、规划文件和验收条件，再进入实现。
2. **主会话负责协调**：主会话做需求澄清、任务规划、worker 调度、spec 更新、提交和收尾。
3. **实现和检查交给 channel worker**：默认用 `trellis channel spawn` 启动 implement/check worker，不使用宿主平台原生 sub-agent。
4. **上下文显式传递**：worker 的输入顺序固定为 `jsonl entries -> prd.md -> design.md -> implement.md`。
5. **结果可审计**：通过 `trellis channel messages --raw` 查看 worker 事件，避免 pretty 输出截断。
6. **持久化所有决策**：需求、研究、计划、review 结论都写入 task 文件。

---

## Trellis 系统

### Developer Identity

首次使用时初始化身份：

```bash
python3 ./.trellis/scripts/init_developer.py <your-name>
```

### Spec System

`.trellis/spec/` 保存项目工程约定。写代码前按任务涉及的 package/layer 读取对应 spec：

```bash
python3 ./.trellis/scripts/get_context.py --mode packages
```

### Task System

每个任务在 `.trellis/tasks/{MM-DD-name}/` 下有独立目录，包含 `task.json`、`prd.md`、可选 `design.md`、可选 `implement.md`、可选 `research/`，以及 `implement.jsonl` / `check.jsonl`。

常用命令：

```bash
python3 ./.trellis/scripts/task.py create "<title>" [--slug <name>] [--parent <dir>]
python3 ./.trellis/scripts/task.py start <name>
python3 ./.trellis/scripts/task.py current --source
python3 ./.trellis/scripts/task.py finish
python3 ./.trellis/scripts/task.py archive <name>
python3 ./.trellis/scripts/task.py validate <name>
```

### Channel System

channel 是 worker 协作和事件审计层。临时实现/check channel 使用 `--ephemeral`；长期讨论空间使用 `--type forum`，forum 里的单个讨论项叫 `thread`。

稳定 worker handle：

- `implement`：实现 worker
- `check`：默认检查 worker
- `check-cc`：Claude check worker
- `check-cx`：Codex check worker

---

<!--
  WORKFLOW-STATE BREADCRUMB CONTRACT

  [workflow-state:STATUS] blocks 是每轮 prompt 注入的单一来源。
  不要删除 tag，不要改 tag 格式。正文可以改，parser 不应该改。
-->

## Phase Index

```
Phase 1: Plan    -> classify, get task-creation consent, then write planning artifacts
Phase 2: Execute -> implement/check through trellis channel workers
Phase 3: Finish  -> verify, update spec, commit, and wrap up
```

### Request Triage

- 简单对话或小任务：只问这轮是否需要创建 Trellis task；如果用户说不需要，就跳过 task。
- 复杂任务：先问是否创建 Trellis task 并进入规划；如果用户拒绝，不做大范围实现。
- 用户同意创建 task，不等于同意开始实现；实现必须等到规划文件 review 后再 `task.py start`。

### Planning Artifacts

- `prd.md`：需求、约束、验收标准。
- `design.md`：复杂任务的技术设计。
- `implement.md`：复杂任务的执行计划、验证命令、review gate、回滚点。
- `implement.jsonl` / `check.jsonl`：worker context manifest，只放 spec 和 research，不放代码文件。

轻量任务可以只有 `prd.md`。复杂任务必须有 `prd.md`、`design.md`、`implement.md` 后才能 start。

### Parent / Child Task Trees

当一个需求包含多个可独立验收的交付物时，使用 parent task。child task 承担实际可独立实现和检查的交付物。父子结构不是依赖系统；依赖关系必须写进 child 的 `prd.md` / `implement.md`。

[workflow-state:no_task]
No active task. First classify the current turn and ask for task-creation consent before creating any Trellis task.
Simple conversation / small task: ask only whether this turn should create a Trellis task. If the user says no, skip Trellis for this session.
Complex task: ask the user if you can create a Trellis task and enter the planning phase. If the user says no, explain, clarify scope, or suggest a smaller split.
[/workflow-state:no_task]

### Phase 1: Plan

- 1.0 Create task `[required · once]`
- 1.1 Requirement exploration `[required · repeatable]`
- 1.2 Research `[optional · repeatable]`
- 1.3 Configure context `[conditional · once]`
- 1.4 Activate task `[required · once]`
- 1.5 Completion criteria

[workflow-state:planning]
Load `trellis-brainstorm`; stay in planning.
Lightweight: `prd.md` can be enough. Complex: finish `prd.md`, `design.md`, and `implement.md`; ask for review before `task.py start`.
Multi-deliverable scope: consider a parent task plus independently verifiable child tasks; dependencies must be written in child artifacts, not implied by tree position.
Channel-worker mode: curate `implement.jsonl` and `check.jsonl` as spec/research manifests before start.
[/workflow-state:planning]

[workflow-state:planning-inline]
Load `trellis-brainstorm`; stay in planning.
Lightweight: `prd.md` can be enough. Complex: finish `prd.md`, `design.md`, and `implement.md`; ask for review before `task.py start`.
Multi-deliverable scope: consider a parent task plus independently verifiable child tasks; dependencies must be written in child artifacts, not implied by tree position.
Inline mode: skip jsonl curation; Phase 2 reads artifacts/specs via `trellis-before-dev`.
[/workflow-state:planning-inline]

### Phase 2: Execute

- 2.1 Implement `[required · repeatable]`
- 2.2 Quality check `[required · repeatable]`
- 2.3 Rollback `[on demand]`

Channel-driven sub-agent dispatch 是本 workflow 的默认执行方式。主会话使用 `trellis channel create`、`trellis channel spawn`、`trellis channel send`、`trellis channel wait` 调度 worker。只有用户明确要求原生 dispatch，或 worker 需要 channel 无法提供的 host-only 能力时，才回退到原生 sub-agent。

[workflow-state:in_progress]
Flow: channel-driven `implement` worker -> channel-driven `check` worker -> `trellis-update-spec` -> commit (Phase 3.4) -> `/trellis:finish-work`.
Main-session default: use `trellis channel spawn` with `.trellis/agents/implement.md` and `.trellis/agents/check.md`; do not use native Claude Task / Codex sub_agent unless explicitly requested or host-only tools require it.
Worker context order: jsonl entries -> `prd.md` -> `design.md if present` -> `implement.md if present`. Use stable worker handles such as `implement`, `check`, `check-cx`, `check-cc`; read results with `trellis channel messages --raw` when precision matters.
[/workflow-state:in_progress]

[workflow-state:in_progress-inline]
Flow: `trellis-before-dev` -> edit -> channel-driven `check` worker -> validation -> `trellis-update-spec` -> commit (Phase 3.4) -> `/trellis:finish-work`.
Inline implementation is allowed only when the user asked for it or the change is too small to justify a worker. After editing, prefer `trellis channel spawn --agent check` for independent review.
Read context before editing: `prd.md` -> `design.md if present` -> `implement.md if present`, plus relevant spec/research loaded by skills.
[/workflow-state:in_progress-inline]

### Phase 3: Finish

- 3.1 Quality verification `[required · repeatable]`
- 3.2 Debug retrospective `[on demand]`
- 3.3 Spec update `[required · once]`
- 3.4 Commit changes `[required · once]`
- 3.5 Wrap-up reminder

[workflow-state:completed]
Code committed. Run `/trellis:finish-work`; if dirty, return to Phase 3.4 first.
[/workflow-state:completed]

---

## Rules

1. 先识别当前 Phase，再执行该 Phase 的下一步。
2. 每个 Phase 内按顺序执行；`[required]` 不能跳过。
3. Phase 2 默认用 channel worker。不要在主会话里直接实现大块代码，除非用户要求 inline 或任务足够小。
4. worker brief 必须明确 active task、目标、可改文件范围、验证命令和禁止事项。
5. `trellis channel messages --raw` 是精确审计入口；pretty 输出只适合快速看状态。
6. worker 完成后，主会话负责整合结果、必要时再发 check worker，不把最终判断外包掉。

### Active Task Routing

[Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi]

- Planning or unclear requirements -> `trellis-brainstorm`.
- `in_progress` implementation -> `trellis channel spawn --agent implement`.
- `in_progress` quality check -> `trellis channel spawn --agent check`.
- Repeated debugging -> `trellis-break-loop`; spec updates -> `trellis-update-spec`.

[/Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi]

[codex-inline, Kilo, Antigravity, Windsurf]

- Planning or unclear requirements -> `trellis-brainstorm`.
- Before editing -> `trellis-before-dev`; after editing -> prefer channel-driven `check` worker.
- Repeated debugging -> `trellis-break-loop`; spec updates -> `trellis-update-spec`.

[/codex-inline, Kilo, Antigravity, Windsurf]

---

## Phase 1: Plan

目标：明确需求，得到 task 创建同意，并产出实现前必须 review 的规划文件。

#### 1.0 Create task `[required · once]`

只有在用户同意创建 task 后才创建目录：

```bash
python3 ./.trellis/scripts/task.py create "<task title>" --slug <name>
```

只运行 `create`，不要同时运行 `start`。`start` 会把状态切到 `in_progress`，让 breadcrumb 进入执行阶段。

#### 1.1 Requirement exploration `[required · repeatable]`

加载 `trellis-brainstorm`，把用户需求写进 `prd.md`。复杂任务还需要 `design.md` 和 `implement.md`。

要求：

- 一次问一个问题。
- 优先自己调研，少问用户已可发现的信息。
- 需求变化后立即更新 task artifact。
- 大范围需求拆成 parent task + child task。
- `prd.md` 只写需求和验收，不写实现 checklist。

#### 1.2 Research `[optional · repeatable]`

需要调研时，把结果写入 `{TASK_DIR}/research/`。研究文件要能被后续 worker 读取。

#### 1.3 Configure context `[conditional · once]`

整理 worker context manifest：

- `implement.jsonl`：实现 worker 需要的 spec 和 research。
- `check.jsonl`：检查 worker 需要的 quality spec、test spec、research。

不要把代码文件写进 jsonl；worker 在执行时自己读代码。

#### 1.4 Activate task `[required · once]`

规划文件 review 后启动任务：

```bash
python3 ./.trellis/scripts/task.py start <task-dir>
```

#### 1.5 Completion criteria

| Condition | Required |
| --- | :---: |
| `prd.md` exists | yes |
| user confirms task should enter implementation | yes |
| `task.py start` has run | yes |
| `design.md` exists for complex tasks | yes |
| `implement.md` exists for complex tasks | yes |
| `implement.jsonl` / `check.jsonl` curated when needed | recommended |

---

## Phase 2: Execute

目标：主会话通过 channel worker 把规划文件变成通过检查的代码。

#### 2.1 Implement `[required · repeatable]`

[Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi]

使用 channel-driven implement dispatch：

```bash
TASK=.trellis/tasks/<active-task>
trellis channel create impl-<topic> --task "$TASK" --by main --ephemeral
trellis channel spawn impl-<topic> \
  --agent implement \
  --as implement \
  --jsonl "$TASK/implement.jsonl" \
  --file "$TASK/prd.md" \
  --file "$TASK/design.md" \
  --file "$TASK/implement.md" \
  --cwd "$PWD" \
  --timeout 60m
trellis channel send impl-<topic> --as main --to implement --text-file /tmp/implement-brief.md
trellis channel wait impl-<topic> --as main --kind done --from implement --timeout 60m
trellis channel messages impl-<topic> --raw --from implement --last 20
```

`design.md` 或 `implement.md` 不存在时，省略对应 `--file`。brief 需要说明 worker 的目标、禁止回退用户改动、验证命令和完成汇报格式。

原生 sub-agent fallback 只在用户明确要求或 host-only 能力必须使用时允许。

[/Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi]

[codex-inline, Kilo, Antigravity, Windsurf]

1. 加载 `trellis-before-dev`。
2. 读取 `prd.md`、可选 `design.md`、可选 `implement.md`。
3. 读取相关 research。
4. 小改动可以 inline 实现；大改动仍应建 channel worker。
5. 实现后进入 channel-driven check。

[/codex-inline, Kilo, Antigravity, Windsurf]

#### 2.2 Quality check `[required · repeatable]`

[Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi]

使用 channel-driven check dispatch：

```bash
TASK=.trellis/tasks/<active-task>
trellis channel create cr-<topic> --task "$TASK" --by main --ephemeral
trellis channel spawn cr-<topic> \
  --agent check \
  --as check \
  --jsonl "$TASK/check.jsonl" \
  --file "$TASK/prd.md" \
  --file "$TASK/design.md" \
  --file "$TASK/implement.md" \
  --cwd "$PWD" \
  --timeout 30m
trellis channel send cr-<topic> --as main --to check --text-file /tmp/check-brief.md
trellis channel wait cr-<topic> --as main --kind done --from check --timeout 30m
trellis channel messages cr-<topic> --raw --from check --last 40
```

需要跨 provider 复核时，在同一个 channel 里并行拉 `check-cc` 和 `check-cx`：

```bash
trellis channel spawn cr-<topic> --agent check --provider claude --as check-cc --cwd "$PWD" --timeout 30m
trellis channel spawn cr-<topic> --agent check --provider codex --as check-cx --cwd "$PWD" --timeout 30m
trellis channel send cr-<topic> --as main --to check-cc --text-file /tmp/check-brief.md
trellis channel send cr-<topic> --as main --to check-cx --text-file /tmp/check-brief.md
trellis channel wait cr-<topic> --as main --kind done --from check-cc,check-cx --all --timeout 30m
```

check worker 应直接修复明确问题。主会话读取 raw 事件后做最终判断。

[/Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi]

[codex-inline, Kilo, Antigravity, Windsurf]

加载 `trellis-check` 或使用 channel-driven check worker。发现问题后修复，再重新检查，直到 green。

[/codex-inline, Kilo, Antigravity, Windsurf]

#### 2.3 Rollback `[on demand]`

- check 发现 PRD 错误 -> 回到 Phase 1 修改 artifact，再重新执行。
- implement worker 做偏 -> 主会话收回范围，重新发 brief 或回滚本轮改动。
- 需要更多 research -> 写入 `{TASK_DIR}/research/` 后重新派 worker。

---

## Phase 3: Finish

目标：确认质量、记录经验、提交工作。

#### 3.1 Quality verification `[required · repeatable]`

加载 `trellis-check` 或派 channel-driven check worker 做最终验证：

- spec compliance
- lint / type-check / tests
- cross-layer consistency
- task artifact 对齐

#### 3.2 Debug retrospective `[on demand]`

如果同一类问题反复出现，加载 `trellis-break-loop` 记录根因和预防措施。

#### 3.3 Spec update `[required · once]`

加载 `trellis-update-spec`，判断是否需要把新模式、新坑、新技术决策写回 `.trellis/spec/`。

#### 3.4 Commit changes `[required · once]`

主会话负责提交工作变更。提交前分清本轮 AI 修改和未知修改，不把用户未知改动混进提交。

```bash
git status --porcelain
git log --oneline -5
```

不要 amend。不要 push。

#### 3.5 Wrap-up reminder

提交后提醒用户运行 `/trellis:finish-work` 归档 task 并记录 session。

---

## Customizing Trellis

这个 workflow 的可定制点是 `.trellis/workflow.md`。脚本只解析 tag 和 heading，不保存正文 fallback。

### 修改步骤含义

改 Phase 1 / 2 / 3 的对应正文。

### 修改每轮注入文本

改对应 `[workflow-state:STATUS]` block 正文。不要改 tag 名称和格式。

### 添加自定义状态

新增：

```text
[workflow-state:my-status]
...
[/workflow-state:my-status]
```

还必须有 lifecycle hook 或脚本把 `task.json.status` 写成这个状态，否则永远不会被读取。
