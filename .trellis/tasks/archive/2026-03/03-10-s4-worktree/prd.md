# S4: Worktree submodule + PR 感知

> Parent: `03-10-v040-beta1` | Depends on: S1, S2, S3

## Goal

Parallel agent 的 worktree 创建和 PR 流程在 monorepo（含 submodule）下正常工作。

## Scope

### 4.1 start.py submodule 按需初始化

**问题**: `git worktree add` 不会初始化 submodule，worktree 中 submodule 目录为空。

**方案**: 按 task 目标 package 选择性初始化。

```
1. 从 task.json 读取目标 package
2. 从 config.yaml 查询哪些目标 package 是 submodule
3. 对 submodule 类型的 package: git submodule update --init <path>
4. 非 submodule → 跳过
5. 无 packages 配置 → 跳过（单仓模式）
```

| 场景 | 行为 |
|------|------|
| task.package 非 submodule | 不 init 任何 submodule |
| task.package 是 submodule | `git submodule update --init <path>` |
| 无 packages 配置 | 完全跳过 |
| 复用已有 worktree | 同样执行 submodule init（幂等） |

**注意**：`task.json.package` 为单值字段（string | null），不支持多 package。"涉及多 package" 场景不在本期范围。

**`task.package` 为空时的 fallback**（Codex CR #3）：
1. `task.json.package`
2. `get_default_package()`
3. 仍为空 → 打印警告 `"no package specified, skipping submodule init"` 并继续（不阻断）

**幂等性**（Codex CR #4, CR2 #1）：submodule init 步骤在新建和复用 worktree 两条路径都执行，但需区分状态：
- 先执行 `git submodule status <path>`，检查前缀：
  - `-`（未初始化）→ 执行 `git submodule update --init <path>`
  - 空格（已初始化、正常）→ 跳过，不执行 update（避免 detach HEAD 破坏进行中工作）
  - `+`（已初始化、commit 不匹配）→ 跳过并打印警告 `"submodule <path> has local changes, skipping update"`
  - `U`（冲突）或命令失败 → 打印 warning 并跳过该 submodule，不阻断 start 流程（Codex CR3 #2）
- 注意：对已初始化的 submodule 执行 `git submodule update` 会 checkout superproject 记录的 commit（detached HEAD），会破坏 agent 正在进行的工作

**Package 校验**（Codex CR2 #4）：`task.package` 和 `default_package` fallback 值需通过 `validate_package()` 校验。无效值打印显式 warning `"package '<name>' not found in config.yaml, skipping submodule init"` 并跳过，不静默忽略。

### 4.2 create_pr.py submodule 感知

**问题**: `git add -A` 只记录 submodule ref 变化，实际代码变更不会提交。

**Submodule 检测来源**（Cross-Layer #1）：
- 通过 `get_submodule_packages()` 获取所有 submodule 路径列表（与 4.1 同一数据源，保持一致）
- 对每个 submodule 路径，在主仓执行 `git -C <submodule> status --porcelain` 检测是否有变更
- **扫描所有 submodule**，不限于 `task.package`（Cross-Layer #2：agent 可能修改非目标 submodule 的内容）

**Submodule 分支命名**（Cross-Layer #6, Codex CR4 #6）：submodule 内使用前缀 `<repo-dir>/<main-branch>`。`<repo-dir>` 取主仓 repo root 的目录名（`Path(repo_root).name`）。例如主仓目录为 `my-project`、主仓分支为 `task/s4-worktree`，则 submodule 内分支为 `my-project/task/s4-worktree`。理由：submodule 可能是共享仓库（多项目引用），裸用主仓分支名可能冲突；目录名是最轻量的标识方式，无需网络请求或额外配置。

