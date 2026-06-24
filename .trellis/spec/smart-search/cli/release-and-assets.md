# Release And Assets

## Bundled Skill Assets

The public skill is stored in two places:

- `skills/smart-search-cli/`
- `src/smart_search/assets/skills/smart-search-cli/`

When changing workflow instructions, examples, references, or agents, keep both copies synchronized. Tests and packaging rely on the asset copy being included by `pyproject.toml` package data and `package.json.files`.

## Documentation Updates

Public behavior changes usually require updates to:

- `README.md`
- `README.zh-CN.md`
- `skills/smart-search-cli/SKILL.md`
- `skills/smart-search-cli/references/cli-contract.md`
- Matching files under `src/smart_search/assets/skills/smart-search-cli/`
- `tests/test_release_workflow.py` when release or workflow expectations change.

## Release Lane Rules

The project uses npm stable and prerelease lanes. Preserve the README's distinction between:

- stable releases via tags and npm `latest`;
- beta/test releases through Actions and npm `next`;
- manual backfill only with explicit version and tag intent.

Do not publish, tag, or push unless the user explicitly asks.

