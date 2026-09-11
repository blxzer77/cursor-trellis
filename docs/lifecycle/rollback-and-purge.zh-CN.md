# 回滚与 purge

[English](rollback-and-purge.md) | 简体中文

Rollback 返回 sealed generation。Purge 是独立的破坏性操作，uninstall 不会隐含触发它。

## 回滚

从 runtime receipt 或 install state 找到 sealed generation identifier，再预览：

```bash
pactile rollback <generation> --dry-run
pactile rollback <generation>
```

Preview 会验证当前 seal 与目标 seal。应用时物化目标 canonical 文件并协调已连接 Adapter。若宿主投影无法安全协调，Adapter 可能是 `degraded`；canonical generation 与 receipt 仍标出精确结果。未 sealed、已改变、含糊或缺失的 generation 会被拒绝。

## Purge

先分离全部宿主并确认 install inactive：

```bash
pactile uninstall --dry-run
pactile uninstall --yes
pactile purge --dry-run
pactile purge --yes --preview-fingerprint <sha256:...>
```

Purge 只接受刚刚审阅的 preview 所给的精确 fingerprint。它重新盘点每个 target，先将 canonical root 移到受检查的 tombstone，再删除。target 集变化、active claimant、symlink、锁或竞态都会安全停止。由于 canonical store 已不存在，最终 receipt 返回给调用者而不持久化。
