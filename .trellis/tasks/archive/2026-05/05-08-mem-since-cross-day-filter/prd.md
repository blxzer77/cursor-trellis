# fix: `tl mem --since` drops cross-day sessions

## Goal

`tl mem list / search --since <date>` should return all sessions that have **activity** in the time window, not only sessions whose first event falls in the window. Long / cross-day sessions are currently invisible to `--since` queries even when they ran heavily inside the window.

## Reproduction

Current session `a5cb6763` (Claude Code) on this project:
- First event: `2026-05-07T10:06:04` (5月7号开始)
- mtime: `2026-05-08 20:10` (5月8号还在跑，29MB)
- 含 19 处 `tl mem` 字串

```bash
tl mem list --since 2026-05-08 --platform claude
# → 1 session(s)（只有 5/8 created 的 55d76）— 漏了 a5cb6763
tl mem search "mem" --since 2026-05-08
# → (no matches) — search 走 listAll，list 已经过滤掉跨天 session
```

放宽到 `--since 2026-05-04` 就能搜到，证明数据本身没问题，是过滤逻辑错了。

## Root Cause

`packages/cli/src/commands/mem.ts` 的 list 实现把 `inRange()` 应用在 session 的 `created` 上：

| 平台 | 行号 | 当前过滤 | 状态 |
|---|---|---|---|
| Claude | 593 | `inRange(created ?? updated, f)` | created 优先 → 漏跨天 |
| Codex | 714 + 723 | 文件名 ts + first.timestamp 双重 created-based | 漏跨天 |
| OpenCode | 828 | `inRange(updated ?? created, f)` | updated 优先 → 误差小，但严格说 `created` 在窗口外、`updated` 也在窗口外才能排除 |

POC 来源 `~/workspace/nb_project/mem-poc/chat-history.ts` (L573 / L682 / L691 / L790) 完全相同的 bug —— 集成时只调 ESLint/TS，逻辑没动。

## Requirements

- `tl mem list --since X` 返回 `[created, updated]` 与 `[X, until]` 有交集的所有 session
- `tl mem search` 复用 list 结果，自动跟着修正
- 三平台一致（claude / codex / opencode）
- 不引入误报：`--until Y` 上界也按区间重叠语义生效

## Acceptance Criteria

- [ ] 跨天 session 在覆盖到的任一日期下 `--since` 都能列出（claude / codex / opencode 三平台分别覆盖）
- [ ] `--since X --until Y` 区间外的 session 仍然被过滤
- [ ] 现有的"single-day created in range"用例不退化
- [ ] 新增 `searchInDialogue` 之外的 list-level 测试覆盖跨天 session（含合成 fixture）
- [ ] `pnpm test / lint / typecheck` 全绿

## Definition of Done

- 三个 list 函数过滤改成区间重叠（`[created, updated] ∩ [since, until] ≠ ∅`）
- 新增 helper（如 `inRangeOverlap(start, end, f)`）保持调用点简洁
- 单元测试覆盖：跨天 session 命中 / 完全早于窗口 / 完全晚于窗口 / 嵌入窗口 / 跨越整个窗口
- changelog: 0.5.10（main） + 0.6.0-beta.2（feat/v0.6.0-beta）

## Technical Approach

新增 helper：

```ts
function inRangeOverlap(
  start: string | undefined,
  end: string | undefined,
  f: Filter,
): boolean {
  // session lives in [start, end]; query window is [f.since, f.until].
  // Keep iff overlap. Missing start defaults to end (point-in-time);
  // missing end defaults to start.
  const s = start ?? end;
  const e = end ?? start;
  if (!s && !e) return true;
  if (f.since && e && new Date(e) < f.since) return false;
  if (f.until && s && new Date(s) > f.until) return false;
  return true;
}
```

替换三处调用：

- `claudeListSessions` L593: `inRange(created ?? updated, f)` → `inRangeOverlap(created, updated, f)`
- `codexListSessions` L714 删掉（文件名 ts 单独过滤是误优化），L723 改成 `inRangeOverlap(created, updated, f)`，其中 updated 是 `fs.statSync(file).mtime` 已经在 L731 算过——下移过滤位置
- `opencodeListSessions` L828: `inRange(updated ?? created, f)` → `inRangeOverlap(created, updated, f)`

POC 文件不动（不在 Trellis 仓内）。

## Decision (ADR-lite)

**Context**: list 阶段已经是 search 的入口，所有 search bug 都源自 list filter；改 list 一次性修好。

**Decision**: 引入 `inRangeOverlap` 区间交集 helper，替换三平台 list 中的 `inRange` 调用。

**Consequences**:
- ✓ 跨天 session 不再漏；search 覆盖率上升
- × 边界：极个别 session created 极早（远早于 since）但 updated 在窗口的，会被列出——这就是期望行为
- × `inRange` 单点检查仍保留给 codex `tsFromName` 之外的别处

## Out of Scope

- 不改 search 的相关性算分 / 多 token 语义 (`searchInDialogue` 用 substring `includes` AND，没问题)
- 不动 `extract` / `context` 命令（接收的是已经过滤好的 SessionInfo）
- 不改 POC `~/workspace/nb_project/mem-poc/chat-history.ts`
- 不引入 session-index cache 重建（mtime 已经够用）

## Technical Notes

- 文件: `packages/cli/src/commands/mem.ts`
- POC 镜像: `~/workspace/nb_project/mem-poc/chat-history.ts`（同源 bug，不修）
- 测试入口: 现有 `test/` 没有 mem 测试 — 需要新建 `test/commands/mem.test.ts`，造合成 jsonl fixtures
- ship vehicle: 0.5.10 (main) + 0.6.0-beta.2 (feat/v0.6.0-beta)
