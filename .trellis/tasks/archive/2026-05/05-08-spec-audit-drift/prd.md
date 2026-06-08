# spec audit fix: P0 + mechanical P1 (Batches A+B+C+D)

## Goal

修掉 audit 出来的 P0 + 容易动手的 P1 — 统一做"对照修文档"的小修维护，约 1 小时工作量。E（5 个新 spec）和 F（决策）拆出去后续单独 task。

## Scope (Batches A+B+C+D)

### Batch A — P0 sweep (clears 2 of 3 P0 items)

**File**: `.trellis/spec/cli/backend/script-conventions.md`

- 行 30: 删除 `task_context.py init-context` 描述（function 在 v0.5.0-beta.12 已移除）
- 行 34: 补充新 module `trellis_config.py` 与 `workflow_phase.py`

证据见 `research/01-spec-drift.md` S1 / S2，`research/02-missing-specs.md`。

### Batch B — Writer-table & line-number refresh

- `.trellis/spec/cli/backend/workflow-state-contract.md` 行 137-142：status writer table 行号现实 + 100~270 行
- `.trellis/spec/cli/backend/quality-guidelines.md` 行 866：`init.ts:931` → `init.ts:1081`（`handleReinit`）
- `.trellis/spec/cli/unit-test/conventions.md` 行 344：同上 `init.ts:931` → `init.ts:1081`

证据：`research/03-stale-refs.md` 第 1-5 项。

### Batch C — Directory-structure refresh

**File**: `.trellis/spec/cli/backend/directory-structure.md`

补缺失项（位置见 `research/01-spec-drift.md` D1/D4/D5）：
- 行 18：configurator listing 加 `pi.ts`
- 行 22-37：utils 树补 `posix.ts`、`proxy.ts`、`task-json.ts`、`uninstall-scrubbers.ts`
- 行 53-67：commands 树只列了 `init.ts`，补 update/uninstall/mem 等
- 行 70-75：templates 子目录核对

### Batch D — docs-site `.current-task` 错误（双语同步）

**Files**:
- `docs-site/advanced/architecture.mdx` 行 173
- `docs-site/zh/advanced/architecture.mdx` 行 173

错误声称：`.trellis/.current-task` 是 CLI fallback。实际：当前代码不写这个文件。证据：`research/04-docs-spec-consistency.md` 第 1 项。

修法：删除/重写这一句，与 spec 描述对齐。EN/ZH 必须 1:1 同步。

### Bonus 清理（不算 batch，跟着这次做）

- `MEMORY.md` 里 `test/templates/iflow.test.ts` 那条已确认 stale（iflow 0.5.0-beta.0 已移除，文件不存在），删掉对应索引行 + memory file

## Acceptance Criteria

- [ ] Batch A：`script-conventions.md` 不再提 `init-context`；提到了 `trellis_config.py` + `workflow_phase.py`
- [ ] Batch B：三个文件的过期行号都对得上当前代码
- [ ] Batch C：`directory-structure.md` 列出来的 configurators/utils/commands 与 `packages/cli/src/` 实际目录一致
- [ ] Batch D：`architecture.mdx` EN/ZH 双语对 `.current-task` 的描述跟 spec 一致；diff 行数对称
- [ ] 双语 EN/ZH 的 batch D edit 在同一个 commit 里（spec 项目惯例）
- [ ] Bonus: `MEMORY.md` 的 iflow.test.ts 行删掉 + `feedback_*.md` 等文件保持完整
- [ ] 不动 batch E（新 spec）/ F（决策）相关文件
- [ ] 不动代码（`packages/cli/src/`）

## Definition of Done

- 5-7 个文件改动（spec 4-5 + docs-site 2 双语 + MEMORY.md 1）
- diff stat 简洁、可阅读
- 不引入新 spec 文件（那是 batch E）
- changelog 不需要发版（spec/docs 内部修，不影响 published artifact）

## Out of Scope

- Batch E 5 个新 spec 文件（commands/update.md, uninstall.md, mem.md, utils/uninstall-scrubbers.md, configurator-shared-helpers.md）— 单独 task，每个 ~45min
- Batch F 决策（docs-site Mode taxonomy + ai-tools/ 11 页）— 需要用户拍板
- audit 提到的 P2/P3 items（17 + 6 项 quality-of-life）— 下一季的活
- audit 建议的"行号引用 → symbol anchor"约定改造 — 单独提案
- 代码改动（commands/mem.ts perf、readJsonlFirst 流式化等 follow-up）

## Technical Approach

- 主 session 派 `trellis-implement` 子代理执行 4 个 batch
- 子代理读 PRD + 5 个 research/*.md 拿到全部细节，对每处都直接 grep 当前代码确认行号 / 符号正确，再改 spec
- 改完跑 `pnpm lint`（不会动代码所以一般 noop）+ 检查双语 batch D 对齐
- check 阶段读 PRD AC + 改动 diff 验证

## Technical Notes

- Spec 文件位置：`.trellis/spec/cli/backend/*.md`、`.trellis/spec/cli/unit-test/*.md`
- docs-site：`docs-site/advanced/architecture.mdx` + `docs-site/zh/advanced/architecture.mdx`（提交后 docs-site submodule pointer 不需要立刻 bump，accumulate 到下次发版前再一起 bump）
- Memory：`/Users/taosu/.claude/projects/-Users-taosu-workspace-company-mindfold-product-share-public-Trellis/memory/MEMORY.md` —— 删掉指向 iflow.test.ts 的那行 + （如果存在）对应 .md 文件

## Research References

- `research/00-summary.md` — 整体 audit 总览，48 findings
- `research/01-spec-drift.md` — 15 drift items，S1/S2/D1/D4/D5/W1 全在本 task
- `research/02-missing-specs.md` — 18 modules（多数 batch E）
- `research/03-stale-refs.md` — 7 hard misses（多数 batch B）
- `research/04-docs-spec-consistency.md` — 3 drift（batch D 是其中之一）

## Decision (ADR-lite)

**Context**: audit 给出 6 batches。E（新 spec 写作）和 F（决策）大头都在那里。先做 A+B+C+D 把"对得上的修对"的部分快速清掉，让 spec 至少不再误导未来 contributor。

**Decision**: 本 task scope = A+B+C+D；E 和 F 单独 task。

**Consequences**:
- ✓ 1 小时左右收尾，单 PR
- ✓ P0 全清；docs-site 双语错误清掉
- × 仍有 P1 遗留：5 个无 spec 的关键模块（mem.ts 等）；F 的决策待开会
- × P2/P3 整批延后
