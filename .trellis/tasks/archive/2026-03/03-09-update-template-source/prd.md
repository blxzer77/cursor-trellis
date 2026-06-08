# 更新 template-fetcher 默认源为主仓库

## Goal

将 `template-fetcher.ts` 的默认模板源从 `mindfold-ai/docs` 改为 `mindfold-ai/Trellis`，配合 `marketplace/` 从 docs-site 迁移到主仓库。

## Background

`03-05-remote-spec-templates` 已实现 `--registry` 自定义源功能。但默认源仍指向 docs 仓库：

```typescript
// packages/cli/src/utils/template-fetcher.ts
const TEMPLATE_INDEX_URL = "https://raw.githubusercontent.com/mindfold-ai/docs/main/marketplace/index.json";
const TEMPLATE_REPO = "gh:mindfold-ai/docs";
```

当 `marketplace/specs/` 从 docs-site 搬到主仓库后（03-08 任务），这两个常量需要更新。

## 依赖

- **前置**：`03-08-template-marketplace` — `marketplace/specs/` 搬到主仓库后才能改源
- **关联**：`03-09-extract-repo-level-content` — `marketplace/skills/` 已搬完

## Requirements

### 代码变更

1. **`packages/cli/src/utils/template-fetcher.ts`**：
   - `TEMPLATE_INDEX_URL` → `https://raw.githubusercontent.com/mindfold-ai/Trellis/main/marketplace/index.json`
   - `TEMPLATE_REPO` → `gh:mindfold-ai/Trellis`

2. **`INSTALL_PATHS` 复审**：
   - 当前 `skill: ".agents/skills"` — 确认是否需要改为 `.claude/skills` 或保持不变
   - 考虑 `marketplace/index.json` 中 skill 类型模板的安装路径

3. **`downloadTemplateById` 中的 `type !== "spec"` 限制**（L432）：
   - 当前只支持 spec 类型，后续需要解除以支持 skill/hook/bundle 类型
   - 本任务先记录，不一定要改

### 测试变更

4. **`test/utils/template-fetcher.test.ts`**：
   - 更新引用 `mindfold-ai/docs` 的断言
   - 确保 `parseRegistrySource` 测试不受影响（它测的是自定义源）

### 文档变更

5. **`docs-site` 相关页面**：
   - 如果文档中有引用默认模板源 URL 的地方，需要同步更新

## Acceptance Criteria

- [ ] `TEMPLATE_INDEX_URL` 和 `TEMPLATE_REPO` 指向 `mindfold-ai/Trellis`
- [ ] `trellis init --template <id>` 从主仓库 marketplace 下载模板
- [ ] `--registry` 自定义源功能不受影响
- [ ] 所有现有测试通过
- [ ] lint + typecheck 通过

## Technical Notes

- 这是简单的常量替换，但必须等 `marketplace/specs/` 实际搬到主仓库后才能生效
- 可以和 03-08 任务一起做，作为最后一步
