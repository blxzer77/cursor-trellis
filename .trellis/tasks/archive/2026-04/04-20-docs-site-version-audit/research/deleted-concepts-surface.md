# 已删除概念的 docs 残留全扫描

截图来源：localhost:3000/zh/guide/ch11-custom-hooks（红框："Dispatch Agent 不需要读 spec"）

## 0.5.0-beta.0 删除的概念

| 概念 | 删除原因 | changelog 出处 |
|---|---|---|
| **Dispatch Agent** | Multi-Agent Pipeline 整块删除时被带走 | `changelog/v0.5.0-beta.0.mdx` "dispatch / debug / plan agents (replaced by skill routing)" |
| **Plan Agent** | 同上 | 同上 |
| **Debug Agent** | 同上 | 同上 |
| **Ralph Loop** | 质量循环改为 check agent 内部循环 | `changelog/v0.5.0-beta.0.mdx` "Ralph Loop removed (check agent has its own internal loop now)" |
| **`current_phase` 字段** | task.json schema 简化 | `changelog/v0.5.0-beta.0.mdx` "task.py create stops writing legacy current_phase / next_action" |
| **Multi-Agent Pipeline / worktree.yaml** | 整个功能移除 | `changelog/v0.5.0-beta.0.mdx` "Multi-Agent Pipeline scaffolding removed" |
| **.ralph-state.json 文件** | Ralph Loop 删除的副产品 | 同上 |

## docs 残留扫描

### Dispatch Agent（10 处文件）

**EN + ZH（全镜像）**：
- `guide/ch02-quick-start.mdx` L375 — 目录树例子里 `dispatch.md`
- `guide/ch04-architecture.mdx` L315, L333 — 架构讲解 + timeout 配置
- `guide/ch05-commands.mdx` L83 — `/parallel` 说明里描述 Dispatch 的职责
- `guide/ch11-custom-hooks.mdx` L99 — inject-subagent-context.py 里 "Dispatch 不读 spec"（**截图里的那处红框**）
- `guide/appendix-a.mdx` L37 — 关键路径速查表里 `dispatch.md`

### Plan Agent（12 处文件）

**EN + ZH**：
- `guide/ch01-what-is-trellis.mdx` — 卖点 "Plan Agent rejects oversized requirements"
- `guide/ch02-quick-start.mdx` — 平台对比表 "Plan Agent"
- `guide/ch04-architecture.mdx` — 架构图 + agent 介绍
- `guide/ch05-commands.mdx` — 命令说明里引用 Plan
- `guide/ch06-task-management.mdx` — phase 流程里
- `guide/appendix-a.mdx` — 关键路径速查 `plan.md`

### Debug Agent（8 处文件）

**EN + ZH + blog**：
- `guide/ch02-quick-start.mdx`
- `guide/ch04-architecture.mdx`
- `guide/appendix-a.mdx`
- `blog/use-k8s-to-know-trellis.mdx` — 技术 blog 里也提了

### Ralph Loop（24 处文件，最广泛）

**EN + ZH + blog**：
- `guide/ch01-what-is-trellis.mdx` L19, L33 — 核心卖点
- `guide/ch02-quick-start.mdx` — Platform Capability Comparison 表
- `guide/ch03-first-task.mdx` — 示例 phase 里
- `guide/ch04-architecture.mdx` L216-323 — **整节 4.4 "Quality Control Loop (Ralph Loop)"**，还解释了 Ralph Wiggum technique
- `guide/ch05-commands.mdx`
- `guide/ch08-real-world.mdx`
- `guide/ch11-custom-hooks.mdx` — SubagentStop hook 对应 `ralph-loop.py` 示例
- `guide/ch13-multi-platform.mdx` — 平台能力表
- `guide/appendix-a.mdx` — `ralph-loop.py` 关键路径
- `guide/appendix-e.mdx` — **整文件讲 worktree.yaml 里 Ralph Loop 的 verify 字段** → 此文件建议整删
- `guide/appendix-f.mdx` — FAQ
- `blog/use-k8s-to-know-trellis.mdx` — 技术 blog

### current_phase（8 处文件）

- `guide/ch04-architecture.mdx`
- `guide/ch06-task-management.mdx` — task.json schema 示例
- `guide/ch11-custom-hooks.mdx` — inject-subagent-context.py "更新 current_phase"（**截图里功能列表的最后一项**）
- `guide/appendix-c.mdx` — task.json Schema 参考（字段定义）

## 总结：这不是多个局部问题，是一个**系统性错位**

整个 guide 以 **0.3.x/0.4.x 的 "Multi-Agent Pipeline + Ralph Loop + 6 agent" 架构**为默认心智模型讲：
- ch01 拿 Ralph Loop / Plan Agent 当**核心卖点**
- ch04 架构图把 6 个 agent 画成正方形
- ch04 **整个 4.4 小节**专门讲 Ralph Loop 数学
- appendix-e **整文件**讲 worktree.yaml 配置 Ralph Loop

0.5.0-beta.0 的变化（skill-first + 3 agent + 无 Multi-Agent + check 自循环）**没有任何一章同步**。

## 修改策略

每一章改写时**必须带上**以下 global find 清单：

```bash
# 可以机械 grep -l 的 kill-list（但改法要结合上下文）：
"Ralph Loop"                    → 整段重写为 "Check Agent 自循环" 或 "质量门"
"Dispatch Agent"                → 整段删除，或改为 "主 Session / user（如果是讲 orchestrator）"
"Plan Agent"                    → 整段删除（brainstorm skill 取代了"需求拆解"职责）
"Debug Agent"                   → 整段删除（合并到 check agent 的 self-fix）
"current_phase"                 → 字段从 task.json schema 里删
"next_action"                   → 同上
"worktree.yaml"                 → 出现处都可改为 ".trellis/config.yaml"
".ralph-state.json"             → 删除引用
```

### 特别注意

- **`guide/appendix-e.mdx` 整文件建议删**：它是 worktree.yaml 配置参考，随 Multi-Agent Pipeline 一起过期
- **`guide/ch04-architecture.mdx` 4.4 小节整段删**：~100 行讲 Ralph Loop
- **`blog/use-k8s-to-know-trellis.mdx`**：作为 thought-piece 可保留，但末尾加 disclaimer "本文写于 0.4.x 时代，Ralph Loop / Plan Agent 已在 0.5.0-beta.0 移除"

## 归属

此扫描结果覆盖了 P0a（ch01/index）+ P0b（ch02）+ P0c（ch05/13/appendix-b）+ P1a（ch03/04/06/08）+ P1b（ch10/11/12）+ P1c（appendix-a/c）+ P2（appendix-e 整删 / appendix-f / blog）**所有子任务**。改写每一章时都要对照本文件扫残留。
