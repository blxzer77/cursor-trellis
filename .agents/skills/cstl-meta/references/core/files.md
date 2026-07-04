# Trellis File Reference

Complete reference of all files in the `.cstl/` directory.

---

## Directory Structure

```
.cstl/
├── .developer              # Developer identity (gitignored)
├── .runtime/               # Session-scoped runtime state (gitignored)
├── .current-task           # Legacy ignored pointer; not an active-task source
├── .ralph-state.json       # Ralph Loop state (gitignored)
├── .template-hashes.json   # Template version tracking
├── .version                # Installed Trellis version
├── .gitignore              # Git ignore rules
├── workflow.md             # Main workflow documentation
├── worktree.yaml           # Multi-session configuration
│
├── workspace/              # Developer workspaces
├── tasks/                  # Task tracking
├── spec/                   # Coding guidelines
└── scripts/                # Automation scripts
```

---

## Root Files

### `.developer`

**Purpose**: Store current developer identity.

**Created by**: `init_developer.py`

**Format**: Plain text, single line with developer name.

```
taosu
```

**Gitignored**: Yes - each machine has its own identity.

---

### `.runtime/sessions/<session-key>.json`

**Purpose**: Store active task state for one AI session/window.

**Created by**: `task.py start <task-dir>`

**Format**: JSON runtime context.

```json
{
  "current_task": ".cstl/tasks/01-31-add-login-taosu",
  "current_run": null,
  "platform": "cursor",
  "last_seen_at": "2026-04-27T00:00:00Z"
}
```

**Gitignored**: Yes - each session/window has its own active task.

**Used by**:
- Hooks resolve this through `common.active_task`
- Scripts use this for active task operations

### `.current-task`

**Purpose**: Legacy ignored pointer from older Trellis versions.

**Active-task behavior**: Not read or written as a fallback. Current Trellis
uses `.runtime/sessions/<session-key>.json` only.

---

### `.ralph-state.json`

**Purpose**: Track Ralph Loop iteration state.

**Created by**: Legacy Ralph Loop tooling (not shipped in cursor-trellis; file may remain gitignored if present from older upgrades)

**Format**: JSON

```json
{
  "task": ".cstl/tasks/01-31-add-login",
  "iteration": 2,
  "started_at": "2026-01-31T10:30:00"
}
```

**Gitignored**: Yes - runtime state.

**Fields**:
| Field | Type | Description |
|-------|------|-------------|
| `task` | string | Task directory path |
| `iteration` | number | Current iteration (1-5) |
| `started_at` | ISO date | When loop started |

---

### `.template-hashes.json`

**Purpose**: Track template file versions for `cstl update`.

**Created by**: `cstl init` or `cstl update`

**Format**: JSON object mapping file paths to SHA-256 hashes.

```json
{
  ".cstl/workflow.md": "028891d1fe839a266...",
  ".cursor/hooks/session-start.py": "0a9899e80f6bfe15...",
  ".cursor/commands/cstl-start.md": "d1276dcbff880299..."
}
```

**Used by**:
- `cstl update` - Detect which files have been modified
- Determines if files can be auto-updated or need conflict resolution

**Behavior**:
- File hash matches template → Safe to update
- File hash differs → User modified, needs manual merge

---

### `.version`

**Purpose**: Track installed Trellis CLI version.

**Created by**: `cstl init` or `cstl update`

**Format**: Plain text, semver version string.

```
0.3.0-beta.5
```

**Used by**:
- `cstl update` - Determine if update is needed
- Version mismatch detection

---

### `.gitignore`

**Purpose**: Define which files to exclude from git.

**Default content**:
```gitignore
# Developer identity (local only)
.developer

# Legacy current task pointer
.current-task

# Session runtime state
.runtime/

# Ralph Loop state
.ralph-state.json

# Agent runtime files
.agents/
.agent-log
.agent-runner.sh
.session-id

# Task directory runtime files
.plan-log

# Atomic update temp files
*.tmp
.backup-*
*.new

# Python cache
**/__pycache__/
**/*.pyc
```

---

### `workflow.md`

**Purpose**: Main workflow documentation for developers and AI.

**Created by**: `cstl init`

**Content sections**:
1. Quick Start guide
2. Workflow overview
3. Session start process
4. Development process
5. Session end
6. File descriptions
7. Best practices

**Injected by**: `.cursor/hooks/session-start.py` (and related hooks) on Cursor.

---

### `worktree.yaml`

**Purpose**: Configure Multi-Session and Ralph Loop.

**Created by**: `cstl init`

**Format**: YAML

```yaml
worktree_dir: ../worktrees
copy:
  - .cstl/.developer
  - .env
post_create:
  - npm install
verify:
  - pnpm lint
  - pnpm typecheck
```

Fields: `worktree_dir`, `copy`, `post_create`, `verify` — used by contributor worktree flows; customize per project needs.

---

## Runtime Files (Gitignored)

### `.agents/`

**Purpose**: Agent registry for Multi-Session.

**Location**: `.cstl/workspace/{developer}/.agents/`

**Content**: `registry.json` tracking running agents.

---

### `.session-id`

**Purpose**: Legacy session identifier from upstream multi-session tooling.

**Created by**: Not used by cursor-trellis Cursor hooks.

**Format**: UUID string.

---

### `.agent-log`

**Purpose**: Agent execution log.

**Created by**: Multi-Session scripts.

---

### `.plan-log`

**Purpose**: Plan Agent execution log.

**Location**: Task directory.

---

## Directories

### `workspace/`

Developer workspaces with journals and indexes.

→ See `core/workspace.md`

### `tasks/`

Task directories with PRDs and session files.

→ See `core/tasks.md`

### `spec/`

Coding guidelines and specifications.

→ See `core/specs.md`

### `scripts/`

Automation scripts.

→ See `core/scripts.md`

---

## Template Files

These files are managed by `cstl update`:

| File | Purpose |
|------|---------|
| `.cstl/workflow.md` | Workflow documentation |
| `.cstl/worktree.yaml` | Multi-session config |
| `.cstl/.gitignore` | Git ignore rules |
| `.cursor/hooks/*.py` | Hook scripts |
| `.cursor/commands/*.md` | Slash commands |
| `.cursor/agents/*.md` | Agent definitions |
| `.cursor/rules/*.mdc` | Always-on policy rules |

**Update behavior**:
1. Compare file hash with `.template-hashes.json`
2. If unchanged → Auto-update
3. If modified → Create `.new` file for manual merge
4. Update hashes after successful update

---

## File Lifecycle

### Created by `cstl init`

```
.cstl/
├── .template-hashes.json
├── .version
├── .gitignore
├── workflow.md
├── worktree.yaml
├── spec/
│   ├── frontend/
│   ├── backend/
│   └── guides/
└── scripts/
```

### Created at runtime

```
.cstl/
├── .developer           # init_developer.py
├── .runtime/sessions/   # task.py start
├── .current-task        # legacy ignored file, not active-task source
├── .ralph-state.json    # legacy (gitignored)
├── workspace/{dev}/     # init_developer.py
│   ├── index.md
│   ├── journal-1.md
│   └── .agents/
└── tasks/{task}/        # task.py create
    ├── task.json
    ├── prd.md
    └── *.jsonl
```

### Cleaned up

```
# After task completion
.cstl/tasks/{task}/ → .cstl/tasks/archive/YYYY-MM/

# After worktree removal
.agents/registry.json entries removed
```