**方案**:
```
1. 通过 get_submodule_packages() 获取 submodule 路径列表
2. 对每个路径检测是否有变更（git -C <path> status --porcelain）
3. 对每个有变更的 submodule:
   ├── cd <submodule>
   ├── git checkout -b <branch>（已存在则 checkout）
   ├── git add -A && git commit（无 staged 变更则跳过）
   ├── git push && gh pr create（PR 已存在则复用）
3. 回到主仓:
   ├── git add <submodule> (更新指针)
   └── 主仓 commit + PR
```

| 场景 | 行为 |
|------|------|
| 只改主仓代码 | 原有逻辑不变 |
| 只改 submodule | submodule PR + 主仓 ref-update PR |
| 两者都改 | submodule PR + 主仓 PR（含 ref + 主仓改动） |
| 无 packages 配置 | 完全跳过检测 |

**幂等性**（Codex CR #5）：
- `git checkout -b <branch>` → 分支已存在时改为 `git checkout <branch>`
- `gh pr create` → 先检查 PR 是否已存在（复用现有 `gh pr list --head` 逻辑）
- 无 staged 变更 → 跳过 commit 步骤

**dry-run 约束**（Codex CR #6）：`--dry-run` 在 submodule 流程中同样生效，只打印不执行。submodule 内不执行 `git checkout -b`、`git commit`、`git push`、`gh pr create`，结束时恢复 staging 状态。

**Submodule PR base 分支**（Codex CR2 #2）：
- 主仓 `task.json.base_branch` 不一定存在于 submodule 仓库中（如主仓用 `feat/v0.4.0-beta`，submodule 只有 `main`）
- submodule 内的 PR base 分支需单独解析：`git symbolic-ref refs/remotes/origin/HEAD`（去掉 `refs/remotes/origin/` 前缀）获取 submodule 的默认分支（Codex CR3 #1：避免依赖 `grep` + 英文输出，使用可移植的纯 Git 命令）
- 若解析失败，fallback 到 `main`

**合并顺序与 squash 风险**（Codex CR #1）：
- submodule PR 必须先于主仓 PR 合并
- 若 submodule 仓库采用 squash merge，主仓 ref 指向的 commit 将不在 base 分支可达，导致后续 `git submodule update` 失效
- **建议**：在主仓 PR body 中输出警告 `"⚠️ Merge submodule PR first. If squash-merged, update submodule ref after merge."`
- 复用已有主仓 PR 时，read-modify-write：先 `gh pr view --json body` 读取当前 body，仅在缺失警告时追加（保留原 body 完整内容），再 `gh pr edit --body` 写回（Codex CR2 #3, CR3 #3）
- 后续可增加 `create_pr.py --post-merge-fixup` 自动更新 ref，本期不实现

**Submodule 分支复用风险**（Codex CR2 #5）：
- `git checkout <branch>`（复用已有分支）时，该分支可能包含前次失败尝试的历史
- checkout 后检查分支与 submodule base 的关系（`git merge-base --is-ancestor`），若严重 diverge 打印警告 `"submodule branch has diverged history, consider recreating"`
- 不阻断执行（用户可能有意保留历史）

**PR URL 追踪**（Codex CR #7, CR2 #6）：`task.json` 新增 `submodule_prs` 字段：
```json
{
  "pr_url": "https://github.com/org/main-repo/pull/123",
  "submodule_prs": {
    "docs-site": "https://github.com/org/docs-site/pull/45"
  }
}
```
- `pr_url` 保持主仓 PR URL（向后兼容）
- `submodule_prs` 为增量合并（保留旧键，仅更新本次触达的 submodule 键）
- 多次运行不会丢失已有 URL

**多 submodule 失败语义**（Codex CR3 #4）：
- 逐个处理 submodule，每个成功后立即持久化 `submodule_prs` 到 `task.json`（支持可重入恢复）
- 任一 submodule 的 push/PR 失败 → fail-fast，停止后续 submodule 处理，**不执行主仓 commit/PR**
- 已成功的 submodule PR URLs 保留在 `task.json` 中，重新运行时跳过已有 PR 的 submodule

### 4.3 cleanup.py

Worktree 目录清理无需特殊处理（`git worktree remove` 清理整个目录）。

