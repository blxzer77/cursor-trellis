# spec batch E: 5 new spec files for uncovered modules

## Goal

补 audit 出来的 5 个零 spec / 不足覆盖的模块，每个写一份独立 spec 在 `.trellis/spec/cli/backend/`，让未来 contributor 能安全扩展这些模块。

## Scope (5 files)

| Spec file | Source code | LOC | 主题 |
|---|---|---|---|
| `commands-mem.md` | `packages/cli/src/commands/mem.ts` | 1506 | `tl mem` 子命令、跨平台 session 索引、Zod schemas、清洗逻辑 |
| `commands-update.md` | `packages/cli/src/commands/update.ts` | 2589 | `trellis update` 全流程、与 `migrations.md` 的边界（migrations.md 只讲 manifest 机制） |
| `commands-uninstall.md` | `packages/cli/src/commands/uninstall.ts` | 433 | `trellis uninstall` 平台清理、scrubber 调用契约 |
| `uninstall-scrubbers.md` | `packages/cli/src/utils/uninstall-scrubbers.ts` | 354 | scrubber 接口、每平台扫描规则、安全边界 |
| `configurator-shared.md` | `packages/cli/src/configurators/shared.ts` | 753 | 跨配器复用 helpers（`resolvePlaceholders` 等） |

存放位置：全部 flat 在 `.trellis/spec/cli/backend/`（不加 commands/ utils/ 子层 — 与现有 spec 约定一致）。

## Style 参考

`platform-integration.md` 是 audit 公认 best-maintained 的 spec —— 5 个新 spec 全部参照它的风格：
- 章节结构清晰（Overview / Public surface / Internals / Boundaries / 测试约定）
- 函数 / 接口列签名而非贴代码
- 用 `path/to/file.ts:symbol` 引用而非 line number（行号易腐烂）
- 关键不变量列成 bullet
- 误用模式 → 正确模式对照

## Acceptance Criteria

- [ ] 5 个新 spec 文件落到 `.trellis/spec/cli/backend/`
- [ ] 每个 spec 都覆盖：模块概述、对外接口（如 commander wire / 导出函数）、内部关键函数与契约、与其他模块的边界、扩展时的常见 pitfall
- [ ] 引用代码：用 `file.ts:symbolName` 而非纯行号
- [ ] 没有引入新的 `.trellis/spec/cli/backend/index.md` / 不动既有 spec（除非要更新 index 让新 spec 可见）
- [ ] 不动代码（`packages/cli/src/`）
- [ ] 双语一致性：本批纯英文 spec（与现有 backend specs 一致），不需要 ZH 镜像
- [ ] `pnpm lint` 通过（应该 noop —— 不改代码）
- [ ] 一个 commit per spec 还是 1 个 batch commit？— 1 个 batch commit（5 个文件一起，commit message 列出 file roster）

## Definition of Done

- 5 个新 spec 文件
- 不破坏既有 lint / test
- 每个 spec self-contained 可读
- 整体 ~2000-3000 行新文档（约 400-600 行 / spec）

## Out of Scope

- Batch F: docs-site Mode taxonomy 对齐 + ai-tools/ 11 平台页（决策待定）
- 把 spec 内容反向同步到 `packages/cli/src/templates/markdown/spec/`（bundled spec 模板，下次 init 用户拿到的）— 这是另一个工作
- 新加 `commands/` / `utils/` 子层目录 — flat 维持
- 改 `.trellis/spec/cli/backend/index.md` 列出新 spec — 让 trellis-check 阶段决定是否需要

## Technical Approach

5 个 sub-agent 并行 spawn，每个 owns 一个 spec：
- 每个 agent 读对应 source code + `platform-integration.md` 风格参考 + audit 里 02-missing-specs.md 对该模块的描述
- 直接写新 spec 文件
- 不 commit

完成后 trellis-check 单代理 review 所有 5 个 spec：风格一致性、引用准确性、完整度。

主 session Phase 3.4 一起 commit。

## Research References

- `.trellis/tasks/05-08-spec-audit-drift/research/02-missing-specs.md` — 18 modules 的 spec gap 分析，5 个 P1 在本 task scope 内
- `.trellis/tasks/05-08-spec-audit-drift/research/00-summary.md` — Batch E 整体说明
- `.trellis/spec/cli/backend/platform-integration.md` — 风格参考

## Decision (ADR-lite)

**Context**: audit 出 5 个关键模块零/不足 spec，最大的 mem.ts 1506 行 P0；其他 4 个 P1。

**Decision**: 5 个 spec 文件并行写，flat 在 backend/，参考 platform-integration.md 风格。1 commit。

**Consequences**:
- ✓ 一次性补齐 audit 提的 P1 spec gap
- ✓ 并行 sub-agent 把单 session 时间从 4-6h 压到 ~1h wall clock
- × 5 个 sub-agent context 互不可见 —— 风格 / 术语可能略有出入，trellis-check 阶段统一
- × 1500-2500 行新内容，不可避免有些段落需要后续微调 —— 通过 trellis-check 把硬伤捞出
