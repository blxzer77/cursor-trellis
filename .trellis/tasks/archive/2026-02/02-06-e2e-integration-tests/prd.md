# E2E Integration Tests for init/update Commands

## Goal

用函数级集成测试（方案 B）验证 `init()` 和 `update()` 两个核心命令的完整行为，确保从入口到文件系统输出的端到端正确性。方案 B 的优势：可复现、快速、不依赖 CLI 子进程。

## Decision (ADR-lite)

**Context**: init/update 是 Trellis 的两个核心命令，当前只有单元测试覆盖内部函数（cleanupEmptyDirs、sortMigrationsForExecution 等），缺乏对命令整体行为的集成测试。

**Decision**: 采用方案 B（函数级集成测试）。直接 import `init()` / `update()` 函数，在真实临时目录中执行，通过 `vi.mock` 隔离外部依赖（inquirer、execSync、fetch）。

**Consequences**:
- (+) 测试速度快，可复现
- (+) 可精确控制每个外部依赖的行为
- (+) 不需要全局安装 CLI
- (-) 需要 mock `process.cwd()` 和交互式依赖
- (-) 不能验证 CLI 参数解析（commander 层）

## Requirements

### Mock 策略

需要 mock 的外部依赖（最小化原则）：

| 依赖 | 原因 | Mock 方式 |
|------|------|----------|
| `process.cwd()` | init/update 内部通过 `process.cwd()` 获取工作目录 | `vi.spyOn(process, 'cwd')` |
| `inquirer` | 交互式提示，CI 中无法使用 | `vi.mock('inquirer')` |
| `execSync` | git config / python 脚本调用 | `vi.mock('node:child_process')` |
| `fetch` (global) | update 中 `getLatestNpmVersion()` 访问 npm registry | `vi.stubGlobal('fetch')` |
| `figlet` | init 中生成 ASCII banner | `vi.mock('figlet')` |
| `chalk` | 不 mock — 测试时 chalk 自动检测到无 TTY 会关闭颜色 |
| `console.log` | 可选 — 用 `vi.spyOn` 静音输出或捕获断言 | `vi.spyOn(console, 'log')` |

### 测试文件结构

```
test/
  commands/
    init.integration.test.ts    # init() 集成测试
    update.integration.test.ts  # update() 集成测试
    update-internals.test.ts    # 已有 — 内部函数单元测试
```

### init() 集成测试矩阵

| # | 场景 | 选项 | 验证点 |
|---|------|------|--------|
| 1 | 基本初始化（全默认） | `{ yes: true }` | .trellis/ 目录结构完整、.version 文件正确、默认平台（cursor+claude）配置生成 |
| 2 | 单平台初始化 | `{ yes: true, claude: true }` | 只生成 .claude/ 目录，不生成 .cursor/ |
| 3 | 多平台初始化 | `{ yes: true, claude: true, cursor: true, opencode: true }` | .claude/ + .cursor/ + .opencode/ 均存在 |
| 4 | Force 模式覆盖 | `{ yes: true, force: true }` | 先 init，手动修改一个文件，再 init --force，文件被覆盖 |
| 5 | Skip 模式保留 | `{ yes: true, skipExisting: true }` | 先 init，手动修改一个文件，再 init --skip，文件不变 |
| 6 | 幂等性 | `{ yes: true }` x 2 | 连续执行两次 init，结果一致，不报错 |
| 7 | 开发者身份初始化 | `{ yes: true, user: 'testdev' }` | 断言 execSync 被调用且参数包含 `init_developer.py "testdev"`（.developer 文件由 Python 脚本写入，mock execSync 不执行脚本，故不断言文件内容） |
| 8 | 版本文件写入 | `{ yes: true }` | .trellis/.version 内容与 VERSION 常量一致 |
| 9 | Hash 追踪初始化 | `{ yes: true }` | .trellis/.template-hashes.json 存在且包含预期 key |
| 10 | Spec 模板生成 | `{ yes: true }` | .trellis/spec/backend/、.trellis/spec/frontend/、.trellis/spec/guides/ 均存在且有文件 |

### update() 集成测试矩阵

**前置条件**：每个 update 测试需要先通过 init 创建一个可用的项目目录。