**Submodule PR/分支清理**（Cross-Layer #3, Codex CR4 #3: 删除可选 flag，只保留提醒）：
- 清理时读取 `task.json.submodule_prs`
- 对每个 submodule PR：打印提醒 `"Remember to close/merge submodule PR: <url>"`
- 不自动关闭 submodule PR、不自动删除 submodule 分支（可能已合并或有人在 review）

**task.json 双副本问题**（Codex CR4 #7: known limitation）：
- `create_pr.py` 在 worktree 中运行时更新的是 worktree 的 task.json 副本（`submodule_prs`、`pr_url`、`status`）
- `status.py` 和 `cleanup.py` 从主仓 registry 找到 worktree 路径后读取 worktree 的 task.json
- 这是已有架构（`pr_url` 字段同样如此），不在 S4 解决。后续 task-orchestrator 任务会统一 sync 策略

---

## 受影响文件

| 文件 | 改动 |
|------|------|
| `packages/cli/src/templates/trellis/scripts/multi_agent/start.py` | submodule 按需 init |
| `packages/cli/src/templates/trellis/scripts/multi_agent/create_pr.py` | submodule 感知 commit/PR |
| `packages/cli/src/templates/trellis/scripts/multi_agent/cleanup.py` | submodule PR 提醒（Cross-Layer #3） |
| `packages/cli/src/templates/trellis/scripts/common/config.py` | `get_submodule_packages()`（S1 已加） |

## Acceptance Criteria

- [ ] Worktree 中 submodule 目录正确初始化（仅 task 涉及的）
- [ ] 复用已有 worktree 时：未初始化的 submodule 执行 init，已初始化的跳过（不 detach HEAD）
- [ ] `task.package` 为空时 fallback 到 `default_package`，仍空则警告并跳过
- [ ] package 无效值（拼写错误等）打印显式 warning，不静默跳过
- [ ] submodule 内改动能正确 commit + 创建 PR
- [ ] submodule PR base 分支从 submodule 仓库默认分支解析，非主仓 base_branch
- [ ] 主仓 ref 更新包含在主仓 PR 中
- [ ] submodule PR URL 记录到 `task.json.submodule_prs`（增量合并）
- [ ] 主仓 PR body 包含 squash merge 警告（新建和复用 PR 都检查）
- [ ] `create_pr.py` submodule 流程幂等（重复执行不 crash、不重复建 PR）
- [ ] `--dry-run` 在 submodule 流程中只打印不执行
- [ ] `git submodule status` 异常（`U`/命令失败）时 warning + 跳过，不阻断
- [ ] submodule base 分支解析使用 `git symbolic-ref`（可移植），非 `grep`
- [ ] 复用主仓 PR 时补写 squash 警告保留原 body（read-modify-write）
- [ ] 多 submodule 部分失败时 fail-fast，已成功的 URLs 已持久化到 task.json
- [ ] cleanup 时打印遗留 submodule PR 提醒
- [ ] submodule 分支命名使用 `<repo-name>/<main-branch>` 前缀（动态解析）
- [ ] 无 submodule 的项目行为完全不变
- [ ] 单仓模式完全跳过 submodule 逻辑

### Deferred（不在 S4 scope）

- status.py 展示 submodule PR URLs（Codex CR4 #4: defer）
- `--clean-submodule-branches` 自动清理 submodule 分支（Codex CR4 #3: scope creep）
- task.json 双副本 sync 策略（已有架构问题，归 task-orchestrator）

## Codex Cross-Review

### Round 1

**Date**: 2026-03-11
**Model**: gpt-5.3-codex, reasoning: xhigh, full-auto
**Result**: 7 findings, all incorporated

