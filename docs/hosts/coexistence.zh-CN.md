# Cursor 与 Codex 共存

[English](coexistence.md) | 简体中文

共存表示两个 Adapter claim 同一个 canonical 项目，不是维护两套 workflow。安装顺序不会改变最终结果。

## 连接两个宿主

```bash
pactile init --cursor --codex -y
pactile capability-smoke --json
```

得到的 ownership 模型如下：

| 资源                                  | claimant                | 分离行为                                                     |
| ------------------------------------- | ----------------------- | ------------------------------------------------------------ |
| `.pactile/` generation 与 ledger      | Pactile canonical owner | 宿主分离永不删除。                                           |
| 受管 `AGENTS.md` 区块                 | Cursor 和/或 Codex      | 只移除正在分离的 claimant；保留用户文本和其他 claimant。     |
| 共享 `.agents/skills/` Tile           | 绑定它的每个宿主        | 只有最后 claimant 离开且字节仍安全时，才可删除生成的 Skill。 |
| 宿主专属 `.cursor/` 或可选 `.codex/` 叶子 | 一个 Adapter       | 安全时移除该 Adapter binding；Codex 不可用时可能没有 `.codex/` 叶子。 |
| 原生 MCP/Provider 安装                | 用户或宿主              | Pactile 分离永不删除。                                       |

兼容的已有文件会以 borrowed 记录并保留 preimage。冲突会报告 `conflict`，等待显式选择。因此 Cursor 投影失败不会回滚成功的 Codex 投影或已 sealed 的 canonical generation。

## 增加或移除宿主

给已有项目增加宿主时，从项目根目录运行对应的 `init` 并审阅 dry-run 输出。移除宿主：

```bash
pactile detach cursor --dry-run
pactile detach cursor
pactile detach codex --dry-run
pactile detach codex
```

第一组命令只会留下 Codex claimant；最后一个宿主分离后，`.pactile/` 仍保留，可稍后重新 bind 或显式 purge。完整移除计划见[分离与卸载](../lifecycle/detach-and-uninstall.zh-CN.md)。
