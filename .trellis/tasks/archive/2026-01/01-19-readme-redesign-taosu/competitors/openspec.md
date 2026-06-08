# OpenSpec - README 与网站分析

> 研究日期：2026-01-19

---

## 快速概览

| 项目 | 值 |
|------|-------|
| **网站** | https://openspec.dev |
| **GitHub** | https://github.com/Fission-AI/OpenSpec |
| **Star 数** | 18.1K |
| **标语** | "A lightweight spec-driven framework" |
| **标语字数** | 5 个单词 |

---

## 1. 网站分析

### 是否有独立网站？
**是** - 多个域名：
- https://openspec.dev（主站）
- https://openspec.cn（中文站）
- https://openspec.app（应用）

### 标语
- **主标语**："A lightweight spec-driven framework"
- **字数**：5 个单词
- **风格**：简洁直接，强调"轻量级"和"规范驱动"

### 网站结构

| 页面 | URL | 用途 |
|------|-----|---------|
| 首页 | openspec.dev | 落地页 |
| 文档 | thedocs.io/openspec | 完整文档 |
| 中文站 | openspec.cn | 中文国际化 |

---

## 2. README 分析

### 长度与风格
- **行数**：约 100-150 行
- **风格**：入口页面 + 链接导航
- **定位**：简洁入口，详细文档分离到 thedocs.io

### README 中是否有完整文档？
**否** - 详细文档在 thedocs.io

### 多语言支持
**2-3 种语言**：
- 英文（主站）
- 中文（openspec.cn）

---

## 3. 视觉资源

### GIF/视频演示
- **YouTube 教程**：3-5 个
- 《OpenSpec: Build Reliable Apps 100x Faster》(10:35)
- 官网首页有交互式代码示例

### 徽章
| 徽章 | 说明 |
|-------|-------|
| MIT License | 有 |
| Stars | 18.1K 动态显示 |
| Forks | 1.2K |

**徽章总数**：3-5

### Logo
**有** - OpenSpec 品牌 logo

### 截图
- 官网有多个代码示例截图
- 规范文件结构展示
- Spec delta 可视化

---

## 4. README 结构

### 主要章节（官网）
1. 标题与标语
2. 快速开始按钮
3. 社区链接（GitHub、Discord、文档）
4. 支持的工具列表（25+ 原生集成）
5. 核心功能区域
6. FAQ 常见问题
7. 联系表单

### 支持的 AI 工具（25+）
- Claude Code
- Cursor
- GitHub Copilot
- Codex
- Windsurf
- Gemini CLI
- OpenCode
- Cline
- RooCode
- 等更多...

### 安装章节
**4-5 种安装方式**：
1. npm 全局：`npm install -g @fission-ai/openspec@latest`
2. npm 本地：`npm install @fission-ai/openspec`
3. pnpm
4. yarn

**初始化**：`openspec init`

### 功能展示
- **格式**：简洁的价值主张
- **风格**：问题→解决方案

**核心功能**：
1. **Spec Delta** - 捕获需求变化，标记 ADDED/MODIFIED/REMOVED
2. **Persistent Context** - 规范存储在仓库，不会丢失
3. **Quick Review** - 秒级审视，自动生成变更提案
4. **Single Source of Truth** - 统一规范文档

---

## 5. 内容元素

### README 中的代码示例
**有** - 安装和初始化：
```bash
npm install -g @fission-ai/openspec@latest
cd my-project
openspec init
```

### 快速开始章节
**有** - 三步骤：安装 → 进入项目 → 初始化

### 命令参考
**有** - CLI 命令文档：
- `/opsx:proposal` - 创建提案
- `/opsx:apply` - 应用变更
- `/opsx:verify` - 验证实现

### 贡献指南
**有** - GitHub 仓库中

### 更新日志
**有** - v0.20.0 最新版本

---

## 6. 社会认证与链接

### 社区链接
- Discord：https://discord.gg/YctCnvvshC
- GitHub：https://github.com/Fission-AI/OpenSpec
- 官方文档：https://thedocs.io/openspec

### 关键数据
- 18.1K stars
- 1.2K forks
- 453+ commits
- 25+ AI 工具集成

---

## 7. 语气与风格

| 方面 | 分类 |
|--------|----------------|
| 技术 vs 营销 | 高技术 + 中营销 |
| 正式程度 | 中等偏正式 |
| 视角 | 问题导向 |

### 语气示例
- "Review intent, not just code"
- "You wouldn't ask an architect to build a house without a plan. Same idea here."
- 用比喻说明，简洁有力

### FAQ 特点
- 预判用户疑虑："Wait, isn't this just waterfall?"
- 诚实回答限制
- 对话感强

---

## README 中的 Use Case

**OpenSpec README 没有专门的 Use Case 列表**，通过功能描述和 FAQ 隐含展示。

### README/官网中隐含的 Use Case

| 功能 | 隐含 Use Case |
|------|--------------|
| Spec Delta | 捕获需求变化，标记 ADDED/MODIFIED/REMOVED |
| Persistent Context | 规范存储在仓库，跨 session 不丢失 |
| Quick Review | 秒级审视变更，自动生成变更提案 |
| Single Source of Truth | 统一规范文档，减少沟通成本 |

### README 中的命令 Use Case

| 命令 | Use Case |
|------|----------|
| `/opsx:proposal` | 创建规范变更提案 |
| `/opsx:apply` | 应用规范变更 |
| `/opsx:verify` | 验证实现是否符合规范 |

### FAQ 中的问题导向 Use Case

| 问题 | 回答（隐含用途） |
|------|----------------|
| "Wait, isn't this just waterfall?" | 不是瀑布，是快速迭代的规范驱动 |
| "What if I don't know what I want?" | Brainstorm 模式帮助探索需求 |

### Use Case 展示风格
- **问题导向**：通过 FAQ 预判用户疑虑
- **功能描述即用途**：Spec Delta、Quick Review 等
- **命令示例**：斜杠命令展示工作流

---

## 对 Trellis 的启示

1. **简洁入口 + 文档分离** - README 不追求完整，指向 thedocs.io
2. **25+ AI 工具集成** - 标准化支持，斜杠命令语法
3. **问题导向的营销** - 不卖产品，卖解决方案
4. **FAQ 设计** - 预判疑虑，诚实回答
5. **多语言域名** - openspec.dev / openspec.cn
6. **Spec-Driven Development** - 规范驱动开发理念
7. **三阶段工作流** - Propose → Apply → Archive
8. **具体效果量化** - "100x"、"seconds to review"
9. **Use Case 隐含在功能名称中** - Spec Delta、Quick Review 等自解释

---

## README 原文

> 来源：https://github.com/Fission-AI/OpenSpec
