# 恢复 Runbook

[English](recovery.md) | 简体中文

按症状、evidence、恢复、升级顺序处理。除非用户显式确认破坏性 purge，恢复都应保持局部且可逆。

| 症状                      | Evidence                                            | 恢复                                                                      | 何时升级                                     |
| ------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------- |
| Adapter 为 `degraded`     | Capability JSON、projection receipt、ownership 条目 | 解决宿主依赖或冲突，再只重试该 Adapter；不重建兄弟 Adapter。              | Receipt 表示 interrupted 或 ownership 含糊。 |
| Ownership 冲突            | Preimage 与当前字节 fingerprint                     | 保留文件；显式选择复用、重命名或跳过。                                    | 无法确定 owner 或 claimant。                 |
| Purge preview 过期        | 新 target fingerprint 不同                          | 停止，重新 dry-run 并审阅变化的 target 集。                               | 仍有 active claim 或不安全 target。          |
| Rollback target 未 sealed | Generation verification 错误                        | 从 install state/receipt 选择 sealed generation。                         | 没有 sealed generation。                     |
| Bin 冲突                  | 命令解析到意外 executable                           | 检查 PATH 与 package bins；使用 canonical `pactile`，不要盲删用户 alias。 | Package manifest 或安装 bin 含糊。           |

不要靠删除 `.pactile/`、重写 legacy 源或把 secret 复制进模板修复。只收集最少命令输出，并使用[支持](../governance/index.zh-CN.md)提交受治理 issue。
