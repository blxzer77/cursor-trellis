# Rollback and purge

English | [简体中文](rollback-and-purge.zh-CN.md)

Rollback returns to a sealed generation. Purge is a separate destructive
operation and is never implied by uninstall.

## Roll back

List the sealed generation identifier from the runtime receipts or install
state, then preview it:

```bash
pactile rollback <generation> --dry-run
pactile rollback <generation>
```

The preview verifies both the current and target seals. Apply materializes the
target canonical files and reconciles attached adapters. An adapter may be
`degraded` if its host projection cannot be safely reconciled; the canonical
generation and receipt still identify the exact outcome. An unsealed, changed,
ambiguous, or missing generation is rejected.

## Purge

First detach every host and confirm the install is inactive:

```bash
pactile uninstall --dry-run
pactile uninstall --yes
pactile purge --dry-run
pactile purge --yes --preview-fingerprint <sha256:...>
```

Purge accepts only the exact fingerprint from the immediately reviewed preview.
It re-inventories every target and moves the canonical root to a checked
tombstone before deleting it. A changed target set, active claimant, symlink,
lock, or race stops safely. The final receipt is returned to the caller because
the canonical store no longer exists.
