# Trellis + Docs Monorepo (Git Submodule)

## Goal

将 `mindfold-ai/Trellis` 重构为 monorepo 结构，Trellis CLI 代码移入子目录，`mindfold-ai/docs` 作为 git submodule 引入，实现代码与文档的同仓库协作。

## Motivation

1. **Co-development** — 同时修改 CLI 代码和文档，一个 PR 搞定
2. **Template 同步** — marketplace 模板 (在 docs 仓库) 与 CLI 代码 (template-fetcher.ts) 联调不需要跨仓库
3. **Dogfooding** — Trellis 自己就是 monorepo 工具，应该 dogfood 自己的 monorepo 支持

## What I Already Know

### 当前状态

**Trellis 仓库** (`mindfold-ai/Trellis`):
- TypeScript CLI 工具，pnpm workspace (目前 `packages: []`)
- `doc/` — changelog、示例文档 zip (可删除，内容陈旧)
- `docs/` — guide.md、blog 文章 (6 个 md 文件，需迁移到 docs 仓库)
- `template-fetcher.ts` 硬编码 `gh:mindfold-ai/docs` 作为模板源
- npm 发布为 `@mindfoldhq/trellis`，`files: ["dist", "bin", "README.md", "LICENSE"]`

**Docs 仓库** (`mindfold-ai/docs`):
- Mintlify 框架，部署在 `docs.trytrellis.app`
- MDX 格式，中英双语 (EN root + `zh/`)
- `marketplace/` 目录 — 模板索引 index.json + spec 模板
- `.claude-plugin/` — 插件注册

### GitHub Submodule 限制 (已调研)

| 限制 | 详情 |
|------|------|
| **相对链接不可用** | 主仓库 README 中 `[Guide](docs-site/guide.md)` → 404。GitHub 无法穿透 submodule |
| **文件浏览器** | submodule 目录显示为 `docs-site @ a1b2c3d`，点击跳转到 submodule 仓库 |
| **版本锁定** | 链接只能指向 branch HEAD 或手动指定 commit hash |

**Workaround**: README 中所有文档链接使用绝对 URL 指向 `docs.trytrellis.app`（当前已经是这样做的）。

## Proposed Structure

```
Trellis/                         # 主仓库 (mindfold-ai/Trellis)
├── .gitmodules                  # submodule 声明
├── .github/                     # CI/CD (保持在根)
├── .trellis/                    # Trellis 自己的任务 (保持在根)
├── .claude/                     # Claude 配置 (保持在根)
├── README.md                    # 主仓库 README (链接用绝对 URL)
├── pnpm-workspace.yaml          # packages: ["packages/*"]
│
├── packages/
│   └── cli/                     # ← Trellis CLI 代码搬到这里
│       ├── package.json
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       ├── src/
│       ├── test/
│       ├── bin/
│       ├── scripts/
│       ├── dist/
│       └── ...
│
└── docs-site/                   # ← git submodule (mindfold-ai/docs)
    ├── docs.json
    ├── marketplace/
    ├── guide/
    ├── zh/
    └── ...
```

### 为什么叫 `docs-site` 不叫 `docs`

- 避免与现有 `docs/` 目录冲突（过渡期）
- 语义更清晰：这是一个完整的文档站点，不只是 markdown 文件
- GitHub 不会自动把 `docs/` submodule 渲染为 GitHub Pages

## Decisions Made

1. **git history**: 使用 `git mv`，简单安全。IDE 的 blame/log 自动 follow rename，够用
2. **template-fetcher 改造**: 不做本地开发模式，后续再说
3. **third/ 目录**: 本地临时目录，后续删除，不纳入本任务

4. **docs 仓库部署**: submodule 里改了 docs 内容后 `cd docs-site && git push` 触发 Mintlify 部署，正常 submodule 工作流
5. **docs/ 内容迁移**: 执行时检查是否有重复，有就删，没就搬

## npm Publish 适配方案 (已分析)

包名 `@mindfoldhq/trellis`，当前从仓库根发布。搬到 `packages/cli/` 后：

