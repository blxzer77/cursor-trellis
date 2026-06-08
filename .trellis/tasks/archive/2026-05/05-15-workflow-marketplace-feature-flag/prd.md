# Workflow marketplace templates and switcher

## 背景

Trellis 现在把 `.trellis/workflow.md` 当成本地 workflow 的核心入口，但项目只能拿到 CLI 打包的默认版本。用户需要在初始化时选择 workflow，也需要在项目内通过命令交互式切换 workflow。可选 workflow 应从 marketplace 分发，而不是把每一种正文都写死在 init/update 逻辑里。

首版需要把 workflow 也纳入 marketplace 模型，提供三个可选 workflow：

- `native`：当前原生 Trellis workflow。
- `tdd`：参考 Matt Pocock TDD skill 的 red/green/refactor 纵向切片工作流。
- `channel-driven-subagent-dispatch`：本地 dogfooding 里使用的 channel-driven sub-agent dispatch workflow。

## 目标

1. `trellis init` 支持选择初始 `.trellis/workflow.md`。
2. 新增 `trellis workflow` 命令，在项目内进入交互式 workflow 选择和替换流程。
3. Marketplace 支持声明、发现、拉取 workflow template，而不只承载 skill/spec/agent/command。
4. 首版 marketplace 内置三个 workflow 变体：`native`、`tdd`、`channel-driven-subagent-dispatch`。
5. TDD workflow 的语义参考 `mattpocock/skills` 的 TDD skill：行为优先、公共接口测试、一次一个测试、red/green/refactor、只 mock 系统边界。

## 非目标

- 不做可视化 workflow 编辑器。
- 不做多 workflow 混合执行；一个项目同一时刻只选择一个 `.trellis/workflow.md`。
- 不把 TDD skill 原文直接复制进 workflow；只吸收工作流结构和质量约束。
- 不改变 task/status 的数据模型，除非实现时证明 workflow 选择必须记录额外元数据。
- 不引入长期 `workflow.variant` / feature flag 配置来驱动 `trellis update` 自动切换 workflow。
- 不让非 native workflow 继续作为 bundled native template 的 pristine hash 目标；否则后续 update 会静默回滚用户选择。

## 用户能力

- 新项目初始化时可以选择 workflow 变体；不选择时默认 `native`。
- 已有项目可以运行 `trellis workflow`，从内置 workflow 或自定义 marketplace workflow 中选择一个，并直接替换本项目的 `.trellis/workflow.md`。
- 用户能查看 marketplace 中有哪些 workflow 变体及其说明。
- 用户修改过 `.trellis/workflow.md` 时，切换/更新 workflow 不能静默覆盖本地改动；需要沿用现有 hash/conflict 保护。

## 首版 workflow 变体

| id | 来源 | 行为 |
| --- | --- | --- |
| `native` | 当前 `packages/cli/src/templates/trellis/workflow.md` | 保持现有 Plan / Execute / Finish 语义 |
| `tdd` | 新增 marketplace workflow | Phase 2 变成 red → green → refactor 的纵向循环；测试通过公共接口验证行为 |
| `channel-driven-subagent-dispatch` | 本地 dogfooding workflow | 主会话协调，implement/check/research 通过 `trellis channel spawn/send/wait` 执行 |

## TDD workflow 要求

- Phase 1 必须要求列出要验证的行为，而不是实现步骤。
- Phase 2 必须按单个行为纵向推进：写一个失败测试、写最少实现、跑通、再进入下一个行为。
- 测试应通过公共接口验证行为，避免测试 private 方法、内部函数调用次数、内部 collaborator 调用顺序。
- mock 只用于系统边界：外部 API、时间、随机数、文件系统，或必要的数据库边界。
- Refactor 只能在 green 状态进行；每个 refactor 步后要重跑相关测试。
- workflow 文本仍必须兼容现有 `[workflow-state:*]` breadcrumb parser 和 `get_context.py --mode phase`。

## Marketplace 要求

