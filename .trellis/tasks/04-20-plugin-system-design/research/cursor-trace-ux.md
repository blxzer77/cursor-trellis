# Research: Cursor 产品级 Trace 体验（UX 视角）

- **Query**: Cursor 用户在 UI 里实际看到/用到的"trace"（checkpoint、background agent 日志、history、diff、blame、bugbot）
- **Scope**: 外部调研（官方 docs / changelog / 博客 / 论坛 / 第三方文章）
- **Date**: 2026-04-20
- **Edition basis**: Cursor 1.x（2025 中）→ 2.0（2025-10-29）→ 2.1（2025-11）→ 2.2（2025-12-10）→ 3.0（2026-04-02）→ 3.1（2026-04-13）

> 注意：本调研**刻意不重复** Agent Trace RFC schema（另有文档）和 `state.vscdb` 底层（另有文档）。本篇只覆盖用户能摸到的 UX 面。

---

## 1. Checkpoint & Restore（Composer / Agent mode）

### 1.1 已有的产品行为
- **自动创建**：Agent 每次"做出显著改动"（write_file / apply_patch 前）自动创建一次 checkpoint，记录所有将被修改文件的 before 状态。不是"每个 tool call 都 checkpoint"，是粗粒度的。  
  — 来源：[Cursor Docs · Checkpoints](https://cursor.com/docs/agent/chat/checkpoints)
- **UI 入口**：
  1. 聊天时间线里每条 agent response 旁有 **"Restore Checkpoint"** 按钮
  2. 每条用户消息的"+"hover 按钮 → 可恢复到发送该消息之前的状态
  3. 直接点 chat timeline 的 checkpoint entry → 先 preview、再 restore
- **Restore 粒度**：整个工作区回滚，不是单文件选择性 restore（论坛有用户抱怨）
- **与 Chat 的关系**：restore 代码但**保留对话上下文**（可以 restore 后继续追加 prompt），这是 checkpoint vs git 的核心 UX 区别。
- **存储位置**：本地，独立于 git。官方明确："stored locally and separate from Git"。

### 1.2 已知局限（Cursor 自己承认 + 论坛反复提）
| 局限 | 影响 |
|---|---|
| 不跨 IDE 重启持久化 | 关了 Cursor 就没了（developertoolkit.ai 2026-04 明确写） |
| 不捕获 terminal 副作用 | Agent 跑了 `pnpm migrate`？restore 不 undo DB |
| 不跨云端同步 | 多设备/多机器切换会丢 |
| 只能在消息边界恢复，不能在某个 tool call 中间恢复 | forum.cursor.com/t/68887（2025-03 至今未实现） |
| 新建文件后手动修改，restore 会覆盖手动改动 | 论坛多次投诉 |

### 1.3 用户请求但未实现
- "checkpoint 关键点命名"（手动 pin 一个 checkpoint）  
- "跨 session restore"（重启后依然能恢复）  
- "部分文件 restore"（目前只能全部）  
- "restore 到任意 tool call"

来源：
- https://forum.cursor.com/t/feature-improvements-restore-checkpoint-and-copy-paste/134487
- https://forum.cursor.com/t/allow-restoring-a-checkpoint-at-any-point-during-agent-based-code-updates/68887

---

## 2. Background/Cloud Agent 的执行 trace 视图

### 2.1 命名演进
- 1.0（2025-06）叫 **Background Agents**（cloud 上执行）
- 2.0（2025-10-29）**rebrand 为 Cloud Agents**
- 3.0（2026-04-02）整合进 **Agents Window**

### 2.2 UI 所能看到的 trace
| 层级 | 能看到什么 |
|---|---|
| **Sidebar（Cmd/Ctrl+E）** | 所有活跃 agent 的列表 + 高阶状态（"analyzing"、"editing"、"done"） |
| **单 agent 详情** | todo list（prompt 分解出的步骤）、进度指示、最终 diff |
| **实时观察** | cloud agent 支持"peek into remote machine"（1.4，2025-08-06 加入） |
| **Demo 截图** | 3.0 起 cloud agent 完成后自动产出"demo 截图"（为前端任务截 UI 截图）供 verify |
| **handoff** | cloud → local 的 agent session 可以一键切换，继续本地 edit + test |
| **Demo 视频** | 3.0 的 Design Mode：cloud agent 可在 headless browser 里操作，流程截为 video |

来源：
- [Cursor 1.4 changelog](https://cursor.com/en/changelog/1-4)
- [Cursor 2.0 changelog](https://cursor.com/changelog/2-0) · Cloud Agents rename
- [Cursor 3.0 blog](https://cursor.com/en/blog/cursor-3)

### 2.3 明确不可见的部分（用户痛点）
> "There's no easy way to see detailed logs of what agents are thinking. The sidebar shows high-level status but not the reasoning. If an agent makes weird changes, you have to reverse-engineer its logic from the commits."  
> — [toolstac.com: Cursor Background Agents & Bugbot Troubleshooting](https://toolstac.com/tool/cursor/agents-troubleshooting)（2025-08）

即：
- **没有"完整 tool-call 日志导出"视图**
- **看不到 LLM 的 thinking tokens**（用户在论坛反复 request）
- **失败时没有 stderr/stdout 归档**（只能看提交）

### 2.4 第三方补位实现
- **Trigger.dev 的 Cursor Background Agent 示例**：调 Cursor headless CLI（`cursor-agent`）以子进程跑，**把 stdout NDJSON 流**（system / assistant / tool_call / result 事件）实时 pipe 到前端，做出一个类似 terminal UI 的 trace viewer。这才是"完整执行 trace"的用户体验，但 Cursor 官方客户端没做。  
  — [trigger.dev docs](https://trigger.dev/docs/guides/example-projects/cursor-background-agent)

### 2.5 Automations（2026-03）
Cursor Automations 让 agent 按 cron / event 触发（文件保存、git commit、PR 打开、test 失败）。每次触发 → 独立 sandbox → 产出 diff 供 review。**每个 run 都有独立 dashboard 条目**，但依然不暴露完整 reasoning trace。
  — [digitalapplied.com · Cursor Automations guide](https://www.digitalapplied.com/blog/cursor-automations-always-on-agentic-coding-agents-guide)

---

## 3. Chat History / Conversation Timeline UX

### 3.1 入口和界面
| 入口 | 行为 |
|---|---|
| Composer 右侧"历史"icon | 列出当前 workspace 的 past composers + chats，可 rename / delete / reopen |
| `Cmd+Alt+L` / `Ctrl+Alt+L` | 当 Composer 聚焦时快速打开历史面板 |
| Command Palette → "Chat: Show History" | 部分版本可用 |
| `Cmd+Shift+I` / `Ctrl+Shift+I` | 打开 Chat 面板 |
| **Cursor 2.2 Pinned chats** | agent sidebar 里可以置顶 chats，方便常用对话快速访问 |
| **Cursor 3.0 at-mention 搜索历史** | 输入 `@` 时，past chat transcripts 会出现在建议列表里（可以引用旧对话作为 context） |

### 3.2 搜索
- **Cursor 2.1（2025-11）** 加入"Instant Grep"但**对 chat 本身没有官方全文搜索**。
- 社区需求很高：forum.cursor.com/t/109297 "Quick overview of past conversations"（2025-06）到 2026-04 依然未实现。
- **第三方解决**：
  - `cursor-chat-browser`（Next.js web app，扒 state.vscdb）— 全文搜索 chat/composer logs
  - `cursor-history`（npm 包）+ `cursor-history-mcp`（MCP server）— 用 MCP 让 Claude / 其他 assistant 查你的 Cursor 历史
  - SpecStory 插件 — 自动把每次 chat 导出到 `.specstory/` 文件夹

### 3.3 多设备同步
- **原生：无**。官方客服在 2025-12 论坛明确表态：chat history 是本地的，is one of the most requested features，团队"在考虑"。
- **Workaround**：把 `~/Library/Application Support/Cursor/User/workspaceStorage` 放 Dropbox/iCloud 做 symlink
- **第三方**：`cursaves`（CLI）— push chat 到 private git repo，pull 到另一台机器；匹配机制是 git remote URL 而不是本地路径（这是关键设计）。  
  — [DEV Community · cursaves](https://dev.to/callum_5c4104e61f9bc/i-built-a-cli-to-sync-cursor-chat-history-between-machines-2cnf)（2026-03-04）

### 3.4 导出单个 chat
- Chat header 右上角三点菜单 → **Export Chat** → 生成 `.md` 文件（含代码块 + 对话，**不含 thinking tokens，不含 images**）
- 用户反复要求"导出 thinking + tool_calls"（2025-07 forum.cursor.com/t/118837），未实现

---

## 4. Replay / Diff / Session-level 审计

### 4.1 Session-level diff
- **Cursor 3.0** 的 Agents Window 提供"unified diff view"——一个 agent 所有改动聚合展示
- 多个 agent 并行时，diff **按 agent 颜色编码**（2026-04 antigravitylab 文章，Cursor 官方未明示但实测可见）
- 可以直接 **stage / commit / 管理 PR**，无需离开 Agents Window

### 4.2 Time-travel / Replay
- **没有**真正的 time-travel debugger（不能回到某个 tool call 时间点看 agent 当时看到什么 context）
- Checkpoint 是 file-state time travel，**不是 agent-state time travel**
- Debug Mode（2.2，2025-12-10）有"runtime logs 回看"，但那是**被调试应用**的 log，不是 agent 自己的 trace

### 4.3 Git 自动化
- Cursor **不会**为每轮对话自动 commit
- 但提供：
  - **Commit message 生成**（sparkle icon，基于 diff + repo history）
  - **`Made with Cursor` commit trailer**（默认开，Settings → Agent → Attribution 关，Enterprise admin 可全局强制关）
  - **`/pr` 自定义命令**（commit + push + PR 一气呵成）
  - **Agent 可以用 `gh` CLI 开 PR**
- **社区 best practice**：先手动 `git commit` 做 baseline → 再让 Agent 跑 → checkpoint 做细粒度 undo → git 做 coarse undo。  
  — [developertoolkit.ai · Checkpoints and Branching](https://developertoolkit.ai/en/cursor-ide/advanced-techniques/checkpoints-branching/)

---

## 5. Bugbot / Debug Mode 的 trace 基础

### 5.1 Bugbot（代码审查 agent）
- 工作面：GitHub PR comments（不是 IDE 内）
- **可见的 trace**：
  - 每条 comment 附带"explanation"和 fix suggestion
  - "Fix in Cursor" / "Fix in Web" 链接 → 跳回 IDE / cursor.com/agents
- **Autofix（2026-02-26）**：bugbot 发现 bug → **自动 spawn cloud agent** → cloud agent 在隔离 VM 里跑 test + propose fix → PR 上 post comment 带 preview diff
- **Trace 范围**：用户看到的是"agent run 日志链接 + 产出的 patch"，内部 tool call 序列没有开放
- 35% 的 autofix 直接被合入 base PR（Cursor 官方数据）

### 5.2 Debug Mode（2.2，2025-12-10）
- **新 agent loop，专门针对"难复现 bug"**
- 用户视角的 trace：
  1. Agent 生成多个假设（显示在 chat）
  2. Agent 往代码里插 log statements（用户能看到这些 log 改动）
  3. Agent 要求用户"再重现一次 bug"
  4. local debug server（Cursor extension 跑）接收 runtime log
  5. Agent 回读 log，定位 root cause
  6. Agent 写 fix + **清掉所有插桩的 log**
- 每一步在 chat timeline 都是可见的一条 entry
- 快捷键：`Shift+Tab` 切换 modes
- **这是目前 Cursor 里最接近"可视化 trace"的产品体验**

### 5.3 Plan Mode（2.2 改进）
- Agent 生成 plan 时**实时 stream Mermaid diagram**（Cursor 2.2 新加）
- Plan 保存为磁盘上的文件（不是只在 DB 里），**可以被普通编辑工具 edit**，可以被其他 agent re-read
- Plans 也会包含在 shared chats 里（3.0）

### 5.4 Multi-Agent Judging（2.2）
- `/best-of-n` 并行跑多个 model，**自动 judge 所有 run 并推荐**
- 选中的 agent 会带注释说明"为什么选它"——这是 trace 的一种产品形态：**不是 low-level log，是 high-level 决策解释**

---

## 6. 和 Agent Trace RFC 的关系（UI 层）

### 6.1 Cursor 客户端默认写 `.agent-trace/traces.jsonl` 吗？
**没有公开证据说它默认写。** RFC repo [cursor/agent-trace](https://github.com/cursor/agent-trace) 是开放规范（2026-01-27 推出），Cursor 客户端是否是第一批 writer、把 trace 文件写到哪里 —— 官方文档未明示，changelog 也没提。

> 推测：Cursor 的"Cursor Blame"功能（见下）是 trace 的**消费端 UX**，但数据来源可能是 Cursor 自己的私有格式 + 可选输出到 agent-trace 格式。需要实际跑一下才能确认。

### 6.2 Cursor Blame —— 唯一真正面向用户的"trace 可视化"
- 文档：https://cursor.com/docs/integrations/git
- 原话："Cursor Blame tracks which code was written by AI and which was written by humans. It annotates your git history so you can see at a glance whether a line was AI-generated."
- UX：在 editor 侧边栏 annotate 每一行 —— 类似 VS Code GitLens 的 inline blame，但**多了一个 AI/human 标记维度**
- 这是 Cursor 真正把"trace"变成每天可用产品的那个功能

### 6.3 第三方竞品
- **Origin CLI**（`getorigin.io`，2026-03 Show HN）：对标 Cursor Blame 但跨平台。hooks 进 Claude Code / Cursor / Gemini / Codex；`origin blame <file>` 显示每行是 `[AI]` 还是 `[HU]`；数据存 git notes，无 server。
- 说明市场对"AI 归属 blame"的需求已被验证，Cursor 不是孤例。

---

## 7. 版本演进时间线（2025-2026，只挑 trace 相关）

| 版本 | 日期 | Trace / History 相关 |
|---|---|---|
| 1.0 | 2025-06 | Background Agents 首发（cloud）、Bugbot 首发 |
| 1.4 | 2025-08-06 | Sidebar for all Agents（foreground + background 统一）、Compact mode、Agent sidebar peek into remote machine、Chat 里显示 usage 统计 |
| 1.7 | 2025-09 | Browser for Agent beta |
| 2.0 | 2025-10-29 | **Multi-Agents sidebar**、Agent plans 作为一等公民、Background→Cloud rename、Browser GA |
| 2.1 | 2025-11-21 | AI Code Reviews、Instant Grep（**不含** chat 全文搜索） |
| 2.2 | 2025-12-10 | **Debug Mode**（trace 最鲜明的一代）、Plan Mode Mermaid 实时流、Multi-Agent Judging、**Pinned chats**、Plans 落盘成可 edit 文件 |
| Agent Trace RFC | 2026-01-27 | 开放 spec 发布（github.com/cursor/agent-trace） |
| Bugbot Autofix | 2026-02-26 | 自动 spawn cloud agent 修 PR bug，35% 合入率 |
| Computer-use | 2026-02-24 | Agents 能控制自己的电脑 |
| Cursor Automations | 2026-03 | cron + event 触发 agent，每次 run 独立 sandbox/diff |
| Self-hosted cloud agents | 2026-03-25 | 代码 + tool execution 全留内网 |
| **3.0** | **2026-04-02** | **Agents Window**（多 agent 并行 UI）、**Design Mode**（browser 标注 → agent）、Agent Tabs（多 chat 并排）、unified diff、**past chat 在 @ 搜索里出现**、plans in shared chats |
| 3.1 | 2026-04-13 | Canvases（side panel 持久 artifact）、Search in Files filters、Agents Window 打磨 |

来源：
- [Cursor Changelog 主页](https://cursor.com/changelog)
- [Developer Toolkit · Version History](https://developertoolkit.ai/en/cursor-ide/version-management/changelog/)

---

## 8. Trace 维度矩阵（总览）

| 维度 | Cursor 做了 | Cursor 没做 / 第三方补位 |
|---|---|---|
| 每轮对话 file-level checkpoint | ✅ 自动 | ❌ 不跨重启、不跨设备 |
| 每轮对话跨会话持久 chat | ✅ 本地 SQLite | ❌ cross-device sync（cursaves、cursor-history 补位） |
| Chat 全文搜索 | ❌ | cursor-chat-browser、SpecStory 补位 |
| Tool-call 完整序列可视化 | ❌（仅 sidebar 高阶状态） | trigger.dev 示例、Debug Mode 部分实现 |
| Thinking tokens 导出 | ❌ | — |
| Session 聚合 diff | ✅（3.0 Agents Window） | — |
| Session 聚合 "哪些文件被改过" | ✅ | — |
| Time-travel 到某个 tool call | ❌ | — |
| Auto-commit per turn | ❌ | 用户通过 `/pr` 命令自定义 |
| AI/human 每行 blame | ✅ Cursor Blame | Origin CLI 补位跨平台 |
| Share chat 给外部 | ✅ `cursor.com/s/<id>` public/team 链接、Fork to Cursor | — |
| Plan 作为文件 | ✅ 2.2 起 | — |
| Pinned chats | ✅ 2.2 起 | — |
| At-mention 搜索历史 chat | ✅ 3.0 起 | — |
| Agent 执行实时日志视图 | 部分（sidebar + todo） | Debug Mode、trigger.dev 示例补位 |

---

## 9. 给 CEO 的汇报话术

### 9.1 一句话定位 Cursor 的 trace 体验
> **Cursor 把 "trace" 切成了 6 块产品维度：回滚（checkpoint）、历史（chat history）、归属（Blame）、审查（Bugbot/Review）、可观测（Agents sidebar / Debug Mode）、分享（shared transcripts）。这 6 块是独立演进的，不是一个统一的 "trace" 功能——这是 Trellis 可以差异化的关键。**

### 9.2 拆解 —— 每一块的成熟度
| 产品维度 | Cursor 成熟度 | Trellis 参考价值 |
|---|---|---|
| ① 回滚 Checkpoint | 高（自动、集成 chat timeline），但不跨 session、不跨设备 | **高** —— 已验证用户心智 |
| ② Chat History 本地 | 高（SQLite + sidebar），但缺全文搜索、缺同步 | **中** —— 用户痛点清晰 |
| ③ AI/human Blame | 中（Cursor Blame 新、Origin CLI 抢跑） | **高** —— 核心审计能力 |
| ④ Bugbot Review | 高（35% autofix 合入率），强绑定 GitHub | **低** —— 超出当前 scope，先跳过 |
| ⑤ Agents Sidebar 可观测 | 中（看得到高阶状态，看不到 reasoning） | **高** —— 这是 Cursor 自己的痛点，Trellis 有机会做更好 |
| ⑥ Shared Transcripts | 中（public/team 链接 + Fork to Cursor） | **中** —— 依赖用户规模，先不急 |

### 9.3 Trellis 的优先级建议

**优先做（P0）**：
1. **完整 tool-call trace 可视化**（Cursor 的明确短板，toolstac.com 等用户反复吐槽）—— 把每轮对话的 read/edit/shell 全流程做成可视化 timeline，带 input/output 快照。
2. **Cross-session 持久 + 全文搜索 chat**（Cursor 两年未解决的痛点，cursor-chat-browser / cursaves 等第三方工具就是证据）。
3. **Session-level 聚合 diff + "哪些文件被改过"视图**（Cursor 3.0 刚做，体验是对的，可借鉴）。

**次优先（P1）**：
4. **Checkpoint 但做得更好**：命名、跨 session 持久、部分文件 restore —— 都是 Cursor forum 2 年未实现的用户请求。
5. **AI/human 每行 blame**（Agent Trace RFC 已经给了 schema，Trellis 是 spec-driven 工具，天然适合）。

**跳过（P2 / 不做）**：
6. **不做 Bugbot-like PR review**（太重，需要 GitHub 深度绑定 + cloud infra）。
7. **不做 shared transcript 公共链接**（需要公有服务，和 Trellis 的 local-first 定位相悖）。
8. **不做 computer-use / browser automation**（Cursor 刚开始做，非 trace 核心）。

### 9.4 一句话差异化口径
> "Cursor 的 trace 是**给用户做 undo 和 review** 的；Trellis 的 trace 应当**给用户做 spec 沉淀和 agent 工作流回放** —— 同一份 trace 数据，Cursor 用它做 blame，Trellis 用它做 spec 提炼。这是 '为什么 Trellis 不是 Cursor 的 me-too'。"

---

## 10. 关键引用链接（可直接贴给 CEO 看截图）

- Cursor Docs · Checkpoints — https://cursor.com/docs/agent/chat/checkpoints
- Cursor Docs · Shared Transcripts — https://cursor.com/docs/shared-transcripts
- Cursor Docs · Git (Cursor Blame) — https://cursor.com/docs/integrations/git
- Cursor Docs · Bugbot — https://cursor.com/docs/bugbot
- Cursor Docs · Debug Mode — https://cursor.com/docs/agent/debug-mode
- Cursor 3.0 blog — https://cursor.com/en/blog/cursor-3
- Cursor 2.2 changelog — https://cursor.com/changelog/2-2
- Cursor 2.0 changelog — https://cursor.com/changelog/2-0
- Cursor 1.4 changelog — https://cursor.com/en/changelog/1-4
- Bugbot Autofix blog — https://cursor.com/blog/bugbot-autofix
- Debug Mode blog — https://cursor.com/blog/debug-mode
- Agent Trace RFC — https://github.com/cursor/agent-trace
- Cursor 3 Agents Window 论坛讨论（带截图） — https://forum.cursor.com/t/cursor-3-agents-window/156509
- cursaves CLI（第三方 sync） — https://dev.to/callum_5c4104e61f9bc/i-built-a-cli-to-sync-cursor-chat-history-between-machines-2cnf
- cursor-chat-browser（第三方浏览器） — https://github.com/thomas-pedersen/cursor-chat-browser
- trigger.dev Cursor Background Agent 示例（NDJSON 实时 trace UI） — https://trigger.dev/docs/guides/example-projects/cursor-background-agent
- Origin CLI（对标 Cursor Blame） — https://news.ycombinator.com/item?id=47510254
- toolstac.com · Background Agent troubleshooting（"agent logs are hidden"痛点） — https://toolstac.com/tool/cursor/agents-troubleshooting

---

## Caveats / Not Found

- **没有找到** Cursor 官方声明 "客户端默认写 .agent-trace/traces.jsonl" 的明确证据 —— Agent Trace RFC 存在，但 writer 实现细节需要实际在本地跑 Cursor 才能确认
- **没有找到** Cursor Blame 的具体 UX 截图 / 演示视频（文档只是文字描述）
- **没有找到** Cursor 3.0 Agents Window 的 trace export 功能（截至 3.1 changelog）
- **没有找到** Debug Mode 产生的 runtime log 是否被保存为可查看的文件 —— 只知道"agent 会在结束后清掉"
- 中国用户视角：Cursor 的 shared transcript `cursor.com/s/...` 页面在国内访问可能不稳定 —— 未本次调研范围内
