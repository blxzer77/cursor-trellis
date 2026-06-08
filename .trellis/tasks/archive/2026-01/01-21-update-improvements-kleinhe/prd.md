# PRD: Improve Trellis Update with File Descriptions and Migration Support

## Overview

改进 `trellis update` 命令，添加文件描述功能和迁移系统支持，提升用户体验和版本升级可靠性。

## Background

当前 `trellis update` 命令存在以下不足：
1. 用户不清楚每个被更新的文件是什么用途
2. 版本升级时缺乏文件迁移机制（重命名、删除等）
3. 无法区分用户修改的文件和模板更新的文件

## Goals

1. **文件描述** - 在更新时显示每个文件的用途说明
2. **迁移系统** - 支持版本间的文件重命名、删除等迁移操作
3. **修改检测** - 通过 hash 追踪区分用户修改 vs 模板更新

## Requirements

### 1. File Descriptions

```
Updating templates...
  ✓ .trellis/workflow.md - Development workflow guide
  ✓ .trellis/scripts/task.sh - Task management script
  ⚠ .trellis/spec/backend/index.md - Backend guidelines (modified by user)
```

**Implementation:**
- 在模板元数据中添加描述字段
- 或通过文件路径模式匹配生成描述

### 2. Migration System

支持的迁移类型：
| Type | Description | Example |
|------|-------------|---------|
| `rename` | 重命名单个文件 | `feature.sh` → `task.sh` |
| `rename-dir` | 重命名整个目录 | `agent-traces/` → `workspace/` |
| `delete` | 删除废弃文件 | 移除旧版本遗留文件 |

**Migration Manifest Format:**
```json
{
  "version": "0.2.0",
  "migrations": [
    { "type": "rename", "from": "old.md", "to": "new.md" }
  ]
}
```

### 3. Hash Tracking

- 首次 init 时记录所有模板文件的 SHA256 hash
- update 时对比 hash 检测用户修改
- 修改过的文件提示用户确认

### 4. User Experience

更新流程改进：
1. 显示版本变化（0.1.9 → 0.2.0）
2. 列出待执行的迁移操作
3. 区分自动更新 vs 需确认的文件
4. 创建完整备份后再执行

## Success Metrics

- 用户能理解每个文件的用途
- 版本升级自动处理文件重命名
- 用户修改的文件不会被意外覆盖
- 提供备份和回滚能力

## Status

- [x] 迁移系统基础实现
- [x] Hash 追踪机制
- [x] 备份机制
- [ ] 文件描述显示（待实现）

## Related

- Task: `21-update-mechanism-fixes` - 修复迁移系统的具体问题
- Commits: `24cb8ff`, `03716e0`, `ed0eafc`
