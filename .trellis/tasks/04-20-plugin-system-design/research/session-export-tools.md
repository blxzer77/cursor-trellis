# Session Export Tools 调研

> 时间: 2026-04-23
> 目标: 按日期导出 Claude Code / Codex CLI 会话，喂给 Trellis Memory plugin 做 ingest 源
> 场景: 命令行、可脚本化、可 cron 定时跑、输出 markdown（非审计/token 统计）

---

## 候选项目对比表

| 项目 | URL | 语言/安装 | 最近活跃 | 日期过滤 | 输出格式 | 平台 | Headless | 结论 |
|---|---|---|---|---|---|---|---|---|
| **yxjxx/claude-codex-daily-log** | https://github.com/yxjxx/claude-codex-daily-log | Python 脚本 | 2026-03-20 | ✅ 原生按日期 (argv YYYY-MM-DD) | MD (Obsidian 风格，一天一文件夹，一会话一 note) | Claude + Codex + OpenClaw | ✅ 纯 CLI | **最佳匹配**：按日期切片、双平台、正是我们的用法 |
| **daaain/claude-code-log** | https://github.com/daaain/claude-code-log | Python (pip/uv), 912★ | 活跃 (v1.1.1) | ✅ `--from-date "yesterday"` 自然语言 | HTML + MD | Claude only | ✅ 但默认开 TUI | 成熟度最高，支持自然语言日期，仅 Claude |
| **robertguss/claude_transcripts** (ct) | https://github.com/robertguss/claude_transcripts | Go `go install` | 2026-01 | ❌ 无日期过滤（按 project/session）| MD + YAML frontmatter | Claude only | ✅ 纯 CLI | 增量 sync 不错，但无日期过滤 |
| **douglasrw/session-export** | https://github.com/douglasrw/session-export | Python 脚本 / Claude skill | 2026-01 | ✅ `--after YYYY-MM-DD --before YYYY-MM-DD` | MD / JSON / training JSONL | Claude only | ✅ | 日期过滤明确，可当 Claude skill 跑 |
| **faceair/codex-exporter** | https://github.com/faceair/codex-exporter | Go | 2026-03 | ❌ cwd + session-id 过滤，无日期 | MD | Codex only | ✅ `-last -session-id` | Codex 侧 Go 方案，无日期但支持按 cwd |
| **nishantdesai/codex-history** | https://github.com/nishantdesai/codex-history | CLI (read-only) | 2026-03 | ⚠️ 按 thread-id 导出，grep/search 可带过滤 | MD / JSON / prompt-pack | Codex only | ✅ | 自带 secrets 脱敏，纯读，但日期过滤要自己拼 |
| **MeXenon/codex-session-export** | https://github.com/MeXenon/codex-session-export | Python TUI | 2026-04-12 (新) | ❌ 交互选 | MD | Codex only | ❌ 强依赖 TUI | 交互好但不可脚本化 |
| **es617/claude-replay** | https://github.com/es617/claude-replay | ? | 2026-03 | 未明说 | 单 HTML | Claude+Cursor+Codex+Gemini+OpenCode | ✅ CLI | 跨平台最广，但输出 HTML 不是 MD |
| **S2thend/claude-code-history** (cch) | https://github.com/S2thend/claude-code-history | TS CLI + lib | 2025-12 | ❌ 索引列表按时间排序，无日期过滤 | MD / JSON | Claude only | ✅ | API 可编程 (lib 导出)，但无日期参数 |
| **ZeroSumQuant/claude-conversation-extractor** | https://github.com/ZeroSumQuant/claude-conversation-extractor | Python | 2025-05 | ❌ roadmap 有 --after/--before 但未实现 | MD / JSON / HTML | Claude only | ✅ | pure stdlib，干净 MD，无日期 |
| **jimmc414/cctrace** | https://github.com/jimmc414/cctrace | Python | 2025-07 (不太活跃) | ❌ 按 session-id | MD + XML | Claude only | ✅ | v2 支持 portable (push 到 git 恢复会话) |
| **Nnadozie/export-claude-code-sessions** | https://github.com/Nnadozie/export-claude-code-sessions | Python stdlib | 2025-11 | ❌ 仅 `--latest` | TXT | Claude only | ✅ | 太简单，作参考代码合适 |

排除的：
- `simonw/claude-code-transcripts` / `johncmunson/...` / `robzolkos/claude-session-export` / `brucehart/codex-transcripts` / `masonc15/codex-transcript-viewer` — 全是 HTML 输出（查看导向），不是我们要的 MD
- `claude-code-exporter` (developerisnow) — focus 是 aggregate/analyze prompts，`--period 7d` 有但非日期切片
- `GunitBindal/claude-transcript-exporter` — 交互式 TUI，无法脚本化
- `vtemian/claude-notes` — HTML/terminal 为主
- `HizTam/codex-history-viewer` — VS Code extension，不是 CLI
- `agoramachina/claude-exporter` — Chrome extension，不适用
- `fabriqaai/claude-code-logs` — local web UI，非 headless

