# Design: workflow marketplace templates and switcher

## 核心设计

把 workflow 当成 marketplace template 的一种类型处理。`trellis init` 负责选择初始 workflow；`trellis workflow` 负责在已有项目中交互式选择并替换 `.trellis/workflow.md`。不引入长期 `workflow.variant` 配置，也不让 `trellis update` 根据配置自动切换用户 workflow。

## 数据模型

### Marketplace entry

`marketplace/index.json` 新增 `workflow` 类型：

```json
{
  "id": "tdd",
  "type": "workflow",
  "name": "TDD Workflow",
  "description": "Trellis workflow with red/green/refactor execution gates",
  "path": "workflows/tdd/workflow.md",
  "tags": ["workflow", "tdd"]
}
```

约束：

- `id` 是 CLI 参数和交互选择使用的稳定标识。
- `path` 指向单个 `workflow.md` template，不指向目录。
- `native` 也进入 index，避免默认 workflow 在 marketplace 里不可见。

## CLI 行为

### init

`trellis init` 增加 workflow 选择入口。首版支持显式 flag，并在交互式 init 中提供列表：

```bash
trellis init --workflow native
trellis init --workflow tdd
trellis init --workflow channel-driven-subagent-dispatch
trellis init --workflow-source <source> --workflow custom-id
```

没有 flag 时使用 `native`。写入顺序：

1. 解析 workflow id。
2. 拉取或读取 workflow template。
3. `createWorkflowStructure` 写入 `.trellis/workflow.md`。
4. 初始化 template hashes。
5. 如果 workflow 是 `native`，保留 `.trellis/workflow.md` hash；如果 workflow 不是 `native`，调用 `removeHash(cwd, ".trellis/workflow.md")`，把它视为 user-managed local workflow。

### workflow

新增顶层命令：

```bash
trellis workflow
trellis workflow --template tdd
trellis workflow --marketplace <source> --template custom-id
trellis workflow --list
trellis workflow --template tdd --force
trellis workflow --template tdd --create-new
```

行为：

- 无参数时读取内置 marketplace 和配置的 marketplace source，展示可用 workflow，用户选择后替换 `.trellis/workflow.md`。
- `--template` 走非交互路径，适合脚本和测试。
- `--marketplace` 指定额外 source，用于用户自定义 workflow marketplace。
- `--list` 只展示可用 workflow，不写文件。
- 写文件前复用当前 template hash 机制：pristine 文件可直接替换；modified 文件必须确认、跳过、强制覆盖或写 `.trellis/workflow.md.new`。
- 非交互模式遇到 modified `.trellis/workflow.md` 时默认 exit 1，并提示用户加 `--force` 或 `--create-new`。
- 替换成功后按 workflow id 处理 hash：
  - `native`：更新 `.trellis/.template-hashes.json` 中 `.trellis/workflow.md` 的 hash，使 native 后续继续走 Trellis-managed update。
  - 非 `native`：移除 `.trellis/workflow.md` hash entry，使后续 `trellis update` 把它归类为 modified user-managed file，而不是静默改回 native。

### update

`trellis update` 不读取 workflow 选择状态，也不自动把非 native workflow 追到 marketplace 最新内容。原因是用户明确要求切换是项目内的主动操作，而不是 config 驱动的 update 副作用。

首版保持：

- 缺省/旧项目按现有 update 行为处理 `workflow.md`。
- 通过 `trellis workflow` 切换过的项目，由 `trellis workflow` 负责再次切换或刷新。
- 如果后续需要“refresh current marketplace workflow”，也应作为 `trellis workflow` 子能力，而不是塞进 `trellis update`。

Durable-state contract:

- `native` workflow is Trellis-managed and hash-tracked.
- Non-native workflow is user-managed. `trellis init --workflow tdd`, `trellis workflow --template tdd`, `channel-driven-subagent-dispatch`, and custom workflow sources must remove `.trellis/workflow.md` from `.template-hashes.json` after writing.
- Because `isTemplateModified()` treats missing hash entries conservatively, `trellis update` will not auto-update a non-native workflow to bundled native content. It will appear in the normal modified-file decision path.
- This avoids long-lived `workflow.variant` state while preventing silent variant rollback.

## Context injection behavior

Workflow switching works only if every runtime entry reads the current `.trellis/workflow.md`. The current architecture has four relevant paths:

| Path | What it reads | Effect of workflow switch |
| --- | --- | --- |
| SessionStart hook | `## Phase Index` range from `.trellis/workflow.md`, with `[workflow-state:*]` blocks stripped | New compact Phase summary appears at session start |
| Per-turn workflow-state hook | `[workflow-state:STATUS]` blocks from `.trellis/workflow.md` | New planning / in-progress breadcrumb appears every user turn |
| `trellis-start` / `start` skill | Runs `get_context.py --mode phase`, then `--step` on demand | New workflow summary and step detail appear when the skill is used |
| `get_context.py --mode phase --step <X.Y>` | `#### X.Y` section from `.trellis/workflow.md`, filtered by platform markers | New TDD / channel-driven step instructions appear on demand |

