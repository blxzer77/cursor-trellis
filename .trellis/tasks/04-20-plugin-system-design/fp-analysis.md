# First Principles Analysis: Memory / Trace Storage Ownership

> 日期：2026-04-24
> 触发问题：Memory / trace 到底应该存在哪里：项目目录、gitignored 项目目录、用户全局目录，还是团队自部署 server？
> 状态：脑暴分析，供 PRD 收敛使用。

## Axioms

1. **Raw 会话记录会持续增长** — 每次 agent 对话都会产生新内容，且体积不可控；如果没有 retention 或压缩，存储成本只会单调上升。
2. **Git 仓库应只承载团队愿意 review 和长期维护的内容** — Git 的核心价值是 diff、review、merge、history；把不可审阅的大量 raw transcript 放进去会直接破坏仓库体验。
3. **Memory 有不同 visibility：personal / project / team** — 私人偏好、当前项目知识、团队共享规范不是同一种数据；混用一个存储契约会导致隐私泄漏、冲突或召回噪声。
4. **跨项目召回需要用户级身份，而不是项目级路径** — 如果用户希望“我之前在别的项目学到的模式”能被召回，数据必须能脱离单个 repo 被索引。
5. **团队共享必须有同步和权限边界** — 多人写同一份 memory 需要冲突处理、身份、权限和审计；单纯把文件放进 repo 或本地目录不能完整解决。
6. **Trellis 的 runtime 仍在各 AI CLI 里** — Trellis 不应该默认接管 agent loop；Memory/Trace 的存储层应通过 CLI/MCP/hook 被调用，而不是要求用户迁移到新 runtime。

## Problem Essence

**Core problem:** 设计一套 Memory / Trace 存储分层，让 raw session 不污染代码仓库，个人 memory 能跨项目使用，项目知识能被团队审阅共享，同时保留未来接入团队 server 的路径。

**Success criteria:**

- Raw session 不默认进入 git，也不会让 repo 随时间膨胀。
- 当前项目搜索和跨项目搜索都能通过同一套 CLI/MCP 入口完成。
- 团队共享内容必须落到现有可 review 的 Trellis 文档面，或显式 promote 到未来 team backend，而不是自动采集的 raw transcript。
- 默认方案无需自部署 server；server 只能是可选 backend。
- 后续迁移到 server 不需要重写 skill / hook 的上层语义。

## Assumptions Challenged

| Assumption | Challenge | Axiom(s) | Verdict |
|---|---|---|---|
| Memory 应该放在 `.trellis/memory/` 并进 git | 这会和现有 `spec` / `tasks` / `journal` 形成第三套项目知识库。repo 只适合承载已有 review 面里的 curated 内容，不适合 raw session 或私人偏好。 | A1, A2, A3 | Discard as default |
| gitignored 的 `.trellis/.traces/` 放在项目下就够了 | 它适合项目 scoped raw capture，但不解决跨项目记忆；多个 worktree / clone 也会产生重复。 | A3, A4 | Modify |
| 用户全局目录最通用，所以所有 memory 都放那里 | 全局目录适合 personal/private 和跨项目召回，但团队共享和 PR review 会变弱。 | A2, A3, A5 | Modify |
| 团队场景应该直接上 self-host server | Server 能解决团队同步，但会引入部署、权限、备份、网络故障；不应成为 MVP 默认路径。 | A5, A6 | Modify |
| Trace 和 Memory 可以合并成一个目录 | Trace 是 raw/append-only；Memory 是 curated/edit-in-place。写入节奏和信任等级不同。 | A1, A2, A3 | Discard |
| Branch 信息只靠 git 文件结构自然解决 | 全局存储脱离 repo 后必须显式记录 project_id / branch / commit / worktree，否则召回会串上下文。 | A3, A4 | Keep as constraint |
| 本地搜索只需要当前项目 scope | 当前项目 scope 是常用默认，但长期价值来自 global scope 和 team scope 的切换。 | A3, A4, A5 | Modify |

## Ground Truths

1. **Raw session capture 必须默认 private + non-git**，否则会遇到仓库膨胀、冲突和隐私问题。
2. **项目级共享知识已经有 repo 内归宿**：稳定规范进 `spec/`，任务级设计和调研进 `tasks/<task>/`，时间线进 `workspace/<dev>/journal-*.md`；新增 repo wiki 默认会重复。
3. **个人跨项目 memory 需要 user-global local store**，并通过 metadata 过滤当前项目、全局、repo、branch、task 等 scope。
4. **团队共享 memory 不是文件路径问题，而是同步/权限/审计问题**；这天然需要可选 server 或显式 PR review 流程。
5. **CLI/MCP 应成为统一访问面**，上层 skill 不应关心底层是 local global store、现有 repo docs index，还是 team server。
6. **各 IDE/CLI 已经拥有原生 transcript source-of-truth**，Trellis 默认复制 raw session 会制造重复存储；更合理的是索引指针、内容哈希和派生摘要。

## Reasoning Chain

GT#1 + GT#3 → raw session 和 personal memory 的默认落点应是用户全局本地 store，而不是 repo。

