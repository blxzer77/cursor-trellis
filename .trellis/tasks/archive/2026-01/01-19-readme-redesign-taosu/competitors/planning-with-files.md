# Planning-with-Files - README 与网站分析

> 研究日期：2026-01-19

---

## 快速概览

| 项目 | 值 |
|------|-------|
| **网站** | 无独立网站 |
| **GitHub** | https://github.com/OthmanAdi/planning-with-files |
| **Star 数** | 10K+ |
| **标语** | "Work like Manus — the AI agent company Meta acquired for $2 billion" |
| **标语字数** | 13 个单词 |

---

## 1. 网站分析

### 是否有独立网站？
**否** - 仅通过 GitHub 仓库维护

### 标语
- **主标语**："Work like Manus — the AI agent company Meta acquired for $2 billion"
- **字数**：13 个单词
- **核心理念**："Markdown is my working memory on disk"
- **风格**：借势营销（引用 Meta 收购 Manus 的新闻事件）

---

## 2. README 分析

### 长度与风格
- **行数**：约 200-300 行
- **风格**：技术文档 + 使用指南
- **定位**：Claude Code 插件/技能的完整说明

### README 中是否有完整文档？
**是** - README 包含完整的功能说明、安装指南、使用场景

### 多语言支持
**1 种语言**：
- 英文（主要）

---

## 3. 视觉资源

### GIF/视频演示
- **数量**：无
- 纯文本文档，无视频演示

### 徽章
| 徽章 | 说明 |
|-------|-------|
| Stars | 10K+ |
| Forks | 880 |
| Version | v2.3.0 |

**徽章总数**：3-5

### Logo
**无** - 无品牌 logo

### 截图
- 无截图
- 使用代码块展示安装命令

---

## 4. README 结构

### 主要章节
1. 标题与标语
2. **核心概念** - 3-File Pattern 介绍
3. **基本原理** - 文件系统 vs 上下文窗口
4. **安装指南** - 多 IDE 安装方法
5. **支持的 IDE** - 5 种 IDE
6. **功能特性** - Hooks 系统
7. **使用场景** - When to Use / When to Skip
8. **许可证** - MIT

### 目录
**无** - 使用清晰的章节标题

### 安装章节
**5 种安装方式**（按 IDE 分）：
1. **Claude Code**：
   ```
   /plugin marketplace add OthmanAdi/planning-with-files
   /plugin install planning-with-files@planning-with-files
   ```
2. **Cursor**：Rules 格式
3. **Kilo Code**：Rules 格式
4. **OpenCode**：Personal/Project Skill
5. **Codex**：Personal Skill

### 功能展示
- **格式**：3-File Pattern + Hooks 系统
- **风格**：概念驱动

**核心功能**：
1. **3-File Pattern** - 三文件持久化模式
2. **PreToolUse Hook** - 工具调用前重读计划
3. **PostToolUse Hook** - 工具调用后提醒更新
4. **Session Recovery** - 上下文清理后的会话恢复
5. **OS-aware Hooks** - Unix/Windows 双系统支持

---

## 5. 内容元素

### README 中的代码示例
**有** - 安装命令：
```bash
/plugin marketplace add OthmanAdi/planning-with-files
/plugin install planning-with-files@planning-with-files
```

### 快速开始章节
**有** - 插件安装命令

### 命令参考
**无** - 主要通过 Hooks 自动触发

### 贡献指南
**GitHub Issues** - 通过 Issues 接受贡献

### 更新日志
**GitHub Releases** - v2.3.0（添加 Codex & OpenCode 支持）

---

## 6. 社会认证与链接

### 社区链接
- GitHub Issues
- GitHub Discussions
- **无** Discord、Twitter

### 关键数据
- 10K+ stars
- 880 forks
- MIT 许可证
- 5 种 IDE 支持

---

## 7. 语气与风格

| 方面 | 分类 |
|--------|----------------|
| 技术 vs 营销 | 技术型为主 |
| 正式程度 | 中等正式 |
| 视角 | 概念导向 |

### 语气示例
- "Markdown is my working memory on disk"
- "Work like Manus"
- 使用比喻（RAM vs Disk）解释核心概念

### 文案特点
- 借势营销（Meta 收购 Manus）
- 核心概念清晰（3-File Pattern）
- 使用场景明确（When to Use / When to Skip）

---

## 对 Trellis 的启示

1. **3-File Pattern** - task_plan.md / findings.md / progress.md 清晰分工
2. **RAM vs Disk 比喻** - 上下文窗口（RAM）vs 文件系统（Disk）的类比
3. **借势营销** - 引用 Meta 收购 Manus 的新闻增加可信度
4. **多 IDE 支持** - 5 种 IDE 的适配（Claude Code、Cursor、Kilo Code、OpenCode、Codex）
5. **Hooks 系统** - PreToolUse / PostToolUse / Stop 三阶段 Hook
6. **When to Use / When to Skip** - 明确使用场景边界
7. **OS 兼容性** - Unix/Windows PowerShell 双系统支持
8. **Session Recovery** - 上下文清理后的恢复机制
9. **无独立网站** - 仅通过 GitHub 仓库维护，降低运营成本
10. **MIT 许可证** - 宽松许可降低使用障碍

### 与 Trellis 的关系
- **相似点**：都关注 AI 编程助手的工作流优化，使用 Markdown 文件作为持久化存储
- **差异点**：Planning-with-Files 聚焦于会话内的计划追踪，Trellis 聚焦于跨会话的项目工作流模板和规范
- **可借鉴**：3-File Pattern 的清晰分工，Hooks 系统的自动化触发机制

---

## README 原文

> 来源：https://github.com/OthmanAdi/planning-with-files

