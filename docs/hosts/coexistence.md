# Cursor and Codex coexistence

English | [简体中文](coexistence.zh-CN.md)

Coexistence means two adapters claim one canonical project; it does not mean
two copies of the workflow. Installation order is deliberately irrelevant.

## Attach both hosts

```bash
pactile init --cursor --codex -y
pactile capability-smoke --json
```

The resulting ownership model is:

| Resource                                   | Claimants                        | Detach behavior                                                                         |
| ------------------------------------------ | -------------------------------- | --------------------------------------------------------------------------------------- |
| `.pactile/` generation and ledger          | Pactile canonical owner          | Never removed by host detach.                                                           |
| Managed `AGENTS.md` block                  | Cursor and/or Codex              | Remove only the detaching claimant; preserve user text and remaining claims.            |
| Shared `.agents/skills/` Tile              | Each attached host that binds it | Delete a generated Skill only after the final claimant leaves and bytes are still safe. |
| Host-specific `.cursor/` or optional `.codex/` leaf | One adapter              | Remove that adapter's binding when safe; an unavailable Codex app may leave no `.codex/` leaf. |
| Native MCP/provider installation           | User or host                     | Never deleted by Pactile detach.                                                        |

If a pre-existing file is compatible, `adopt` records it as borrowed and keeps
its preimage. If it conflicts, Pactile reports `conflict` and waits for an
explicit choice. A failed Cursor projection therefore does not roll back a
successful Codex projection or the sealed canonical generation.

## Add or remove one host

To add a host to an existing project, run the matching `init` command from the
project root and review the dry-run output. To remove one:

```bash
pactile detach cursor --dry-run
pactile detach cursor
pactile detach codex --dry-run
pactile detach codex
```

The first command pair leaves Codex claimants in place; after the final host is
detached, `.pactile/` remains available for a later rebind or explicit purge.
For a complete removal plan, read [detach and uninstall](../lifecycle/detach-and-uninstall.md).