| # | 场景 | 选项 | 验证点 |
|---|------|------|--------|
| 1 | 同版本更新 | `{ force: true }` | 输出 "Already up to date" 或无文件变更 |
| 2 | Dry run | `{ dryRun: true }` | 没有文件被修改（对比 init 后的快照） |
| 3 | 新文件自动添加 | `{ force: true }` | 删除某个模板文件后运行 update，文件被重新创建 |
| 4 | 未修改文件自动更新 | `{ force: true }` | 通过文件系统操纵模拟"模板已更新"：init 后将某文件内容改为 "old_v1"，同时将 .template-hashes.json 中对应 hash 改为 hash("old_v1")。此时 update 见到 file≠template 且 hash(file)=stored_hash → 归类为 autoUpdate。断言 update 后文件恢复为当前模板内容。不 mock 任何内部模块。 |
| 5 | 用户修改文件 + force | `{ force: true }` | 用户修改了文件，update --force 覆盖用户修改 |
| 6 | 用户修改文件 + skipAll | `{ skipAll: true }` | 用户修改了文件，update --skip-all 保留用户修改 |
| 7 | 用户修改文件 + createNew | `{ createNew: true }` | 用户修改了文件，update --create-new 创建 .new 副本 |
| 8 | 版本文件更新 | `{ force: true }` | update 后 .trellis/.version 更新为新版本 |
| 9 | 备份创建 | `{ force: true }` | update 后 .trellis/.backup-* 目录存在 |
| 10 | 降级保护 | `{}` (默认) | CLI 版本低于项目版本时，update 直接返回（不修改文件） |
| 11 | 降级 + allowDowngrade | `{ allowDowngrade: true, force: true }` | 允许降级时正常执行 |

### 辅助函数需求

```typescript
// test helpers
function createTempProject(): string;              // 创建临时目录
function initProject(tmpDir: string, opts?: InitOptions): Promise<void>;  // 在临时目录执行 init
function snapshotDir(dir: string): Map<string, string>;  // 递归读取所有文件内容
function compareDirSnapshots(before: Map, after: Map): { added, removed, changed };
```

## Acceptance Criteria

- [x] `test/commands/init.integration.test.ts` — 10 个测试，覆盖 init 矩阵
- [x] `test/commands/update.integration.test.ts` — 11 个测试，覆盖 update 矩阵
- [x] 所有 339 测试通过 `pnpm test`（20 文件）
- [x] lint 通过 `pnpm lint`
- [x] Mock 数量最小化 — 只 mock figlet、inquirer、child_process、fetch（4 个外部依赖）
- [x] 每个测试使用独立临时目录，测试间无状态共享
- [x] 无 flaky 测试 — 不依赖时间、网络、全局状态

## Definition of Done

- Tests added/updated (integration tests)
- Lint / typecheck / CI green
- PRD updated with final test counts

## Out of Scope

- CLI 参数解析测试（commander 层）— 属于真正的 E2E 需要子进程
- 网络功能测试（fetchTemplateIndex、downloadWithStrategy）— 需要 mock 服务器
- Python 脚本执行结果验证 — 需要 Python 环境
- 交互式提示的 UX 行为 — 需要 TTY 模拟

## Technical Notes

### 关键源文件

- `src/commands/init.ts` — init 命令入口（667 行）
- `src/commands/update.ts` — update 命令入口（1762 行）
- `src/configurators/workflow.ts` — 创建 .trellis 目录结构
- `src/configurators/index.ts` — 平台注册和配置
- `src/utils/template-hash.ts` — 模板 hash 追踪
- `src/utils/file-writer.ts` — 文件写入（有写入模式：ask/force/skip）

### init 执行流程

```
init(options)
├─ figlet banner (mock)
├─ setWriteMode(force/skip/ask)
├─ detectProjectType(cwd) — 纯文件检测，不需要 mock
├─ getInitToolChoices() — 纯数据，不需要 mock
├─ [inquirer 提示] — 被 --yes 或显式 flag 跳过
├─ [fetchTemplateIndex] — 被 --yes 跳过
├─ createWorkflowStructure(cwd, opts) — 实际写文件
├─ configurePlatform(platformId, cwd) — 实际写文件
├─ createRootFiles(cwd) — 写 AGENTS.md
├─ initializeHashes(cwd) — 写 .template-hashes.json
├─ execSync(python init_developer.py) — mock
└─ printWhatWeSolve() — console.log
```

