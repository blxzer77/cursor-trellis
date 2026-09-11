# Host integrations

English | [简体中文](index.zh-CN.md)

Pactile keeps one canonical project state and projects it into the host(s) you
actually use. Choose a single host for the smallest surface, or attach both
when the same project is opened in Cursor and Codex. Host pages describe the
observable support contract; they do not imply that a host-native tool or
provider is installed.

## Choose a path

| Need               | Start here                                  | Result                                                                |
| ------------------ | ------------------------------------------- | --------------------------------------------------------------------- |
| Cursor only        | [Cursor](cursor.md)                         | `.pactile/` plus a Cursor projection under `.cursor/`.                |
| Codex only         | [Codex](codex.md)                           | `.pactile/` plus an optional `.codex/` projection when native support is ready. |
| Both hosts         | [Coexistence](coexistence.md)               | One canonical generation, shared claimants, and host-specific leaves. |
| Cursor constraints | [Cursor limitations](cursor-limitations.md) | Known injection and provider boundaries with safe fallbacks.          |

Every host follows the same sequence:

```text
detect -> install or adopt -> bind -> reconcile -> report readiness
```

Detection is read-only. If a native dependency is missing, Pactile reports an
installation hint; it does not install a host tool or copy credentials. A
successful canonical install can therefore coexist with a `degraded` optional
capability.

## Common first run

```bash
npm install -g @blxzer/pactile
pactile init --cursor --codex -y
pactile capability-smoke --json
```

Use only the host flags you want. Read the JSON readiness and user action
before treating a capability as available. Continue with [capability
origins and providers](../capabilities/index.md) or [lifecycle safety](../lifecycle/index.md).
