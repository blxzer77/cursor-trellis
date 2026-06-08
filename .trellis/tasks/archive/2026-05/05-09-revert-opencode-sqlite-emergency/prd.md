# 0.6.0-beta.4 emergency: revert OpenCode SQLite reader

## Goal

撤掉 0.6.0-beta.3 的 `better-sqlite3` 依赖，**让 Trellis 在 Windows + 中国网络环境下能装上**。OpenCode 平台暂时回到"列空 + warning"的 degrade 状态。

## What happened

社群报告（2026-05-09 13:43-13:44）：Windows 用户装 `@mindfoldhq/trellis@beta` 失败：

1. `better-sqlite3` prebuild 从 GitHub releases 下 tarball **超时**（中国网络对 GitHub releases 不稳定）
2. fallback 走 `node-gyp rebuild` 源码编译
3. Windows 用户多数没装 Visual Studio 2017+ build tools
4. `error code 1` —— **整个 trellis 安装失败**，不只是 OpenCode 用不了

之前 0.6.0-beta.2 没 native dep，所有平台用户都装得上。0.6.0-beta.3 加的 native dep 给中国 Windows 用户挖了坑。

## Decisions (locked)

- **方案 D — emergency revert**：撤掉 OpenCode SQLite 实现 + 撤掉 `better-sqlite3` 依赖。OpenCode 平台 list/extract/search 全部立即返回空 + stderr 一次性 warning："OpenCode reader is temporarily unavailable on this version; track <issue>"
- 老 JSON tree reader **不找回**（PRD 0.6.0-beta.3 已经显式 drop 了 1.1.x 支持，找回也没用——1.2+ 用户那儿 storage/ 已经空了）
- **不**改 mem-recall skill / commands-mem.md spec 的 OpenCode 表述——下个 beta（fallback 重做）会一并改
- 立即发 0.6.0-beta.4，npm publish 后让群友重装

## Requirements

- `packages/cli/package.json` 删除 `better-sqlite3` from `dependencies` + 删除 `@types/better-sqlite3` from `devDependencies`
- `packages/cli/src/commands/mem.ts`:
  - 删除 `loadBetterSqlite3 / discoverColumns / probeSchema / openOcDb / OC_DB_PATH / createRequire(...)` + 相关 helpers
  - 删除 `OpenCodeMessageDataSchema / OpenCodePartDataSchema` Zod schemas
  - 三个 OpenCode adapter 函数（`opencodeListSessions / opencodeExtractDialogue / opencodeSearch`）保留导出但实现退化：
    - `opencodeListSessions(f)` → 返回 `[]`（一次性 stderr warning）
    - `opencodeExtractDialogue(s)` → 返回 `[]`
    - `opencodeSearch(s, kw)` → 返回 `searchInDialogue([], kw)` (= empty hit)
  - 一次性 warning helper：`function warnOpencodeUnavailable()` —— 模式跟 `bsqliteWarned` 一样，state 在模块顶部
- 根 `package.json` 的 `pnpm.onlyBuiltDependencies: ["better-sqlite3"]` 删除（已经没这个 dep）
- 测试：删 / 改 OpenCode SQLite fixture 测试，回归到"OpenCode 返回空"的 trivial assertion
- spec `commands-mem.md`：暂不动（下个 release 重做时统一）

## Acceptance Criteria

- [ ] `npm install -g @mindfoldhq/trellis@<this-tag>` 在不带 C 编译器的纯 Node 环境装上不报错
- [ ] `tl mem list --platform opencode --global` 返回 0 sessions + stderr 警告（**warning fires once**）
- [ ] `tl mem list` 不带 platform 限制时 Claude / Codex 正常返回，不被 OpenCode 影响
- [ ] `pnpm test / lint / typecheck` 全绿
- [ ] `package.json` deps 不再含 `better-sqlite3`
- [ ] `pnpm-lock.yaml` 更新，无 better-sqlite3 entry
- [ ] dogfood：本地 `pnpm install` 不再 download better-sqlite3 prebuilt

## Definition of Done

- 1 个 commit + 0.6.0-beta.4 manifest + docs-site changelog
- 立即 push + release：让群友能重装

## Out of Scope

- sql.js fallback / node:sqlite 迁移（下个独立 task 评估）
- 找回老 JSON tree reader 给 1.1.x 用户（trade-off 不值）

## In Scope (added after initial PRD — keep skill + spec coherent with beta.4)

- `marketplace/skills/mem-recall/SKILL.md`：description / "Where data comes from" 表 / OpenCode 触发短语都标 "temporarily unavailable on 0.6.0-beta.4"
- `.trellis/spec/cli/backend/commands-mem.md`：`### OpenCode (SQLite, 1.2+)` 节缩成一段 stub，注明 reverted in beta.4，等 install-resilient backend 回来再展开

## Technical Notes

- 群里 dczy 报错截图 + js 诊断（"opencode 异教徒改用 sqlite, 这个依赖还需要 C"）记录在本 task 的 research/ 下（可选）
- 本 task 是真正的 fix-forward；不能 git revert 因为后续 commit（perf streaming + dogfood robustness + 后续 chore）跟 SQLite 实现交错
