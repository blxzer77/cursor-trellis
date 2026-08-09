# Goal 发布回归 Runbook

> **受众**：Root npm 闸、Parent 集成前自检、维护者。  
> **范围**：`cstl goal` 回归 checklist — **不扩展 Goal 功能**，仅钉死 hardening 命令。  
> **基线**：`cursor-trellis` `main`（A1/A2 合并后 tip）；harness 侧 `.cstl/spec/Trellis/framework/cstl-goal-*.md`。

---

## 1. 发布门语义

| 项 | 说明 |
| --- | --- |
| **用途** | npm 发布前 Goal 回归闸；Parent `verify.md` 可链接本页 |
| **非目标** | 不新增 runner/worker 能力；不替代 [cursor-trellis release runbook](./cursor-trellis-release-coexistence-guide.md) |
| **通过标准** | Mock 路径全绿（§2）；Live 路径（§3）为可选加分项 |
| **零功能 diff** | 本闸仅文档与命令；**不得**附带 `cursor-trellis/packages/cli/src/goal/*` 语义变更 |

---

## 2. Mock 路径（必须 — 无需 `CURSOR_API_KEY`）

在 harness 根目录执行。CI / 新人 onboarding 至少跑完本节。

### 2.1 全量 Goal 测试

```powershell
cd cursor-trellis/packages/cli
pnpm test goal/
```

**期望：** 7 个 test files、32 tests 全部 PASS。

### 2.2 Golden + 墙单元测试

```powershell
cd cursor-trellis/packages/cli
pnpm exec vitest run test/goal/reviewer-golden.test.ts test/goal/walls.test.ts
```

**期望：**

- `mis-allow gate is zero on hard-deny bucket` 通过
- `walls.test.ts` 墙钟逻辑通过

### 2.3 墙 smoke 脚本语法

```powershell
python -m py_compile .cstl/scripts/goal_wall_smoke.py
```

### 2.4 可选 — 墙钟 crash 可复现 smoke

需已有 goal run 目录（`goal_id` 来自历史 hardening 或本地狗粮）：

```powershell
python ./.cstl/scripts/goal_wall_smoke.py <goal_id> --mode window --json
```

**期望：** JSON 中 `ok: true`；`audit.log` 含 `wall-clock reached`。

---

## 3. Live 路径（可选 — 需要 `CURSOR_API_KEY`）

仅当维护者显式同意 live SDK 狗粮时执行。Cursor Agent shell **默认不继承** User 级环境变量，须先加载：

```powershell
$env:CURSOR_API_KEY = [Environment]::GetEnvironmentVariable('CURSOR_API_KEY','User')
```

### 3.1 Preflight → Accept → Run

```powershell
cstl goal preflight --goal "..." --json
cstl goal accept <goal_id>
cstl goal run <goal_id> --max-steps 1 --json
```

CI 风格可用 mock worker（无需 live SDK）：

```powershell
cstl goal run <goal_id> --mock-worker --max-steps 1 --json
```

若全局 `cstl` 未 link 最新 dist，改用本地 CLI：

```powershell
node cursor-trellis/packages/cli/dist/cli/index.js goal preflight --goal "..." --json
```

---

## 4. 契约引用

回归失败时对照合同，勿在发布闸中改语义：

| 文档 | 路径 |
| --- | --- |
| cstl-goal 验收合同 | [`.cstl/spec/Trellis/framework/cstl-goal-contract.md`](../Trellis/framework/cstl-goal-contract.md) |
| Action Packet | [`.cstl/spec/Trellis/framework/cstl-goal-action-packet.md`](../Trellis/framework/cstl-goal-action-packet.md) |
| Golden 用例 | `cursor-trellis/packages/cli/test/fixtures/goal-reviewer-golden/cases.json` |

---

## 5. SDK 残余风险（须诚实记录）

| 来源 | 结论 |
| --- | --- |
| `@cursor/sdk` `Agent.prompt` | `sdk-client.ts` 包装为**单次** `Promise`，**无** mid-run cancel / abort 参数 |
| Goal SDK worker | `worker.ts` 仅外层 `withTimeout(..., ctx.timeoutMs)` |
| smart-search docs 探针（2026-08-07） | 未发现官方 mid-run cancel API — **按 timeout-only 风险处理** |

**实践建议：**

- Live 回归控制 `--max-steps` 与 wall 配置
- 长步无法保证 turn 中途取消；超时后进程可能仍占用资源直至 Promise  settle
- 无 key 环境一律用 `--mock-worker` 或 §2 Mock 路径

---

## 6. 快速 Checklist

- [ ] `pnpm test goal/` — 32 PASS
- [ ] `reviewer-golden.test.ts` + `walls.test.ts` — PASS
- [ ] `python -m py_compile .cstl/scripts/goal_wall_smoke.py` — OK
- [ ] （可选）`goal_wall_smoke.py <goal_id> --mode window --json` — `ok: true`
- [ ] （可选 live）`cstl goal preflight` / `accept` / `run --max-steps 1`
- [ ] **无** `cursor-trellis/packages/cli/src/goal/*` 功能 diff

---

**来源：** `08-06-cstl-p2-goal-hardening/verify.md` · Parent `08-07-cstl-parent-orch-visibility` §5.2
