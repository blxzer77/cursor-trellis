# Trace 重新定位：先给 Memory 留原始材料

> 创建日期：2026-04-23
> 背景：2026-04-22 到 2026-04-23 的讨论里，方向发生了一次明显变化。
>
> 用户原话：
>
> > "我需要的不是被后端观测生态接收，以及核心是记录用户 message 和 ai message，别的其实无关紧要，我们的 trace 更多是偏向构造 memory 的底座"
>
> 这篇笔记不是最终 PRD。它只记录这次方向修正，以及后续改 PRD 时应该删掉什么、保留什么。

---

## 现在的判断

Trace 不应该先按 observability 或 code attribution 设计。

我们现在要的东西更简单：把一次 AI session 里真正有用的对话材料留下来，之后作为 Memory 的输入。第一版只需要可靠拿到 user message 和 assistant message 的时序。工具调用、span、token、trace id、外部 exporter 都可以先放下。

换句话说，Trace 现在更像 Memory 的 raw source，不是一个独立的观测产品。

这也意味着 PRD 里原来那套 OTel / agent-trace / exporter 设计需要重写。那些研究没有白做，但它们暂时不应该决定 MVP。

---

## 原路线哪里不合适

当前 PRD 里的 Trace 章节还是按"对接外部 trace 生态"写的。按照新的目标看，这些内容会把事情做重。

| 原设计 | 现在的问题 |
|---|---|
| 内部数据结构对齐 OpenTelemetry GenAI | Memory 消费的是对话文本，不需要 span 树、token 计量或 trace id 穿链 |
| 支持 agent-trace / opentraces / git-ai / langfuse / OTLP exporter | 这些是对外交换格式。我们现在没有明确消费者 |
| 跨平台统一 conversation transcript schema | 统一 schema 不是第一问题。先让每个平台能稳定导出可读材料 |
| 订阅 PostToolUse / UserPromptSubmit / SessionStart / Stop / SubagentStop | 事件太多，第一版没必要。session 结束后一次性采集就够 |
| OpenCode event firehose | 同上。只为 Memory 留材料时，实时 firehose 不值得引入 |
| commit 时生成 `.agent-trace/traces.jsonl` | 这个 acceptance criteria 应该删除 |

这些研究文件仍然保留，但在新 PRD 里应该标成历史背景，而不是实现依据：

- `research/agent-trace-spec.md`
- `research/agent-trace-ecosystem.md`
- `research/otel-mcp-semconv.md`
- `research/cursor-trace-ux.md`

---

## 配置放在哪里

我倾向把开关放在 `.trellis/.developer`。

这个文件已经存在，是 ini 格式，而且本来就是 per-project、per-machine 的个人配置：

```ini
name=taosu
initialized_at=2026-01-17T16:09:39+08:00
```

它也已经被 gitignore 了：

- 仓库根 `.gitignore` 忽略 `.trellis/.developer`
- `.trellis/.gitignore` 忽略 `.developer`

所以第一版不需要新建配置系统。直接加几个 key 就够：

```ini
name=taosu
initialized_at=2026-01-17T16:09:39+08:00

trace.enabled=true
trace.mode=session
trace.digest.min_turns=5
```

Hook 侧只需要做很朴素的判断：

```python
cfg = parse_ini(".trellis/.developer")
if cfg.get("trace.enabled") != "true":
    return

mode = cfg.get("trace.mode", "session")
```

这样做的好处不是"架构优雅"，而是少引入一层概念。Trace 原始日志本来就是个人材料，不应该进 git，也不应该默认影响团队共享文件。

`trellis plugin trace enable` 可以以后再补。它本质上只是帮用户改 `.developer` 的糖，不应该成为第一版的前置条件。

---

## 存储位置

建议放在 `.trellis/.traces/`：

```text
.trellis/
  .developer
  .traces/
    session-{uuid}.jsonl
    digests/
      2026-04-23-session-xxx.md
  .gitignore
```

同时在 `.trellis/.gitignore` 里加：

```gitignore
.traces/
```

我不建议放到 `.trellis/workspace/{user}/traces/`。`workspace/{user}/` 现在是会进 git 的协作材料，比如 journal 和 plan；trace 则是个人原始日志，里面可能有未清洗的对话、路径、工具输出，语义上不该混在一起。

也不建议默认放进 task 目录。一个 session 可能跨 task，也可能先没有 task，之后才决定哪些内容值得进 Memory。Trace 先按 developer 归档，后续 Memory ingest 再决定是否提升为共享知识。

---

## 第一版：只做 session capture

第一版目标很窄：session 结束时，把原始对话导出到 `.trellis/.traces/`。

```text
AI session 结束
  ↓
Stop / SessionEnd hook 触发
  ↓
读取 .trellis/.developer
  ↓
trace.enabled=true
  ↓
导出当前 session
  ↓
.trellis/.traces/session-{uuid}.jsonl
```

Claude Code 的实现可以直接复制已有 transcript：

```text
~/.claude/projects/<normalized-project-path>/<session_id>.jsonl
  -> .trellis/.traces/session-{uuid}.jsonl
```

OpenCode 需要走自己的 storage 结构或 plugin API，在 session 结束时 dump 出来。它不一定能和 Claude Code 完全同构，这没关系。第一版只要让 Memory 后续能读。

这个方案的成本很低：

- 不调 LLM
- 不做摘要
- 不做跨平台统一 schema
- 不碰外部 trace 标准
- 只需要 hook 里做文件定位、复制和少量清洗

它已经能解决一个实际问题：几个月后可以回头查"当时为什么这么设计"，而不是只能靠 journal 或 commit message 猜。

