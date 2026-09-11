# Middleware Providers

English | [简体中文](providers.zh-CN.md)

Providers are independently installed integrations resolved through the
project's Middleware configuration. A Provider has an origin, version,
authorization, binding, readiness, freshness, assurance, and privacy policy;
each field is evidence-bearing and bounded.

## Resolution checklist

1. The project explicitly selects the capability and Provider.
2. The manifest is valid and names the permitted intents and policy ceiling.
3. A binding connects the intent to this host and project.
4. Runtime facts and a time-bounded probe establish readiness and freshness.
5. Credentials stay in the host's secret store or environment; only safe
   references and redacted outcomes enter receipts.
6. The resolver reports `selected`, `fallback`, `degraded`, or `unsupported`
   with a user action when the checks do not pass.

Pactile does not auto-install an MCP package, copy an API key, or select a
Provider because its name happens to appear in a global config. Optional
Providers can be unavailable while exact local capability remains usable.

## Evidence and failure

Keep the manifest identifier, Provider version, probe time, status, and bounded
error code. Do not retain token values or arbitrary provider output in the
project ledger. A stale or failed probe lowers the claim; it does not justify a
silent fallback that changes the requested intent. Read [retrieval](retrieval.md)
for intent-specific proof and [privacy](privacy-and-permissions.md) for data flow.
