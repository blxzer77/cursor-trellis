# 跨平台 Python 命令适配

## Goal

让 `trellis init` 在 Windows 上生成的配置文件使用 `python` 而非 `python3`，解决 Windows 用户 hook 无法执行的问题。

## 背景

| 平台 | 默认 Python 命令 |
|------|------------------|
| macOS / Linux | `python3` |
| Windows | `python` |

当前 `.claude/settings.json` 等配置文件硬编码了 `python3`，导致 Windows 用户的 hook 无法执行。

## 现有资源

spec 里已有跨平台指南：`.trellis/spec/guides/cross-platform-thinking-guide.md`

包含 `getPythonCommand()` 检测逻辑示例，但未应用到 init 流程。

## 影响范围

### MVP（本次实现）

| 文件类型 | 处理方式 |
|----------|----------|
| `.claude/settings.json` | ✅ init 时检测平台，替换 python 命令 |
| `.iflow/settings.json` | ✅ 同上 |
| `.opencode/` 相关配置 | ✅ 同上 |

### 后续处理（单独 task）

| 文件类型 | 处理方式 |
|----------|----------|
| `workflow.md` 文档 | 待定：加提示说明 or 替换 |
| 其他 `.md` 文档 | 待定 |
| 本项目 spec 文档 | 待定 |

### 不需要处理

| 文件类型 | 原因 |
|----------|------|
| Python 脚本帮助文本 | 自动执行，无人查看 |

## Requirements

### 功能需求

1. init 时检测 `process.platform`
2. Windows (`win32`) 使用 `python`，其他使用 `python3`
3. 配置文件用模板 + 占位符，init 时替换

### 实现方案

**模板文件**：
```json
{
  "command": "{{PYTHON_CMD}} .claude/hooks/session-start.py"
}
```

**init.ts**：
```typescript
const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'

// 生成配置时替换占位符
const content = template.replace(/\{\{PYTHON_CMD\}\}/g, pythonCmd)

// 给用户提示
if (process.platform === 'win32') {
  console.log(chalk.yellow('📌 Windows detected: Using "python" for hooks'))
}
```

## Acceptance Criteria

- [ ] Windows 上 init 生成的 settings.json 使用 `python`
- [ ] macOS/Linux 上 init 生成的 settings.json 使用 `python3`
- [ ] Windows 用户看到平台检测提示
- [ ] 现有 macOS/Linux 用户行为不变

## Technical Notes

### 涉及文件

| 文件 | 改动 |
|------|------|
| `src/templates/claude/settings.json` | 改用占位符 `{{PYTHON_CMD}}` |
| `src/templates/iflow/settings.json` | 同上 |
| `src/templates/opencode/` 相关 | 同上 |
| `src/configurators/claude.ts` | 添加占位符替换逻辑 |
| `src/configurators/iflow.ts` | 同上 |
| `src/configurators/opencode.ts` | 同上 |
| `src/commands/init.ts` | 添加平台检测提示 |

### 占位符方案 vs 运行时检测

选择 **占位符方案**（init 时替换）而非运行时检测，因为：
1. hook 执行时没有机会做检测
2. 配置文件需要是静态的
3. 一次生成，后续不需要再处理

## Out of Scope

- 文档类文件的 python3 替换（单独 task）
- Python 脚本帮助文本修改（不需要）
