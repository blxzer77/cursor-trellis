# 统一平台目录硬编码 — TS Registry 重构

## Goal

通过扩展 `src/configurators/` 为中心化 platform registry，将 TS 侧 14 处硬编码平台列表降到 2-3 处不可避免的静态声明。

## Requirements

- 在 `src/types/ai-tools.ts` 扩展 `AIToolConfig` → `PlatformDefinition` interface
- 在 `src/configurators/index.ts` 新建 PLATFORMS registry，作为 single source of truth
- 从 PLATFORMS 派生所有重复列表：`BACKUP_DIRS`、`TEMPLATE_DIRS`、`getConfiguredPlatforms()`、`cleanupEmptyDirs()` 白名单
- 各 configurator 实现 `collectTemplates` 函数，通过 `PLATFORM_FUNCTIONS` registry 在 `configurators/index.ts` 中集中注册和 dispatch（非各 configurator 直接 export）
- `init.ts` 的 `TOOLS[]` 和 configurator dispatch 改为从 registry 派生

## Acceptance Criteria

- [x] `BACKUP_DIRS` 不再硬编码，从 PLATFORMS 派生
- [x] `TEMPLATE_DIRS` 不再硬编码，从 PLATFORMS 派生
- [x] `getConfiguredPlatforms()` 不再硬编码，从 PLATFORMS 派生
- [x] `cleanupEmptyDirs()` 两处白名单不再硬编码，从 PLATFORMS 派生
- [x] `init.ts` 的 `TOOLS[]` 从 PLATFORMS 派生
- [x] `collectTemplateFiles()` 改为遍历 registry 而非 if/else 分支
- [x] 所有现有测试通过
- [x] lint / typecheck 通过
- [x] `trellis init` 和 `trellis update` 行为不变

## Definition of Done

- Lint / typecheck / CI green
- 手动测试 `trellis init` 和 `trellis update` 行为不变
- `platform-integration.md` 更新为新的添加平台流程

## Technical Approach

### PlatformDefinition interface

```typescript
export interface PlatformDefinition {
  name: string;                              // "Claude Code"
  configDir: string;                         // ".claude"
  templateDirs: TemplateDir[];               // ["common", "claude"]
  defaultChecked: boolean;                   // init 交互选择默认值
  hasPythonHooks: boolean;                   // Windows 检测用
  configure: (cwd: string) => Promise<void>; // init configurator
  collectTemplates?: (cwd: string) => Map<string, string>;  // update 模板收集（OpenCode 无）
}
```

### Registry location

`src/configurators/index.ts` — 扩展现有目录，导出：
- `PLATFORMS: Record<AITool, PlatformDefinition>` — single source of truth
- `PLATFORM_IDS` — 所有平台 ID
- `CONFIG_DIRS` — 所有 configDir
- `ALL_MANAGED_DIRS` — `[".trellis", ...CONFIG_DIRS]`
- `getConfiguredPlatforms(cwd)` — 检测已安装平台
- `getPlatformsWithPythonHooks()` — Windows 检测用

### 消费端改造

| 消费端 | 之前 | 之后 |
|--------|------|------|
| `update.ts` BACKUP_DIRS | 硬编码 5 项 | `import { ALL_MANAGED_DIRS }` |
| `update.ts` getConfiguredPlatforms | 4 个 if | `import { getConfiguredPlatforms }` |
| `update.ts` collectTemplateFiles | 4 个 if block | `for (platform of configured) platform.collectTemplates?.(cwd)` |
| `update.ts` cleanupEmptyDirs x2 | 5 个字符串比较 | `ALL_MANAGED_DIRS.some(...)` |
| `template-hash.ts` TEMPLATE_DIRS | 硬编码 5 项 | `import { ALL_MANAGED_DIRS }` |
| `init.ts` TOOLS[] | 硬编码 4 项 | 从 PLATFORMS 派生 |
| `init.ts` configurator dispatch | 4 个 if | `for (tool of selected) PLATFORMS[tool].configure(cwd)` |
| `init.ts` Windows 检测 | 硬编码 2 个平台 | `getPlatformsWithPythonHooks()` |

### 不改动的部分

| 文件 | 原因 |
|------|------|
| `cli/index.ts` CLI flags | Commander.js 需静态声明 |
| `init.ts` InitOptions type | TypeScript interface 需静态 |
| `update.ts` static imports | ES module 静态 import |
| `templates/extract.ts` | 每平台一个函数，是注册行为本身 |
| `configurators/{platform}.ts` | 每平台一个文件，是注册行为本身 |
| `templates/{platform}/` | 物理目录结构 |

## Decision (ADR-lite)

**Context**: 30 处硬编码平台列表，添加新平台需改 17+ 处。

