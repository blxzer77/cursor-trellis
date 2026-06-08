# Rollout 1 Trace — Codex 主线程独占行为

## Source

`/Users/taosu/Library/Containers/com.tencent.xinWeChat/.../rollout-2026-04-23T08-45-47-019db7cc-...jsonl`
2323 lines, 4.0 MB.

## Session Meta

- Codex CLI 0.122.0, gpt-5.4 effort=xhigh, originator=codex-tui
- 起手: `$trellis-continue 04-22-07-task-list-005-transfer-relax`
- 任务域: 前后端联动需求 (Java backend + Vue frontend)，monorepo 按端拆包（`backend` / `frontend`）

## Timeline

| Line | Action |
|------|--------|
| 7 | 用户 slash-command `$trellis-continue <task>` |
| 10 | Codex 注入 `trellis-continue/SKILL.md` 作为 user message |
| 15-16 | `get_context.py` / `get_context.py --mode phase` |
| 39 | 主线程判定从 Phase 1 Step 1.3 开始 |
| 40-51 | `task.py start` → `task.py init-context ... fullstack --platform codex` → **exit 1 "monorepo requires --package"** |
| 51-155 | 主线程手工补造 `implement.jsonl` / `check.jsonl` + 改 `task.json.status` + `dev_type=fullstack`（10 分钟绕过工具） |
| 157 | `sed` 读 `trellis-before-dev/SKILL.md` |
| 158 | `get_context.py --mode phase --step 2.1 --platform codex` |
| 163 | Phase 2.1 返回 **"Spawn the implement sub-agent: `trellis-implement`"** |
| 165+ | 主线程**忽略 spawn 指令**，开始读 spec/backend/dev、spec/frontend/dev、permission/form-validation guides |
| 225+ | 主线程宣布"开始只读上下文收集" → **33 次 `apply_patch`** 改前后端 10+ 个文件 |
| 878 | 用户 turn_aborted |
| 882 | 用户追加 `$trellis-check-all` — 主线程又自己跑 |
| 1076 | 用户 `$trellis-run-e2e` — 主线程 49 次 `browser_run_code` + 67 次 `mysql_query` 自跑 E2E |

## Tool Call 统计

```
exec_command      235   # shell / get_context / rg / sed / mvn / npm
apply_patch        33   # 10 业务文件 + task 元数据（Java DTO/AppService/Controller/Mapper + Vue TaskList + API contract）
mysql_query        67   # 直连 DB 做 E2E 断言
browser_run_code   49   # Playwright 跑端到端
write_stdin        42   # 交互式命令
update_plan         3
browser_*          18   # navigate/snapshot/tabs/console
```

**子 agent 调用次数: 0**（搜 `codex exec` / `claude -p` / `trellis-implement` 在 235 条 shell 命令里无任何匹配）

## 关键证据

**证据 1 —— Phase 2.1 输出（line 163）**:
```
#### 2.1 Implement [required · repeatable]
Spawn the implement sub-agent:
- Agent type: trellis-implement
- Task description: Implement the requirements per prd.md ...
The platform hook auto-handles:
- Reads implement.jsonl and injects the referenced spec files into the agent prompt
- Injects prd.md content
```

**证据 2 —— `trellis-before-dev/SKILL.md` 全文（line 161）**：第二人称祈使句
> "Read...", "Execute these steps", "proceed with your development plan", "This step is mandatory before writing any code"

**证据 3 —— 主线程自我宣言（assistant messages）**:
- L50: "下一步我会先初始化这个任务的实现上下文，然后按流程加载 `trellis-before-dev`，**把相关规范读完后再进代码**"
- L156: "上下文文件已经补齐...接下来我按规则切到 `trellis-before-dev`，**先读目标包的开发清单和思维指引，再开始落代码**"
- L167: "使用 `trellis-before-dev` 的原因很直接：...不先把规范读透，后面很容易改偏"
- L225: "规范这边已经足够了，接下来**开始'只读上下文收集'**...避免后面凭记忆写字段和签名"

主线程在执行 Phase 2.1 之前已将 `trellis-before-dev` 的第二人称按到自己头上，把"进代码/落代码"定性为自己的下一步，完全没把 "Spawn the implement sub-agent" 当回事。

## 结论

两个原因叠加触发主线程独占：
1. **`init-context` 失败是催化剂** —— 工具挂了 → 主线程"取代工具"→ 手工写 jsonl → 进一步绑定到执行者角色
2. **Phase 2.1 的 `Spawn sub-agent` 在 Codex 平台没有可执行动词** —— 没有 Task tool / 没有 `codex exec` wrapper / 没有 MCP agent binding，模型无法 ground，只能当注释吞掉

## Why relevant to this task

init-context 失败是**失控链路的起点**。如果 init-context 不存在（Phase 1.3 直接让 agent 填 jsonl），失控链路从源头消除：
- 没有"工具不可用"的失败点
- 没有"我来取代工具"的心智滑坡
- 主线程知道"我负责 curate，curate 完才 dispatch"，角色更清晰
