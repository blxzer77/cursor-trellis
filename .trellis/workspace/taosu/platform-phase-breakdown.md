# Trellis 各平台 × 各 Phase 行为分解

（基于当前 v0.5.0-beta.12 template，post init-context-removal 改动）

---

## 两个正交分类维度

### 维度 1：能不能 spawn sub-agent

| 组 | 平台 | 主线程行为 |
|---|---|---|
| Agent-capable (10) | Claude Code, Cursor, OpenCode, Codex, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid | dispatch sub-agent 干重活 |
| Agent-less (3) | Kilo, Antigravity, Windsurf | 主线程自己干，用 skill 加载 spec |

### 维度 2：sub-agent 怎么拿到 context（仅 agent-capable 内部再分）

| 类 | 平台 | 注入方式 |
|---|---|---|
| Class-1 Hook-inject (6) | Claude, Cursor, OpenCode, Kiro, CodeBuddy, Droid | 主线程 hook 在 sub-agent spawn 前改它的 prompt |
| Class-2 Pull-based (4) | Codex, Copilot, Gemini, Qoder | sub-agent 定义里有 prelude："你自己去 Read jsonl" |

workflow.md 大多数地方按维度 1 分支（[10 platforms] vs [Kilo, Antigravity, Windsurf]）。
Phase 2.1 额外把 Codex 和 Kiro 单拎出来，因为文案细节不同。

---

## Phase 1（Plan）

| Step | Agent-capable (10) | Agent-less (3) |
|---|---|---|
| 1.0 Create task | `task.py create` + `task.py start` | 同 |
| 1.1 Requirements | load `trellis-brainstorm`，写 prd.md | 同 |
| 1.2 Research | spawn `trellis-research` sub-agent，产出写到 `{task}/research/*.md` | 主线程自己 research，同样写到 `research/*.md` |
| 1.3 Configure context | curate `implement.jsonl` + `check.jsonl`：填入 spec + research 文件，禁放代码路径 | Skip this step（context 在 Phase 2 由 `trellis-before-dev` 加载） |
| 1.4 Completion | prd.md + user 确认 + jsonl 有 curated 条目（seed 行不算） | prd.md + user 确认 |

Phase 1.3 是这次改动最大的地方：以前是 `task.py init-context` 机械推导，现在是 agent 自己填。

---

## Phase 2（Execute）

### 2.1 Implement

workflow.md 里分 4 个文案分支，但本质只有 2 种行为：

| 平台组 | 指令 | 实际机制 |
|---|---|---|
| Claude, Cursor, OpenCode, CodeBuddy, Droid (Class-1 主体) | Spawn `trellis-implement`；hook auto-handles | 主线程的 PreToolUse hook 拦截 Task 调用，把 `implement.jsonl` 引用的 spec 内容拼进 sub-agent prompt |
| Kiro (Class-1，文案单拎出) | Spawn `trellis-implement`；"platform prelude auto-handles" | 用 `agentSpawn` hook 做同样的事 |
| Gemini, Qoder, Copilot (Class-2 的 3 个) | Spawn `trellis-implement`；"plugin auto-handles" | sub-agent 定义里的 prelude 要求它第一轮自己 Read 那些文件 |
| Codex (Class-2，文案单拎出) | Spawn `trellis-implement`；"Codex sub-agent definition auto-handles：reads .current-task, prd.md, info.md, implement.jsonl" | 同 Class-2，但 prelude 显式多读几个文件 |
| Kilo, Antigravity, Windsurf (agent-less) | 5 步手工流程：1) load `trellis-before-dev` skill 2) read prd.md 3) read research 4) write code 5) run lint + typecheck | 全在主线程 |

关键：agent-less 组是**唯一**提到 `trellis-before-dev` 的地方。
Skill Routing 表也是这么切的 —— agent-capable 组的表里根本没有 `trellis-before-dev` 这一行（这次改动的 Item 7）。

### 2.2 Quality check

| 平台 | 指令 |
|---|---|
| Agent-capable (10) | Spawn `trellis-check` sub-agent → review + auto-fix + lint/typecheck |
| Agent-less (3) | load `trellis-check` skill 自己走一遍 |

### 2.3 Rollback（所有平台一样）

