# Trellis CLI 全量单元测试 + 回归测试

## Goal

为 Trellis CLI 的所有 TypeScript 功能模块引入全面的单元测试和历史 bug 回归测试，建立质量安全网，防止功能回退。

## 完成状态

**已完成** — 339 tests, 20 files, all passing, lint clean.

> 初始完成时 304 tests / 17 files。后续 `02-06-e2e-integration-tests` task 新增 2 个集成测试文件（init + update，21 tests），以及 `configurators/index.test.ts` 扩展 1 test，累计 339 / 20。

## 测试基础设施

* **框架**: Vitest 4.x（TypeScript ESM 零配置支持）
* **配置**: `vitest.config.ts` — `include: ["test/**/*.test.ts"]`, `exclude: ["third/**"]`
* **目录**: 集中式 `test/` 目录，镜像 `src/` 结构
* **脚本**: `pnpm test` / `pnpm test:watch`
* **Lint**: `eslint src/ test/`（两个目录）
* **依赖**: `vitest` (devDependency)

---

## 测试文件清单 (17 files, 304 tests)

### Phase 1: 注册表纯函数 + Registry Invariants (56 tests, 3 files)

#### `test/types/ai-tools.test.ts` — 4 tests
* `getToolConfig()` 返回正确配置对象（每个 AITool）
* `getTemplateDirs()` 返回正确模板目录（每个 AITool）

#### `test/configurators/index.test.ts` — 35 tests
**`isManagedPath()`**:
* 正向匹配：`.claude/commands/foo.md`, `.trellis/spec`, `.iflow`（精确匹配）
* MC/DC：`startsWith(d + "/")` true + `=== d` false；反之
* 边界：前缀相似 `.claude-backup`, `.trellis-old` → false
* 边界：空字符串 `""` → false
* 边界：路径穿越 `"../.claude"` → false
* **[BUG FIX beta.12]** Windows 反斜杠：`.claude\\commands` → true

**`isManagedRootDir()`**:
* 正向匹配各平台 configDir + `.trellis`
* 边界：非根目录路径、不存在的目录

**`resolveCliFlag()`**:
* 正向映射：`claude` → `claude-code` 等
* 边界：未知 flag、空字符串、带前缀 `--claude`、大小写 `Claude`

**`getInitToolChoices()`**:
* 数组长度 == 平台数量
* 每个元素含 `key`, `name`, `defaultChecked`, `platformId`
* `platformId` roundtrip 验证

**`getPlatformsWithPythonHooks()`**:
* 返回 `hasPythonHooks: true` 的平台子集

**派生常量**:
* `PLATFORM_IDS` 完整性
* `CONFIG_DIRS` / `ALL_MANAGED_DIRS` 长度和内容验证

#### `test/registry-invariants.test.ts` — 17 tests
**内部一致性（SQLite 式）**:
* `AI_TOOLS` key 在 `PLATFORM_FUNCTIONS` 中有对应
* `cliFlag` / `configDir` 唯一性
* `configDir` 以 `.` 开头且不与 `.trellis` 冲突
* `cliFlag` 不与 commander.js 保留名冲突
* 每个平台 `templateDirs` 包含 `common`
* `name` 非空字符串

**Roundtrip 一致性（Seemann 消费者视角）**:
* `resolveCliFlag(AI_TOOLS[id].cliFlag) === id` roundtrip
* `configurePlatform` 函数引用 defined
* `collectPlatformTemplates()` 路径以对应 `configDir` 开头

**派生数据不变量**:
* `ALL_MANAGED_DIRS[0]` === `.trellis`
* 无重复项

---

### Phase 2: 全功能模块覆盖 (190 tests, 13 files)

