# Remove init-context auto-fill, let main agent curate implement.jsonl per task

## Motivation

`task.py init-context` 机械推导 `implement.jsonl` / `check.jsonl` 内容，假设 monorepo 里每个 package 内部有 `backend/` 和 `frontend/` 子目录（`task_context.py:48-61`）。用户把 package 按端拆（`spec/backend/dev/`、`spec/frontend/dev/`）时，生成的 jsonl 指向不存在的路径，且 `fullstack` dev_type 只能传一个 `--package`，无法覆盖两个包。

真实 rollout（见 research）显示：init-context 失败直接催化了"主线程 override sub-agent、吭哧吭哧自己写 36 处 patch"的失控链路 —— 模型因工具不可用而接管工具职责，继而接管 sub-agent 职责。

## Goal

把"init context"从**跑脚本机械推导**改成**Phase 1.3 让 AI 自己填 jsonl**。脚本命令消失，概念保留。jsonl 依旧是 hook/prelude 的消费契约，但内容由懂任务上下文的 agent 决定。

核心约束：**jsonl 条目只引用 spec 或 research 文件，不引用具体代码文件**。代码在 implement 阶段读，不应在 planning 阶段预注册。

## In Scope

1. **`task.py create` 行为改动**
   - 检测 platform 是否支持 sub-agent（查 `.trellis/config.yaml` 的 `features` 或已装 `.{platform}/` 目录）
   - 支持 → 顺手生成 seed 版 `implement.jsonl` + `check.jsonl`（每个文件一行自描述 JSON 作为"注释"，见下文 Seed 方案）
   - 不支持 → 只生成 `prd.md` + `task.json`（现状）

2. **删除 `task.py init-context` 子命令**
   - 删 `task_context.py:cmd_init_context`
   - 删 `get_implement_backend` / `get_implement_frontend` / `get_check_context` 中"按 dev_type 推导路径"的机械逻辑
   - 保留 `resolve_task_dir` 等底层 helper（给其他命令复用）
   - 老命令跑时输出 deprecation 提示，引导看 Phase 1.3 或用 `task add-context`

3. **Phase 1.3 重写成 "agent 自填 jsonl" 指令**（`workflow.md`）
   
   不再说"跑 init-context"。改成直接告诉 AI：
   - **位置**：`{TASK_DIR}/implement.jsonl` 和 `{TASK_DIR}/check.jsonl`（`task create` 已经 seed 好了，直接编辑 / 追加）
   - **格式**：每行一个 JSON 对象 `{"file": "<path>", "reason": "<why>"}`；seed 行（含 `_example` 字段）可以删除或保留
   - **必填什么**：根据 prd 选择相关的 **spec 文件**（`.trellis/spec/**/*.md`）和 **research 文件**（`{TASK_DIR}/research/*.md`）
   - **禁止填什么**：具体代码文件路径（`src/**`、`packages/**/*.ts` 等）—— 代码在 Phase 2 implement 时读，不在 planning 时预注册
   - **工具**：`task.py add-context <dir> implement|check <path> <reason>` 可脚本化追加；也可以直接文本编辑 jsonl
   - **发现 spec 的方式**：`python3 .trellis/scripts/get_context.py --mode packages` 列出本项目所有 spec layer 和路径
   
   Kilo / Antigravity / Windsurf 这一组仍然 "skip this step"（它们不消费 jsonl）。

4. **`trellis-before-dev/SKILL.md` 仍可读取 spec，不再承担 jsonl curate**
   - curate 职责在 Phase 1.3 已完成；Phase 2 的 before-dev 只负责"读"已经 curate 好的内容
   - 移除之前可能存在的"生成 jsonl"措辞（如果有的话），保持单一职责

5. **Hook / prelude 对 seed-only jsonl 的容错**
   - `shared-hooks/inject-subagent-context.py`：只有 seed 行或文件不存在时 warn 到 stderr，注入结果仅 prd.md
   - Class-2 platform sub-agent prelude（Codex/Copilot/Gemini/Qoder）：seed-only 时 fallback 到"自行读 prd.md + 判断 spec"，不因为空 jsonl 卡死

6. **workflow.md 其他清理**
   - `:236,261,286` 的 "Skip when: `implement.jsonl` already exists" 改成 "Skip when: `implement.jsonl` has agent-curated entries (seed 行不算)"
   - Phase 1.4 completion criteria 的 "implement.jsonl exists" 改成 "implement.jsonl has non-seed entries"
   - Phase 2 描述不变（依然从 jsonl 消费注入）

