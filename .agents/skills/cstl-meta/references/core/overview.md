# Core Systems Overview

These systems work on **all platforms** (Claude Code, Cursor, and future platforms).

---

## What's in Core?

| System | Purpose | Files |
|--------|---------|-------|
| Workspace | Session tracking, journals | `.cstl/workspace/` |
| Tasks | Work item tracking | `.cstl/tasks/` |
| Specs | Coding guidelines | `.cstl/spec/` |
| Commands | Slash command prompts | `.claude/commands/` |
| Scripts | Automation utilities | `.cstl/scripts/` (core subset) |

---

## Why These Are Portable

All core systems are **file-based**:
- No special runtime required
- Read/write with any tool
- Works in any AI coding environment

```
┌─────────────────────────────────────────────────────────────┐
│                    CORE SYSTEMS (File-Based)                 │
│                                                              │
│  .cstl/                                                   │
│  ├── workspace/     → Journals, session history              │
│  ├── tasks/         → Task directories, PRDs, context files  │
│  ├── spec/          → Coding guidelines                      │
│  └── scripts/       → Python utilities (core subset)         │
│                                                              │
│  .claude/                                                    │
│  └── commands/      → Slash command prompts                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Platform Usage

### Claude Code
All core systems work automatically with hook integration.

### Cursor
Read files manually at session start:
1. Read `.cstl/workflow.md`
2. Read relevant specs from `.cstl/spec/`
3. Run `python3 .cstl/scripts/task.py current --source` for active work
4. Read JSONL files for context

### Other Platforms
Same as Cursor - manual file reading.

---

## Documents in This Directory

| Document | Content |
|----------|---------|
| `files.md` | All files in `.cstl/` with purposes |
| `workspace.md` | Workspace system, journals, developer identity |
| `tasks.md` | Task system, directories, JSONL context files |
| `specs.md` | Spec system, guidelines organization |
| `scripts.md` | Core scripts (platform-independent) |