- `marketplace/index.json` 支持 `type: "workflow"` 的 template 条目。
- Workflow template 应有稳定 `id`、可读 `name`、`description`、`path`、`tags`，并能被 init 和 `trellis workflow` 选择。
- Marketplace 拉取逻辑要复用现有 template fetcher，不在 init / workflow command 内部散落下载和解析实现。
- 远程 marketplace 失败时错误信息要说明是 workflow template 获取失败，而不是泛化成 spec 下载失败。

## `trellis workflow` 要求

- 默认进入交互式选择，显示 `native`、`tdd`、`channel-driven-subagent-dispatch` 和可发现的 marketplace workflow。
- 选择后直接替换当前项目的 `.trellis/workflow.md`。
- 本地 `.trellis/workflow.md` 与 template hash 不匹配时，不能静默覆盖；应提示用户确认、跳过或写 `.new` 文件。
- 非交互模式下本地 `.trellis/workflow.md` 已修改时，应默认失败并提示 `--force` 或 `--create-new`，不能弹交互 prompt。
- 命令应支持非交互参数，方便脚本和测试，例如：

  ```bash
  trellis workflow --template tdd
  trellis workflow --marketplace <source> --template custom-id
  trellis workflow --template tdd --force
  trellis workflow --template tdd --create-new
  ```

- `trellis update` 不根据历史选择自动换 workflow；update 只继续维护当前 Trellis managed template 的安全更新路径。
- `native` workflow 是 Trellis-managed；非 `native` workflow 是 user-managed local workflow。切换到非 native 后必须移除 `.trellis/workflow.md` 的 hash entry，避免 update 把它静默恢复成 native。

## 注入路径要求

- SessionStart hook 的 `<trellis-workflow>` 必须从当前 `.trellis/workflow.md` 提取 compact Phase Index，因此 workflow 切换后新 Phase summary 要自动进入 SessionStart。
- Per-turn `inject-workflow-state.py` / OpenCode plugin 必须从当前 `.trellis/workflow.md` 读取 `[workflow-state:*]` block，因此 workflow 切换后新 breadcrumb 要自动生效。
- `trellis-start` / `start` skill 不应内嵌具体 workflow 语义；它们应继续调用 `get_context.py --mode phase` 和 `--step`，由当前 `.trellis/workflow.md` 决定 TDD / channel-driven 行为。
- SessionStart 里少量硬编码的 `<task-status>` / `<guidelines>` 文案可以保持通用，但不能与 workflow 变体冲突；具体执行细节必须以 workflow Phase detail 为准。

## 验收标准

- [ ] `trellis init` 默认写入 native workflow。
- [ ] `trellis init` 能选择 marketplace workflow 变体并写入对应 `.trellis/workflow.md`。
- [ ] `trellis update` 对缺省/旧项目保持 native 行为不变。
- [ ] `trellis workflow` 能交互式选择并替换当前项目 `.trellis/workflow.md`。
- [ ] `trellis workflow --template tdd` 能非交互替换当前项目 `.trellis/workflow.md`。
- [ ] `trellis workflow` 能从自定义 marketplace source 选择 workflow template。
- [ ] 修改过 `.trellis/workflow.md` 的项目不会被静默覆盖；仍走现有 modified-file / hash 保护。
- [ ] 切换到 TDD/channel/custom workflow 后，后续 `trellis update` 不会静默恢复 native workflow。
- [ ] Marketplace index 包含 `native`、`tdd`、`channel-driven-subagent-dispatch` 三个 workflow entries。
- [ ] TDD workflow 能被 `get_context.py --mode phase` 和 `--step` 正常解析。
- [ ] 三个 workflow 都通过 SessionStart overview、per-turn workflow-state、`trellis-start` skill、`get_context.py --mode phase --step` 注入路径验证。
- [ ] 相关 init/update/marketplace 行为有集成测试覆盖。

## 参考

- Matt Pocock TDD skill: https://github.com/mattpocock/skills/tree/main/skills/engineering/tdd
- 本地 channel-driven workflow 参考：`.trellis/workflow.md`
- 当前默认 workflow 模板：`packages/cli/src/templates/trellis/workflow.md`
