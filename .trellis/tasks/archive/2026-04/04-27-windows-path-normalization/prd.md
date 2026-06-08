# Windows 路径分隔符规范化（#194 + #198）

## Goal

修复 Windows 上路径分隔符不一致导致的两类问题：

1. **#198**：`.template-hashes.json` 在 Windows 上写入 `.trellis\\config.yaml` 这种反斜杠 key，跨平台不可移植，且每次 `trellis update` 在不同 OS 下都会让所有文件被判定为"新增/修改"。
2. **#194**：CLI 内部使用 `path.join` 产生的相对路径（`opencode.ts` 模板收集、`template-hash.ts` 文件遍历、`regression.test.ts` 部分断言）在 Windows 上会出现 `\`，导致 hash 比对失败、测试 fixture 比对失败。

目标：所有作为"逻辑相对路径键 / 跨 OS 持久化字符串"使用的路径，统一为 POSIX 风格 `/`，OS-native 仅保留在文件系统调用本地。

## What I already know

* **Hash key 起源**：`packages/cli/src/utils/template-hash.ts:243` 的 `collectFiles` 用 `path.join(dir, entry.name)` 构造 relPath，再写入 hashes 字典。Windows 下产物为 `\`。
* **Configurator collector**：`packages/cli/src/configurators/opencode.ts:49,58` 用 `path.join(".opencode", relEntry)` 作为 `Map<relPath, content>` 的 key。这些 key 最终也会进 hash 字典。其他 configurator（claude/iflow/cursor 等）模式相同，需要排查。
* **isManagedPath**：已经把 `\` 归一化为 `/`（见 `regression.test.ts:496-507`），属于"输入侧防御"，无需改。
* **测试 fixture**：`regression.test.ts` 大量用 `path.join(tmpDir, ".trellis", ...)` 写文件，这是真实 fs 调用，不需要改。但若有比对字符串的地方需要 normalize。
* **行尾符（CRLF/LF）**：#194 报告里同时提到 "换行符不同导致的测试执行失败"。这是 git `core.autocrlf` + `fs.readFileSync` 读到 CRLF 的副作用，hash 也会因此对不上。属于相关但独立的根因。

## Assumptions (temporary)

* 我们认可"Hash key 一律 POSIX"作为契约，loadHashes 时自动迁移旧的 Windows 风格 key（防止存量用户升级时全量误报）。
* 行尾符问题是否在本任务一起治，需要用户拍板（见 Open Questions）。
* `path.posix.join` 不可用于跨实际文件系统操作；只在"构造逻辑 key"时使用 `toPosix(p)` 替换。

## Open Questions

* （无）

## Decision (ADR-lite)

**Context**: #194 报告同时涉及路径分隔符和换行符两个根因，#198 只涉及路径。两者修复点接近（都在 hash 计算/比对边界），分开做会两次动同一处代码。

**Decision**: 选 B —— 路径分隔符 + 行尾符（CRLF→LF）一并在本任务修复，#194 和 #198 一次性关闭。

**Consequences**:
* hash 计算前需要做 content normalize（`content.replace(/\r\n/g, "\n")`），影响 `computeHash` 所有调用方。
* 存量 Windows 用户升级时，旧 hash 同时面临 key 格式（`\` → `/`）和 value（CRLF hash → LF hash）双重不匹配，需要迁移策略：在 JSON 加 `__version` 字段，老版本/缺失时丢弃存量并由 `initializeHashes` 重新生成（安全，无破坏数据）。
* 测试需要同时覆盖 Windows-path 输入和 CRLF 输入两种向量。

## Requirements

* **路径**：
  - `loadHashes` / `saveHashes` 持久化时，所有 key 一律 POSIX（`/`）。
  - `collectFiles`（template-hash.ts）和所有 configurator collector（opencode/claude/iflow/cursor/codex/kiro/kilo/gemini/antigravity/qoder）产出的 `Map<relPath, content>` 的 key 统一 POSIX。
  - 新增 `toPosix(p: string): string` 工具放在 `src/utils/`，单一来源避免散落 `replaceAll('\\', '/')`。
* **行尾符**：
  - `computeHash` 在计算前对 content 做 `\r\n → \n` normalize（或包装一层 `computeContentHash`），保证跨平台 hash 稳定。
  - `isTemplateModified` 用同样的 normalize 路径读取磁盘 content。
* **迁移**：
  - `.template-hashes.json` 顶层加 `__version: 2` 字段。
  - `loadHashes` 读到无 `__version` 或低版本时，返回 `{}`，由后续 `initializeHashes` / `updateHashes` 重新生成；不破坏其他用户数据。
* **测试**：
  - 模拟 `path.win32` 风格输入：验证 hash key 始终是 POSIX。
  - 模拟 CRLF 输入：验证 hash 与 LF 输入一致。
  - 验证 `loadHashes` 迁移：旧格式 → 返回空字典 → 重新初始化后变成 v2。

## Acceptance Criteria

* [ ] macOS/Linux 上 `trellis init` 后 `.template-hashes.json` 全部 key 为 `/`（回归不破）。
* [ ] Windows 上 `trellis init` 后 `.template-hashes.json` 全部 key 为 `/`（关闭 #198）。
* [ ] CRLF 内容与 LF 内容计算出的 hash 一致。
* [ ] Windows 上 `pnpm test` 通过（关闭 #194）。
* [ ] 存量用户升级：老 `.template-hashes.json` 自动迁移（清空 + 重新生成），不误报全部文件为已修改。
* [ ] 新增单测：(a) Windows-path 输入下 key 仍为 POSIX；(b) CRLF/LF 内容 hash 一致；(c) loadHashes 在缺失 `__version` 时返回空。
* [ ] `pnpm test` 在 macOS/Linux 全绿（不回归）。

## Definition of Done

* Tests added/updated（含模拟 Windows 风格输入）
* Lint / typecheck / Vitest 全绿
* `loadHashes` 迁移逻辑有回归测试
* 所有 configurator collector 排查完毕（不只是 opencode）
* CHANGELOG 记录"Windows 路径兼容性修复"
* 手动在 Windows 验证（如有环境）或文档说明回归风险

## Out of Scope (explicit)

* `isManagedPath` 输入侧 normalize（已经处理）
* 用户 task 数据 / workspace 数据中的路径（仅 hash 字典 + collector key）
* 如选 A 或 C：行尾符（CRLF）问题留作另一个任务

## Technical Notes

* 关键文件：
  - `packages/cli/src/utils/template-hash.ts`（核心）
  - `packages/cli/src/configurators/opencode.ts:49,58`
  - `packages/cli/src/configurators/{claude,iflow,cursor,codex,kiro,kilo,gemini,antigravity,qoder}.ts`（同类排查）
  - `packages/cli/test/regression.test.ts`（已有 Windows-style 断言可参考）
* 已有先例：`shouldExcludeFromHash` 内部用 `relativePath.replace(/\\/g, "/")` 做 normalize（template-hash.ts:217），可统一抽到 `toPosix()`。
* 涉及 issue：
  - https://github.com/mindfold-ai/Trellis/issues/198 (root cause: hash key)
  - https://github.com/mindfold-ai/Trellis/issues/194 (root cause: 路径 + 行尾符)
