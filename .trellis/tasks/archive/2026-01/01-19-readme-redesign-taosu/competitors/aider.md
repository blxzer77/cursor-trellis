# Aider - README 与网站分析

> 研究日期：2026-01-19

---

## 快速概览

| 项目 | 内容 |
|------|-------|
| **网站** | https://aider.chat |
| **GitHub** | https://github.com/Aider-AI/aider |
| **Star 数** | 39.9K |
| **标语** | "AI pair programming in your terminal" |
| **标语字数** | 5 个单词 |

---

## 1. 网站分析

### 是否有独立网站？
**是** - https://aider.chat

### 标语
- **原文**："AI pair programming in your terminal"
- **字数**：5 个单词
- **风格**：动作 + 场景（做什么 + 在哪里）

### 网站结构

| 页面 | URL | 用途 |
|------|-----|---------|
| 首页 | aider.chat | 落地页 + 功能介绍 |
| 文档 | aider.chat/docs/ | 文档中心 |
| 安装 | aider.chat/docs/install.html | 安装指南 |
| 使用 | aider.chat/docs/usage.html | 使用指南 |
| LLM | aider.chat/docs/llms.html | 模型连接 |
| FAQ | aider.chat/docs/faq.html | 常见问题 |
| 排行榜 | aider.chat/docs/leaderboards/ | LLM 基准测试 |

---

## 2. README 分析

### 长度与风格
- **行数**：约 200-250 行
- **风格**：中等详细
- **定位**：入口页面，链接到外部文档

### README 是否包含完整文档？
**否** - README 是落地页，完整文档在 aider.chat

### 语言
- **仅英文**（无多语言 README）

---

## 3. 视觉资源

### GIF/视频演示
- **数量**：1 个
- **类型**：视频元素（屏幕录制）
- **位置**：主标题下方
- **时长**：约 15-30 秒

### 徽章
| 徽章 | 数值 |
|-------|-------|
| GitHub Star 数 | 39.9K |
| PyPI 安装量 | 410 万 |
| 每周 Token 数 | 150 亿 |
| OpenRouter | 前 20 |
| Singularity | 88% |

**徽章总数**：5 个

### Logo
**有** - Aider logo 位于 README 顶部

### 截图
- **数量**：0 张静态截图
- **功能图标**：9 个功能图标

---

## 4. README 结构

### 主要章节
1. Logo 与标题
2. 演示/屏幕录制（视频）
3. 徽章（5 个指标）
4. 功能介绍（9 个带图标的功能卡片）
5. 快速开始（代码示例）
6. 更多信息（链接）
7. 用户好评（推荐语）

### 目录
**无** - README 中没有明确的目录

### 安装部分
- **详细程度**：README 中较简略
- **展示的命令**：pip install、aider-install
- **完整指南**：外部链接（aider.chat/docs/install.html）

### 功能展示
- **格式**：9 个带图标的功能卡片
- **风格**：图标 + 标题 + 1-2 句描述
- **布局**：网格

**功能列表**：
1. 云端和本地 LLM
2. 代码库映射
3. 支持 100+ 编程语言
4. Git 集成
5. 在 IDE 中使用
6. 图片与网页
7. 语音转代码
8. 代码检查与测试
9. 复制/粘贴到 Web 聊天

---

## 5. 内容元素

### README 中的代码示例
**有** - 3 个示例：
```bash
python -m pip install aider-install
aider-install
cd /to/your/project
aider --model deepseek --api-key deepseek=<key>
aider --model sonnet --api-key anthropic=<key>
aider --model o3-mini --api-key openai=<key>
```

### 快速开始部分
**有** - "Getting Started" 包含 3 个模型示例

### 命令参考
**无** - README 中仅有基本命令
**完整参考**：外部文档中有 40+ 个命令

### 贡献指南
**单独文件** - CONTRIBUTING.md

### 更新日志
**单独文件** - HISTORY.md + 博客文章

---

## 6. 社会证明与链接

### 社区链接
- Discord：有（在页脚/资源中）
- GitHub Issues：有
- GitHub Discussions：有

### 赞助/资金
**README 中不可见**

---

## 7. 语气与风格

| 方面 | 分类 |
|--------|----------------|
| 技术 vs 营销 | 平衡（营销 + 技术） |
| 正式程度 | 专业/随意混合 |
| 视角 | 第二人称，以用户为中心 |

### 语气示例
- "Aider lets you..."（Aider 让你...）
- "Aider works best with..."（Aider 最适合与...配合使用）

---

## README 中的 Use Case

**注意**：Aider README 没有专门的 "Use Cases" 章节，而是通过**功能卡片**隐含展示用途。

### 功能卡片中的隐含 Use Case

| 功能 | 隐含的 Use Case |
|------|----------------|
| Cloud and local LLMs | 连接 Claude、DeepSeek、OpenAI 等模型进行 AI 编程 |
| Maps your codebase | 在大型项目中进行代码库理解和导航 |
| 100+ code languages | 支持各种编程语言的开发任务 |
| Git integration | 自动提交变更，管理版本控制 |
| Use in your IDE | 在 IDE 中通过注释请求代码变更 |
| Images & web pages | 添加截图、参考文档等视觉上下文 |
| Voice-to-code | 用语音请求新功能、测试用例、bug 修复 |
| Linting & testing | 自动检查并修复 linter 和测试问题 |
| Copy/paste to web chat | 通过浏览器与任意 LLM 的 web 界面协作 |

