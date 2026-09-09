# Pactile lifecycle fixtures

These fixtures are immutable inputs for migration, rollback, uninstall, and recovery tests.

- `release-derived` scenarios extract a minimal installed-state shape from the named release. They are not full release archives.
- `representative` scenarios model failures or user-owned content and never claim byte identity with a release.
- Every file below a scenario's `input/` directory is declared in `scenario.json` and protected by SHA-256.
- Paths in manifests are POSIX-relative and must not escape `input/`.
- `byte-preserved` files must be compared as bytes by lifecycle tests. Active legacy files may be schema-transformed only into `.pactile`; the source fixture bytes remain read-only.
- Ownership-facing policies use all frozen v1 dispositions: `no-op`, `write-generated`, `restore-preimage`, `remove-generated`, `preserve-modified`, `preserve-borrowed`, and `manual-review`.
- `generated-lifecycle` binds write, rollback, and uninstall expectations to concrete target bytes; restore/write sources live under the inert canonical fixture root and are never inferred from host state.
- `.trellis` input requires explicit import approval. Missing-ledger host content is only an adoption candidate until explicit adoption evidence exists.
- `.gitattributes` marks every `input/` byte as `-text`, so Git cannot rewrite evidence across operating systems.
- `.gitignore` only re-includes inert hidden runtime roots below these fixtures; it does not change product-runtime ignores.

Do not update a checksum merely to make a test pass. Review the fixture change and its provenance first.