7. **Skill Routing + DO NOT skip skills 表的平台分支**（`workflow.md:130-149`）
   
   现状是全平台共享一份表，但 `trellis-before-dev` 其实只对 "主线程直接写代码" 的平台有意义 —— sub-agent 平台应该是"dispatch sub-agent，sub-agent 内部自己读 spec"。
   
   拆成两份：
   
   **[Claude Code, Cursor, OpenCode, Codex, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid]**：
   - "要写代码" → `Phase 2.1 — dispatch trellis-implement`（去掉 trellis-before-dev 行）
   - "要验证" → `Phase 2.2 — dispatch trellis-check`
   - 其他行不变
   
   **[Kilo, Antigravity, Windsurf]**：
   - "要写代码" → `trellis-before-dev`
   - "要验证" → `trellis-check`
   - 其他行不变
   
   同样给 "DO NOT skip skills" 表做分支：sub-agent 平台那行关于 "before-dev takes under a minute" 改成 sub-agent 语境下的对应劝诫（如 "dispatching trellis-implement is the cheap path; skipping it tempts you to write code in the main thread and lose spec context"）。

7. **0.5.0-beta.12 migration manifest**
   - `safe-file-delete` 不用（jsonl 保留向后兼容）
   - `aiInstructions` 加一条：老任务的 jsonl 如果是 0.5.0-beta.11 及之前自动生成的默认内容，可按 Phase 1.3 新指引 re-curate（或保留不动，hook 仍能消费）

## Out of Scope

- `task.py start` 加 `--dev-type` / `--package` 交互式询问 —— 放到后续 task 做（要和 task.json schema 迁移对齐）
- Phase 2.1 "Spawn sub-agent" 对 Codex 的平台分支改造 —— 单独 task 做（见 research）
- `trellis-before-dev` 语态从"祈使句"改成"元描述" —— 单独 task 做

## JSONL Seed 方案

每个文件一行自描述 JSON，既合法又能自解释：

```jsonl
{"_example": "Fill with {\"file\": \".trellis/spec/<pkg>/<layer>/index.md\", \"reason\": \"why this spec applies\"}. Run `python3 .trellis/scripts/get_context.py --mode packages` to list available specs. Delete this line when done."}
```

- 消费方（hook / prelude）只取 `.file` 字段，seed 行被自动过滤
- agent 打开文件即可看到格式说明

## Success Criteria

1. 新 `task create` 生成的任务 Phase 1.3 由 AI curate jsonl（无需跑 init-context）
2. Phase 1.3 文案清晰告知 AI：位置、格式、放 spec/research、不放代码
3. 按端拆包的 monorepo（spec 布局 `.trellis/spec/{backend,frontend}/dev/`）不再卡在 "requires --package"（因为根本不跑 init-context 了）
4. 既有任务的 jsonl 保持可用（向后兼容）
5. `inject-subagent-context.py` 对 seed-only 或缺失的 jsonl 注入结果合理（至少包含 prd.md）
6. 两份 rollout 对应的场景（fullstack + 前后端分包）能走通完整 workflow，主线程不再手工仿造 jsonl 绕过工具
7. Skill Routing 表按平台分支后，sub-agent 平台的主线程不再被 `trellis-before-dev` 诱导代入执行者角色

## Research

- `research/rollout-1-trace.md` — 第一份 Codex rollout 的 init-context 失败 + 主线程手工仿造 jsonl 的完整链路
- `research/rollout-2-trace.md` — 第二份 Codex rollout，同问题复现（36 处 patch 主线程独占）
- `research/init-context-root-cause.md` — 两层问题：表面 `--package required`、深层 spec 路径布局假设错位
- `research/jsonl-consumers.md` — Class-1（shared-hooks/inject-subagent-context.py）+ Class-2（platform prelude）两条消费路径的实现细节

## Affected Files (preliminary)

- `packages/cli/src/templates/trellis/scripts/task.py` — 删 `init-context` subparser
- `packages/cli/src/templates/trellis/scripts/common/task_context.py` — 删 `cmd_init_context` + 相关 helper
- `packages/cli/src/templates/trellis/scripts/common/task_store.py` — `cmd_create` 加 platform 探测 + seed jsonl 生成
- `packages/cli/src/templates/shared-hooks/inject-subagent-context.py` — seed-only 容错
- `packages/cli/src/templates/codex/hooks/session-start.py` + 类似 class-2 prelude — 同上容错
- `packages/cli/src/templates/common/skills/trellis-before-dev/SKILL.md` — curate 职责
- `packages/cli/src/templates/trellis/workflow.md` — "Skip when jsonl exists" 描述
- `packages/cli/src/migrations/manifests/0.5.0-beta.12.json` — 新建
- `test/commands/task-context.test.ts` 或对应 python 测试 — 覆盖新行为