**Decision**: 采用 Turborepo 模式（centralized typed registry + per-platform interface），扩展 `src/configurators/` 为 registry 入口。不做插件化架构（4 平台不需要）。TS 和 Python 侧分别维护各自的 registry。

**Consequences**:
- 加新平台从 17+ 处降到 ~5 处（registry entry + configurator file + template dir + CLI flag + TS type）
- CLI flags 和 TS types 仍需手动加（语言限制）
- Python 侧暂不改动（独立 task）

## Out of Scope

- **Python 侧 registry 整理**：`cli_adapter.py` 已是事实上的 Python registry，派生不够充分。单独 task 处理（plan.py/start.py argparse choices 从 cli_adapter 派生）。
- **`template-fetcher.ts` INSTALL_PATHS**：Claude 特有功能，暂不动。
- **Migration manifests 里的历史路径**：不可变历史记录。
- **OpenCode 的 `index.ts` 缺失**：通过 `collectTemplates?: optional` 自然解决，不强制补。
- **`configurators/templates.ts` 重构**：`getCommandTemplates()` 只处理 claude/cursor 的问题随 collectTemplates dispatch 自然解决。

## Implementation Plan

1. **PR1: Registry scaffolding**
   - 扩展 `PlatformDefinition` interface
   - 新建 `src/configurators/index.ts` with PLATFORMS + helpers
   - 各 configurator 加 `collectTemplates` export
   - 纯新增代码，不改消费端

2. **PR2: 消费端迁移**
   - `update.ts`: BACKUP_DIRS, getConfiguredPlatforms, cleanupEmptyDirs, collectTemplateFiles 全部改为 import
   - `template-hash.ts`: TEMPLATE_DIRS 改为 import
   - `init.ts`: TOOLS[], configurator dispatch, Windows 检测改为从 registry 派生

3. **PR3: Spec 更新**
   - 更新 `platform-integration.md`：新的添加平台流程（从 11 个 category 降到 ~5 步）
   - 补全缺失的 6 处文档

## 硬编码完整清单（按域，供 review 参考）

### 域 1：初始化（`trellis init`）

| # | 文件 | 位置 | 可从 registry 派生？ | 本次处理 |
|---|------|------|:-------------------:|:--------:|
| 1 | `cli/index.ts` | CLI flags | ❌ | 不动 |
| 2 | `init.ts` | InitOptions | ❌ | 不动 |
| 3 | `init.ts` | TOOLS[] | ✅ | PR2 |
| 4 | `init.ts` | configurator dispatch | ⚠️ dispatch | PR2 |
| 5 | `init.ts` | Windows 检测 | ⚠️ | PR2 |
| 6 | `configurators/*.ts` | 每平台文件 | ❌ | PR1 (加 collectTemplates) |
| 7 | `configurators/templates.ts` | getCommandTemplates | ⚠️ | 随 collectTemplates 解决 |

### 域 2：更新（`trellis update`）

| # | 文件 | 位置 | 可从 registry 派生？ | 本次处理 |
|---|------|------|:-------------------:|:--------:|
| 8 | `update.ts` | imports | ❌ | 不动 |
| 9 | `update.ts` | getConfiguredPlatforms | ✅ | PR2 |
| 10 | `update.ts` | collectTemplateFiles | ⚠️ dispatch | PR2 |
| 11 | `update.ts` | BACKUP_DIRS | ✅ | PR2 |
| 12 | `update.ts` | cleanupEmptyDirs 白名单 | ✅ | PR2 |
| 13 | `update.ts` | cleanupEmptyDirs 递归 | ✅ | PR2 |
| 14 | `template-hash.ts` | TEMPLATE_DIRS | ✅ | PR2 |

### 域 3：Python 运行时（Out of Scope）

| # | 文件 | 位置 | 本次处理 |
|---|------|------|:--------:|
| 15-23 | cli_adapter.py, registry.py, plan.py, start.py, status.py | 多处 | 单独 task |

### 域 4：模板/构建/文档

| # | 文件 | 本次处理 |
|---|------|:--------:|
| 24 | types/ai-tools.ts | PR1 (扩展 interface) |
| 25 | templates/extract.ts | 不动 |
| 26 | template-fetcher.ts | 不动 |
| 27-28 | templates/{platform}/ | 不动 |
| 29 | copy-templates.js | 不动 |
| 30 | README | PR3 (如需要) |

## 参考

- Turborepo: centralized typed array + interface per package manager
- Rulesync/PRPM: central tool → output spec mapping
- PR #22 (iFlow integration): 完整的新平台添加示例
- beta.16: Windows `ValueError: I/O operation on closed file` 修复