---

## 每个项目详情（重点三个）

### 1. yxjxx/claude-codex-daily-log — 最接近目标

**基本信息**
- URL: https://github.com/yxjxx/claude-codex-daily-log
- 维护者: yxjxx
- 最近活跃: 2026-03-20
- 语言: Python (stdlib-ish)

**按日期导出的命令**
```bash
# 今天
python3 claude_daily_log.py
python3 codex_daily_log.py

# 指定日期
python3 claude_daily_log.py 2026-03-20
python3 codex_daily_log.py 2026-03-20
```

**输出结构**（完全契合 `sources/YYYY-MM-DD/chat-<session>.md` 需求）
```
Claude Logs/
  2026-03-20/
    00 - 2026-03-20.md                 ← 当日索引
    01 - Configure rclone backup.md    ← session 1
    02 - Fix docker networking.md      ← session 2
Codex Logs/
  2026-03-20/
    00 - 2026-03-20.md
    01 - Debug API endpoint.md
```

**实现机制**
- Claude 侧：读 `~/.claude/history.jsonl` 定位当日 session → 去 `~/.claude/projects/` 拉 JSONL → 提取 user message + assistant text（**剔除 tool_result / thinking / tool_use**）→ 写成带 YAML frontmatter 的 Obsidian note
- Codex 侧：扫 `~/.codex/sessions/YYYY/MM/DD/` → 读 `~/.codex/state_5.sqlite` 取 thread 元数据 → 同样结构
- 双平台路径都按官方约定

**局限**
- 会**丢掉 tool_use / tool_result / thinking**。Trellis Memory 想作为 wiki ingest 源可能还好（wiki 关心对话语义不关心工具执行细节），但如果 wiki agent 想理解"Claude 读了哪些文件"就不够
- 依赖 `~/.codex/state_5.sqlite` 具体结构，Codex 升级可能 break
- 是脚本 repo，不是 published package（没有 `pip install`），要 clone

**适用性**: ⭐⭐⭐⭐⭐
- 日期切片原生支持 ✅
- 双平台 ✅
- Headless / cron 友好 ✅
- 可以直接拿来 fork 或当 reference implementation，20-50 行可以改成只保留 tool calls

---

### 2. daaain/claude-code-log — Claude 侧最成熟

**基本信息**
- URL: https://github.com/daaain/claude-code-log
- 维护者: daaain
- Stars: ~912 (最高的)
- PyPI: `pip install claude-code-log` (v1.1.1)

**按日期导出**
```bash
# 自然语言日期范围
claude-code-log --from-date "yesterday" --to-date "today"
claude-code-log --from-date "last week"
claude-code-log /path/to/dir --from-date "3 days ago" --to-date "yesterday"
```

**输出**
- 默认 HTML（项目 index + 每个 session HTML），**但也支持 MD**（v1.x 加入）
- 保留 thinking 块、tool calls、token usage
- Markdown 走 mistune，代码块有 syntax highlight
- 有 Pydantic 模型定义 schema，稳定

**局限**
- 有个 TUI 模式，纯 cron 场景要加 flag 关掉
- 只支持 Claude（Codex 要另找）
- 更偏"浏览查看"场景，导出单个 session 到单文件的命令不如 yxjxx 那个直观

**适用性**: ⭐⭐⭐⭐
- Claude 侧稳定，是生态第一选择
- 但是不能同时处理 Codex

---

### 3. faceair/codex-exporter — Codex 侧最干净

**基本信息**
- URL: https://github.com/faceair/codex-exporter
- 维护者: faceair
- 最近活跃: 2026-03-04
- 语言: Go (`go run .`)

**命令**
```bash
# 当前 cwd 的最新 session
go run . -last

# 指定 session-id
go run . -session-id <uuid> -output session.md -force

# 全部（不限 cwd）
go run . -all

# full mode：包含 non-final assistant phases + 全部 metadata
go run . -last -full
```

**局限**
- **没有 `-date` 参数**，按 cwd 和 session-id 过滤
- 要按日期切需要：shell 先 `ls ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`，然后对每个文件跑一次
- Go，要编译（或 `go install`）

**适用性**: ⭐⭐⭐
- 输出 MD 质量好
- 日期切片要外层 shell 脚本拼，不如 yxjxx 那个直接

---

## 关键发现

