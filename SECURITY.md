# Security policy

English | [中文说明](docs/governance/security.zh-CN.md)

Please report suspected vulnerabilities through a private security channel for
the repository. Do not put undisclosed details in a public issue, pull request,
changelog, or Provider prompt.

Include the minimum safe report:

- affected Pactile version, host, and capability mode;
- a redacted reproduction that does not exfiltrate data;
- impact and the smallest affected path or resource;
- relevant exit status, receipt, or fingerprint with secrets removed.

Never attach API keys, access tokens, private logs, customer data, hidden model
reasoning, or a complete private repository. Maintainers may request additional
material through the private channel, coordinate a fix, and agree on a
disclosure date before publication.

The policy covers credential and Provider egress, ownership confusion, path
traversal, unsafe purge, projection overwrite, and any way to bypass a Kernel
gate or preview fingerprint.
