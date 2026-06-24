# Smart Search CLI And Packaging Guidelines

This layer covers user-facing command contracts, npm wrapper behavior, release metadata, and bundled skill assets.

## Source Areas

- `src/smart_search/cli.py` builds the actual Python CLI.
- `npm/bin/smart-search.js` launches the installed Python runtime.
- `npm/scripts/postinstall.js` creates the isolated runtime and installs the bundled Python package.
- `npm/scripts/test.js` validates npm wrapper behavior.
- `skills/smart-search-cli/` and `src/smart_search/assets/skills/smart-search-cli/` must stay synchronized.
- `package.json` and `pyproject.toml` must agree on package metadata and version.

## Guides

| Guide | Use When |
| --- | --- |
| [CLI Contract](./cli-contract.md) | Adding flags, commands, aliases, output formats, or exit behavior. |
| [NPM Wrapper](./npm-wrapper.md) | Changing install, wrapper, version sync, or package contents. |
| [Release And Assets](./release-and-assets.md) | Updating bundled skill assets, README release notes, or package publishing metadata. |

## Pre-Development Checklist

- Read `README.md` command tables and `skills/smart-search-cli/SKILL.md`.
- Preserve alias compatibility unless the task explicitly removes a deprecated command.
- Keep JSON output stable for agents.
- Update tests and docs together for public command changes.

