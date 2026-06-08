# Trellis 现有"类插件"扩展点盘点

## 结论

Trellis 已有 5 种 plugin-like 机制，各自覆盖不同层级。设计新 plugin 机制应**复用**而非重建。

## 1. 平台注册表（Platform Registry）

**位置**：`packages/cli/src/types/ai-tools.ts` + `packages/cli/src/configurators/index.ts`

**形态**：中央注册表，13 种 AI CLI 工具通过 `AI_TOOLS` 记录和 `PLATFORM_FUNCTIONS` 函数表管理。

**扩展方法**：
1. 在 `AI_TOOLS` 加新项
2. 创建 `src/configurators/{platform}.ts`
3. 注册到 `PLATFORM_FUNCTIONS`
4. CLI 加 flag

**适用**：支持新 AI CLI 工具。**不适合做 capability-level 插件**。

## 2. 共享模板层（Shared Templates）

**位置**：`packages/cli/src/templates/common/` + `packages/cli/src/templates/shared-hooks/`

**形态**：单一来源模板，各平台通过 `resolveCommands()` / `resolveSkills()` 动态派生。

**扩展方法**：在 `src/templates/common/commands/` 或 `common/skills/` 新建 md，自动分发到所有平台。

**适用**：跨平台 skill / command / hook。**是 plugin 机制的天然底座**。

## 3. Migration 清单（Version Migrations）

**位置**：`packages/cli/src/migrations/index.ts` + `src/migrations/manifests/*.json`

**形态**：版本化声明式清单（rename / delete / safe-file-delete），JSON manifest + 动态加载。

**扩展方法**：在 `manifests/{version}.json` 声明迁移项，框架自动应用和追踪。

**适用**：Trellis 版本升级时的文件重构。**可复用作插件升级迁移机制**。

## 4. OpenCode JS 插件（真正的运行时 plugin）

**位置**：`.opencode/plugins/*.js` + `packages/cli/src/templates/opencode/lib/`

**形态**：JavaScript 插件，通过 hook 事件注入。当前有 3 个：
- `session-start.js` — 会话开始时注入上下文
- `inject-workflow-state.js` — UserPromptSubmit 时注入 workflow 状态
- `inject-subagent-context.js` — subagent spawn 时注入父任务上下文

**扩展方法**：在 `.opencode/plugins/` 新建 JS 文件，导出 hook 处理函数（工厂函数形态，OpenCode 1.2.x 约定）。

**适用**：OpenCode 平台特定的运行时行为。**是 Trellis 内部唯一的"真 plugin"**，可推广到其他平台。

## 5. Spec Marketplace（Registry Pull）

**位置**：`docs-site/marketplace/specs/`

**形态**：Git 仓库 / HTTP registry，通过 `trellis init --registry <url>` 拉取自定义 spec 模板集。

**扩展方法**：在独立仓库维护 spec 集合，URL 形式发布。

**适用**：项目特定编码规范、架构指南的复用。**可扩展为 plugin marketplace**。

## Trellis 最近改动（2026-04）观察到的方向

近期 commit 重点：
- `feat(agents)!: trellis- prefix sub-agents` — 统一 agent 命名空间
- `fix: opencode update tracking` + `windows hook cwd fix` — 跨平台稳定性
- `chore: trellis self update` — dogfooding
- `fix(update): include workflow.md in template set` — template 资源管理

**趋势**：Trellis 正在往"**更强的 template 资源管理 + 更稳的平台适配**"收敛。plugin 机制如果加入，应当复用这套已有的资源分发基础设施，**不另起炉灶**。

## 核心子系统的扩展能力矩阵

| 子系统 | 组织方式 | 扩展性 | 适合做插件底座 |
|--------|--------|--------|--------|
| CLI 命令 | 硬编码（init、update） | 低 | ❌ |
| Configurator | 中央注册表 `PLATFORM_FUNCTIONS` | 高 | ⚠️（平台层，非 capability 层） |
| Migration | 动态清单加载 | 高 | ✅（适合"插件升级迁移"） |
| Template | 共享层 + 平台派生 | 高 | ✅（适合"skill / hook 分发"） |
| Hook | 共享脚本库 + 平台特定 | 中 | ✅（需写 Python/JS） |

## 给 plugin 机制的架构建议

**不新增核心子系统**，而是**组合现有能力**：

```
.trellis/plugins/<name>/
  manifest.json         # 声明 capability 依赖
  skills/*.md           # → 复用 template 共享层
  hooks/*.py            # → 复用 shared-hooks 机制
  adapters/
    claude-code/        # → 复用 Configurator 注册
    opencode/           # → 复用 OpenCode plugin 范式
  migration/            # → 复用 migration manifest
```

每个目录背后都是现有 Trellis 子系统，plugin 机制只是**上层的打包 + 分发约定**。

## 跟"create task 自动建 research/"的关系

当前 `cmd_create`（`common/task_store.py:85`）只建 `task.json`，**不建 research/**。

research/ 是 `trellis-research` agent 的约定（`.claude/agents/trellis-research.md:36`），由 agent 自己 `mkdir -p`。

**小优化建议（可纳入 plugin 机制 PRD 的 Out of Scope 或独立任务）**：`cmd_create` 时可选地建 `research/` 空目录（或至少 `research/.gitkeep`），让调研产出有固定落地位置。
