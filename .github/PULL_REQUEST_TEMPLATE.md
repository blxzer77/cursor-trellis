## Change summary / 变更摘要

<!-- Describe the user outcome and the bounded write set. / 说明用户结果与有限写集。 -->

## Pactile context / Pactile 上下文

- Pactile version / 版本:
- Host (`cursor`, `codex`, or both) / 宿主:
- Capability mode and Provider (if any) / 能力 mode 与 Provider（如有）:
- Task or issue:

## Verification / 验证

<!-- List commands, exit status, and skipped checks with reasons. / 列出命令、退出状态及跳过原因。 -->

- [ ] Focused tests or docs smoke:
- [ ] `pnpm typecheck` / `pnpm lint` as applicable:
- [ ] Full Core + CLI suite (final release preflight only, if actually run):
- [ ] Ownership, projection, and rollback impact reviewed:

## Safety / 安全

- [ ] No credentials, tokens, private logs, or user data are included.
- [ ] Historical, foreign, borrowed, and modified resources are preserved.
- [ ] No tag, publish, remote mutation, or destructive purge was run unless
      explicitly authorized by the release owner.