### Codex 侧的现状
- **没有原生 `--date` CLI 参数**的工具。大部分是按 cwd / session-id / 交互选
- 但 Codex 的目录结构 `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` **天然按日期组织**——对一天的所有 session 只要 `ls 2026-04-22/*.jsonl` 就能拿到路径，后续交给任何 JSONL-to-MD 工具循环跑即可
- **yxjxx/claude-codex-daily-log** 是唯一一个原生按日期、双平台、headless 的
- **zpdldhkdl/codex-replay** 输出 HTML（不是 MD），但它证明"按 session_id merge history+rollout"可行
- OpenAI 刚开源了 **Euphony**（2026-04-21）做 Codex session 可视化，但是 web app，不适合我们

### Claude 侧现状
- 生态成熟：`claude-code-log` (912★) 是 de-facto
- 大部分新项目是 HTML viewer（`simonw/claude-code-transcripts`, `johncmunson/...`, `robertguss/ct` 等）—— 对"文档输入源"场景是 over-engineered
- JSONL schema 已经被 3-4 个项目独立实现解析，能抄的 parser 代码很多

### 空位点
1. **没有"按日期 + tool_use/tool_result 完整保留 + Markdown"** 的成熟 CLI。想给 wiki agent 的 ingest 源既含对话语义又含工具调用，几乎必须自己搓或 fork
2. 没有任何工具原生做 "diff last-run-timestamp vs now" 的增量导出（`robertguss/ct sync` 接近但按 project 不按日期）
3. Codex 没有真正的"按日期"参数；都是按 cwd/session-id。好在目录结构帮忙

### 最省事方案
**Codex 按日期导出（20 行 shell）**：
```bash
DATE=2026-04-22
Y=${DATE:0:4}; M=${DATE:5:2}; D=${DATE:8:2}
mkdir -p "sources/$DATE"
for f in ~/.codex/sessions/$Y/$M/$D/rollout-*.jsonl; do
  SID=$(basename "$f" .jsonl | sed 's/^rollout-//')
  jq -r 'select(.type=="response_item" or .type=="event_msg") |
         if .role=="user" then "\n## User\n\n" + (.content // .text // "")
         elif .role=="assistant" then "\n## Assistant\n\n" + (.content // .text // "")
         else empty end' "$f" > "sources/$DATE/chat-$SID.md"
done
```

**Claude 按日期导出（20 行 Python）**：
```python
# 伪码要点
import json, datetime, pathlib
target_date = "2026-04-22"
root = pathlib.Path("~/.claude/projects").expanduser()
for jsonl in root.rglob("*.jsonl"):
    # 读第一行 / 文件 mtime 判断日期
    mtime = datetime.datetime.fromtimestamp(jsonl.stat().st_mtime).date().isoformat()
    if mtime != target_date: continue
    out = pathlib.Path(f"sources/{target_date}/chat-{jsonl.stem}.md")
    out.parent.mkdir(parents=True, exist_ok=True)
    with jsonl.open() as f, out.open("w") as w:
        for line in f:
            ev = json.loads(line)
            # 规则参考 yxjxx/claude-codex-daily-log 的 claude_daily_log.py
            ...
```

更精准的日期判断应该读 JSONL 里的 `timestamp` 字段，而不是文件 mtime（mtime 会被最后一次 resume 污染）。

---

## 推荐

**一句话**：直接用或 fork `yxjxx/claude-codex-daily-log`——它是唯一满足"按日期 + 双平台 + headless + Markdown"的项目，路径约定和 Trellis 的 `sources/YYYY-MM-DD/chat-<session>.md` 目标几乎 1:1 对齐。

**具体建议**：
1. **Phase 1（快速集成）**：`git submodule add` 或直接 clone 这两个 Python 脚本进 Trellis Memory plugin 的 `tools/` 下，每天 cron 跑一次
2. **Phase 2（增强）**：fork 后改两处 —— (a) 保留 tool_use/tool_result 块（wiki agent 会需要知道 Claude 读了哪些文件），(b) 输出路径切换成 `{memory_dir}/sources/YYYY-MM-DD/` 而不是 Obsidian vault
3. **坑**：
   - Codex 的 `~/.codex/state_5.sqlite` 是 **undocumented schema**，Codex 升级可能 break。做 fallback：如果 SQLite 读失败，只按 rollout JSONL 的 filename timestamp 切片
   - Claude 的 session JSONL **可以被 resume**，导致一个 session 跨多天。按 event-level `timestamp` 切片更安全，不要按文件 mtime
   - 所有 JSONL 都可能含 base64 图片/工具输出（dev.to 那篇"70MB distiller"就是这事），ingest 前最好过一道 image-redact / size-cap
