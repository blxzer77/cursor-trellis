# Security reporting

English | [简体中文](security.zh-CN.md)

Please report a suspected vulnerability privately using the instructions in
[SECURITY.md](../../SECURITY.md). Do not open a public issue for an undisclosed
security problem and do not attach secrets, tokens, private logs, or customer
data.

Include only the minimum reproducible detail: affected version, host and mode,
safe steps that do not exfiltrate data, impact, and redacted Evidence. The
maintainer may request a private channel for additional material. We will
acknowledge receipt, validate the report, coordinate a fix, and agree on a
disclosure date; do not publish an exploit before that coordination.

Security boundaries include credential handling, Provider egress, ownership
confusion, path traversal, unsafe purge, and projection overwrite. A successful
probe or host identity is not authorization to access another user's data.
