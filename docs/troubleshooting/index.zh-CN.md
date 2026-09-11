# 排障索引

[English](index.md) | 简体中文

从只读 evidence 开始。原因未知时不要删除宿主文件、绕过 fingerprint 或重复运行破坏性命令。

| 症状           | Runbook                                | 首个 evidence                                                     |
| -------------- | -------------------------------------- | ----------------------------------------------------------------- |
| 能力缺失或过期 | [Doctor 风格检查](doctor.zh-CN.md)     | `pactile capability-smoke --json`。                               |
| 投影或迁移停止 | [恢复](recovery.zh-CN.md)              | Install state、ownership ledger、receipt 与当前字节 fingerprint。 |
| 想了解支持边界 | [已知限制](known-limitations.zh-CN.md) | mode、Provider readiness 与宿主证据。                             |

常用顺序：

```bash
pactile capability-smoke --json
pactile update --dry-run
pactile validate-rules
```

保留输出、命令退出状态和相关路径。分享前脱敏 token、私有日志与用户内容。
