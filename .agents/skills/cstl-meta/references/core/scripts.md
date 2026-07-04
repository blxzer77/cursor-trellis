# Core Scripts

Platform-independent Python scripts for Trellis automation.

---

## Overview

These scripts only read/write files under `.cstl/` — they do not depend on a specific AI IDE runtime. Cursor hooks call them; you can also run them from a terminal.

```
.cstl/scripts/
├── common/                 # Shared utilities
│   ├── paths.py
│   ├── developer.py
│   ├── task_utils.py
│   ├── phase.py
│   └── git_context.py
│
├── init_developer.py       # Initialize developer
├── get_developer.py        # Get developer name
├── get_context.py          # Get session runtime
├── task.py                 # Task management CLI
└── add_session.py          # Record session
```

---

## Developer Scripts

### `init_developer.py`

Initialize developer identity.

```bash
python3 .cstl/scripts/init_developer.py <name>
```

**Creates:**
- `.cstl/.developer`
- `.cstl/workspace/<name>/`
- `.cstl/workspace/<name>/index.md`
- `.cstl/workspace/<name>/journal-1.md`

---

### `get_developer.py`

Get current developer name.

```bash
python3 .cstl/scripts/get_developer.py
# Output: taosu
```

**Exit codes:**
- `0` - Success
- `1` - Not initialized

---

## Context Scripts

### `get_context.py`

Get session runtime for AI consumption.

```bash
python3 .cstl/scripts/get_context.py
```

**Output includes:**
- Developer identity
- Git status and recent commits
- Current task (if any)
- Workspace summary

---

### `add_session.py`

Record session entry to journal.

```bash
python3 .cstl/scripts/add_session.py "Session summary"
```

**Actions:**
1. Appends to current journal
2. Updates index markers
3. Rotates journal if needed

---

## Task Scripts

### `task.py`

Task management CLI.

#### Create Task

```bash
python3 .cstl/scripts/task.py create "Task name" --slug task-slug
```

**Options:**
- `--slug` - URL-safe identifier
- `--assignee` - Developer name (default: current)
- `--type` - Dev type: frontend, backend, fullstack

#### List Tasks

```bash
python3 .cstl/scripts/task.py list
```

**Output:**
```
Active Tasks:
  01-31-add-login-taosu (active)
  01-30-fix-api-cursor-agent (paused)
```

#### Start Task

```bash
python3 .cstl/scripts/task.py start <task-dir>
```

Sets the active task in `.cstl/.runtime/sessions/<session-key>.json`.
Without a session identity or `TRELLIS_CONTEXT_ID`, this command fails and
does not create `.cstl/.current-task`.

#### Finish Task

```bash
python3 .cstl/scripts/task.py finish
```

Clears the active task for the current session runtime only.

#### Initialize Context

```bash
python3 .cstl/scripts/task.py init-context <task-dir> <dev-type>
```

**Dev types:** `frontend`, `backend`, `fullstack`

Creates JSONL files with appropriate spec references.

#### Set Branch

```bash
python3 .cstl/scripts/task.py set-branch <task-dir> <branch-name>
```

Updates `branch` field in task.json.

#### Archive Task

```bash
python3 .cstl/scripts/task.py archive <task-dir>
```

Moves task to `.cstl/tasks/archive/YYYY-MM/`.

#### List Archive

```bash
python3 .cstl/scripts/task.py list-archive [month]
```

---

## Common Utilities

### `common/paths.py`

Path constants and utilities.

```python
from common.paths import (
    DIR_WORKFLOW,     # ".cstl" — directory name constant (not a full Path)
    DIR_WORKSPACE,    # "workspace"
    DIR_TASKS,        # "tasks"
    DIR_SPEC,         # "spec"
    DIR_SCRIPTS,      # "scripts"
    get_repo_root,
    get_tasks_dir,
    get_workspace_dir,
)
```

> **Legacy name:** pre-rename Trellis docs used `TRELLIS_DIR` for the runtime root. Current scripts use `DIR_WORKFLOW = ".cstl"` in `common/paths.py`.

### `common/developer.py`

Developer management.

```python
from common.developer import (
    get_developer,     # Get current developer name
    get_workspace_dir, # Get developer's workspace directory
)
```

### `common/task_utils.py`

Task lookup functions.

```python
from common.task_utils import (
    get_current_task,  # Get active task directory
    load_task_json,    # Load task.json
    save_task_json,    # Save task.json
)
```

### `common/phase.py`

Phase tracking.

```python
from common.phase import (
    get_current_phase,  # Get current phase number
    advance_phase,      # Move to next phase
)
```

### `common/git_context.py`

Git context generation.

```python
from common.git_context import (
    get_git_status,     # Get git status
    get_recent_commits, # Get recent commit messages
    get_branch_name,    # Get current branch
)
```

---

## Usage Examples

### Initialize New Developer

```bash
cd /path/to/project
python3 .cstl/scripts/init_developer.py john-doe
```

### Create and Start Task

```bash
# Create task
python3 .cstl/scripts/task.py create "Add user login" --slug add-login

# Initialize context for fullstack work
python3 .cstl/scripts/task.py init-context \
  .cstl/tasks/01-31-add-login-john-doe fullstack

# Start task
python3 .cstl/scripts/task.py start \
  .cstl/tasks/01-31-add-login-john-doe
```

### Record Session

```bash
python3 .cstl/scripts/add_session.py "Implemented login form, pending API integration"
```

### Archive Completed Task

```bash
python3 .cstl/scripts/task.py archive \
  .cstl/tasks/01-31-add-login-john-doe
```