| 项 | 变化 |
|---|---|
| `bin`, `main`, `types` 字段 | **不用改** — 相对于 package.json 的路径不变 |
| `files` 字段 | 需确认 `README.md` 和 `LICENSE` 的位置（可在 cli/ 放精简版或脚本拷贝） |
| CI publish.yml | 加 `working-directory: packages/cli` 或 `pnpm --filter @mindfoldhq/trellis publish` |
| CI ci.yml | build 验证路径改为 `packages/cli/dist/` |
| release 脚本 | `pnpm version` 需要在 `packages/cli/` 下执行 |
| `prepublishOnly` | 需确认 workspace 下行为正确 |

## Execution Phases

### Phase 1: 准备 (低风险)

- [ ] 审计 `doc/` 目录内容，确认可安全删除
- [ ] 审计 `docs/` 目录，确认哪些内容已迁移到 docs 仓库、哪些需要迁移
- [ ] 确认 npm 包名和发布配置
- [ ] 确认 CI/CD 现有配置 (GitHub Actions workflow 文件)

### Phase 2: 仓库重构

- [ ] 创建 `packages/cli/` 目录
- [ ] 将 CLI 代码移入：`src/`, `test/`, `bin/`, `scripts/`, `dist/`, `package.json`, `tsconfig.json`, `vitest.config.ts`, `eslint.config.js`, `node_modules/` 相关配置
- [ ] 保留在根目录的文件：`.github/`, `.trellis/`, `.claude/`, `.cursor/`, `.opencode/`, `README.md`, `README_CN.md`, `LICENSE`, `CONTRIBUTING.md`, `pnpm-workspace.yaml`, `.gitignore`
- [ ] 更新 `pnpm-workspace.yaml` → `packages: ["packages/*"]`
- [ ] 更新根 `package.json` (如果需要 workspace scripts)
- [ ] 更新所有内部路径引用 (import paths, bin paths, etc.)

### Phase 3: Submodule 集成

- [ ] `git submodule add https://github.com/mindfold-ai/docs.git docs-site`
- [ ] 更新 `.gitignore` 处理 submodule
- [ ] 删除 `doc/` 目录
- [ ] 迁移/删除 `docs/` 目录

### Phase 4: 适配调整

- [ ] 更新 CI/CD workflows (路径 filter, working-directory)
- [ ] 更新 npm publish 配置
- [ ] 验证 `pnpm install` / `pnpm build` / `pnpm test` 全部通过
- [ ] 更新 README 中的所有链接
- [ ] 可选：template-fetcher 支持本地 marketplace 路径 (开发模式)

### Phase 5: 验证

- [ ] 全量测试通过 (375 tests)
- [ ] Lint / typecheck 通过
- [ ] npm publish dry-run 成功
- [ ] 新 clone 后 `git submodule update --init` + `pnpm install` + `pnpm test` 通过

## Risks

| 风险 | 影响 | 缓解 |
|------|------|------|
| git history 断裂 | `git log --follow` 可能丢失移动前的历史 | 用 `git mv` 保留 rename detection |
| npm publish 路径错误 | 用户安装后 bin 找不到入口 | Phase 5 强制 dry-run 验证 |
| CI/CD 遗漏 | PR 检查失效 | 重构前先列出所有 workflow 文件 |
| 新贡献者学习成本 | clone 后要 `git submodule init` | README 和 CONTRIBUTING.md 说明 |

## Acceptance Criteria

- [ ] `git clone --recursive` 后可以直接 `pnpm install && pnpm test` 通过
- [ ] `packages/cli/` 可以独立 npm publish
- [ ] `docs-site/` submodule 指向 `mindfold-ai/docs` 且可更新
- [ ] 所有 375 个测试通过
- [ ] README 链接全部有效
- [ ] `doc/` 目录已删除

## Definition of Done

- Tests added/updated (unit/integration where appropriate)
- Lint / typecheck / CI green
- Docs/notes updated if behavior changes
- Rollout/rollback considered if risky

## Out of Scope

- docs 仓库内容重构 (那是 docs 仓库自己的事)
- template-fetcher 新功能 (已有单独任务 03-08)
- 新增 monorepo packages (只做搬迁，不新增)
- pnpm workspace 的 packages 间依赖 (只有一个 cli package)
