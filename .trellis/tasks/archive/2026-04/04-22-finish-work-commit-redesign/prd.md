# Finish-work 职责重划：Phase 3.4 加 Commit 步骤 + finish-work 回归纯 record-session

> **状态**：已 brainstorm，待 implementation。
> **Scope**：选项 2（降级版方向 A）—— 不追求"零 trailing chore commit"，仅修复"finish-work 跑两次 + commit 顺序错乱"的体验问题。
> **历史**：2026-04-22 第一次实现完整版（方向 A/C 混合）后回滚；2026-04-29 重新 brainstorm，确认范围降级。

---

## 背景

### 用户痛点（来自群聊 + 截图反馈）

1. `/trellis:finish-work` 跑下来，AI 会停下来等用户手动 commit 代码 → 用户 commit → 再跑一次 `/trellis:finish-work` 才完成 archive + record session。**一次收尾要两次唤起 finish-work**，体验割裂。
2. 即使用户记得先手动 commit，git log 仍可能出现 `chore(task): archive X` / `chore: record journal` 这类 bookkeeping commit 散落在 work commit 中间，**顺序错乱**，PR review / release notes 别扭。
3. （未在本 scope 内解决）`task.py archive` 和 `add_session.py` 各自的 auto-commit 行为，会在收尾末尾产生 1–2 个 trailing chore commit，老用户每次 squash。

### 已探索方向回顾

- **方向 A**（Phase 3.4 加 commit / finish-work 回归 record）：第一次实现已回滚，原因是当时认为"不够压缩"。本次 brainstorm 决定降级目标，**不再要求消除 trailing chore commit**。
- **方向 B**（删 journal 的 git commits 段）：用户讨论后决定保留 hash，**放弃**。
- **方向 C**（一把梭压缩 commit）：受困于 journal hash 鸡生蛋问题（hash 必须在 journal 写入前拿到，但要把 journal 塞进同一个 code commit 又得 amend，amend 改 hash → 作废）。**本任务不做，留作未来 Track-2**。

---

## 目标

让用户的标准收尾流程变成：

```
work 完成后  →  [Phase 3.4] AI 帮你按本次 task 改动批量 commit 代码
            →  /trellis:finish-work  →  archive task + record session
```

- 用户唤起 `/trellis:finish-work` **零等待**，不会被卡在"先手动 commit 再来一次"。
- git log 顺序：`feat: ...`（用户的 work commit）→ `chore(task): archive X` → `chore: record journal`。**bookkeeping 永远在 work commit 之后**。
- AI 主动起草 commit message，用户**整批 plan 一次性确认**后由 AI 执行 `git commit`。

---

## 非目标（明确不做）

- **不消除 trailing chore commit**：archive / add_session 的 auto-commit 行为保留不动（这是方向 C 的事，超出 scope）。
- **不加 `--amend` 任何使用**：选项 2 全程三阶段三 commit，不重写历史。
- **不引入 `--manual-commit` flag**：用户拒绝整批 plan 即天然回到手动模式。
- **不动 `relatedFiles` task.json 字段语义**：本期靠 AI 会话记忆 + 用户勾选兜底。

---

## 设计决策（ADR-lite）

### Decision 1：commit 授权粒度
- **决定**：展示整批 commit plan，**一次性**让用户确认（不每个 commit 单独问）。
- **拒绝原因**：单 commit 单确认会造成多轮交互，违背"finish-work 一次完成"目标。
- **逃生阀**：用户对整批 plan 回"不行/不对/我自己来" → AI 完全退出 commit 编排，等用户手动提完再继续 record。**不需要专门的 flag**。

### Decision 2：本次 task 改动识别
- **决定**：策略 a + c —— AI 默认按"本 session 编辑过的文件"提案，commit plan 里把**未识别归属的 dirty file**单独列出让用户勾选/排除。
- **AI 自识别范围**：本 session 通过 Edit/Write/Bash 工具修改/新增的文件路径（保留在工具调用记录里）。
- **用户兜底**：plan 展示阶段，dirty 但 AI 没编辑过的文件 → 单独列出 → 用户决定 include/exclude。
- **跨 session 风险**：如果用户上一会话改了一半就退出，本会话才跑 finish-work，那些"上次的改动"会落到"未识别归属"分组里 → 用户决定。

### Decision 3：commit message 风格学习
- **决定**：实现时让 AI 跑 `git log --oneline -5`，模仿最近 5 个 commit 的 message 风格（前缀 / 长度 / 中英文）。
- **不做**：让用户在 spec 里手写"commit style"约定（增加配置面）。

### Decision 4：commit 顺序
- **决定**：流程顺序固化为 `code commits → archive task → record journal`。
  - 3.4 的 code commit 由 AI 起草并执行
  - finish-work skill 内**先**调 `task.py archive`（产生 `chore(task): archive` commit）
  - **再**调 `add_session.py`（产生 `chore: record journal` commit，hash 字段填本次 task 关联的 work commit hash list）

### Decision 5：finish-work 重新定义
- **决定**：finish-work 回归**纯 record-session 语义**（archive + journal）。
- **前置检查**：进入 finish-work 时跑 `git status --porcelain` 检测未提交代码改动（排除 `.trellis/workspace`、`.trellis/tasks` 这些 add_session 自动管的路径）。
  - 检测到 → 不执行，提示"请先回到 Phase 3.4 把代码 commit 完，再跑 /finish-work"
  - 干净 → 执行 archive + record

---

## 实施范围（文件清单）

### 一、文档：workflow.md Phase 3 重组

