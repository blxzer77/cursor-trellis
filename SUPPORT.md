# Support / 支持

## Before asking / 提问前

Run the read-only diagnostics and copy the exit status:

```bash
pactile capability-smoke --json
pactile validate-rules
pactile update --dry-run
```

运行只读诊断并保留退出状态：

```bash
pactile capability-smoke --json
pactile validate-rules
pactile update --dry-run
```

## What to include / 请提供

State the Pactile version, host (`cursor`, `codex`, or both), capability mode,
OS/Node version, minimal reproduction, and redacted output or receipt. Explain
whether the project is fresh, legacy-imported, mixed, or already detached.

请说明 Pactile 版本、宿主（`cursor`、`codex` 或二者）、capability mode、OS/Node 版本、最小复现步骤，以及脱敏后的输出或 receipt。说明项目是 fresh、legacy-import、mixed 还是已 detach。

Do not include credentials, tokens, private logs, hidden reasoning, customer
data, or an entire project archive. Use the private security channel for a
vulnerability; use a public issue only for ordinary support after redaction.

不要提供 credential、token、私有日志、隐藏推理、客户数据或整个项目压缩包。漏洞请使用私密安全渠道；普通支持问题脱敏后再使用公开 issue。