---

## 第二版：digest，但不要自动进 Memory

如果 session capture 稳定，再考虑 digest。

Digest 的作用是把原始 session 变成更适合 ingest 的 markdown，例如：

```text
.trellis/.traces/
  session-{uuid}.jsonl
  digests/
    2026-04-23-session-{uuid}.md
```

Digest 可以记录：

- 这次讨论做了哪些设计判断
- 哪些旧路线被放弃
- 哪些问题还没决定
- 哪些文件或任务被反复提到

但 digest 不应该自动写进 `.trellis/memory/`。这里需要一个人审闸门。

原因很简单：摘要会失真。Memory 又是会被后续 agent 反复读取的材料。错误一旦进 Memory，就会被后面的任务放大。比较稳的流程是：

```text
raw session
  -> digest
  -> 人确认
  -> promote / ingest 到 memory sources
```

也就是说，Trace 负责留材料，Digest 负责提炼，Memory 负责沉淀。三者可以串起来，但不要一开始就打通成全自动流水线。

---

## `trace.mode` 怎么理解

先保留两个模式就够：

```ini
trace.mode=session
```

只导出原始 session，不做摘要。这应该是默认值。

```ini
trace.mode=digest
```

先导出原始 session，再生成 digest。这个模式可以后做，也可以先作为实验功能。

不要急着加 `off`。关闭行为已经由 `trace.enabled=false` 表达了。

---

## Digest 的触发方式

默认不应该自动 digest 每个 session。更稳的做法是先提供手动命令：

```text
/trellis:digest-session <session-id>
```

理由：

- 有些 session 只是修小问题，没必要花 token 摘要
- 自动摘要会制造很多低价值文档
- 手动触发能逼用户判断这段对话是否真的值得沉淀

以后可以加阈值：

```ini
trace.digest.min_turns=5
```

少于 5 轮的 session 默认不摘要。这个阈值只影响 digest，不影响原始 session capture。

---

## Memory 怎么接 Trace

Trace 产物不要直接变成 Memory。

更合理的关系是：

```text
.trellis/.traces/session-xxx.jsonl
  -> .trellis/.traces/digests/xxx.md
  -> .trellis/memory/sources/YYYY-MM-DD/xxx.md
  -> .trellis/memory/wiki/*.md
```

其中：

- `.traces/session-xxx.jsonl` 是个人原始材料，不进 git
- `.traces/digests/xxx.md` 仍然是个人草稿，不默认进 git
- `memory/sources/` 是经过选择的输入材料，可以进 git
- `memory/wiki/` 是整理后的共享知识

这条边界很重要。Trace 是"发生过什么"，Memory 是"我们决定保留什么"。两者不能混成一个目录。

---

## PRD 应该怎么改

如果采用这个方向，PRD 需要做这些调整：

1. 删除 Trace 章节里的 OTel / exporter 内核设计。
2. 删除 agent-trace / opentraces / git-ai / OTLP 作为 MVP 要求的内容。
3. 删除"commit 时生成 `.agent-trace/traces.jsonl`"的验收标准。
4. 删除"Trace 是否与 task 绑定"这个 open question。第一版不绑 task，绑 developer。
5. 把 Trace 改写成 Memory plugin 下的 session capture 能力。
6. Out of Scope 明确写：不做 observability、不做 code attribution、不做外部 trace exporter。

旧调研可以保留在 research 目录里。它们的作用是解释为什么不走那些路线。

---

## 还没决定的事

### trace 文件保留多久

原始 session 会越积越多。需要决定：

- 是否按天数清理，例如保留 30 天
- 是否压缩旧 jsonl
- digest 生成后，原始文件是否仍然保留

我的倾向：第一版不自动删除，只提供清理命令或文档说明。自动删原始材料容易后悔。

### digest 用什么格式

可以先用普通 markdown，加最少 frontmatter：

```yaml
---
session_id: xxx
created_at: 2026-04-23T23:12:00+08:00
source: .trellis/.traces/session-xxx.jsonl
---
```

不要一开始就套完整 llm-wiki schema。等它真的进入 `memory/sources/` 时，再补 Memory 需要的字段。

### 跨平台 session 怎么合并

同一个 task 可能横跨 Claude Code、Codex、OpenCode。第一版不合并。

更稳的做法是每个平台先各自导出。之后在 digest 或 memory ingest 阶段再做关联。

### CLI 是否现在就做

`trellis plugin trace enable` 不必第一版就做。

第一版可以先通过 `.developer` 开关启用。等 trace capture 本身跑稳，再补 CLI。否则 CLI、配置、hook、storage 会一起变，调试面太大。

---

## 当前推荐

先做最小闭环：

1. `.developer` 增加 `trace.enabled=true` 和 `trace.mode=session`。
2. `.trellis/.gitignore` 忽略 `.traces/`。
3. Claude Code 在 session 结束时复制 transcript 到 `.trellis/.traces/`。
4. OpenCode 做同等能力，但允许输出格式先不完全一致。
5. 不做 OTel、agent-trace、exporter、Git Notes。
6. 不自动 digest，不自动写 Memory。

这个闭环小，但方向对。它先把原始材料留下来，后面 Memory plugin 才有东西可吃。

---

## 参考

- `.trellis/.developer`：现有 per-developer 配置文件
- `research/karpathy-llm-wiki.md`：后续 digest / memory ingest 的参考
- `research/fp-spec-memory-trace-boundary.md`：Trace、Memory、Spec 的边界分析
- `research/agent-trace-ecosystem.md`、`research/otel-mcp-semconv.md`：旧路线的背景资料
