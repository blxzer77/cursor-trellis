# Cursor 聊天存储机制（区别于 Agent Trace）

## 重要澄清

**Cursor 的 `state.vscdb` chat 存储 ≠ Agent Trace**。

两个完全不同的系统：

| 系统 | 性质 | 存的内容 | 可访问性 |
|---|---|---|---|
| `state.vscdb` | 私有本地存储（SQLite） | 对话消息原文 | 事后扒库，社区脚本 |
| Agent Trace | 开放规范（JSONL） | 代码↔对话的归属映射 | 标准 schema，互操作 |

CEO 提到的"cursor 那种 trace"大概率是两个混淆。

## state.vscdb 详情

### 存储位置

SQLite 数据库 `state.vscdb`，每个 workspace 一个文件。路径因 OS 而异（社区工具 `cursor-chat-export` 在 `config.yml` 中维护路径映射）。

### Schema

通用 KV 表 `ItemTable`：

```sql
ItemTable (
  key TEXT PRIMARY KEY,
  value TEXT   -- 通常是 JSON 字符串
)
```

### 关键 Keys

| Key | 存什么 |
|---|---|
| `composer.composerData` | 新版 Composer chat 列表（当前主要） |
| `workbench.panel.aichat.view.aichat.chatdata` | 老版 chat（tabs[] + bubbles[]） |
| `aiService.prompts` | 用户 prompt 历史（早期版本） |
| `aiService.generations` | AI response 历史（早期版本） |

### Bubble 数据结构

```json
{
  "bubbleId": "uuid",
  "type": 2,             // 1=user, 2=assistant
  "createdAt": "RFC3339",
  "text": "消息文本",
  "codeBlocks": [...],
  "toolFormerData": {...},
  "thinking": {...}
}
```

## 导出机制

**只支持事后导出**，无实时 hook。

社区工具：
- [cursor-chat-export](https://github.com/somogyijanos/cursor-chat-export) — `discover` + `export` 命令，导出为 Markdown
- [CursorChat Downloader](https://github.com/abakermi/vscode-cursorchat-downloader) — VS Code 扩展，浏览和保存
- [Cursor Chronicle](https://forum.cursor.com/t/cursor-chronicle-search-export-and-analyze-your-cursor-chat-history/153309) — CLI 工具，跨 workspace 搜索导出

## 跟 Trellis 的关系

如果未来要支持 Cursor 平台的 Trace plugin：

1. **无法实时捕获** —— Cursor 没有跟 Claude Code `PostToolUse` hook 对等的事件
2. **降级方案**：提供 `trellis trace import-cursor` 命令，事后扒 `state.vscdb`，转成 Trellis 统一 schema
3. **MVP 可以不做 Cursor 适配器** —— 核心用户已经在用 Claude Code / OpenCode

## 相比之下 Claude Code / OpenCode 的优势

| 能力 | Claude Code | OpenCode | Cursor |
|---|---|---|---|
| 实时 hook | ✅ PostToolUse/Stop/UserPromptSubmit/SessionStart/End | ✅ plugin.js hooks | ❌ 仅事后 |
| Tool call 级别事件 | ✅ 每个 Write/Edit/Bash 都触发 | ✅ | ❌ |
| 对话 transcript 本地化 | ✅ `~/.claude/projects/<id>/*.jsonl` | ⚠️ 取决于实现 | ❌ 云端 |

**结论**：Trellis 的 Trace plugin 在 Claude Code/OpenCode 上可以做**实时 JSONL** 流，在 Cursor 上最多只能做**事后 scraper**。这是平台能力的天花板差异，不是 Trellis 的问题。
