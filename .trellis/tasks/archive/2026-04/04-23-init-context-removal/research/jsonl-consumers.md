# implement.jsonl / check.jsonl 的消费方

了解谁消费 jsonl，才能判断"删 init-context、留 jsonl"的改动对哪些路径有影响。

## 两种消费模式

### Class-1：Hook 推注入（Claude / Cursor / OpenCode / Kiro / CodeBuddy / Droid）

消费方：`packages/cli/src/templates/shared-hooks/inject-subagent-context.py`

触发时机：sub-agent spawn 时，platform hook 拦截 Task 调用。

逻辑（`inject-subagent-context.py:216-276`）：
- 根据 sub-agent 名（`implement` / `check` / `finish`）选 jsonl
- Implement agent: 读 `implement.jsonl` + `prd.md`
- Check agent: 读 `check.jsonl` + `prd.md`
- Finish phase: 读 `check.jsonl` + `prd.md`（复用 check 的上下文）

注入方式：`read_jsonl_entries(repo_root, f"{task_dir}/implement.jsonl")` 逐行 parse，取 `{file, reason}` → 读文件内容 → 拼进 sub-agent prompt。

**对 seed-only jsonl 的现状**：`read_jsonl_entries` 会跳过没有 `.file` 字段的 entry（因为 `.get("file")` 返回 None），所以 seed 行天然被过滤。注入结果是"只有 prd.md"。

### Class-2：Sub-agent 自读 prelude（Codex / Copilot / Gemini / Qoder）

消费方：各平台的 `session-start.py`（`packages/cli/src/templates/codex/hooks/session-start.py:111`、`packages/cli/src/templates/copilot/hooks/session-start.py:111`）+ sub-agent 定义里的 prelude instruction block

触发时机：sub-agent 的第一轮，prelude 要求它 Read `implement.jsonl` / `check.jsonl`。

原因（见 `0.5.0-beta.0.json` changelog）：
> Codex PreToolUse 只对 Bash 触发；Copilot #2392/#2540；Gemini #18128；Qoder 没有 Task tool —— 这些平台都没法可靠地 hook 修改 sub-agent prompt，所以改成 pull-based：sub-agent 自己读 jsonl。

**对 seed-only jsonl 的现状**：sub-agent Read 到一个只有 seed 的 jsonl，需要 prelude 明确告诉它"只有 seed 就 fallback 到自行判断 spec"，否则可能卡住或走歪。这是本 task 的 In-Scope Item 5。

## 其他提到 jsonl 的地方

- `packages/cli/src/configurators/shared.ts:311-313` —— 文件名选择逻辑（`check.jsonl` vs `implement.jsonl`），**不关心内容**
- `packages/cli/src/templates/copilot/prompts/start.prompt.md:383-384` —— 文档列表
- `packages/cli/src/templates/codex/skills/start/SKILL.md:340-341` —— 文档列表
- `packages/cli/src/templates/common/commands/continue.md:34` —— 提到"jsonl 存在则 skip init-context"，**这行要改**
- `packages/cli/src/templates/trellis/workflow.md:236,261,286,316,336,350` —— workflow 描述，**要改**

## 不受影响的地方

- Multi-platform configurators (`packages/cli/src/configurators/*.ts`) —— 只管 install/update，不关心 jsonl 内容
- Migration 基础设施（`packages/cli/src/migrations/`）—— 中立

## JSONL schema 现状

每行一个 JSON 对象：`{"file": "<path>", "reason": "<why>"}`。`file` 是 repo-root 相对路径。消费方用 `.get("file")` 和 `.get("reason")`，对未知字段宽容（忽略）。**这意味着 seed 行可以塞任意 `_example` 字段，消费方不会炸。**

## Why relevant to this task

本文件的结论：
1. 两条消费路径都在 agent 消费 jsonl 时才读，**task 创建时的"预填"不是必需**
2. JSONL schema 天然容忍未知字段 → seed 行方案可行
3. Hook 对缺 `.file` entry 已经 skip，Class-1 天然容错；Class-2 需要在 prelude 加 fallback（In-Scope Item 5）
4. workflow.md 至少 5 处提到 jsonl，改动要全量 sweep（见 Affected Files）
