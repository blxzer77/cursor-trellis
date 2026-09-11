# Known limitations

English | [简体中文](known-limitations.zh-CN.md)

These are explicit boundaries, not hidden failures:

- Cursor hook context is best-effort; rules, canonical workflow, and CLI
  dispatch prompts remain the fallback.
- Codex and Cursor can expose different native tools. Capability parity is
  reported per host, not inferred from similar names.
- Optional MCP and retrieval Providers are not installed or authorized by
  Pactile. Missing readiness is a valid `unsupported` or `degraded` result.
- A Provider result is a candidate until source, Git, tests, or a bounded
  receipt corroborates it.
- Detach and uninstall preserve canonical state; only an explicitly confirmed
  purge removes the canonical target set.
- The current CLI has no `doctor` command; use the diagnostic checks in the
  [doctor-style page](doctor.md).
- Full Core and CLI tests are a release-preflight gate, not a claim that every
  local change has run the whole suite.
