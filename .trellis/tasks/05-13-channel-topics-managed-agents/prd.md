# Channel threads and managed resident agents

## 目标

扩展 `trellis channel`，让 channel 支持两种结构类型：现有的 `chat` channel，以及类似飞书话题群的 `thread` channel。Thread channel 默认展示 thread list，进入具体 thread 后再评论、改状态、打标签。这样本地多个使用 Trellis 的项目可以把反馈、bug、复现信息发到一个全局 Trellis thread channel，而不需要新增一套独立的 `trellis issue` 子系统。

## 需求

- 为 channel metadata 建立一等设计：
  - `scope`：默认 project-scoped，显式支持跨项目的 global scope。
  - `type`：结构类型，只允许 `chat` 或 `thread`。默认 `chat`，现有 channel 都是 chat channel；创建时显式 `--type thread` 后才是 thread channel。
  - `labels`：自由标签，用来表达用途和分类，例如 `issue-board`、`feedback`、`release`、`cr`。
  - `description`：适用于所有 channel 的简短说明，让人和 agent 快速理解这个 channel 的用途。
  - `linkedContext`：适用于所有 channel 的关联上下文列表。只支持 `file` 和 `raw` 两类：`file` 必须是绝对路径，`raw` 是直接写入的纯文本。
  - `thread`：thread channel 内部的单个话题元素。
- 保留现有 channel 模型：append-only `events.jsonl`、project buckets、`send`、`messages`、`wait`、`spawn`、`kill`、`prune` 对已有 channel 必须继续可用。
- 明确两种 channel 的用户心智：
  - `type: "chat"` 是 timeline-first，`messages <channel>` 默认展示消息时间线。
  - `type: "thread"` 是 board-first，`messages <channel>` 默认展示 thread list，`messages --thread <key>` 进入单个 thread。
- 不创建单独的 `trellis issue` 功能。issue-like 行为应该由 channel metadata、thread events、thread aggregation 扩展出来。
- 支持核心工作流：
  - Trellis maintainer 创建一个全局 thread channel，例如 `trellis-issues`。
  - 使用 Trellis 的本地项目可以从自己的 cwd 把反馈、bug、repro、support notes 作为 thread 发到这个全局 channel。
  - agent 查看 channel 时可以先读取 channel 级 `description` 和 `linkedContext`；进入具体 thread 时再读取 thread 级说明和上下文。
  - maintainer 可以列出 threads、查看单个 thread、关闭/打标签 thread，之后也可以接入 managed worker 做 triage。
- 第一版不实现 managed resident workers。它们作为后续设计，消费 thread events，而不是定义 thread 存储。
- thread state 必须 event-sourced。thread status、labels、title、assignees、summaries 应该从 events 推导；如果以后为了性能持久化 projection，也必须声明为可重建缓存，不是独立数据库。
- `send` 和 `post` 必须分工清楚：`send` 是普通 message primitive；`post` 是 structured thread event primitive。v1 不支持 `send --thread`。
- Channel labels 和 thread labels 是两层不同标签：channel labels 描述 channel 用途，thread labels 描述单个 thread 分类。
- 保留 raw auditability。`messages --raw` 必须完整输出所有新增 event field。
- 支持跨平台本地使用：channel paths、thread keys、stored metadata、hashes 不应依赖 OS-native path separators 或 shell syntax。

## 验收标准

- [ ] `design.md` 定义 `type: "chat" | "thread"` 的功能差异、channel `scope`、`labels`、`description`、`linkedContext`、thread events，以及 managed workers 的 v1/v2 边界。
- [ ] `design.md` 说明 global channels 如何映射到 bucket storage，以及如何和现有 `TRELLIS_CHANNEL_PROJECT` 交互。
- [ ] `design.md` 给出创建 global labeled channels、post thread events、列出 threads、修改 thread status/labels 的 CLI contract。
- [ ] `design.md` 覆盖已有 channels 和已有 commands 的 backward compatibility。
- [ ] `design.md` 明确 project/global buckets、thread filtering、thread aggregation、legacy compatibility、raw/pretty output 需要的测试。
- [ ] implementation 前必须记录 architecture brainstorm notes。

## 备注

- 用户纠正过方向：这应该扩展 channel properties，不应该新增平行的 issue feature。
- 当前命令名仍是设计 contract；最终实现前需要和现有 channel command model 对齐。
