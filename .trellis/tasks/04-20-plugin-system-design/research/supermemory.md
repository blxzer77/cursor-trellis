# Supermemory 分析

**Source**: https://supermemory.ai / https://supermemory.ai/docs/

## 定位

SaaS 形态的 **memory layer for AI agents**。面向：
- 企业用户（API 接入）
- 开发者（TS/Python SDK、MCP server）
- 个人用户（consumer PA，"remembers everything"）

## 存储架构

- **Memory Graph**：custom vector graph engine，ontology-aware edges
- **混合检索**：向量 + 关键词，<300ms 延迟
- **Extractors**：理解多种格式（PDF / 网页 / 图像 / 音频）并写入
- **深度用户画像**：从行为构建 profile，驱动上下文感知召回

## 接入方式

| 通道 | 说明 |
|---|---|
| REST API | POST 端点用于 add / search memory |
| SDK | 官方 TypeScript + Python |
| MCP Server | 支持 MCP 直连（给 AI agent 用） |
| Connectors | Notion / Slack / Google Drive / S3 / Gmail |
| 开发者控制台 | API Key 管理 |

## 三种上下文交付方式（产品对外宣称）

1. **Memory API** — 原始 memory 读写
2. **User Profiles** — 高级用户画像
3. **RAG** — 检索增强生成

## 关键限制

- **SaaS 为主，不支持 self-host**（官网未提供自托管选项）
- 详细 API reference / 数据模型字段需要访问 docs.supermemory.ai 的 API Reference tab（公开 overview 页未列出）

## 跟 Coding Agent 的整合现状

- 产品定位偏 consumer PA，**非 coding agent 专用**
- MCP server 支持为技术上可集成 Claude Code / Cursor 奠定基础
- 但 Coding 场景的 memory 需求（代码风格、历史决策、架构偏好）跟 Supermemory 的文档 / 通讯记忆定位不完全对齐

## 给 Trellis 的启示

**作为参考，不作为直接依赖**：

1. **多源 connector + 统一 memory 层**的产品形态值得借鉴 —— 未来可能需要聚合 Linear / GitHub / Slack / 对话
2. **向量 + 关键词混合检索** —— 但 Trellis MVP 可用 grep / 简单 embedding 顶替
3. **云端依赖不合适 Trellis 默认路径** —— Trellis 强调"文件即真相"，云端只作为可选后端

## 作为可选后端的整合路径（后期）

- Memory plugin 抽象出 `MemoryBackend` 接口
- 默认实现：本地 markdown（Serena 风格）
- 可选实现：Supermemory API（用户配 API key）
- 用户在 `.trellis/plugins/memory/config.yml` 选 `backend: local | supermemory`
