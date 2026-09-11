# 隐私与权限

[English](privacy-and-permissions.md) | 简体中文

Pactile 是本地项目工具。它只记录重建投影和审计结论所需的最少元数据，不拥有宿主凭据、OAuth 状态或私有推理。

| 数据或操作                       | 默认边界                                         | evidence 与同意                               |
| -------------------------------- | ------------------------------------------------ | --------------------------------------------- |
| `.pactile/` 状态与 receipt       | 本地项目文件                                     | 用户控制仓库访问和保留。                      |
| 宿主投影与原生资产               | 除非 managed receipt 另有说明，否则属于宿主/用户 | Ownership preimage 与 claimant ledger。       |
| Provider query/context           | 仅发送给选定且获批的 Provider，并限于允许上下文  | Manifest、策略上限与受限 probe/result。       |
| Credential/API key               | 宿主 secret store 或环境；永不进入项目模板       | 可以检查是否存在；永不记录值。                |
| 网络、浏览器、GitHub 或 MCP 写入 | 不自动执行                                       | 用户显式意图、宿主授权与可审阅 receipt。      |
| 破坏性 purge                     | 无默认动作                                       | dry-run target fingerprint 后再精确显式确认。 |

不要把 token、私有日志、隐藏模型推理或无关项目文件粘贴到 issue、Evidence 或 Provider prompt。Provider readiness 正常也可能 assurance 不足；应 fail closed 并说明下一步安全动作。
