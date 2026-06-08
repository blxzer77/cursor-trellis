# Continue - README 与网站分析

> 研究日期：2026-01-19

---

## 快速概览

| 项目 | 值 |
|------|-------|
| **网站** | https://continue.dev |
| **GitHub** | https://github.com/continuedev/continue |
| **Stars** | 30.9K |
| **标语** | "Ship faster with Continuous AI" |
| **标语字数** | 5 个单词 |

---

## 1. 网站分析

### 是否有独立网站？
**是** - 多域名架构：
- www.continue.dev（营销）
- docs.continue.dev（文档）
- hub.continue.dev（控制面板）
- blog.continue.dev（内容）
- changelog.continue.dev（版本发布）

### 标语
- **原文**："Ship faster with Continuous AI"
- **字数**：5 个单词
- **风格**：收益 + 概念

### 网站结构

| 页面 | URL | 用途 |
|------|-----|---------|
| 首页 | continue.dev | 落地页 |
| 定价 | hub.continue.dev/pricing | 定价层级 |
| 文档 | docs.continue.dev/intro | 文档 |
| 关于 | continue.dev/about-us | 公司信息 |
| 企业版 | continue.dev/enterprise | 企业销售 |
| 博客 | blog.continue.dev | 内容营销 |

---

## 2. README 分析

### 长度与风格
- **行数**：约 100-200 行
- **风格**：中等长度
- **定位**：入口页面，大量外链

### README 是否包含完整文档？
**否** - 链接到 docs.continue.dev

### 语言
- **仅英文**

---

## 3. 视觉素材

### GIF/视频演示
- **数量**：1+ 个（引用了 autocomplete-quick-start.gif）
- **位置**：快速入门教程

### 徽章
| 徽章 | 值 |
|-------|-------|
| GitHub Stars | 30.9K |
| GitHub Forks | 4.1K |
| 许可证 | Apache-2.0 |

**徽章总数**：3+ 个

### Logo
**有** - Continue logo（文字版：log-text.svg）

### 截图
- **数量**：3-5 张图片
- Mission Control 界面
- CLI 界面预览

---

## 4. README 结构

### 主要章节
1. 标题/标语
2. 快速入门/安装
3. 功能（Cloud Agents、CLI Agents、IDE Agents）
4. 使用场景
5. 入门链接
6. 文档链接
7. 贡献链接
8. 许可证

### 目录
**极简/内联** - 使用标题链接

### 安装部分
- **详细程度**：极简/概述
- **命令**：`npm i -g @continuedev/cli` → `cn`
- **完整指南**：外部文档

### 功能展示
- **格式**：带描述的编号列表
- **风格**：纯文本，无图标

**列出的功能**：
1. Cloud Agents - 自动化工作流
2. CLI Agents - 实时终端
3. IDE Agents - VS Code/JetBrains

---

## 5. 内容元素

### README 中的代码示例
**有** - 极简：
```bash
npm i -g @continuedev/cli
cn
```

### 快速入门部分
**有** - 链接到 docs.continue.dev/getting-started/quick-start

### 命令参考
**外部** - docs.continue.dev/cli/quick-start

### 贡献指南
**独立文件** - CONTRIBUTING.md

### 更新日志
**外部站点** - changelog.continue.dev

---

## 6. 社会认同与链接

### 社区链接
- Discord：discord.gg/NWtdYexhMs
- GitHub：有

### 定价
| 层级 | 价格 |
|------|-------|
| Solo | 免费 |
| Team | $10/开发者/月 |
| Enterprise | 定制 |

---

## 7. 语气与风格

| 方面 | 分类 |
|--------|----------------|
| 技术 vs 营销 | 平衡 |
| 正式程度 | 随意但专业 |
| 人称视角 | 第三人称（以产品为中心） |

### 语气示例
- "Delegating the boring parts, so you can build the interesting stuff"（把无聊的部分委托出去，让你专注于有趣的事情）
- "Built for how developers actually work"（为开发者真实的工作方式而构建）

---

## README 中的 Use Case

**Continue README 非常简洁，没有专门的 Use Case 章节**，仅通过产品线描述隐含用途。

### README 中隐含的 Use Case

| 产品线 | 隐含 Use Case |
|--------|--------------|
| Cloud Agents | 自动化工作流，由 PR 打开、定时或自定义事件触发 |
| CLI Agents | 实时终端执行，逐步审批流程 |
| IDE Agents | VS Code/JetBrains 中触发工作流 |

### README 中的关键描述（原文）
- "Delegating the boring parts, so you can build the interesting stuff"
- "Built for how developers actually work"

### Use Case 展示风格
- **极简**：没有具体场景，只有产品形态描述
- **价值导向**：强调"委托无聊部分"的收益
- **外链依赖**：具体 Use Case 需要去 docs.continue.dev 查看

---

## Trellis 的关键启示

1. **多域名架构** - 分离营销/文档/应用
2. **"Continuous AI" 概念** - 创造了一个新的品类术语
3. **三条产品线**清晰展示（Cloud/CLI/IDE）
4. **极简 README** - 大量依赖外部文档
5. **免费增值定价**清晰展示
6. **5 个单词的标语**，聚焦收益
7. **Use Case 极简化** - 只讲价值，不讲具体场景

---

## README 原文

> 来源：https://github.com/continuedev/continue

# Continue - Continuous AI for Developers

Continue is an open-source platform designed to accelerate development workflows through AI-powered automation. The project emphasizes delegating routine coding tasks so developers can focus on building meaningful features.

## Key Features

The platform operates across multiple environments:

- **Cloud Agents**: Automated workflows triggered by PR opens, schedules, or custom event triggers
- **CLI Agents**: Real-time workflow execution with terminal-based step-by-step approval processes
- **IDE Agents**: Integration with VS Code and JetBrains IDEs for in-editor workflow triggering

## Getting Started

Quick installation via npm:

```bash
npm i -g @continuedev/cli
cn
```

Users can access the platform through Mission Control (web interface), CLI in headless mode, or CLI in TUI (text user interface) mode.

## Project Details

- **License**: Apache 2.0 © 2023-2024 Continue Dev, Inc.
- **Community**: Active Discord community with dedicated contribution channels
- **Documentation**: Comprehensive docs available at docs.continue.dev
- **Changelog**: Tracked at changelog.continue.dev

The project welcomes contributions and maintains a detailed [contributing guide](https://github.com/continuedev/continue/blob/main/CONTRIBUTING.md) for interested developers.