- 发现 prd 有洞 → 回 Phase 1 改 prd → 重做 2.1
- 实现跑偏 → revert → 重做 2.1
- 需要更多 research → 走 Phase 1.2，把发现写进 research/

---

## Phase 3（Finish）—— 所有平台一样，没有 platform 分支

| Step | 行为 |
|---|---|
| 3.1 Quality verification | load `trellis-check`，最终过一遍 spec/lint/type/cross-layer |
| 3.2 Debug retrospective `[on demand]` | 反复 debug 同一个 bug 才做 —— load `trellis-break-loop` |
| 3.3 Spec update `[required]` | load `trellis-update-spec`，沉淀到 `.trellis/spec/` |
| 3.4 Wrap-up | 提醒用户跑 `/finish-work`（archive + record session） |

Phase 3 没 platform 分支的原因：这几步都是"主线程对着已有代码做判断"，跟 sub-agent 能力无关。

---

## Skill Routing 表（Phase 无关，载入时即可看到）

### Agent-capable 10 个平台

| User intent | Route |
|---|---|
| 需求模糊 | `trellis-brainstorm` |
| 要写代码 | Dispatch `trellis-implement` sub-agent per Phase 2.1 |
| 要验证 | Dispatch `trellis-check` sub-agent per Phase 2.2 |
| 循环撞同一个 bug | `trellis-break-loop` |
| 更新 spec | `trellis-update-spec` |

没有 `trellis-before-dev` —— 因为写代码的是 sub-agent，不是主线程。

### Agent-less 3 个平台（Kilo, Antigravity, Windsurf）

| User intent | Skill |
|---|---|
| 需求模糊 | `trellis-brainstorm` |
| 要写代码 | `trellis-before-dev`（然后主线程直接动手） |
| 要验证 | `trellis-check` |
| 循环撞同一个 bug | `trellis-break-loop` |
| 更新 spec | `trellis-update-spec` |

---

## 从用户角度看实际差异

**Agent-capable 组（10 个）** 几乎看不到差异：每个 phase 都是"用户说要 X → 主 agent dispatch sub-agent X → sub-agent 干完"。主线程像项目经理，sub-agent 像实际执行者。

**Agent-less 组（3 个）** 所有步骤在主线程完成。skill 比 sub-agent 轻量 —— 加载 skill = 读一个 SKILL.md，然后主线程按上面的指令继续干。没有 context 切换。

**两组都一样**的地方：
- Phase 1.0 / 1.1 / 1.4
- Phase 2.3
- 整个 Phase 3

---

## 仍然遗留的小不一致

看 workflow.md 会注意到：

1. Phase 2.1 为 Codex 和 Kiro 单独开了两个 block
   - 它们本来可以合并进 8-platform block
   - 是 code 历史原因，不影响行为

2. Codex 的 block 多写了 "reads `.current-task` + `info.md`"，别的 Class-2 没提
   - 只是文档详细度的差异
   - 实现上别的 Class-2 的 prelude 也默认读 `.current-task`

这些不是 bug，但下次整理文档可以合并简化。

---

## 本次 init-context-removal 改动的影响范围（总结）

| 层 | 改了什么 |
|---|---|
| **脚本** | 删 `task.py init-context`；`task.py create` 在 sub-agent 平台上 seed 两个 jsonl |
| **workflow.md Phase 1.3** | 从"跑脚本"→"告诉 AI 自己填 jsonl"（位置、格式、spec+research、禁止代码） |
| **workflow.md Skill Routing** | 按平台分两组：agent-capable 去掉 `trellis-before-dev`，agent-less 保留 |
| **Hook / Prelude** | 加 seed 行跳过 + stderr warning；session-start READY 检测从"文件存在"改成"有 curated 条目" |
| **Class-2 prelude** | fallback wording："如果 jsonl 只有 seed，读 prd.md 自判断 spec" |
| **Spec** | platform-integration.md 加两小节：`_SUBAGENT_CONFIG_DIRS` 注册表、Agent-Curated JSONL Contract（含 Wrong vs Correct） |

影响的 platform 范围：10 个 agent-capable 全部；3 个 agent-less 不受影响（它们 Phase 1.3 本来就 skip）。
