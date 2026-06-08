# 从 docs-site 提取主仓库级内容

## Goal

识别 docs-site（submodule）中与 Trellis CLI 代码强耦合的内容，提取到主仓库根目录，确保代码和文档同步演进。

## Background

monorepo 重构后，docs-site 作为 submodule 引入。但部分内容（如 trellis-meta skill）描述的是 CLI 本身的架构和用法，跟 CLI 代码强耦合，放在 docs 仓库容易漏更新。

## 调研结果

### docs-site 内容分类

| 分类 | 目录 | 归属 | 理由 |
|------|------|------|------|
| 文档站内容 | `guide/`, `blog/`, `changelog/`, `concepts/`, `essentials/`, `use-cases/`, `showcase/`, `ai-tools/`, `api-reference/`, `zh/` | docs-site | 纯网站内容，Mintlify 渲染 |
| 文档站配置 | `docs.json`, `snippets/`, `images/`, `logo/`, `.husky/` | docs-site | 站点基础设施 |
| docs 自己的 Trellis | `.trellis/` | docs-site | docs 仓库自己的任务和工作区 |
| Marketplace 模板 | `marketplace/specs/` | docs-site → 主仓库 | 后续搬迁（03-08 任务） |
| 文档站页面 | `templates/`, `skills-market/`, `contribute/` | docs-site | 网站展示页面 |
| **trellis-meta skill** | `plugins/trellis-meta/skills/trellis-meta/` | **主仓库** | 描述 CLI 内部架构，跟代码强耦合 |

### `npx skills add` 发现机制（已验证）

通过阅读 `skills@1.4.4` 源码确认：

```javascript
// skills CLI 的核心发现逻辑
const SKIP_DIRS = ["node_modules", ".git", "dist", "build", "__pycache__"];

async function findSkillDirs(dir, depth = 0, maxDepth = 5) {
    if (depth > maxDepth) return [];
    const [hasSkill, entries] = await Promise.all([
        hasSkillMd(dir),
        readdir(dir, { withFileTypes: true }).catch(() => [])
    ]);
    const currentDir = hasSkill ? [dir] : [];
    const subDirResults = await Promise.all(
        entries.filter((entry) => entry.isDirectory() && !SKIP_DIRS.includes(entry.name))
            .map((entry) => findSkillDirs(join(dir, entry.name), depth + 1, maxDepth))
    );
    return [...currentDir, ...subDirResults.flat()];
}
```

**关键结论**：
- `npx skills add` **不需要** `.claude-plugin/` 或 `plugin.json`
- 只需要递归扫描找到 `SKILL.md` 文件即可（maxDepth=5）
- 跳过 `node_modules/.git/dist/build/__pycache__` 目录
- **不跳过 dotfile 目录**（除 `.git`），`.agents/`、`.claude/` 等内部 skill 会被扫到
- 示例：`mindfold-ai/team-skill` 仓库纯粹用 `skill-name/SKILL.md` 结构，无任何 Claude Code 绑定

### 扫描污染问题与解决

主仓库有 ~17 个 SKILL.md（`.agents/skills/` 14个、`.claude/skills/` 2个、`marketplace/skills/` 1个），直接 `npx skills add mindfold-ai/Trellis` 会扫到所有内部 skill。

**解决方案**：`npx skills add` 支持 `owner/repo/subpath` 子目录语法（源码 `parseSource()` L143）：

```bash
# 只扫描 marketplace/ 目录，不会扫到 .agents/、.claude/ 等内部 skill
npx skills add mindfold-ai/Trellis/marketplace
npx skills add mindfold-ai/Trellis/marketplace -s trellis-meta
```

工作原理：
1. Clone 完整仓库到临时目录
2. `searchPath = join(tempDir, "marketplace")` — 只在子目录内扫描
3. 只发现 `marketplace/skills/trellis-meta/SKILL.md`，不会扫到其他位置

**不支持的功能**（skills CLI 调研确认）：
- 无 `.skillsignore` 或类似忽略文件
- 无 `--exclude`、`--filter`、`--path` flag
- 不读取 `.gitignore`
- 无配置文件控制扫描范围

### 提取决策

基于以上发现，决定：
1. **不搬 `.claude-plugin/`** — Claude Code plugin 注册文件，不需要跟 Claude Code 绑定
2. **不搬 `plugin.json`** — 同上，`npx skills add` 不需要
3. **只搬 skill 内容本身** — `SKILL.md` + `references/` 目录
4. **放到统一的 `marketplace/` 目录** — 为后续模板市场做准备

## Marketplace 统一架构设计

### 设计原则

两套消费系统共享一个 `marketplace/` 目录：

| 系统 | 发现机制 | 消费者 | 兼容性 |
|------|---------|--------|--------|
| **npx skills add** | 递归扫描 `SKILL.md`（maxDepth=5） | `npx skills add mindfold-ai/Trellis/marketplace` | `marketplace/skills/*/SKILL.md` 自动被发现 |
| **trellis init --template** | `marketplace/index.json` → giget 下载子目录 | `trellis init --template <id>` | `marketplace/{type}/{id}/` 被索引 |

### 目录结构

