# fix(mem): OpenCode SQLite reader — make 1.2+ users visible

## Goal

`tl mem` 当前对所有装了 OpenCode 1.2+ 的用户**完全失明**。OpenCode 1.2 把 session 存储从 `~/.local/share/opencode/storage/` 的 JSON tree 迁到了 `~/.local/share/opencode/opencode.db` SQLite。`mem.ts:1459` 的 `OC_ROOT` 还指着老路径，结果 `mem list --platform opencode` 永远返回 0 session（实际本机有 138 个 session / 678 个 message）。

修这个真 bug 让 OpenCode 路径恢复可用，同时双轨兼容老 JSON path（1.1.x 用户和老归档）。

## What I already know

- OpenCode 1.2+ 用 `better-sqlite3` 风格的 SQLite + drizzle ORM
- 本机实测：`opencode --version` = 1.14.30，DB 路径 `~/.local/share/opencode/opencode.db`（7.1MB），含 `__drizzle_migrations / session / message / part / todo / event / event_sequence / account / project / workspace / permission` 等表
- 当前 mem.ts:
  - `OC_ROOT = path.join(HOME, ".local", "share", "opencode", "storage")` — 错位
  - `opencodeListSessions(f)` / `opencodeExtractDialogue(s)` / `opencodeSearch(s, kw)` 三个函数读老 JSON 结构
  - `buildChildIndex(sessions)` 用 `s.parent_id` 串 OpenCode 子代理（仅 OpenCode 暴露此字段）
- 老 storage/ 目录在某些机器上仍有数据（5/8 还有 `session_diff/` 写入），但 mem.ts 找的路径（session/、message/、part/）很多 1.2+ 用户已经空了
- 社区已做完的参考实现：
  - `arthurtyukayev/opencode-session-search` —— 双轨自动检测（最干净）
  - `joeyism/opencode-history-search` —— < 50ms 查询性能参考
  - `ryoppippi/ccusage` PR #850 —— 生产迁移路径
- 决策已定：用 `better-sqlite3`（非 `node:sqlite`，因为不想抬高用户 Node 版本）

## Assumptions

- 引入 `better-sqlite3` 是 Trellis 第一个 native dep；prebuilt for Win/macOS/Linux × Node 18/20/22 都现成
- OpenCode SQLite schema 跨小版本基本稳定（drizzle 加列向后兼容）；少数列名 / 表名变化用 `PRAGMA table_info` 探查防御
- 老 JSON path 仍有少量 1.1.x 用户和"过去 session 没迁过去"用户 → 双轨保留至少一个 release 周期

## Decisions (locked)

- **Schema strategy**: 动态 PRAGMA 防御 — 启动时 `PRAGMA table_info(<table>)` 拿实际列，缺关键列 → stderr 警告 + 降级（不崩）
- **Missing dep behavior**: soft-degrade — `try { import "better-sqlite3" } catch` 失败时 stderr 提示 + opencode 平台 skip，其他平台正常跑
- **Old JSON path**: 删除 — 只走 SQLite。1.1.x 用户和老 storage/ 归档不再支持（1.2 已发布数月，覆盖率高；老归档场景小）

## Requirements

- 删除老 JSON path 相关的 `opencodeListSessions / opencodeExtractDialogue / opencodeSearch` + `OC_ROOT` 常量
- 新加 `opencodeListSessions / opencodeExtractDialogue / opencodeSearch` 实现走 SQLite（保持函数名不变让上游 dispatcher 不动）
- `try-catch` 加载 `better-sqlite3`：失败时缓存 "unavailable" 标志，所有 opencode 调用直接返回空 + 一次性 stderr 提示
- 启动时 `PRAGMA table_info(session) / table_info(message) / table_info(part)` 拿现状；缺必需列（`id` / `cwd` / 时间列）→ stderr 警告 + 该次调用空返回
- DB 路径：`~/.local/share/opencode/opencode.db`（hardcode；用户自定 storage path 罕见，超出 MVP）
- `SessionInfo.id / cwd / created / updated / parent_id / filePath`：filePath 设成 DB 路径本身（所有 session 共享）；其他从 SQL 查
- `buildChildIndex` 基于 SQL 查 `parent_id` 列（PRAGMA 探查到才用）
- `--phase brainstorm` on opencode：尝试在 message/part 内容里找 `task.py create / start` 字串（OpenCode 也支持 Bash tool）；找到 boundary 信号就切，找不到 fallback degrade
- DB 用只读模式打开（`new Database(path, { readonly: true, fileMustExist: true })`）防误改

## Acceptance Criteria (evolving)

- [ ] 本机 dogfood：`tl mem list --platform opencode --global` 返回 138 个 session（非 0）
- [ ] `tl mem extract <opencode-id>` 输出 cleaned dialogue
- [ ] `tl mem search "kw" --platform opencode --global` 在 SQLite 上跑通且 < 1s on 678 messages
- [ ] `--include-children` 把 sub-agent session 合并进 parent
- [ ] 缺 `better-sqlite3` 时不崩，stderr 提示 + 该平台 skip
- [ ] 老 storage/ JSON path 仍能读（双轨）
- [ ] OpenCode `--phase brainstorm` 行为决策（升真实检测 / 保 degrade）落实
- [ ] 单元测试：合成 SQLite DB fixture 跑通 list / extract / search / parent_id 链
- [ ] `pnpm test / lint / typecheck` 全绿
- [ ] `commands-mem.md` spec 加 OpenCode SQLite 子节

## Definition of Done

- ~300 行 src + ~80 行测试
- `better-sqlite3` 加进 deps（不是 optionalDependencies — 我们要求必备；soft-degrade 仅针对加载失败的用户机）
- prefer single batch commit；分两 commit 也可（dual-track + new SQLite reader）
- 不动 Claude / Codex 路径

## Out of Scope

- FTS5 索引（research E.2，等真用户反馈跨 session search 慢再做）
- Sidecar metadata cache（research E.1，规模到 100+ codex sessions 再做）
- OpenCode brainstorm boundary 检测如果不 trivial 就 defer
- 写回 OpenCode DB（mem 是只读工具）
- OpenCode CLI 暴露的 `opencode db` 子命令（research C 提到的 shell-out 方案）— 选了 `better-sqlite3` 就不走它
- 跨版本 schema migration（用户 OpenCode 升级时我们自动跟随，无需 mem 主动迁）

## Technical Notes

- 实现入口：`packages/cli/src/commands/mem.ts`，平行 `claude*` / `codex*` adapters 加 `opencodeSqlite*` adapters
- Path detection helper：`detectOpencodeBackend(): "sqlite" | "json" | "missing"`
- 关键 SQL：
  - `SELECT id, cwd, created_at FROM session WHERE created_at >= ? ORDER BY updated_at DESC`
  - `SELECT role, content, created_at FROM message WHERE session_id = ? ORDER BY created_at`
  - `SELECT type, text FROM part WHERE message_id = ?` —— 看 OpenCode 怎么把 message 拆 parts
- 测试 fixture：用 `better-sqlite3` 在 setup 阶段写 schema + 喂数据 + open；afterEach close + rmSync
- 跨 session search：load all sessions 然后逐个 extract + searchInDialogue（先不上 FTS5）

## Research References

- `/tmp/trellis-mem-perf-research.md` § D.2-D.4, § E.4 —— OpenCode SQLite 路径已被多个 OSS 工具实现
