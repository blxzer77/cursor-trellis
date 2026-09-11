# 宿主集成

[English](index.md) | 简体中文

Pactile 只保留一份项目 canonical 状态，再投影到实际使用的宿主。项目可以只连接一个宿主，也可以在 Cursor 与 Codex 间共存。宿主页面描述可观察的支持契约，不把宿主原生工具或 Provider 的安装状态假定为已满足。

## 选择路径

| 需求        | 从这里开始                                 | 结果                                                         |
| ----------- | ------------------------------------------ | ------------------------------------------------------------ |
| 只用 Cursor | [Cursor](cursor.zh-CN.md)                  | `.pactile/` 加 `.cursor/` 下的 Cursor 投影。                 |
| 只用 Codex  | [Codex](codex.zh-CN.md)                    | `.pactile/` 加原生支持就绪时才生成的可选 `.codex/` 投影。     |
| 两个宿主    | [共存](coexistence.zh-CN.md)               | 一份 canonical generation、共享 claimant，以及宿主专属叶子。 |
| Cursor 限制 | [Cursor 限制](cursor-limitations.zh-CN.md) | 已知注入与 Provider 边界及安全回退。                         |

所有宿主都遵循同一顺序：

```text
detect -> install or adopt -> bind -> reconcile -> report readiness
```

探测是只读的。缺少宿主依赖时，Pactile 只报告安装提示，不安装宿主工具，也不复制凭据。因此 canonical install 成功时，可选能力仍可能诚实地处于 `degraded`。

## 通用首次运行

```bash
npm install -g @blxzer/pactile
pactile init --cursor --codex -y
pactile capability-smoke --json
```

只传入需要的宿主 flag。先阅读 JSON 中的 readiness 与 user action，再判断能力是否可用。接下来阅读[能力来源与 Provider](../capabilities/index.zh-CN.md)或[生命周期安全](../lifecycle/index.zh-CN.md)。