### update 执行流程

```
update(options)
├─ fs.existsSync(.trellis) — 检查是否已初始化
├─ getInstalledVersion(cwd) — 读 .version 文件
├─ getLatestNpmVersion() — fetch npm registry (mock)
├─ compareVersions() — 纯计算
├─ getMigrationsForVersion() — 纯数据
├─ collectTemplateFiles(cwd) — 纯数据 + getConfiguredPlatforms
├─ analyzeChanges(cwd, hashes, templates) — 文件比对
├─ printChangeSummary() — console.log
├─ [dryRun 提前返回] — dryRun=true 时在 confirm 之前直接 return
├─ [inquirer confirm] — 始终执行（force/skipAll/createNew 不跳过 confirm，只跳过冲突解决）
├─ createFullBackup(cwd) — 实际写文件
├─ [executeMigrations] — 被 --migrate 控制
├─ 写入新文件、自动更新文件
├─ 处理冲突文件 — 被 force/skipAll/createNew 控制
├─ updateVersionFile(cwd) — 写 .version
└─ updateHashes(cwd) — 写 .template-hashes.json
```

### process.cwd() Mock 注意事项

`init()` 和 `update()` 内部直接调用 `process.cwd()`。需要在测试中 mock：

```typescript
const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tmpDir);
// ... 执行测试 ...
cwdSpy.mockRestore();
```

注意 `file-writer.ts` 的 `setWriteMode` 是模块级状态，测试间需要重置。

### inquirer Mock 策略

`init()` 在 `--yes` 模式下跳过大部分 inquirer 调用。

`update()` 的 inquirer 调用分两处，跳过条件不同：
1. **confirm 提示**（"Proceed?"）— 只有 `dryRun=true` 会在 confirm 之前提前 return。`force`/`skipAll`/`createNew` **不会**跳过 confirm。
2. **冲突解决提示** — 被 `force`/`skipAll`/`createNew` 跳过。

因此所有 update 测试（除 dryRun）都必须 mock inquirer，让 confirm 自动返回 `{ proceed: true }`。

```typescript
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn().mockResolvedValue({ proceed: true }),
  },
}));
```

## 实现备注

### 测试过程中发现的代码问题

1. **`{{PYTHON_CMD}}` 模板 roundtrip 不一致**（Medium） — **已修复**
   - `init` 的 `configurePlatform` 将 `{{PYTHON_CMD}}` 替换为 `python3` 写入文件
   - `update` 的 `collectTemplateFiles` 返回原始模板（含 `{{PYTHON_CMD}}`）
   - 导致 update 总是认为 Claude 平台文件有变更（autoUpdate），即使是同版本
   - **修复**：在 `configurators/index.ts` 新增 `resolvePlaceholders()` 函数，在 Claude 和 iFlow 的 `collectTemplates` 中对 settings 内容做占位符替换

2. **`cross-platform-thinking-guide.md` init/update 不一致**（Low） — **已修复**
   - `workflow.ts` 的 `createSpecTemplates` 创建 3 个 guides
   - `update.ts` 的 `collectTemplateFiles` 列出 4 个 guides（多了 cross-platform）
   - 导致 update 总是检测到一个"新文件"，即使是同版本
   - **修复**：从 `update.ts` 的 `collectTemplateFiles` 中移除 `cross-platform-thinking-guide.md`（该文件是 Trellis CLI 项目自身的文档，不属于用户项目模板）

### 最终 Mock 清单

| 依赖 | Mock 方式 | 两个测试文件均用 |
|------|----------|---------------|
| `figlet` | `vi.mock("figlet")` | 是 |
| `inquirer` | `vi.mock("inquirer")` | 是 |
| `node:child_process` | `vi.mock("node:child_process")` | 是（init 用，update 通过 setupProject 间接用） |
| `fetch` | `vi.stubGlobal("fetch")` | 仅 update |
| `process.cwd()` | `vi.spyOn(process, "cwd")` | 是 |
| `console.log/error` | `vi.spyOn` 静音 | 是 |
