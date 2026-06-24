# Trellis CLI Guidelines

This layer covers TypeScript CLI commands, platform configurators, package scripts, release flow, and the vendored Smart Search wrapper.

## Source Areas

- `packages/cli/src/cli/index.ts` wires the command entrypoint.
- `packages/cli/src/commands/` implements `init`, `update`, `workflow`, `mem`, `channel`, `uninstall`, and release-adjacent commands.
- `packages/cli/src/configurators/` owns platform-specific output.
- `packages/cli/scripts/` owns build, postinstall, release, and vendor-sync helpers.
- `packages/cli/vendor/smart-search/` is vendored runtime content.
- Root `package.json` orchestrates workspace scripts.

## Guides

| Guide | Use When |
| --- | --- |
| [Commands And Configurators](./commands-and-configurators.md) | Adding flags, commands, platform support, or init/update behavior. |
| [Python Template Runtime](./python-template-runtime.md) | Editing generated `.trellis/scripts/*.py` or hook behavior. |
| [Release And Vendor](./release-and-vendor.md) | Touching release scripts, package metadata, smart-search vendoring, or postinstall. |

## Pre-Development Checklist

- Check root and package-level `package.json` scripts.
- Search for existing command/configurator patterns before adding new helpers.
- Keep command behavior non-interactive-safe when used in CI or tests.
- Preserve Windows behavior; this project is actively used on Windows.

