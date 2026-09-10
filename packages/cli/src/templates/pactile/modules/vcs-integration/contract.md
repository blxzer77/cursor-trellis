# `vcs-integration`

P29 表名：`vcs-integration`（不得改名）。层：on-demand。

## 职责

Git（或其它已探测 VCS）上的真实操作：branch、worktree、commit、PR、push。它把「隔离 / 留下提交 / 开 PR」从 capability 落到命令。**不是** Kernel 前提，也不是 Close 的完成条件。人批仍走 `approval-personal` 的 Finalize（commit / 远程 / 不可逆）。工人默认不 commit（`worker-orchestration` 已锁）。

## 触发/披露

未触发当没装。仓库里有 `.git` **不够**进 Prompt。触发（可审计）：

1. Finalize 窗口且用户要 commit / PR / push；或
2. Policy / Close 合同要求 commit Evidence；或
3. Parent/Worker 要求 isolation，需要 worktree；或
4. 用户明确说提交、开分支、开 PR。

**不是**触发：每次 Execute；无 Git 的 Lite Close；只改文件还不想留提交。

Finalize/隔离窗口结束，Git 教战从常驻包消失。

Agent 看见：

1. 无 VCS → 本块不出现；生命周期仍可 Close；需要隔离则按 `worker-orchestration` 诚实降级，不得假装 worktree 已建。
2. `git commit` ≠ Outcome completed。没 Finalize 授权不得 commit、不得 push、不得 `--force` 到默认分支。
3. 远程、破坏性 Git、跳过 hook、改全局 git config：先问（Finalize / 用户明确）。不静默 push。
4. worktree 细节（add/remove/路径）归本块；谁有权 integrate、哪个 Child 要隔离，归 `parent-child`。
5. 个人默认不把「禁止在 main 上开发」写成 Kernel 规则；那是仓库/用户 overlay。若用户或 Policy 已有分支约定，本块遵守。
6. 不提交密钥。PR 只在存在对应远程托管时做；没有 GitHub/远程 ≠ Close 失败。

用户看见：要留提交或开 PR 时才出现 Git 步骤，并与 Finalize 并成一次确认。无 Git 的项目收工像普通 Close。日常改代码不灌 Git 教战。

## 停止条件

- 探测 ≠ 激活；激活条件见上。
- 操作清单：branch / worktree / commit / PR / push 各自还要不要 Finalize。
- 停止：无 Git 却挡 Close；把 commit 当 Close；工人代 commit；未授权 push；把窗口改名当本块。
- 降级：无 VCS / 无远程 / 无 worktree 能力 → 记 assurance，生命周期继续（除非 Policy 硬要 commit Evidence）。

## 关掉必须消失

不能 commit/PR/worktree 教战。Open→Close 仍必须能走完。不得把缺 Git 写成 Kernel 坏了。物理搬家仍是 `retention-storage`。

## 不得带走

业务 Outcome（`close-basic`）；Finalize 人批（`approval-personal`）；Integrate 权威（`parent-child`）；isolation **要求**（执行合同 / `worker-orchestration`）；窗口标题（Adapter UX）；任务目录 archive（`retention-storage`）。
