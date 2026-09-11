# Install、adopt 与 bind

[English](native-adoption.md) | 简体中文

Pactile 区分安装 Pactile 投影和 adopt 宿主原生资源。这一差异保护用户文件，也避免两个宿主创建重复状态。

| 观察状态                            | 操作           | ownership 结果                              | detach 结果                            |
| ----------------------------------- | -------------- | ------------------------------------------- | -------------------------------------- |
| 外部/原生依赖缺失                   | `install-hint` | 由用户或宿主安装；之后探测到时是 borrowed。 | Pactile 永不移除。                     |
| Pactile 投影缺失                    | `install`      | Pactile 记录 managed 资源和请求 claimant。  | 只有最后 claimant 且字节安全时才删除。 |
| 兼容的已有原生资产                  | `adopt`        | 记录 owner、preimage 与 borrowed control。  | 保留资产。                             |
| 已安装或 adopted 资产可供 Tile 使用 | `bind`         | 增加宿主/能力 binding 与 claimant。         | 只移除该 binding。                     |
| 同一 identity 但语义不同            | `conflict`     | 保留字节并要求选择。                        | 保留审查证据。                         |
| 格式错误、锁定、不可信或不可用      | `degraded`     | 保留可重试 plan，只影响一个宿主。           | 用户解决原因后重试。                   |

资源 identity 是 workspace 内的 `kind + stable logical id`。Ownership 记录 claimant、control（`managed` 或 `borrowed`）、preimage、当前 fingerprint 与删除策略。Binding 不是 ownership，宿主 identity 也不是授权。

## 安全顺序

```text
detect -> preview plan -> explicit install/adopt/bind -> reconcile -> receipt
```

使用 `pactile update --dry-run` 检查 projection plan。遇到冲突或修改字节时停止并显式解决 ownership。不要靠删除文件或把 canonical 内容复制进原生配置来解决冲突。
