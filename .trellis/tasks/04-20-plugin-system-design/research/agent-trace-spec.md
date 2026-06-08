# Cursor Agent Trace 规范深度分析

**Source**: https://github.com/cursor/agent-trace
**版本**: 0.1.0 (RFC) — 2026-01 发布
**License**: CC BY 4.0

## 一句话定位

**数据规范，不是产品**。只定义"AI 代码归属怎么记"，不定义存储 / UI / 评估。

README 原话：*"Agent Trace is a data specification, not a product. It defines how to record attribution data. Storage mechanisms are implementation-defined."*

## Goals / Non-Goals

**Goals**：
1. Interoperability — 任何合规工具互读互写
2. Granularity — 文件级 / 行级归属
3. Extensibility — 厂商可加 metadata 不破坏兼容性
4. Human & Agent Readable — 无需特殊工具即可读

**Non-Goals**（明确排除）：
- 代码法律所有权 / 版权
- Training data provenance
- AI 贡献的质量评估
- UI 约束

## Core Schema（完整）

```
TraceRecord {
  version: string,        // semver, e.g. "0.1.0"
  id: uuid,
  timestamp: RFC3339,
  vcs?: { type: "git"|"jj"|"hg"|"svn", revision },
  tool?: { name, version? },
  files: [File],          // 必填
  metadata?: {}           // 反向域名命名空间，如 "dev.cursor.*"
}

File {
  path: string,           // 相对 repo 根
  conversations: [Conversation]
}

Conversation {
  url?: string,           // 对话引用
  contributor?: Contributor,
  ranges: [Range],
  related?: [{type, url}]
}

Range {
  start_line: int ≥1,     // 1-indexed
  end_line: int ≥1,
  content_hash?: "alg:hash",   // 位置无关追踪
  contributor?: Contributor    // range 级覆盖（agent handoff 场景）
}

Contributor {
  type: "human" | "ai" | "mixed" | "unknown",
  model_id?: string       // models.dev 约定 "provider/model-name"
}
```

**最小合法 TraceRecord**（Appendix A）：

```json
{
  "version": "0.1.0",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-01-25T10:00:00Z",
  "files": [{
    "path": "src/app.ts",
    "conversations": [{
      "contributor": { "type": "ai" },
      "ranges": [{ "start_line": 1, "end_line": 50 }]
    }]
  }]
}
```

**MIME Type**: `application/vnd.agent-trace.record+json`

## Model ID 约定