- `packages/cli/src/templates/trellis/workflow.md`：
  - 在 Phase 3 当前的 3.1 / 3.2 / 3.3 之后**插入**：
    - `#### 3.4 Commit changes [required · once]` —— AI 跑 git status / 学 commit style / 起草 plan / user confirm / 执行 git commit
  - 把原 `3.4 Wrap-up reminder` 顺移为 `3.5`
- `.trellis/workflow.md`：同步上述内容
- `[workflow-state:completed]` breadcrumb 改文案：从"User commits changes; then run task.py finish and task.py archive"改成"代码已 commit；运行 /trellis:finish-work 收尾"
  - 涉及文件：`packages/cli/src/templates/shared-hooks/inject-workflow-state.py`、`packages/cli/src/templates/opencode/plugins/inject-workflow-state.js`、本地副本

### 二、Skill 重写：finish-work

- `packages/cli/src/templates/common/commands/finish-work.md`：
  - 删除当前 Step 2 "Remind user to commit"
  - 新 Step 1：sanity check（`git status --porcelain` 排除 `.trellis/workspace` `.trellis/tasks` 后非空 → bail out）
  - Step 2：archive task（如有 active task）
  - Step 3：add_session 写 journal
- `packages/cli/src/templates/copilot/prompts/finish-work.prompt.md`：同步
- `packages/cli/src/templates/codex/skills/finish-work/*`：同步
- 各平台 dist / 本地 `.{platform}/commands/trellis/finish-work.md` 副本：通过 build 流程同步（不手改）

### 三、bundled-skills 文档同步

- `packages/cli/src/templates/common/bundled-skills/trellis-meta/references/local-architecture/workflow.md` —— Phase 3 调整描述同步

### 四、不动的部分

- `task.py archive` 的 `_auto_commit_archive` —— 保留
- `add_session.py` 的 `_auto_commit_workspace` —— 保留

---

## Acceptance Criteria

- [ ] workflow.md Phase 3 包含 3.4 Commit changes，描述清晰、给出具体动作步骤
- [ ] `/trellis:finish-work` 在 working tree 干净时 1 次跑通 archive + record session，无任何"等待用户 commit"暂停
- [ ] `/trellis:finish-work` 在 working tree 有未提交代码改动时**拒绝执行**，提示用户回到 3.4
- [ ] AI 在 3.4 阶段：
  - [ ] 自动跑 `git status` 识别 dirty file
  - [ ] 区分"AI session 编辑过 / 未识别归属"两组
  - [ ] 模仿 `git log --oneline -5` 的 message 风格起草 commit
  - [ ] 整批 plan 一次性 user-confirm（拒绝即退出，不再尝试）
  - [ ] 用户确认后逐个执行 `git commit`
- [ ] 最终 git log 顺序：work commits → `chore(task): archive` → `chore: record journal`
- [ ] 跨平台模板（claude / codex / copilot / cursor / iflow / kiro / kilo / qoder / opencode / pi / gemini / antigravity）的 finish-work skill 文案统一更新
- [ ] CHANGELOG 写明：finish-work 行为变更 + 老用户迁移说明（之前会等手动 commit 的体验已改）

## Definition of Done

- [ ] 本 task 通过 `pnpm test` / `pnpm lint` / `pnpm typecheck`
- [ ] 至少在 claude + opencode 两个平台手动跑通新流程
- [ ] script-conventions / 相关 spec 已更新（finish-work 语义变更需文档化）
- [ ] dist 模板由 build 流程重新生成

---

## Open Questions（已全部 resolved）

| # | 问题 | 决议 |
|---|---|---|
| 1 | commit 授权粒度 | 整批 plan 一次性确认 |
| 2 | pre-existing dirty state（别 task 的 WIP） | 只提交本次 task 相关的改动 |
| 3 | `--amend` 使用范围 | 选项 2 不需要 amend，划掉 |
| 4 | 多 task 混 commit | AI 自己 session 里做的相关改动为准 |
| 5 | commit message 风格来源 | `git log --oneline -5` 自动学 |
| 6 | 逃生阀 | 复用 #1 的拒绝路径，不加 flag |
| 7 | journal hash 生成时机 | code commit → archive → journal（journal 写时所有 hash 都已存在） |
| 8 | finish-work 重新定义 | 回归纯 record-session 语义 |

---

## 风险

- **用户习惯惯性**：之前手动 commit 的老用户改到"AI 帮提" 节奏不一样，需要 changelog 大字提示
- **AI 自识别"本次改动"会漏**：长会话/编辑过又删除的情况，依赖用户在 plan 阶段勾选兜底
- **commit message 风格学习不准**：repo 历史 5 个 commit 不代表风格 → 退化方案是 AI 起草后让用户改

---

## 关联

- 历史回滚：本任务首次实现于 2026-04-22 会话上下文，已 revert
- 后续任务（不在本 scope）：方向 C「一把梭压缩 commit + 解决 journal hash 鸡生蛋」
- 相关代码文件：
  - `packages/cli/src/templates/trellis/workflow.md`
  - `packages/cli/src/templates/common/commands/finish-work.md`
  - `packages/cli/src/templates/copilot/prompts/finish-work.prompt.md`
  - `packages/cli/src/templates/codex/skills/finish-work/`
  - `packages/cli/src/templates/common/bundled-skills/trellis-meta/references/local-architecture/workflow.md`
  - `packages/cli/src/templates/shared-hooks/inject-workflow-state.py`
  - `packages/cli/src/templates/opencode/plugins/inject-workflow-state.js`
  - 本地副本若干（通过 init/update 同步）

## 优先级

🟢 **P1** —— 用户体感明确、范围已收敛、实现量可控、收益直接。建议在下一个 beta 发版前合入。
