# NPM Wrapper

## Wrapper Ownership

The npm package exposes one command, `smart-search`, but the implementation remains Python.

Local pattern:

- `package.json` declares `"bin": { "smart-search": "npm/bin/smart-search.js" }`.
- `npm/scripts/postinstall.js` creates `.smart-search-python` and installs the local Python package into it.
- `npm/bin/smart-search.js` should launch the installed Python CLI, not reimplement command behavior.
- `npm/scripts/test.js` validates wrapper behavior.

## Rules

- Do not add research behavior to npm scripts.
- Keep Python version probing in postinstall simple and Windows-aware.
- Keep package files listed in `package.json.files`; ensure bundled skill assets and Python package data are included.
- When version changes, keep `package.json` and `pyproject.toml` synchronized through existing npm scripts.
- Do not commit generated runtime directories such as `.smart-search-python`, `build/`, or `*.egg-info` unless a task explicitly changes packaging fixtures.

## Validation

Use:

```powershell
npm test
npm run pack:dry
```

Use Python tests for behavior and npm tests for packaging/wrapper integration.