| Level | Issue | Action |
|-------|-------|--------|
| CRITICAL | Submodule PR squash merge 后主仓 ref 不可达 | 新增合并顺序约束 + PR body 警告（4.2） |
| WARNING | "涉及多 package" 但 task.json.package 是单值 | 删除多包场景，声明仅支持单 package（4.1） |
| WARNING | task.package 为空时跳过 init，submodule 目录仍为空 | 新增 fallback 链（4.1） |
| WARNING | 复用已有 worktree 时不执行 submodule init | 改为新建/复用都执行（幂等）（4.1） |
| WARNING | create_pr.py submodule 流程缺幂等性 | 新增 branch/PR 存在检查（4.2） |
| WARNING | --dry-run 未约束到 submodule 流程 | 明确 dry-run 覆盖 submodule 操作（4.2） |
| WARNING | task.json 只有单个 pr_url，多 PR 无法追踪 | 新增 submodule_prs 字段（4.2） |

### Round 2 (verification review)

**Date**: 2026-03-11
**Model**: gpt-5.3-codex, reasoning: xhigh, full-auto
**Result**: 6 findings, all incorporated

| Level | Issue | Action |
|-------|-------|--------|
| CRITICAL | 复用 worktree 时 `git submodule update --init` 会 detach HEAD 破坏进行中工作 | 改为检查 `submodule status` 前缀，仅未初始化时执行（4.1） |
| CRITICAL | Submodule PR base 分支未定义，主仓 base_branch 在 submodule 可能不存在 | 每个 submodule 单独解析默认分支（4.2） |
| WARNING | 复用 PR 时 body 不更新，squash 警告可能缺失 | 复用时检查并通过 `gh pr edit` 补写（4.2） |
| WARNING | package 无效值静默跳过难排查 | 用 `validate_package()` 校验，无效时显式 warning（4.1） |
| WARNING | Submodule 分支复用可能带入旧历史 | checkout 后检查 diverge 并警告（4.2） |
| NITPICK | `submodule_prs` 覆盖 vs 增量合并未定义 | 规定增量合并，保留旧键（4.2） |

### Round 3 (final review)

**Date**: 2026-03-11
**Model**: gpt-5.3-codex, reasoning: xhigh, full-auto
**Result**: 4 findings, all incorporated

| Level | Issue | Action |
|-------|-------|--------|
| WARNING | `git remote show origin \| grep` 依赖英文输出，Windows/非英文 Git 会失效 | 改用 `git symbolic-ref refs/remotes/origin/HEAD`（4.2） |
| WARNING | `git submodule status` 未覆盖 `U`（冲突）和命令失败场景 | 增加异常分支：warning + 跳过（4.1） |
| WARNING | `gh pr edit --body` 会覆盖原 body，丢失 PRD 内容 | 改为 read-modify-write（4.2） |
| WARNING | 多 submodule 部分失败时主仓行为未定义 | fail-fast + 即时持久化已成功 URLs（4.2） |

### Round 4 (cross-layer discussion)

**Date**: 2026-03-11
**Model**: gpt-5.3-codex, reasoning: xhigh, full-auto
**Input**: 6 cross-layer findings from Claude + request for validation
**Result**: 6 validations + 4 new findings (2 valid, 2 false positive)

| Type | Issue | Action |
|------|-------|--------|
| AGREE | #1 检测来源用 `get_submodule_packages()` | 保持 |
| AGREE | #2 扫描所有 submodule | 保持 |
| CHALLENGE | #3 `--clean-submodule-branches` scope creep | 删除可选 flag，只保留提醒 |
| CHALLENGE | #4 status.py defer | 移出 MVP，标记 deferred |
| AGREE | #5 package 解析不对称已解决 | 保持 |
| CHALLENGE | #6 分支命名冲突风险 | 改为 `trellis/<main-branch>` 前缀 |
| NEW | #7 task.json 双副本 sync | 标记 known limitation，归 task-orchestrator |
| FALSE POS | #8 push 成功 PR 失败 | 现有代码已处理 |
| FALSE POS | #9 `submodule_pr_urls` 兼容 | 不存在旧字段，纯新增 |
| NEW | #11 Scope creep | 精简 scope，增加 Deferred section |
