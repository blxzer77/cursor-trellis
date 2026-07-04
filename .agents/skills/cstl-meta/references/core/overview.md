# Core Systems Overview

These systems are **file-based** and work in Cursor without a proprietary Trellis runtime. cursor-trellis injects context via `.cursor/hooks/`; the same files are readable directly when debugging.

---

## What's in Core?

| System | Purpose | Files |
|--------|---------|-------|
| Workspace | Session tracking, journals | `.cstl/workspace/` |
| Tasks | Work item tracking | `.cstl/tasks/` |
| Specs | Coding guidelines | `.cstl/spec/` |
| Commands | Slash command prompts | `.cursor/commands/` |
| Scripts | Automation utilities | `.cstl/scripts/` |

---

## Why These Are Portable

All core systems read and write plain files:

- No Trellis server required
- Version-controlled alongside application code
- Hooks automate loading; manual `get_context.py` works the same data

```
┌─────────────────────────────────────────────────────────────┐
│                    CORE SYSTEMS (File-Based)                 │
│                                                              │
│  .cstl/                                                      │
│  ├── workspace/     → Journals, session history              │
│  ├── tasks/         → Task directories, PRDs, context files  │
│  ├── spec/          → Coding guidelines                      │
│  └── scripts/       → Python utilities                       │
│                                                              │
│  .cursor/                                                    │
│  └── commands/      → `/cstl-*` slash command prompts        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Cursor usage

At session start (automated via hooks, or manually):

1. Run `python ./.cstl/scripts/get_context.py` for selected task + dashboard
2. Read `.cstl/workflow.md` when routing is unclear
3. Read relevant `.cstl/spec/<package>/<layer>/` indexes before coding
4. Use `task.py select` / `cstl-continue` to resume in-progress work

---

## Documents in This Directory

| Document | Content |
|----------|---------|
| `files.md` | All files in `.cstl/` with purposes |
| `workspace.md` | Workspace system, journals, developer identity |
| `tasks.md` | Task system, directories, JSONL context files |
| `specs.md` | Spec system, guidelines organization |
| `scripts.md` | Core scripts and `common/paths.py` constants |