GT#2 + GT#4 → repo 里不默认新增 `.trellis/memory/wiki/`；共享知识应 promote 到现有 `spec` / `tasks` / `journal` 中最合适的位置，保持一个事实只有一个 canonical home。

GT#3 + GT#5 → 当前项目搜索不要求数据物理存放在项目目录下；只要全局 store 有 `project_id` metadata，CLI/MCP 可以按当前 repo 自动过滤。

GT#4 + GT#5 → team server 应该作为 backend provider，而不是第一版默认架构；skill / command 只调用稳定的 `memory.search` / `memory.capture` / `memory.promote` 能力。

GT#1 + GT#2 → trace 不能直接流入 repo docs；需要 digest / promote 闸门，把 raw 变成可审阅改动建议，再由人决定写进 spec、task research/info 或 journal。

GT#1 + GT#6 → raw session 不应默认复制到 Trellis store；Trellis store 应优先保存 native transcript pointer、index state、content hash 和 digest。

## Conclusion

**Recommended approach:** 采用三层存储模型：

1. **User-global local store（默认）**
   - 存 native transcript catalog、session digest、personal memory、跨项目索引。
   - 不进 git，有 retention / compaction / size cap。
   - 按 metadata 支持 `current-project` / `global` / `branch` / `task` 过滤。
   - 默认不复制完整 raw session；只在显式 export、原生存储不稳定、迁移/team server 同步时 snapshot。

2. **Existing repo knowledge surfaces（默认共享层）**
   - `spec/`：长期稳定、团队认可的规范和约束。
   - `tasks/<task>/research` / `info.md` / `prd.md`：任务级设计、调研和决策上下文。
   - `workspace/<dev>/journal-*.md`：按时间追加的会话总结和工作记录。
   - Memory 不复制这些内容；它索引这些内容，并在 promote 时建议写入哪个 canonical home。

3. **Team server backend（后续可选）**
   - 自部署或企业场景使用。
   - 提供同步、权限、审计、集中搜索。
   - CLI/MCP 使用相同 API，底层 provider 可切换。

**Key insight:** “当前项目搜索”不要求“数据存放在当前项目目录”。物理存储和逻辑 scope 应该分离：数据默认放 user-global，本项目只是查询 filter；真正适合进 repo 的知识应落到现有 Trellis 文档面，而不是新建一套 parallel memory wiki。

**Trade-offs acknowledged:**

- 默认 user-global 会让团队共享弱一些，但避免 repo 膨胀和隐私问题。
- Promote 仍然需要人为确认，不能完全自动化，但这正是防止错误传播的闸门。
- Team server 延后会让多人实时共享暂时缺位，但 MVP 不背部署复杂度。

## Proposed Data Shape

```text
~/.trellis/memory/                       # or platform data dir
  catalog.sqlite                         # native transcript pointers + metadata
  digests/
    <project-id>/
      session-<id>.md
  personal/
    wiki/
    sources/
  cache/                                 # optional extracted chunks / embeddings / FTS cache

<repo>/.trellis/                         # existing git-tracked knowledge surfaces
  spec/                                  # stable human-reviewed contracts
  tasks/<task>/research/                 # task-scoped research sources
  tasks/<task>/info.md                   # task-scoped technical design, if present
  workspace/<dev>/journal-*.md           # chronological work records
```

Minimal metadata for global records:

```yaml
project_id: <stable repo identity>
repo_root: /absolute/path
git_remote: <origin url or empty>
branch: <branch name>
commit: <sha when captured>
task_id: <trellis task id or empty>
session_id: <agent session id>
source_tool: claude-code | opencode | codex
transcript_uri: <native transcript path or opaque tool URI>
content_hash: <hash of indexed transcript state>
visibility: private | shared-candidate | shared
created_at: <timestamp>
```

## Validation

- [x] Every conclusion traces to a ground truth.
- [x] Every ground truth is covered by at least one conclusion.
- [x] No phases skipped.
- [x] Stress-tested with pre-mortem.

## Pre-Mortem

如果 12 个月后这个设计失败，最可能的原因：

1. **全局 store 变成黑洞**：用户不知道里面有什么，也不知道怎么清理。
   - 缓解：第一版必须有 `list`, `search`, `prune`, `stats`，并默认 size/age retention。
2. **project_id 不稳定**：换路径、换 remote、fork、worktree 后召回错乱。
   - 缓解：project_id 需要用 remote + repo root fallback + Trellis config 显式 override，而不是只用路径。
3. **新增 repo memory 重复 spec / journal**：团队不知道该读哪一份，AI 也会召回冲突事实。
   - 缓解：不默认创建 `.trellis/memory/wiki/`；promote 必须选择写入 `spec`、`tasks` 或 `journal` 的 canonical home。
4. **team server 太晚导致团队场景流失**：
   - 缓解：MVP 就定义 provider interface，但只实现 local provider；server 后续兼容同一接口。
5. **原生 transcript 被工具清理或迁移后指针失效**：
   - 缓解：catalog 记录 hash 和 indexed_at；高价值 session 可显式 snapshot 到 digest/export，普通 session 指针失效后降级为不可打开但保留 digest。