#### `test/constants/paths.test.ts` — 23 tests
* `DIR_NAMES`: 6 个常量存在性 + 值验证（`.trellis`, `workspace`, `tasks`, `archive`, `spec`, `scripts`）
* `FILE_NAMES`: 7 个常量存在性 + 值验证（`.developer`, `.current-task`, `task.json`, `prd.md`, `workflow.md`, `journal-`）
* `PATHS`: 8 个构造路径正确性（组合 DIR_NAMES）
* `getWorkspaceDir("john")` → `.trellis/workspace/john`
* `getTaskDir("01-21-my-task")` → `.trellis/tasks/01-21-my-task`
* `getArchiveDir()` → `.trellis/tasks/archive`
* 边界：路径不含 `\` 分隔符

#### `test/utils/template-hash.test.ts` — 30 tests
使用 `fs.mkdtempSync` + `os.tmpdir()` 创建真实临时目录测试。

**`computeHash()`**:
* SHA256 哈希长度 64 字符
* 相同输入一致性
* 已知值验证
* Unicode 内容支持

**fs 操作（每组 beforeEach/afterEach 管理临时目录）**:
* `loadHashes()`: 文件不存在返回 `{}`、正常加载、无效 JSON 返回 `{}`
* `saveHashes()`: 创建文件、覆盖文件
* `updateHashes()`: 合并新条目
* `updateHashFromFile()`: 从文件读取内容计算哈希、文件不存在时跳过
* `removeHash()`: 删除条目
* `renameHash()`: 重命名条目、旧路径不存在时跳过
* `isTemplateModified()`: 未修改 → false、修改后 → true、文件不存在 → false、无存储哈希 → true
* `matchesOriginalTemplate()`: 匹配 → true、修改后 → false
* `getModificationStatus()`: 批量检查返回正确 Map
* `initializeHashes()`: 扫描并哈希所有模板文件

#### `test/utils/project-detector.test.ts` — 20 tests
使用临时目录 + 真实文件创建测试。

**`getProjectTypeDescription()`**: 4 种类型的描述文本
**`detectProjectType()`**:
* 前端检测：`vite.config.ts`, `next.config.js`, React deps, Vue deps
* 后端检测：`go.mod`, `Cargo.toml`, `requirements.txt`
* Fullstack：前端 + 后端同时存在
* 空目录 → `unknown`
* **[已知 quirk]** `package.json` 在 `FRONTEND_INDICATORS` 中，文件存在即触发前端检测
* 边界：含 express 的 package.json → `fullstack`（因 package.json 触发前端）
* 边界：只有 lodash/无效 JSON/空 package.json → `frontend`

#### `test/utils/template-fetcher.test.ts` — 6 tests
**`getInstallPath()`**:
* `spec` → `.trellis/spec`
* `skill` → `.claude/skills`
* `command` → `.claude/commands`
* `full` → `.`（项目根目录）
* 未知类型 fallback → `.trellis/spec`
* 路径以 cwd 为前缀

#### `test/utils/file-writer.test.ts` — 13 tests
**`setWriteMode()` / `getWriteMode()`**: 全局状态设置/读取
**`ensureDir()`**: 新建目录、嵌套目录、已存在目录
**`writeFile()`**:
* 新文件写入
* 相同内容跳过
* force 模式覆盖
* skip 模式跳过
* append 模式追加
* 追加时自动添加换行符

#### `test/migrations/index.test.ts` — 20 tests
使用真实 manifest 文件（非 mock）。

* `getAllMigrationVersions()`: 返回所有版本、升序排列
* `getAllMigrations()`: 返回完整迁移列表
* `getMigrationsForVersion()`: 相同版本返回空、范围过滤
* `hasPendingMigrations()`: 有/无待处理迁移
* `getMigrationSummary()`: renames + deletes ≤ total（`rename-dir` 不计入）
* `getMigrationMetadata()`: 每个 manifest 含 version + migrations 字段
* `clearManifestCache()`: 缓存清除后仍能正常加载
* **[已知 quirk]** `getMigrationSummary` 不计入 `rename-dir` 类型

#### `test/templates/extract.test.ts` — 19 tests
**模板路径函数**: 5 个 `getXxxTemplatePath()` 验证目录存在
**废弃别名**: 5 个 deprecated 别名函数测试
**文件读取**: `readTrellisFile`, `readScript`, `readMarkdown`, `readClaudeFile`, `readOpenCodeFile`

#### `test/templates/claude.test.ts` — 13 tests
* `settingsTemplate`: 有效 JSON
* `getAllCommands()`: 返回 Map、每个值非空字符串
* `getAllAgents()`: 返回 Map、包含关键 agent
* `getAllHooks()`: 返回 Map、JSON 有效
* `getSettingsTemplate()`: 含 `{{PYTHON_CMD}}`

#### `test/templates/cursor.test.ts` — 4 tests
* `getAllCommands()`: 返回 Map、每个值非空
* 命令数量验证

#### `test/templates/iflow.test.ts` — 11 tests
* `settingsTemplate`: 有效 JSON、含 hooks
* `getAllCommands()`: **返回空 Map**（已知 quirk：命令在 `commands/trellis/` 子目录）
* `getAllAgents()`: 返回 Map
* `getAllHooks()`: 返回 Map、JSON 有效
* `getSettingsTemplate()`: 含 `{{PYTHON_CMD}}`

#### `test/templates/trellis.test.ts` — 10 tests
* 26 个 template string 常量非空
* `getAllScripts()`: 23 个条目、key 正确、值与常量一致
* Python 脚本含 docstring
* gitignore 含 `__pycache__`、`.developer`

#### `test/configurators/templates.test.ts` — 6 tests
* `getCommandTemplates()`: 每个平台返回正确的命令模板 Map
* 默认行为验证

#### `test/configurators/platforms.test.ts` — 15 tests
使用临时目录 + `setWriteMode("force")` 避免交互提示。

* `getConfiguredPlatforms()`: 目录检测逻辑
* `configurePlatform()`: 4 个平台实际模板复制验证

---

### Phase 3: 历史 Bug 回归测试 (58 tests, 1 file)

#### `test/regression.test.ts` — 58 tests

覆盖 23 个版本中的 27 个历史 bug，分 6 大类：

**Windows 编码修复 (10 tests)**:
* `[beta.10]` `_configure_stream` 函数存在性
* `[beta.10]` `reconfigure(encoding="utf-8")` 模式
* `[beta.10]` `TextIOWrapper` 回退路径
* `[beta.10]` `sys.platform == "win32"` 守卫
* `[beta.10]` stdout + stderr 都配置
* `[beta.16]` `_configure_stream` 处理有 reconfigure 方法的 stream
* `[beta.16]` `_configure_stream` 幂等性
* `[beta.10]` `task.py` inline encoding fix
* `[beta.10]` `add_session.py` inline encoding fix
* `[beta.10]` `git_context.py` inline encoding fix

**Windows 子进程标志 (4 tests)**:
* `[beta.12]` `plan.py` 使用 `CREATE_NEW_PROCESS_GROUP` (win32)
* `[beta.12]` `plan.py` 使用 `start_new_session` (非 Windows)
* `[beta.12]` `start.py` 使用 `CREATE_NEW_PROCESS_GROUP` (win32)
* `[beta.12]` `start.py` 使用 `start_new_session` (非 Windows)

**Windows 路径分隔符 (2 tests)**:
* `[beta.12]` `isManagedPath` 反斜杠路径处理
* `[beta.12]` `isManagedPath` 混合分隔符处理

**路径问题 (5 tests)**:
* `[0.2.15]` `PATHS.TASKS` = `.trellis/tasks`（非 `.trellis/workspace/*/tasks`）
* `[0.2.14]` Claude agent 模板无硬编码 `workspace/*/tasks/` 路径
* `[beta.13]` `cli_adapter.py` 无硬编码开发者路径
* `[0.2.15]` 脚本模板无硬编码用户名（路径中）
* `[beta.12]` `task.py` `resolve_task_dir` 处理 `.trellis` 前缀
* `[potential]` `task.py` 路径检查包含 `/` 分隔符

**Semver 预发布排序 (4 tests)**:
* `[beta.5]` 预发布版本排在正式版前
* `[beta.5]` 数字比较 `beta.2 < beta.10`（非字符串排序）
* `[beta.5]` 相同版本返回空
* `[beta.5]` beta 范围过滤正确

**迁移数据完整性 (4 tests)**:
* `[beta.14]` 所有迁移有 `from` 字段
* `[beta.14]` 所有迁移有合法 `type` 字段
* `[beta.14]` rename/rename-dir 迁移有 `to` 字段
* `[beta.14]` 所有 manifest 版本是合法 semver 格式

**平台模板收集 (2 tests)**:
* `[beta.16]` `collectPlatformTemplates` opencode 返回 undefined
* `[beta.16]` `collectPlatformTemplates` 其他平台返回 Map

**Shell → Python 迁移 (3 tests)**:
* `[beta.0]` 无 `.sh` 脚本残留
* `[beta.0]` 所有 script key 以 `.py` 结尾
* `[beta.0]` `multi_agent` 使用下划线命名

**Hook JSON 格式 (5 tests)**:
* `[beta.7]` Claude settings.json 有效 JSON
* `[beta.7]` Claude settings.json 有 hooks 结构
* `[beta.7]` hook 命令使用 `{{PYTHON_CMD}}` 占位符
* `[beta.7]` iFlow settings.json 有效 JSON + hooks
* `[beta.7]` iFlow hook 命令使用 `{{PYTHON_CMD}}`

**模板反斜杠问题 (4 tests)**:
* `[beta.12]` Claude command 模板无问题反斜杠序列
* `[beta.12]` Claude agent 模板无问题反斜杠序列
* `[beta.12]` Claude hook 模板无问题反斜杠序列
* `[beta.12]` iFlow hook 模板无问题反斜杠序列

**平台注册 (6 tests)**:
* `[beta.9]` OpenCode 平台已注册
* `[beta.13]` iFlow 平台已注册
* `[beta.16]` 所有平台有 configDirs
* `[beta.9]` OpenCode configDir = `.opencode`
* `[beta.13]` iFlow configDir = `.iflow`
* `[beta.16]` Claude configDir = `.claude`

**CLI 适配器 (3 tests)**:
* 所有注册平台在 `cli_adapter.py` 中有支持
* `detect_platform` 函数存在
* `get_cli_adapter` 函数存在

**迁移一致性 (4 tests)**:
* 23 个 manifest 文件已加载
* 版本严格升序
* 每个 manifest 有 migrations 数组
* migrations 数组非空

---

## Bug 注入验证

### 单元测试验证（已完成）
注入 5 个 bug → 10 个测试失败 → 100% 检测率：
1. 删除 `isManagedPath` 反斜杠归一化 → 2 tests failed
2. `computeHash` SHA256 → MD5 → 2 tests failed
3. `getArchiveDir` 用错常量 → 2 tests failed
4. `getProjectTypeDescription` 拼写错误 → 2 tests failed
5. `getInstallPath` 错误 fallback → 2 tests failed

### 回归测试验证（已完成）
注入 3 个历史 bug → 8 个测试失败 → 100% 检测率：
1. 删除 `_configure_stream` 编码修复 → 5 tests failed
2. 去掉 `isManagedPath` 反斜杠归一化 → 2 tests failed
3. semver 数字比较改字符串比较 → 1 test failed

---

## 已知代码 Quirks（测试中发现）

| Quirk | 位置 | 影响 |
|-------|------|------|
| `package.json` 在 FRONTEND_INDICATORS | `project-detector.ts` | 文件存在即触发前端检测 |
| `*.csproj` glob → regex 有 bug | `project-detector.ts:125` | `.*` 先替换再 `\.` 替换，regex 结果不正确 |
| `iflow getAllCommands()` 返回空 | `templates/iflow/index.ts` | 命令在 `commands/trellis/` 子目录 |
| `getMigrationSummary` 不计 `rename-dir` | `migrations/index.ts` | summary 数量 < 总迁移数 |
| `compareVersions` 重复 3 次 | migrations, update, cli | 未导出共享 |

---

## 测试文件结构

```
test/
├── constants/
│   └── paths.test.ts              # 23 tests — 路径常量 + 构造函数
├── commands/
│   └── update-internals.test.ts   # 13 tests — cleanupEmptyDirs + sortMigrationsForExecution
├── configurators/
│   ├── index.test.ts              # 36 tests — 纯函数 + 派生常量 + CliFlag 验证
│   ├── templates.test.ts          #  6 tests — 命令模板
│   └── platforms.test.ts          # 15 tests — 平台检测 + 配置
├── migrations/
│   └── index.test.ts              # 20 tests — 版本比较 + 迁移过滤
├── templates/
│   ├── extract.test.ts            # 19 tests — 模板路径 + 文件读取
│   ├── claude.test.ts             # 13 tests — Claude 模板
│   ├── cursor.test.ts             #  4 tests — Cursor 模板
│   ├── iflow.test.ts              # 11 tests — iFlow 模板
│   └── trellis.test.ts            # 10 tests — Trellis 脚本模板
├── types/
│   └── ai-tools.test.ts           #  4 tests — 注册表数据
├── utils/
│   ├── template-hash.test.ts      # 30 tests — SHA256 + fs 操作
│   ├── project-detector.test.ts   # 20 tests — 项目类型检测
│   ├── template-fetcher.test.ts   #  6 tests — 安装路径
│   └── file-writer.test.ts        # 13 tests — 文件写入模式
├── registry-invariants.test.ts    # 17 tests — 跨模块一致性
└── regression.test.ts             # 58 tests — 历史 bug 回归
```

---

## Acceptance Criteria

* [x] `pnpm test` 运行通过，339 tests 全绿（含后续 e2e task 新增）
* [x] `pnpm lint` 通过
* [x] 覆盖所有 EASY + MEDIUM 级别可测函数
* [x] 历史 27 个 bug 有回归覆盖
* [x] Bug 注入验证：单元测试 5/5 检测、回归测试 3/3 检测
* [x] Codex CR 4 条修复：cleanupEmptyDirs 防护、command 测试、CliFlag 类型安全、PRD 对齐

## Definition of Done

* [x] 339 tests passing (20 files)
* [x] Lint clean
* [x] Bug injection verification passed
* [x] 生产代码修复：`isManagedPath()` Windows 路径、`cleanupEmptyDirs()` 根目录保护、`CliFlag` 类型收紧

## Out of Scope

* `commands/init.ts`, `commands/update.ts` 完整命令流程测试 — 已由 `02-06-e2e-integration-tests` task 完成（函数级集成测试，21 tests）
* `cli/index.ts` — import 时有副作用
* `utils/template-fetcher.ts` 网络函数 — fetchTemplateIndex, downloadWithStrategy
* Python 脚本单元测试 — 单独 task: `02-06-python-windows-testing`
* CI/CD 集成（GitHub Actions）

## Decision (ADR-lite)

**Context**: 项目从零引入测试，需要覆盖所有可测功能模块。

**Decision**:
- **框架**: Vitest 4.x — TypeScript ESM 零配置
- **目录**: 集中式 `test/` 镜像 `src/` 结构
- **策略**: 真实临时目录（`fs.mkdtempSync`）替代 mock fs，回归测试直接验证源码内容
- **范围**: EASY + MEDIUM 全覆盖，HARD 级（命令行交互）排除

**Consequences**:
- HARD 级函数需要 mock inquirer/execSync，后续 task 处理
- 回归测试依赖源码文本匹配，重构时可能需要同步更新

## Technical Notes

### 测试方法论
* **SQLite 边界值测试**: 每个条件测试边界两侧
* **SQLite MC/DC**: 复合条件每个子条件独立影响结果
* **Mark Seemann 注册表测试**: roundtrip 验证消费者视角
* **Bug 注入验证**: 故意引入 bug 验证测试检测能力

### 测试技巧
* `setWriteMode("force")`: configurePlatform 测试前必须设置，避免交互提示
* `fs.mkdtempSync(path.join(os.tmpdir(), "prefix"))`: 创建隔离临时目录
* `beforeEach`/`afterEach`: 管理临时目录生命周期
* 回归测试直接读取 Python 源码文本，用 `toContain`/`toMatch` 验证修复模式存在
