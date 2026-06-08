# 合并 monorepo 分支到 main

## Goal

将 `feat/monorepo-submodule` 分支合并到主仓库 main，并按正确顺序推送 docs-site 子模块，确保所有 URL 和链接生效。

## 背景

`feat/monorepo-submodule` 分支完成了以下工作：
- 仓库结构重组为 monorepo（`packages/cli/` + `docs-site` submodule）
- `marketplace/` 目录建立（specs + skills + index.json）
- 模板源 URL 从 `mindfold-ai/docs` 更新为 `mindfold-ai/Trellis`
- docs-site 清理（删除 `plugins/trellis-meta/`、`.claude-plugin/`，更新所有链接）

## 操作步骤

### Step 1: 主仓库合并

```bash
git checkout main
git merge feat/monorepo-submodule
git push origin main
```

**前置条件**: 无
**产出**: `marketplace/` 目录上线 main，GitHub URL 生效

### Step 2: docs-site 子模块推送

```bash
cd docs-site
git checkout main
git push origin main
```

**前置条件**: Step 1 完成（docs-site 页面中的 `mindfold-ai/Trellis/tree/main/marketplace` 链接需要主仓库 main 已有 `marketplace/`）
**产出**: Mintlify 自动部署，文档页面链接全部有效

### Step 3: 验证

- [ ] `https://github.com/mindfold-ai/Trellis/tree/main/marketplace` 可访问
- [ ] `https://raw.githubusercontent.com/mindfold-ai/Trellis/main/marketplace/index.json` 返回正确 JSON
- [ ] docs-site 各页面链接正常：
  - skills-market/index.mdx — install 命令
  - skills-market/trellis-meta.mdx — skill 详情
  - templates/specs-index.mdx — marketplace 链接
  - templates/specs-electron.mdx — 模板下载链接
  - guide/ch02-quick-start.mdx — marketplace 链接
  - contribute/docs.mdx — 贡献指南
- [ ] `npx skills add mindfold-ai/Trellis/marketplace -s trellis-meta` 可正常安装

### Step 4: 清理

```bash
git branch -d feat/monorepo-submodule
git push origin --delete feat/monorepo-submodule

cd docs-site
git branch -d feat/marketplace-migration
git push origin --delete feat/marketplace-migration
```

## 风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| 顺序反了（先推 docs-site） | 文档页面链接 404 | 严格按 Step 1 → 2 执行 |
| submodule pointer 指向未推送的 commit | clone 时 submodule init 失败 | Step 2 确保 docs-site commit 在 remote |
| Mintlify 部署延迟 | 文档短暂不一致 | 可接受，几分钟内同步 |

## 不需要等发版

URL 常量（`TEMPLATE_INDEX_URL`、`TEMPLATE_REPO`）改动在 CLI 源码中，用户需 `npm update` 后才生效。但 `marketplace/` 目录和 `index.json` 在 main 上即可被旧版 `--registry` 参数引用，无依赖冲突。
