# Serena Memory System 分析

**Source**:
- https://github.com/oraios/serena
- https://oraios.github.io/serena/01-about/035_tools.html

## 定位

MCP server，主打**符号级代码检索 + 编辑**（基于 LSP / JetBrains plugin）。
Memory system 是其**附带特性**，不是独立产品。

## Memory 存储

- **路径**：`.serena/memories/*.md`（项目级）
- **全局 scope**：以 `global/foo` 前缀命名
- **格式**：纯 UTF-8 Markdown 文件，人可读可 grep
- **位置配置**：通过 `serena_config.yml` 的 `project_serena_folder_location` 可改
- **用户数据目录**：`~/.serena`（可用 `SERENA_HOME` 环境变量覆盖）

## Memory 工具（MCP tools）

| Tool | 功能 |
|---|---|
| `write_memory` | 写一条命名 memory（markdown） |
| `read_memory` | 读取 memory 内容 |
| `list_memories` | 列出所有 memory |
| `edit_memory` | 用正则替换修改 memory |
| `delete_memory` | 删除 memory（需显式要求） |
| `rename_memory` | 重命名（支持跨 scope 移动） |
| `check_onboarding_performed` | 检查是否首次启动 |
| `onboarding` | 首次启动时分析项目结构并写初始 memory |

## 召回机制（关键设计）

**Agent 主动调用**，非自动注入。

流程：
1. Agent 先调 `list_memories` 看有哪些
2. 判断相关性后再调 `read_memory`
3. 明确提示："只在相关时读取"、"一个会话内不要重复读同一 memory"

## Scope 区分

- **Project-level**：绑定具体项目
- **Global**：跨项目，命名前缀 `global/`
- `rename_memory` 支持跨 scope 移动

## Onboarding

首次接入时 `onboarding` tool 会：
1. 分析项目结构、关键文件、业务逻辑
2. 写入初始 memory 文件
3. 后续每次启动先 `check_onboarding_performed` 判断

## Serena 的整体架构（无传统 plugin 机制）

- **分层 YAML 配置**：global / CLI / project / context / mode
- **modes**：可动态组合的配置片段
- 没有开放的 plugin API / 扩展点

## 给 Trellis 的启示

1. **本地 markdown 文件**是最简单有效的 memory 存储 —— 用户可读可改，git diff 可审计
2. **Agent 主动调用**比自动注入更节约 context，但需要 AI 足够智能
3. **Onboarding tool** 值得参考 —— 首次启用插件时做项目画像
4. **Scope 分层**（project / global）是刚需 —— 用户私人记忆 vs 项目共享记忆

## 不适合 Trellis 直接照搬的部分

- Serena 是 MCP server，Trellis 是配置生成器（不同架构层）
- Serena 的 memory 工具通过 MCP 暴露，Trellis 应通过 Skill（SKILL.md）暴露 —— 走 AI agent 自然调用路径