### Use Case 展示风格
- **无专门章节**：通过功能描述间接展示
- **图标+标题+描述**：每个功能 1-2 句话
- **动作导向**：强调 "Aider lets you...", "Aider can..."

---

## Trellis 的关键借鉴

1. **5 个单词的标语**效果好 - 定位清晰
2. **视频演示**放在首屏很有效
3. **5 个关键指标作为徽章** - 强有力的社会证明
4. **功能图标网格** - 可扫视，视觉化
5. **精简的 README** - 链接到独立文档站
6. **不需要目录** - 保持足够简短就不需要目录
7. **Use Case 隐含在功能中** - 不需要单独章节，功能描述即用途

---

## README 原文

> 来源：https://github.com/Aider-AI/aider

# AI Pair Programming in Your Terminal

Aider lets you pair program with LLMs to start a new project or build on your existing codebase.

## Features

### Cloud and local LLMs

Aider works best with Claude 3.7 Sonnet, DeepSeek R1 & Chat V3, OpenAI o1, o3-mini & GPT-4o, but can connect to almost any LLM, including local models.

### Maps your codebase

Aider makes a map of your entire codebase, which helps it work well in larger projects.

### 100+ code languages

Aider works with most popular programming languages: python, javascript, rust, ruby, go, cpp, php, html, css, and dozens more.

### Git integration

Aider automatically commits changes with sensible commit messages. Use familiar git tools to easily diff, manage and undo AI changes.

### Use in your IDE

Use aider from within your favorite IDE or editor. Ask for changes by adding comments to your code and aider will get to work.

### Images & web pages

Add images and web pages to the chat to provide visual context, screenshots, reference docs, etc.

### Voice-to-code

Speak with aider about your code! Request new features, test cases or bug fixes using your voice and let aider implement the changes.

### Linting & testing

Automatically lint and test your code every time aider makes changes. Aider can fix problems detected by your linters and test suites.

### Copy/paste to web chat

Work with any LLM via its web chat interface. Aider streamlines copy/pasting code context and edits back and forth with a browser.

## Getting Started

```bash
python -m pip install aider-install
aider-install

# Change directory into your codebase
cd /to/your/project

# DeepSeek
aider --model deepseek --api-key deepseek=<key>

# Claude 3.7 Sonnet
aider --model sonnet --api-key anthropic=<key>

# o3-mini
aider --model o3-mini --api-key openai=<key>
```

See the installation instructions and usage documentation for more details.

## More Information

### Documentation
- Installation Guide
- Usage Guide
- Tutorial Videos
- Connecting to LLMs
- Configuration Options
- Troubleshooting
- FAQ

### Community & Resources
- LLM Leaderboards
- GitHub Repository
- Discord Community
- Release notes
- Blog

## User Testimonials

- "My life has changed... Aider... It's going to rock your world." — Eric S. Raymond
- "The best free open source AI coding assistant." — IndyDevDan
- "The best AI coding assistant so far." — Matthew Berman
- "Aider has easily quadrupled my coding productivity." — SOLAR_FIELDS
- "It's a cool workflow... Aider's ergonomics are perfect for me." — qup
- "Like having your senior developer live right in your Git repo - truly amazing!" — rappster
- "What an amazing tool. It's incredible." — valyagolev
- "Aider is such an astounding thing!" — cgrothaus
- "WAY faster than I would be getting off the ground making first working versions." — Daniel Feldman
- "THANK YOU for Aider! It really feels like a glimpse into the future of coding." — derwiki
- "It's just amazing. It is freeing me to do things I felt were out my comfort zone." — Dougie
- "This project is stellar." — funkytaco
- "Amazing project, definitely the best AI coding assistant I've used." — joshuavial
- "I absolutely love using Aider... It makes software development feel so much lighter." — principalideal0
- "Aider has allowed me to continue productivity." — codeninja
- "I am an aider addict. Getting so much more work done, but in less time." — dandandan
- "Aider blows everything else out of the water hands down." — SystemSculpt
- "Aider is amazing, coupled with Sonnet 3.5 it's quite mind blowing." — Josh Dingus
- "Hands down, this is the best AI coding assistant tool so far." — IndyDevDan
- "Aider changed my daily coding workflows. It's mind-blowing." — maledorak
- "Best agent for actual dev work in existing codebases." — Nick Dobos
- "One of my favorite pieces of software. Blazing trails on new paradigms!" — Chris Wall
- "Aider has been revolutionary for me and my work." — Starry Hope
- "Try aider! One of the best ways to vibe code." — Chris Wall
- "Freaking love Aider." — hztar
- "Aider is hands down the best. And it's free and opensource." — AriyaSavakaLurker
- "Aider is also my best friend." — jzn21
- "Try Aider, it's worth it." — jorgejhms
- "I like aider :)" — Chenwei Cui
- "Aider is the precision tool... Minimal, thoughtful and capable of surgical changes." — Reilly Sweetland
- "Cannot believe aider vibe coded a 650 LOC feature... in 1 shot." — autopoietist
- "Aider is the best coding tool around. I highly recommend it." — Joshua D Vander Hook
- "Thanks to aider, I have started and finished three projects within two days." — joseph stalzyn
- "Been using aider as my daily driver... I absolutely love the tool." — koleok
- "Aider is the tool to benchmark against." — BeetleB
- "Aider is really cool." — kache
