# Cursor 宿主

[English](cursor.md) | 简体中文

Pactile 的 Cursor Adapter 写入小而可重建的投影。canonical workflow、Task、Tile、receipt 与 ownership ledger 仍在 `.pactile/`；Cursor 使用受管 `.cursor/` 文件以及共享的 `AGENTS.md` 区块。

## 安装与检查

从项目根目录运行，不要在 Pactile 源码 checkout 中运行：

```bash
pactile init --cursor -y
pactile capability-smoke --json
pactile validate-rules
```

生成面通常包括：

| 表面                             | 作用                            | 权威来源                           |
| -------------------------------- | ------------------------------- | ---------------------------------- |
| `.cursor/commands/`              | 用户调用的工作流命令。          | 当前 generation 的投影。           |
| `.cursor/rules/`                 | 小型 always-on bootstrap 指针。 | 策略指针，不是完整 workflow。      |
| `.cursor/agents/`                | 研究、实现、审查的命名入口。    | Task 派发元数据的投影。            |
| `.cursor/hooks/` 与 `hooks.json` | 尽力而为的上下文与证据辅助。    | 宿主增强，不能作为唯一硬门禁。     |
| `AGENTS.md`                      | 共享受管说明及保留的用户文本。  | 带 ownership claimant 的共享资源。 |

`pactile validate-rules` 将已安装 rules 与内置 manifest 比较。`pactile update --dry-run` 会在用户确认应用前预览投影变化。手工修改或被锁定的文件会进入审查，不会被静默覆盖。

## 能力与限制

Cursor rules 是可靠的 always-on 通道。Hook 可以补充会话、注入检索计划或准备交接，但部分宿主版本不会把 Hook 上下文传给 Agent。[限制页](cursor-limitations.zh-CN.md)给出回退：Hook 缺失时使用 CLI 生成的 dispatch prompt，并检查 canonical workflow。

Skills、MCP server 与检索 Provider 遵循统一的[install → adopt → bind 模型](../capabilities/native-adoption.zh-CN.md)。原生资源仍由宿主或用户所有，或以 borrowed 记录；只有字节与 ownership receipt 都支持时，Pactile 投影才是 managed。

## 分离

```bash
pactile detach cursor --dry-run
pactile detach cursor
```

分离 Cursor 只移除 Cursor claimant 及其 binding。若 Codex 仍在 claim，共享的 `AGENTS.md` 或 Skill 会保留；borrowed 或 modified 原生文件也会保留。双宿主示例见[共存](coexistence.zh-CN.md)。
