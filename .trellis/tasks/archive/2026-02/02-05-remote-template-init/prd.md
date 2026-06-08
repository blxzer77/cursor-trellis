# trellis init 支持从远程模板初始化

## Goal

让 `trellis init` 命令支持从 docs 仓库 (https://github.com/mindfold-ai/docs) 下载模板，替代默认的空白模板。设计需考虑未来扩展到多种模板类型。

## 市场调研

### 主流 CLI 工具的做法

| 工具 | 模板发现 | 下载机制 | 交互式 |
|------|----------|----------|--------|
| create-vite | 硬编码列表 | npm 包内置 | ✅ prompts 选择框架 |
| create-next-app | GitHub examples 目录 | GitHub tarball API | ✅ 完整交互 |
| degit/tiged | 无列表，用户指定 | GitHub tarball | ❌ |
| **giget** | 无列表，用户指定 | GitHub tarball API | ❌ |

### giget 特点（推荐使用）

- TypeScript 原生，有可编程 API
- 支持 GitHub 子目录：`gh:user/repo/path/to/subdir`
- 内置缓存机制
- 被 Nuxt/UnJS 生态使用，活跃维护

## 架构设计

### 模板类型（扩展性考虑）

| 类型 | 安装位置 | 说明 | 状态 |
|------|----------|------|------|
| `spec` | `.trellis/spec/` | 开发规范模板 | **MVP** |
| `skill` | `.claude/skills/` | Claude 技能模板 | 未来 |
| `command` | `.claude/commands/` | 自定义命令模板 | 未来 |
| `full` | 整个 .trellis + .claude | 完整 starter kit | 未来 |

### 方案选择：统一索引 + 自动识别

**选择理由**：
1. 用户体验最简单，只需知道模板名
2. 索引文件声明模板类型，CLI 自动识别安装位置
3. 交互式选择时可按类型分组显示
4. 扩展性好，新增类型只需更新索引

**用户体验**：
```bash
# 用户不需要关心模板类型
trellis init --template electron-fullstack  # 自动识别为 spec
trellis init --template code-reviewer       # 未来：自动识别为 skill
```

**交互式显示（未来）**：
```
? Select a template:

  Spec Templates
  ❯ blank (default - empty templates)
    electron-fullstack (Electron + React + TypeScript)

  Skill Templates
    code-reviewer (Code review assistant)

  Full Starter Kits
    team-starter (Complete team setup)
```

## 默认行为

| 命令 | 行为 |
|------|------|
| `trellis init` | 交互式，**默认选中 blank** |
| `trellis init -y` | 跳过交互，**直接用 blank** |
| `trellis init --template <name>` | 使用指定模板 |

## 关键决策

### 已有目录处理策略

当目标目录（如 `.trellis/spec/`）已存在时：

| 策略 | 说明 | 参数 |
|------|------|------|
| **skip**（默认） | 跳过，不下载模板 | 默认行为 |
| overwrite | 删除已有目录，完全覆盖 | `--overwrite` |
| append | 只添加不存在的文件 | `--append` |

**交互式询问**：
```
? Directory .trellis/spec/ already exists. What do you want to do?
  ❯ Skip (keep existing)
    Overwrite (replace all)
    Append (add missing files only)
```

**注意**：giget 不原生支持 append 模式，需要自己实现：
1. 下载到临时目录
2. 遍历文件，只复制不存在的
3. 清理临时目录

### 模板记录

**决策：不记录使用的模板**

调研结果：create-vite、create-next-app 等主流脚手架都不记录使用的模板。

### 仓库支持

**决策：MVP 只支持官方仓库**

- 只允许 `mindfold-ai/docs` 仓库
- 不支持 `--template gh:user/repo/path` 自定义仓库
- 未来可扩展支持企业内部仓库

## Requirements

### MVP 范围（本次实现）

- 只支持 `type: "spec"` 模板
- 只支持官方 `mindfold-ai/docs` 仓库
- 交互式选择时 blank 为默认选项
- 支持 `--template` 参数直接指定
- 支持 `--overwrite` / `--append` 处理已有目录

### 功能需求

- 模板源：`https://github.com/mindfold-ai/docs/tree/main/marketplace/`
- 统一索引：`marketplace/index.json`（包含所有类型模板）
- 根据模板 `type` 字段决定安装位置
- 网络错误时 fallback 到 blank
- 已有目录时默认跳过，可选覆盖或追加

### 非功能需求

- 利用 giget 缓存机制支持离线
- 网络错误有友好提示

## Acceptance Criteria

- [ ] `trellis init` 交互式显示模板列表，blank 为默认
- [ ] `trellis init -y` 直接使用 blank，不触发模板选择
- [ ] `trellis init --template electron-fullstack` 下载指定模板
- [ ] 模板根据 `type` 字段安装到正确位置
- [ ] 网络错误有清晰提示，fallback 到 blank
- [ ] 目标目录已存在时，默认跳过并提示
- [ ] `--overwrite` 参数可覆盖已有目录
- [ ] `--append` 参数可追加缺失文件
- [ ] docs 仓库有 `marketplace/index.json` ✅ 已完成

## Technical Notes

### 涉及的项目

| 项目 | 改动 |
|------|------|
| **Trellis CLI** | `src/commands/init.ts` 添加模板选择逻辑 |
| **Trellis CLI** | 新增 `src/utils/template-fetcher.ts` 下载逻辑 |
| **Trellis CLI** | `src/cli/index.ts` 添加 `--template` 参数 |
| **Trellis CLI** | `package.json` 添加 giget 依赖 |
| **docs 仓库** | `marketplace/index.json` 统一模板索引 |

### 模板索引格式 (marketplace/index.json)

```json
{
  "version": 1,
  "templates": [
    {
      "id": "electron-fullstack",
      "type": "spec",
      "name": "Electron + React + TypeScript",
      "description": "Full-stack Electron desktop app guidelines",
      "path": "marketplace/specs/electron-fullstack",
      "tags": ["electron", "react", "typescript"]
    }
  ]
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | ✅ | 全局唯一标识符，用于 `--template` 参数 |
| `type` | string | ✅ | 模板类型：`spec` / `skill` / `command` / `full` |
| `name` | string | ✅ | 显示名称 |
| `description` | string | ❌ | 简短描述 |
| `path` | string | ✅ | 相对于仓库根目录的路径 |
| `tags` | string[] | ❌ | 分类标签 |

### 类型到安装位置映射

```typescript
const INSTALL_PATHS: Record<string, string> = {
  spec: '.trellis/spec',
  skill: '.claude/skills',
  command: '.claude/commands',
  full: '.',  // 整个项目根目录
}
```

### giget 使用 + 目录策略实现

giget 不原生支持 skip/append 模式，需要封装：

```typescript
import { downloadTemplate } from 'giget'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

type Strategy = 'skip' | 'overwrite' | 'append'

async function downloadWithStrategy(
  templatePath: string,
  destDir: string,
  strategy: Strategy
): Promise<boolean> {
  const exists = fs.existsSync(destDir)

  // skip: 目录存在就跳过
  if (strategy === 'skip' && exists) {
    console.log(`Skipping: ${destDir} already exists`)
    return false
  }

  // overwrite: 先删除再下载
  if (strategy === 'overwrite' && exists) {
    await fs.promises.rm(destDir, { recursive: true })
  }

  // append: 下载到临时目录，再合并
  if (strategy === 'append' && exists) {
    const tempDir = path.join(os.tmpdir(), `trellis-${Date.now()}`)
    await downloadTemplate(`gh:mindfold-ai/docs/${templatePath}`, {
      dir: tempDir,
      preferOffline: true
    })
    await copyMissing(tempDir, destDir)
    await fs.promises.rm(tempDir, { recursive: true })
    return true
  }

  // 直接下载
  await downloadTemplate(`gh:mindfold-ai/docs/${templatePath}`, {
    dir: destDir,
    preferOffline: true
  })
  return true
}

// 只复制不存在的文件
async function copyMissing(src: string, dest: string) {
  const entries = await fs.promises.readdir(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      if (!fs.existsSync(destPath)) {
        await fs.promises.mkdir(destPath, { recursive: true })
      }
      await copyMissing(srcPath, destPath)
    } else if (!fs.existsSync(destPath)) {
      await fs.promises.copyFile(srcPath, destPath)
    }
  }
}
```

## Out of Scope（本次不实现）

- `skill` / `command` / `full` 类型模板
- 模板版本管理
- 模板更新检测（trellis update 不更新模板）
- 私有/自定义模板仓库支持（`gh:user/repo/path`）
- 记录使用的模板
