# Trellis

<!-- 🖼️ [IMAGE] Banner: 品牌横幅图，包含 Logo + "Structure. Guide. Ship." 标语
     尺寸建议: 1280x640 或 1200x300
     文件: assets/banner.png
-->

**Structure. Guide. Ship.**

English | [中文](./README-zh.md)

[![npm version](https://img.shields.io/npm/v/@mindfoldhq/trellis)](https://www.npmjs.com/package/@mindfoldhq/trellis)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Compatible-blueviolet)](https://claude.ai/code)
[![Cursor](https://img.shields.io/badge/Cursor-Compatible-blue)](https://cursor.sh)

> AI capabilities grow like vines — full of vitality but spreading in all directions.
> Trellis provides structure, guiding them along a disciplined path.

---

## Why Trellis?

**Your AI assistant forgets everything between sessions.**

Every conversation starts from zero. The same mistakes repeat. Guidelines written but never followed. Multi-agent workflows feel like herding cats.

Trellis fixes this.

| Problem | Trellis Solution |
|---------|------------------|
| AI lacks project context | Guidelines persisted in `.trellis/structure/`, shared across team |
| Guidelines written but ignored | On-demand injection — each Agent receives only what it needs |
| Workflow requires human supervision | Slash Commands encapsulate complete workflows (`/start`, `/parallel`) |
| Multi-agent parallelism is hard | One-click launch with Git Worktree isolation |

---

## Quick Start

### Install

```bash
npm install -g @mindfoldhq/trellis@latest
```

### Initialize

```bash
cd your-project
trellis init -u your-name
```

### Start Working

**Claude Code:**
```
/start → describe your task → /record-agent-flow
```

**Complex features (Multi-Agent Pipeline):**
```
/parallel → describe requirement → /record-agent-flow
```

---

## Core Concepts

### The Three Pillars

```
.trellis/
├── structure/      # 📚 Guidelines — team's knowledge, AI's rulebook
├── agent-traces/   # 📝 Memory — session history, feature tracking
└── scripts/        # ⚙️ Automation — deterministic, repeatable operations
```

| Pillar | What It Does | Why It Matters |
|--------|--------------|----------------|
| **Structure** | Stores coding standards, architectural decisions | Guidelines that actually get followed |
| **Agent-traces** | Records work history, feature context | Resume any session, trace any decision |
| **Scripts** | Encapsulates complex operations | AI executes consistently, never misses steps |

### Slash Commands

| Command | Purpose |
|---------|---------|
| `/start` | Initialize session, load context |
| `/parallel` | Launch multi-agent pipeline (Claude Code) |
| `/before-frontend-dev` | Read frontend guidelines before coding |
| `/before-backend-dev` | Read backend guidelines before coding |
| `/check-frontend` | Review code against guidelines |
| `/check-backend` | Review code against guidelines |
| `/check-cross-layer` | Cross-layer data flow validation |
| `/finish-work` | Pre-commit checklist |
| `/record-agent-flow` | Record session to traces |

### Multi-Agent Pipeline

<!-- 🖼️ [IMAGE] 架构图: 替换下方 ASCII 流程图
     内容: Plan → Implement → Check → Create PR 四阶段流程
     风格: 简洁的流程图，带图标
     尺寸建议: 800x400
     文件: assets/pipeline.png
-->

```
/parallel
    ↓
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Plan Agent  │ →  │  Implement  │ →  │ Check Agent │ →  │  Create PR  │
│             │    │    Agent    │    │             │    │             │
│ Analyze req │    │ Write code  │    │ Review +    │    │ Commit +    │
│ Configure   │    │ Run tests   │    │ Self-fix    │    │ Push + PR   │
│ context     │    │             │    │             │    │             │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       │                  │                  │
       ▼                  ▼                  ▼
   feature.json      implement.jsonl    Ralph Loop
   prd.md            (context injection) (quality gate)
```

**Key Features:**
- **Git Worktree Isolation** — Each agent works in independent directory
- **Staged Context Injection** — Hook injects only relevant files per phase
- **Ralph Loop** — Quality gate that blocks completion until lint/typecheck pass

---

## Supported Tools

| Tool | Support Level |
|------|---------------|
| **Claude Code** | Full (Slash Commands + Agents + Hooks + Multi-Agent Pipeline) |
| **Cursor** | Slash Commands only |

---

## Project Structure

```
your-project/
├── AGENTS.md                    # Lightweight AI instructions
├── .trellis/                    # Workflow center
│   ├── workflow.md              # Development process (read first)
│   ├── worktree.yaml            # Multi-agent config
│   ├── structure/               # Development guidelines
│   │   ├── backend/             # Backend standards
│   │   ├── frontend/            # Frontend standards
│   │   └── guides/              # Thinking guides
│   ├── agent-traces/            # Session records
│   │   └── {developer}/
│   │       ├── traces-N.md      # Session logs
│   │       └── features/        # Feature directories
│   ├── backlog/                 # Requirements pool
│   └── scripts/                 # Automation scripts
├── .claude/                     # Claude Code config
│   ├── commands/                # Slash Commands
│   ├── agents/                  # Agent definitions
│   └── hooks/                   # Automation hooks
└── .cursor/                     # Cursor config
    └── commands/                # Slash Commands
```

---

## How It Works

### 1. Guidelines System (`.trellis/structure/`)

Team's knowledge assets. AI references these when implementing and reviewing.

```
structure/
├── backend/
│   ├── index.md                 # Entry point
│   ├── database-guidelines.md   # Database patterns
│   ├── error-handling.md        # Error strategies
│   └── ...
├── frontend/
│   ├── index.md                 # Entry point
│   ├── component-guidelines.md  # Component patterns
│   ├── state-management.md      # State patterns
│   └── ...
└── guides/
    ├── cross-layer-thinking-guide.md    # Before cross-layer dev
    └── code-reuse-thinking-guide.md     # Before creating new code
```

**Philosophy:** Clearer guidelines = better AI execution. Update whenever issues found.

### 2. Session Tracking (`.trellis/agent-traces/`)

Records all AI work history. Supports multi-developer collaboration.

```
agent-traces/
└── {developer}/
    ├── index.md                 # Personal session index
    ├── traces-N.md              # Session records
    └── features/                # Feature directories
        └── {day}-{name}/
            ├── feature.json     # Metadata
            ├── prd.md           # Requirements
            ├── implement.jsonl  # Implement phase context
            └── check.jsonl      # Check phase context
```

**Traceability:** Every feature records which guidelines were used, which code was referenced, and why.

### 3. Automation Hooks (`.claude/hooks/`)

Two Python scripts power the automation:

**`inject-subagent-context.py`** — Context Injection
- Triggers before Task tool calls
- Reads `.jsonl` files to know which files to inject
- Each Agent receives only relevant context

**`ralph-loop.py`** — Quality Control
- Triggers when Check Agent attempts to stop
- Runs verification commands (lint, typecheck)
- Blocks completion until all pass (max 5 iterations)

---

## Configuration

### `worktree.yaml` — Multi-Agent Pipeline Config

```yaml
worktree_dir: ../trellis-worktrees
copy:
  - .env
  - .trellis/.developer
post_create:
  - pnpm install --frozen-lockfile
verify:
  - pnpm lint
  - pnpm typecheck
```

| Field | Description |
|-------|-------------|
| `worktree_dir` | Where to create Git Worktrees |
| `copy` | Files to copy into Worktree |
| `post_create` | Commands to run after Worktree creation |
| `verify` | Commands that must pass before Check Agent finishes |

---

## Comparison

### vs Planning-with-Files

| Dimension | Planning-with-Files | Trellis |
|-----------|---------------------|---------|
| Scope | Session-level (single task) | Project-level (cross-session) |
| Files | 3 fixed files | Flexible structure |
| Multi-agent | No | Yes (Git Worktree isolation) |
| Guidelines | None | Full guidelines system |

### vs BMAD-METHOD

| Dimension | BMAD-METHOD | Trellis |
|-----------|-------------|---------|
| Complexity | Heavy (21 agents, 50+ workflows) | Lightweight (6 agents, 13 commands) |
| Learning curve | Steep | Gradual |
| Customization | Framework-driven | Template-driven |

---

## Documentation

- [Full Documentation](./docs/README.md) — Complete reference
- [Understanding Trellis via K8s Concepts](./docs/use-k8s-to-know-trellis.md) — For K8s users

---

## Community

- [GitHub Issues](https://github.com/mindfoldhq/trellis/issues) — Bug reports, feature requests
- [GitHub Discussions](https://github.com/mindfoldhq/trellis/discussions) — Questions, ideas

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

---

## License

[MIT](./LICENSE)

---

<p align="center">
  <sub>Built with focus by <a href="https://mindfold.com">Mindfold</a></sub>
</p>