follows [models.dev](https://models.dev)：`provider/model-name`

示例：
- `anthropic/claude-opus-4-5-20251101`
- `openai/gpt-4o`
- `google/gemini-*`

参考实现的自动归一化逻辑（`reference/trace-store.ts`）：

```ts
const prefixes = {
  "claude-": "anthropic",
  "gpt-":    "openai",
  "o1":      "openai",
  "o3":      "openai",
  "gemini-": "google",
};
// 如果 model 已含 "/" 就直接用；否则按前缀加 provider
```

## Extensibility 机制

1. **Version bump**：major = 破坏性，minor = 加可选字段
2. **Metadata 反向域名**：`dev.cursor.*` / `com.github.copilot.*` 避免 key 冲突
3. **Range 级 contributor 覆盖**：支持 agent handoff 场景（同一 conversation 里不同 range 属于不同 contributor）

## Reference Implementation 关键细节

仓库 `reference/` 目录（TypeScript + Bun）。两个文件：

### `trace-store.ts` — 存储层

**存储路径约定**：`.agent-trace/traces.jsonl`（append-only JSONL，每行一条 TraceRecord）

**Workspace 根目录探测链**（按优先级）：
1. `CURSOR_PROJECT_DIR` 环境变量
2. `CLAUDE_PROJECT_DIR` 环境变量
3. `git rev-parse --show-toplevel`
4. `process.cwd()`

**Tool 自动识别**：
- `CURSOR_VERSION` 存在 → `{name: "cursor", version: $CURSOR_VERSION}`
- `CLAUDE_PROJECT_DIR` 存在 → `{name: "claude-code"}`

**VCS 信息**：`git rev-parse HEAD` 取 commit SHA

**Range 定位算法**（关键）：

```
1. 如果 edit.range 存在（Cursor 直接给）→ 直接用
2. 否则读文件内容，indexOf(new_string) 定位起点
3. 兜底：{start_line: 1, end_line: new_string 行数}
```

### `trace-hook.ts` — Hook 事件接入

**同时支持 Cursor + Claude Code 两个平台的 hook 事件**。

从 stdin 读 JSON，按 `hook_event_name` 分发：

| Hook event | 来源 | 触发时机 | 写入的 file.path |
|---|---|---|---|
| `afterFileEdit` | Cursor | Agent 完成一次文件编辑（非 Tab）| 实际文件路径 |
| `afterTabFileEdit` | Cursor | Tab 补全产生的编辑 | 实际文件路径 |
| `afterShellExecution` | Cursor | Agent 执行 shell 后 | 虚拟 `.shell-history` |
| `sessionStart` / `sessionEnd` | Cursor | 会话开始/结束 | 虚拟 `.sessions` |
| `PostToolUse` | Claude Code | Write/Edit/Bash 工具调用后 | 文件路径 or `.shell-history` |
| `SessionStart` / `SessionEnd` | Claude Code | 会话开始/结束 | 虚拟 `.sessions` |

**对话引用约定**：
- Claude Code：`url: file://<transcript_path>`（本地 transcript 作为对话引用）
- Cursor：`url: https://api.cursor.com/v1/conversations/<id>`（云端鉴权）
- `conversation_id` / `generation_id` / `session_id` 都塞进 `metadata`

**虚拟路径约定**：
- Shell 命令 → `.shell-history`
- Session 事件 → `.sessions`

## 生态（Contributing 名单）

- [Amp](https://ampcode.com)
- [Amplitude](https://x.com/spenserskates/status/2017062645518782474)（承诺在其上构建分析 dashboard）
- [Cline](https://cline.bot)
- [Cloudflare](https://cloudflare.com)
- [Cognition](https://cognition.ai)
- [git-ai](https://github.com/git-ai-project/git-ai)
- [Jules](https://jules.google)（Google）
- **[OpenCode](https://opencode.ai)** — 已承诺支持，但参考实现未覆盖（Trellis 的机会）
- [Tapes](https://tapes.dev)
- [Vercel](https://vercel.com)

## Trellis 可复用的设计

1. **存储位置**：`.agent-trace/traces.jsonl` —— 跟社区一致
2. **Workspace 探测链**：环境变量 → git → cwd
3. **Model ID 归一化表**：直接复用 prefix 映射
4. **虚拟路径约定**：`.shell-history` / `.sessions`
5. **Hook 事件 → TraceRecord 映射**：Claude Code PostToolUse/SessionStart/SessionEnd 有现成实现

## 关键限制（重要）

**Agent Trace 本身 NOT 存对话内容**：
- 只存 `url` 指向对话
- 云端 URL 需鉴权（Cursor `api.cursor.com` 不可公开访问）
- 本地 transcript 可能被 rotated

所以 CEO 想要的"完整对话录像"**单靠 Agent Trace 不够**，需要配套 transcript 持久化层：
- Claude Code：transcript 原生存 `~/.claude/projects/<id>/*.jsonl` → 复制到 `.trellis/trace/transcripts/`
- OpenCode：plugin 主动 dump 对话

## FAQ 要点（README Appendix C）

> **How should I store the traces?**
> This spec intentionally does not define how traces are stored. This could be local files, git notes, a database, or anything else.

> **How should I handle rebases or merge commits?**
> We expect to see different implementations in open source. This may influence the spec in the future. We are open to feedback.

> **What happens when agents create scripts to write code?**
> Left to implementation. Code generated this way should still be attributed to the agent. For example, snapshot files before and after, then use git diff.
