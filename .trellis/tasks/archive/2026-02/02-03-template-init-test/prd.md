# Feature: trellis init --template 选项支持

## Goal

为 `trellis init` 命令添加 `--template` 选项，支持从远程模板仓库初始化 spec 和 skills。

## Background

- 文档站地址: https://docs.trytrellis.app
- GitHub 仓库: https://github.com/mindfold-ai/docs
- Spec 模板列表: https://docs.trytrellis.app/zh/templates/specs-index
- Skills 市场: https://docs.trytrellis.app/zh/skills-market/index

## Requirements

### CLI 接口设计

```bash
# 基本用法
trellis init                           # 现有行为，不变

# 使用模板
trellis init --template                # 交互式选择模板
trellis init --template --spec         # 只选择 spec 模板
trellis init --template --skills       # 只选择 skills 模板

# 指定模板名称
trellis init --template --spec nextjs-app
trellis init --template --skills superpowers
```

### 功能要求

1. **获取模板列表**
   - 从 GitHub 仓库获取可用的 spec 模板列表
   - 从 GitHub 仓库获取可用的 skills 模板列表
   - 支持缓存，避免每次都请求网络

2. **交互式选择**
   - 如果只用 `--template` 不指定 `--spec` 或 `--skills`，显示两者的选择菜单
   - 显示模板名称和简短描述
   - 支持搜索过滤

3. **模板下载和应用**
   - 下载选中的模板到对应目录
   - spec 模板 -> `.trellis/spec/`
   - skills 模板 -> `.claude/skills/` 或 `.opencode/skills/`

4. **模板仓库格式**（假设）
   - `templates/specs/<name>/` - spec 模板目录
   - `templates/skills/<name>/` - skills 模板目录
   - 每个模板目录包含 `manifest.json` 描述元数据

## Technical Notes

- 修改 `src/cli/commands/init.py`
- 可能需要新增 `src/cli/template_fetcher.py` 处理模板获取逻辑
- 使用 GitHub API 或 raw.githubusercontent.com 获取内容

## Acceptance Criteria

- [ ] `trellis init --template` 可以列出可用模板
- [ ] 可以选择并下载 spec 模板
- [ ] 可以选择并下载 skills 模板
- [ ] 支持 `--spec` 和 `--skills` 子选项
- [ ] 有基本的错误处理（网络错误、模板不存在等）
