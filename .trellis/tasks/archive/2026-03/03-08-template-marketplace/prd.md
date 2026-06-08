# Trellis Template Marketplace

## Goal

建设 Trellis 的 Template 市场，让用户可以浏览、下载、发布社区 spec/skill/command 模板。

## What I Already Know

### 已有基础设施
- `src/utils/template-fetcher.ts` (551行) 已实现核心能力：
  - `fetchTemplateIndex()` — 从远程获取 `index.json`
  - `downloadTemplateById()` — 按 ID 下载模板
  - `parseRegistrySource()` — 解析 giget 风格源 (`gh:org/repo/path#ref`)
  - 支持三种下载策略: skip / overwrite / append
  - 超时配置: INDEX_FETCH 5s, DOWNLOAD 30s
- CLI 已支持 `--registry` flag (v0.3.6)
- 官方 marketplace 计划托管在 `mindfold-ai/docs` 仓库
- 官方 index URL: `https://raw.githubusercontent.com/mindfold-ai/docs/main/marketplace/index.json`

### index.json 格式 (已定义)
```json
{
  "version": 1,
  "templates": [
    {
      "id": "django-api",
      "type": "spec",
      "name": "Django API Backend",
      "description": "...",
      "path": "marketplace/specs/django-api",
      "tags": ["python", "django", "api"]
    }
  ]
}
```

### 模板类型 (代码中定义但仅 spec 已实现)
- **spec** → `.trellis/spec/` (已实现)
- **skill** → `.agents/skills/` (未实现)
- **command** → `.claude/commands/` (未实现)
- **full** → `.` 完整项目模板 (未实现)

### 安装路径映射 (template-fetcher.ts)
```
spec    → .trellis/spec
skill   → .agents/skills
command → .claude/commands
full    → . (项目根目录)
```

### 已有文档
- README.md 已添加 "Spec Templates & Marketplace" 章节
- 引导用户到 `docs.trytrellis.app/templates/specs-index` (待建设)

## Assumptions (Temporary)

- Marketplace 初期以 GitHub 仓库为载体 (不需要独立后端服务)
- 模板发布主要通过 PR 到官方 docs 仓库
- 社区可以自建 registry (已支持 `--registry`)

## Open Questions

1. **MVP 范围**: 这个任务的边界在哪里？是只做官方 marketplace 的内容填充，还是也包括 CLI 侧的改进？
2. **模板类型优先级**: 目前只有 spec 类型能用，skill/command/full 要在这个任务里支持吗？
3. **发布流程**: 社区如何贡献模板？PR-based？还是需要更自动化的 publish 命令？

## Requirements (Evolving)

- TBD (待 brainstorm 明确)

## Acceptance Criteria (Evolving)

- [ ] TBD

## Definition of Done

- Tests added/updated (unit/integration where appropriate)
- Lint / typecheck / CI green
- Docs/notes updated if behavior changes
- Rollout/rollback considered if risky

## Out of Scope (Explicit)

- TBD

## Technical Notes

### 关键文件
| 文件 | 职责 |
|------|------|
| `src/utils/template-fetcher.ts` | 注册中心、下载、marketplace 逻辑 |
| `src/commands/init.ts` | Init 流程中的模板选择 |
| `src/templates/extract.ts` | 模板路径获取、文件读取 |
| `src/types/ai-tools.ts` | 平台注册表 |

### 当前限制
- `downloadTemplateById()` 中仅 "spec" 类型通过验证，其他类型会被拒绝
- 没有模板发布/验证工具链
- 没有模板质量检查机制
