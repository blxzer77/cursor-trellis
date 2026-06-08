# Plugin Guidelines

> Claude Code plugin manifest patterns and conventions.

---

## File Location

Plugin configuration directory: `.claude-plugin/` (project root)

```
.claude-plugin/
├── marketplace.json   # Marketplace manifest (required)
├── plugin.json        # Plugin definition (required)
└── README.md          # Installation docs (recommended)
```

---

## marketplace.json Schema

This file defines the marketplace and lists available plugins.

### Required Fields

| Field      | Type   | Description                     |
| ---------- | ------ | ------------------------------- |
| `name`     | string | Marketplace identifier          |
| `owner`    | object | Owner info with `name`, `email` |
| `metadata` | object | Contains `description`          |
| `plugins`  | array  | List of plugin definitions      |

### Plugin Entry Fields

| Field         | Type   | Required | Description               |
| ------------- | ------ | -------- | ------------------------- |
| `name`        | string | Yes      | Plugin identifier         |
| `source`      | string | Yes      | Path to plugin (relative) |
| `description` | string | No       | What the plugin does      |
| `author`      | object | No       | Object with `name` field  |
| `homepage`    | string | No       | Plugin homepage URL       |
| `repository`  | string | No       | Source repository URL     |
| `license`     | string | No       | License identifier        |
| `keywords`    | array  | No       | Search keywords           |
| `category`    | string | No       | Plugin category           |
| `tags`        | array  | No       | Descriptive tags          |

### Example

```json
{
  "name": "my-marketplace",
  "owner": {
    "name": "Your Name",
    "email": "you@example.com"
  },
  "metadata": {
    "description": "Description of your marketplace"
  },
  "plugins": [
    {
      "name": "my-plugin",
      "source": "./path/to/plugin",
      "description": "What this plugin does",
      "author": {
        "name": "Your Name"
      },
      "category": "workflow",
      "tags": ["tag1", "tag2"]
    }
  ]
}
```

---

## plugin.json Schema

This file defines the plugin itself.

### Required Fields

| Field         | Type   | Description          |
| ------------- | ------ | -------------------- |
| `name`        | string | Plugin identifier    |
| `version`     | string | Semantic version     |
| `description` | string | What the plugin does |

### Optional Fields

| Field        | Type   | Description                  |
| ------------ | ------ | ---------------------------- |
| `author`     | object | Object with `name` and `url` |
| `homepage`   | string | Plugin homepage URL          |
| `repository` | string | Source repository URL        |
| `license`    | string | License identifier           |
| `keywords`   | array  | Search keywords              |
| `skills`     | array  | Paths to skills              |
| `agents`     | array  | Paths to agent files         |
| `commands`   | array  | Paths to commands            |

### Example

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "What this plugin does",
  "author": {
    "name": "Your Name",
    "url": "https://github.com/you"
  },
  "homepage": "https://example.com",
  "repository": "https://github.com/you/repo",
  "license": "MIT",
  "keywords": ["keyword1", "keyword2"],
  "skills": ["./skills/my-skill"]
}
```

---

## Common Mistakes

### Mistake: author as string

**Symptom**: `plugins.0.author: Invalid input: expected object, received string`

```json
// ❌ WRONG
{
  "author": "Your Name"
}

// ✅ CORRECT
{
  "author": {
    "name": "Your Name"
  }
}
```

### Mistake: Missing source field

**Symptom**: `plugins.0.source: Invalid input`

```json
// ❌ WRONG - No source
{
  "plugins": [
    {
      "name": "my-plugin",
      "description": "..."
    }
  ]
}

// ✅ CORRECT - Include source
{
  "plugins": [
    {
      "name": "my-plugin",
      "source": "./path/to/plugin",
      "description": "..."
    }
  ]
}
```

### Mistake: Missing root-level fields

**Symptom**: `name: expected string, received undefined` or `owner: expected object, received undefined`

```json
// ❌ WRONG - Missing name and owner
{
  "plugins": [...]
}

// ✅ CORRECT - Include all root fields
{
  "name": "marketplace-name",
  "owner": {
    "name": "Owner Name",
    "email": "email@example.com"
  },
  "metadata": {
    "description": "..."
  },
  "plugins": [...]
}
```

### Mistake: Missing version in plugin.json

**Symptom**: Validation fails silently or during marketplace install

```json
// ❌ WRONG - No version
{
  "name": "my-plugin",
  "description": "..."
}

// ✅ CORRECT - Include version
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "..."
}
```

### Mistake: Component fields as strings instead of arrays

**Symptom**: `agents: Invalid input` or similar

```json
// ❌ WRONG - String value
{
  "skills": "./skills"
}

// ✅ CORRECT - Array value
{
  "skills": ["./skills/my-skill"]
}
```

### Mistake: Directory paths for agents

**Symptom**: Validation fails for agents

```json
// ❌ WRONG - Directory path
{
  "agents": ["./agents/"]
}

// ✅ CORRECT - Explicit file paths
{
  "agents": [
    "./agents/planner.md",
    "./agents/reviewer.md"
  ]
}
```

> **Note**: `skills` and `commands` can use directory paths, but `agents` must use explicit file paths.

### Mistake: Adding hooks field

**Symptom**: `Duplicate hooks file detected`

```json
// ❌ WRONG - Explicit hooks declaration
{
  "hooks": ["./hooks/hooks.json"]
}

// ✅ CORRECT - No hooks field
{
  // hooks/hooks.json is auto-loaded by convention
}
```

> **Warning**: Claude Code v2.1+ automatically loads `hooks/hooks.json` by convention. Adding it explicitly causes a duplicate error.

---

## Validation

Before publishing, validate your plugin:

```bash
claude plugin validate .claude-plugin/plugin.json
```

Or from within Claude Code:

```
/plugin validate .
```

---

## Best Practices

### DO

- Include `version` in plugin.json
- Use object format for `author` (not string)
- Always include `source` in plugin entries
- Use arrays for component fields (`skills`, `agents`, `commands`)
- Use explicit file paths for `agents`
- Add a README.md with installation instructions

### DON'T

- Use string values for `author`
- Omit required root fields (`name`, `owner`)
- Use directory paths for `agents`
- Add explicit `hooks` field (auto-loaded by convention)
- Forget to validate before publishing

---

## Reference

- [Claude Code Plugin Docs](https://code.claude.com/docs/en/plugin-marketplaces)
- [everything-claude-code example](https://github.com/affaan-m/everything-claude-code/tree/main/.claude-plugin)
