# Changelog

All notable changes to **@blxzer/cursor-trellis** are documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).  
SemVer: [semver.org](https://semver.org/spec/v2.0.0.html).

> This is a **new npm product line**. Prior internal releases shipped as `@blxzer/trellis` (1.x). They remain on npm for history; use `@blxzer/cursor-trellis` for new installs.

---

## [0.1.0] - 2026-06-20

First public release under `@blxzer/cursor-trellis` / `@blxzer/cursor-trellis-core`.

### Added

- Public GitHub repo: [blxzer77/cursor-trellis](https://github.com/blxzer77/cursor-trellis).
- Router v2 codebase retrieval (platform-adaptive routing, codegraph structural-first, token economy).
- Cursor `.cursor/rules/trellis-triage.mdc` (Request Triage hard gate via rules channel).
- Cursor commands-only default policy + `trellis-cursor2plus-setup` command.
- `release:publish` script (publishes core then cli in dependency order).
- Fresh migration manifest line starting at `0.1.0` (legacy `@blxzer/trellis` manifests archived in-repo).

### Changed

- Package rename from `@blxzer/trellis` → `@blxzer/cursor-trellis` (and matching `-core` SDK).
- `trellis update` non-interactive contexts fail fast instead of hanging on prompts.

### Install

```bash
npm install -g @blxzer/cursor-trellis
```

### Migrating from `@blxzer/trellis`

```bash
npm uninstall -g @blxzer/trellis
npm install -g @blxzer/cursor-trellis
# In each project:
trellis update
```

[0.1.0]: https://github.com/blxzer77/cursor-trellis/releases/tag/v0.1.0