Implications:

- Workflow templates must preserve `## Phase Index`, `## Phase 1: Plan`, `#### X.Y` headings, platform marker syntax, and all required `[workflow-state:*]` blocks.
- Start skills should remain workflow-agnostic. They should route to `get_context.py`, not duplicate TDD or channel-specific instructions.
- SessionStart still has generic hardcoded `<task-status>` / `<guidelines>` lines. These are orientation only; concrete execution behavior must be in Phase Index, workflow-state blocks, and step detail.
- A workflow variant that changes implementation/check behavior must update both `workflow-state:in_progress` and `#### 2.1` / `#### 2.2`; changing only one path creates drift between SessionStart/per-turn guidance and explicit step detail.

## Marketplace fetching

现有 `template-fetcher` 已经处理 registry index、direct download 和 proxy。实现应把 spec-specific 命名拆成更通用的 marketplace template helper，避免 workflow 命令复制一套逻辑。

建议边界：

- `utils/template-fetcher.ts`：保留 registry/index/download 低层能力。
- 新增或扩展一个 resolver：输入 `type + id + optional source`，输出 `{ id, type, path, content }`。
- `init.ts` / `commands/workflow.ts` 只调用 resolver，不直接拼 URL 或解析 index。

## Workflow template layout

建议新增：

```text
marketplace/workflows/
  native/workflow.md
  tdd/workflow.md
  channel-driven-subagent-dispatch/workflow.md
```

`packages/cli/src/templates/trellis/workflow.md` 是 `native` 的 source of truth。

如果 `marketplace/workflows/native/workflow.md` 必须作为 marketplace 可发现文件存在，则它只是镜像文件。测试必须校验它和 bundled native workflow byte-identical，并明确是否先应用 `replacePythonCommandLiterals`。更好的实现是让内置 resolver 对 `native` 直接读取 bundled template，避免双写正文。

## Resolver API

现有 `template-fetcher.ts` 是 spec installer，不应被 `init.ts` 或 `commands/workflow.ts` 直接扩展成分支堆叠。新增 resolver 边界：

```ts
resolveMarketplaceTemplate({
  type: "workflow",
  id: "tdd",
  source?: string,
}): Promise<{
  id: string;
  type: "workflow";
  name: string;
  description?: string;
  path: string;
  content: string;
}>
```

要求：

- registry/index/direct download/proxy handling 只在 resolver/template-fetcher 层。
- command 层只处理参数、选择、冲突决策、写文件、hash 更新。
- missing id、missing path、download failure 必须输出 workflow-specific error，不复用 “spec template not found”。

## TDD workflow 内容边界

TDD 版本只改变 workflow 行为，不改变 task 数据模型。

应改的部分：

- Phase 1：要求列出 behavior list 和 public interface。
- Phase 2.1：替换成 one behavior at a time 的 red/green cycle。
- Phase 2.2：检查测试是否通过 public interface 验证行为，mock 是否只在边界。
- Phase 3：保留 spec/update/commit/finish 语义。
- Breadcrumb：`planning` 和 `in_progress` 必须提到 TDD gates。

不应改的部分：

- `.trellis/scripts/task.py` lifecycle。
- `task.json.status` writer。
- channel/forum/runtime command 语义。

## 风险

- `workflow.md` 是运行时解析文件；template 变体必须通过 `get_context.py --mode phase` 和每个 `--step` 解析验证。
- update 规格中以当前代码为准：workflow update 是 whole-file hash-gated，不是只替换 `[workflow-state:*]`。不能引入半套 per-block merge。
- marketplace 与 bundled template 可能形成双写；native 需要明确 SoT。
- 非 native workflow 如果被记录为 hash-tracked pristine file，后续 update 会静默写回 native，这是 release blocker。
- TDD workflow 如果写成“先写全部测试再实现”，会违背参考 skill 的纵向切片要求。
- `trellis workflow` 直接替换本地 workflow，必须给 modified 文件明确确认路径，不能因“用户主动切换”就绕开保护。

## 验证

- `pnpm typecheck`
- `pnpm test test/commands/init.integration.test.ts`
- `pnpm test test/commands/update.integration.test.ts`
- `pnpm test test/regression.test.ts`
- SessionStart overview extraction against each workflow template.
- Per-turn workflow-state extraction against each workflow template.
- After switching to TDD/channel workflow, `trellis update` must not silently restore native workflow.
- Platform-filtered phase parsing:

  ```bash
  python3 ./.trellis/scripts/get_context.py --mode phase --step 2.1 --platform codex
  python3 ./.trellis/scripts/get_context.py --mode phase --step 2.1 --platform codex-sub-agent
  python3 ./.trellis/scripts/get_context.py --mode phase --step 2.1 --platform claude
  ```

- 对三个 workflow 文件分别运行：

  ```bash
  python3 ./.trellis/scripts/get_context.py --mode phase
  python3 ./.trellis/scripts/get_context.py --mode phase --step 2.1
  python3 ./.trellis/scripts/get_context.py --mode phase --step 2.2
  ```