```
Trellis/
├── marketplace/                     # 统一模板市场
│   ├── index.json                   # 模板索引（trellis CLI 消费）
│   ├── skills/                      # Skill 模板（npx skills add 也能发现）
│   │   └── trellis-meta/
│   │       ├── SKILL.md             # ← npx skills add 扫描入口
│   │       └── references/          # 24 个参考文档
│   │           ├── claude-code/     # Claude Code 平台相关
│   │           ├── core/            # Trellis 核心概念
│   │           ├── how-to-modify/   # 修改指南
│   │           └── meta/            # 元信息
│   ├── specs/                       # 项目规范模板（后续从 docs-site 搬过来）
│   │   └── electron-fullstack/
│   ├── hooks/                       # Hook 模板（未来）
│   │   └── linear-sync/
│   └── bundles/                     # All-in-one 项目模板（未来）
│       └── electron-starter/
│
├── packages/cli/                    # CLI 代码
└── docs-site/                       # 文档站（submodule，只有 MDX 页面）
```

### 关键设计点

1. **`npx skills add` 兼容**：`marketplace/skills/trellis-meta/SKILL.md` 在 maxDepth=5 内（depth=2），自动被发现
2. **`trellis init --template` 兼容**：`index.json` 统一索引所有模板类型
3. **无平台绑定**：不依赖 `.claude-plugin/` 或 `plugin.json`，纯粹基于目录结构
4. **Skill 不重复存储**：`index.json` 的 `path` 可以指向 `marketplace/skills/`

### `index.json` 示例

```json
{
  "templates": [
    { "id": "electron-fullstack", "type": "spec", "path": "marketplace/specs/electron-fullstack" },
    { "id": "trellis-meta", "type": "skill", "path": "marketplace/skills/trellis-meta" },
    { "id": "linear-sync", "type": "hook", "path": "marketplace/hooks/linear-sync" }
  ]
}
```

## docs-site 侧需要同步修改的内容（Research 完成）

搜索了 docs-site 中所有引用 `plugins/`、`trellis-meta`、`.claude-plugin` 的文件：

### 需要修改的文件

| 文件 | 引用内容 | 搬走后需要的改动 |
|------|----------|-----------------|
| `docs.json` L79, L203 | `skills-market/trellis-meta` 导航项 | **不用改** — 这是文档站页面导航，页面本身保留 |
| `skills-market/index.mdx` L18 | `npx skills add mindfold-ai/docs -s trellis-meta` | **需改** → `npx skills add mindfold-ai/Trellis/marketplace -s trellis-meta` |
| `skills-market/trellis-meta.mdx` L20 | `npx skills add mindfold-ai/docs --skill trellis-meta` | **需改** → 同上 |
| `zh/skills-market/index.mdx` L18 | 同英文版 | **需改** → 同上 |
| `zh/skills-market/trellis-meta.mdx` L20 | 同英文版 | **需改** → 同上 |
| `contribute/docs.mdx` L72-78 | 描述如何在 docs 仓库添加 plugin | **需改** — 说明 trellis-meta 已搬到主仓库 |
| `zh/contribute/docs.mdx` L70-75 | 同英文版 | **需改** — 同上 |

### Mintlify 部署影响

搬走后：
- Mintlify 部署 **不受影响**（只渲染 MDX 页面）
- `npx skills add mindfold-ai/docs -s trellis-meta` 会找不到 — **需要用户改用 `mindfold-ai/Trellis/marketplace -s trellis-meta`**

### 兼容性过渡

搬走后 `mindfold-ai/docs` 不再有 trellis-meta skill。已安装的用户不受影响（skill 已本地化），新安装需要用新地址。

## Execution Plan

### Phase 1: 提取到主仓库（主仓库 PR）— ✅ 已完成

- [x] 从 docs-site 复制 `plugins/trellis-meta/skills/trellis-meta/` 内容
- [x] 扁平化为 `marketplace/skills/trellis-meta/`（去掉 `plugin.json` 和多余嵌套）
- [x] 验证 `SKILL.md` + `references/` 完整（24 个参考文档）
- [x] 不复制 `.claude-plugin/`（不需要平台绑定）
- [x] 主仓库 `.gitignore` 确认不排除 `marketplace/`

### Phase 2: 更新 docs-site（docs 仓库 PR）— 待做

- [ ] 删除 `plugins/trellis-meta/`
- [ ] 删除 `.claude-plugin/`（或保留空壳指向主仓库）
- [ ] 更新 4 个安装命令（`skills-market/index.mdx`、`skills-market/trellis-meta.mdx` + 中文版）
  - `mindfold-ai/docs` → `mindfold-ai/Trellis/marketplace`（子目录路径避免扫描污染）
- [ ] 更新 2 个贡献指南（`contribute/docs.mdx` + 中文版）
  - 说明 Trellis skill 已搬到主仓库
- [ ] 确认文档站部署正常

### Phase 3: 验证

- [ ] `npx skills add mindfold-ai/Trellis/marketplace -s trellis-meta` 可正常安装
- [ ] 文档站无死链，安装命令正确

### Phase 4: 后续迁移（03-08 任务）

- [ ] `marketplace/specs/` 从 docs-site 搬到主仓库
- [ ] 更新 `template-fetcher.ts` 源 URL（`gh:mindfold-ai/docs/marketplace/specs/` → `gh:mindfold-ai/Trellis/marketplace/specs/`）
- [ ] 创建 `marketplace/index.json` 统一索引
- [ ] 未来：加 `marketplace/hooks/`、`marketplace/bundles/`

## Acceptance Criteria

- [x] `marketplace/skills/trellis-meta/SKILL.md` 在主仓库，可被 `npx skills add` 发现
- [x] 无 `.claude-plugin/` 或 `plugin.json` 平台绑定
- [ ] docs-site 中已删除 `plugins/` 和 `.claude-plugin/`
- [ ] 文档站 4 个安装命令指向 `mindfold-ai/Trellis/marketplace`
- [ ] 文档站贡献指南已更新
- [ ] 文档站部署正常
