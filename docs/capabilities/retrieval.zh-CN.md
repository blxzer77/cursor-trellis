# 检索与 assurance

[English](retrieval.md) | 简体中文

检索是一种路由策略，不承诺每个宿主都拥有相同搜索工具。Pactile 使用四种 intent，并报告当前宿主与 Provider 事实实际支持的最低 assurance。

| intent       | 首选路由                         | 可选路由               | 必需证明                                       |
| ------------ | -------------------------------- | ---------------------- | ---------------------------------------------- |
| `exact`      | `rg`、路径与字面量搜索           | 无需额外工具           | 阅读当前文件和行范围。                         |
| `structural` | 显式 codegraph 或同类工具        | 宿主结构 Adapter       | 在源码中确认返回的 symbol/range。              |
| `semantic`   | 项目授权的 semantic Provider     | 宿主原生 semantic 工具 | 检查 binding、freshness 与策略，再做精确读取。 |
| `external`   | 显式 Provider，例如 smart-search | 获批的 Web fallback    | 保存来源 URL、时间与相关性。                   |

声称可选能力 readiness 前运行：

```bash
pactile capability-smoke --json
```

宿主 identity 或用户全局路由文件永远不能选择 Provider。Provider 缺失、过期、未授权或超出隐私策略时，应标记 `heuristic`、`degraded` 或 `unsupported`，并在安全时回到 exact search。候选检索只有经当前源码、Git diff、测试或受限 receipt 佐证后才是最终 Evidence。

## 隐私边界

External intent 只能向选定 Provider 发送用户批准的 query 与允许的上下文。默认不要发送凭据、私有日志、隐藏推理或整个仓库。另见[Provider](providers.zh-CN.md)与[隐私与权限](privacy-and-permissions.zh-CN.md)。
