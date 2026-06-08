# OpenCode - README 与网站分析

> 调研日期：2026-01-19

---

## 快速概览

| 项目 | 内容 |
|------|-------|
| **网站** | https://opencode.ai |
| **GitHub** | https://github.com/anomalyco/opencode |
| **Star 数** | 77.3K |
| **标语** | "The open source AI coding agent" |
| **标语字数** | 6 个单词 |

---

## 1. 网站分析

### 是否有独立网站？
**是** - https://opencode.ai

### 标语
- **原文**："The open source AI coding agent"
- **字数**：6 个单词
- **风格**：品类定义（说明它是什么）

### 网站结构

| 页面 | URL | 用途 |
|------|-----|---------|
| 首页 | opencode.ai | 落地页 |
| 下载 | opencode.ai/download | 安装选项 |
| 文档 | opencode.ai/docs | 文档说明 |
| Zen | opencode.ai/zen | 模型市场 |
| 品牌 | opencode.ai/brand | 品牌资源 |
| 隐私 | opencode.ai/legal/privacy-policy | 隐私政策 |
| 条款 | opencode.ai/legal/terms-of-service | 服务条款 |

---

## 2. README 分析

### 长度与风格
- **行数**：约 200+ 行
- **风格**：内容全面
- **定位**：详细的安装选项 + FAQ

### README 中是否包含完整文档？
**部分包含** - README 有大量内容，同时链接到外部文档

### 多语言支持
**是 - 3 种语言**：
1. 英文（README.md）
2. 简体中文（README.zh-CN.md）
3. 繁体中文（README.zh-TW.md）

---

## 3. 视觉资源

### GIF/视频演示
- **数量**：2 个
- 1 个 GIF：终端 UI 演示
- 1 个视频：YOLO 安装功能

### 徽章
| 徽章 | 内容 |
|-------|-------|
| Discord | 链接 |
| npm | 包信息 |
| 构建状态 | CI |
| Star 数 | 77.3K（隐含显示） |

**徽章总数**：4+

### Logo
**有** - OpenCode logo

### 截图
- 桌面应用截图
- 终端界面截图

---

## 4. README 结构

### 主要章节
1. 带徽章的头部（Discord、npm、Build）
2. 安装方式（9 种！）
3. 桌面应用（BETA）
4. 安装目录
5. Agent 系统（build、plan、general 子代理）
6. 文档引用
7. 贡献指南
8. 基于 OpenCode 构建
9. FAQ

### 目录
**无** - 使用 markdown 标题导航

### 安装章节
**非常详细** - 9 种安装方式：
1. YOLO（curl 安装）
2. npm
3. bun
4. Scoop（Windows）
5. Homebrew（macOS/Linux）- 推荐
6. Homebrew 官方 formula
7. paru（Arch Linux）
8. mise（任意系统）
9. nix

### 功能展示
- **格式**：带图标的项目符号
- **风格**：功能列表

**列出的功能**：
- LSP 支持
- 多会话
- 分享链接
- Claude Pro 支持
- ChatGPT Plus/Pro 支持
- 支持任意模型（75+ LLM 提供商）
- 支持任意编辑器

---

## 5. 内容元素

### README 中的代码示例
**有** - 多个安装命令：
```bash
curl -fsSL https://opencode.ai/install | bash
npm install -g opencode
brew install opencode-ai/tap/opencode
```

### 快速开始章节
**有** - 安装是主要入口

### 命令参考
**有** - 基础命令 + agent 调用：
- `opencode auth login`
- `opencode`
- `@general`（子代理）
- Tab 键切换

### 贡献指南
**独立文件** - CONTRIBUTING.md

### 更新日志
**独立文件** - STATS.md + releases

---

## 6. 社会认同与链接

### 社区链接
- Discord：有（徽章显示）
- X (Twitter)：在 FAQ 中

### 关键数据
- 77.3K stars
- 6.8K forks
- 596 贡献者
- 669 个版本发布
- 7,535 次提交
- 每月 650,000 开发者使用
- 500+ 贡献者

### FAQ 章节
**有** - 包含"与 Claude Code 有什么区别？"

**相对 Claude Code 的主要差异点**：
- 100% 开源
- 不绑定任何服务商
- 开箱即用的 LSP 支持
- 专注 TUI
- 客户端/服务端架构

---

## 7. 语气与风格

| 方面 | 分类 |
|--------|----------------|
| 技术性 vs 营销性 | 营销性 + 面向开发者 |
| 正式程度 | 轻松随意（"YOLO" 安装） |
| 视角 | 第三人称（描述 OpenCode） |

### 语言风格示例
- "The open source AI coding agent"
- "YOLO" 安装方式命名
- FAQ 采用对话式语气

---

## README 中的 Use Case

**OpenCode README 没有专门的 Use Case 章节**，侧重于安装方法和技术差异点。

### README 中隐含的 Use Case

| 功能 | 隐含 Use Case |
|------|--------------|
| build agent | 全权限开发代理，执行复杂开发任务 |
| plan agent | 只读分析代理，带权限控制的 bash 执行 |
| general subagent | 处理复杂搜索和多步骤任务 |
| LSP support | 语言服务器支持，代码智能 |
| Multi-session | 多会话管理 |
| Share links | 分享工作链接 |

### README 中的关键描述（原文）
- "The open source AI coding agent"
- "100% open source"
- "Works with Claude, OpenAI, Google and local models"

### FAQ 中的差异化定位（vs Claude Code）
- 100% 开源
- 不绑定任何服务商
- 开箱即用的 LSP 支持
- 专注 TUI
- 客户端/服务端架构

### Use Case 展示风格
- **技术导向**：强调架构和能力，非场景
- **差异化定位**：通过 FAQ 与 Claude Code 对比
- **无具体场景**：没有"用 OpenCode 做 X"的描述

---

## 对 Trellis 的启示

1. **9 种安装方式** - 覆盖所有平台/偏好
2. **"YOLO" 安装** - 有趣的命名，令人印象深刻
3. **3 种语言 README** - 中文市场很重要
4. **FAQ 包含竞品对比** - 直接定位
5. **桌面应用（BETA）** - 跨平台扩展
6. **Agent 系统** - 文档化的 build、plan、general agents
7. **极高的 star 数**（77K）- 大规模采用
8. **客户端/服务端架构** - 技术差异化优势
9. **Use Case 隐含在 Agent 描述中** - 通过代理角色暗示用途

---

## README 原文

> 来源：https://github.com/anomalyco/opencode

# OpenCode - Open Source AI Coding Agent

OpenCode is described as "The open source AI coding agent," offering capabilities comparable to Claude Code with several distinguishing features.

## Key Installation Methods

Users can install via package managers including npm, Homebrew, Scoop, and Arch Linux, or use the YOLO installation:

```bash
curl -fsSL https://opencode.ai/install | bash
```

## Notable Features

The platform includes two built-in agents accessible via Tab key:
- **build** - Full-access development agent
- **plan** - Read-only agent for analysis with permission-based bash execution

A **general** subagent handles complex searches and multistep tasks.

## Desktop Application

OpenCode offers a beta desktop app available for macOS (Apple Silicon/Intel), Windows, and Linux through their releases page or opencode.ai/download.

## Differentiation

Compared to similar tools, OpenCode emphasizes "100% open source" status and provider independence, supporting Claude, OpenAI, Google, and local models. Additional strengths include LSP support, terminal UI focus, and client/server architecture enabling remote operation.

## Resources

- Documentation: opencode.ai/docs
- Community: Discord and X.com channels
- Contributing guidelines available in CONTRIBUTING.md
