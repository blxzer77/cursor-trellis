---
name: trellis-bootstrap
description: Initialize Trellis AI workflow system in a project. Use when user mentions "Trellis", "初始化 Trellis", "setup Trellis", "install Trellis", or wants to add AI-assisted development workflow to their project. This is a one-time setup skill.
allowed-tools: Bash, Read, AskUserQuestion
---

# Trellis Bootstrap

One-time setup for Trellis - the AI workflow system that helps your AI assistant remember project context across sessions.

## What is Trellis?

Trellis provides:
- **Structure** - Store coding guidelines in `.trellis/structure/` that AI follows
- **Memory** - Track session history in `.trellis/agent-traces/`
- **Automation** - Slash commands like `/start`, `/parallel`, `/finish-work`

## Prerequisites Check

Before starting, verify:

```bash
# Check Node.js (required: v18+)
node --version

# Check npm
npm --version
```

If Node.js is not installed, ask the user to install it first.

## Installation Steps

### Step 1: Install Trellis CLI

```bash
npm install -g @mindfoldhq/trellis@latest
```

Verify installation:
```bash
trellis --version
```

### Step 2: Get Developer Name

Ask the user for their name/username. This will be used for tracking their sessions.

Example question: "What name should I use for your developer profile? (e.g., your GitHub username)"

### Step 3: Initialize in Project

Run in the project root:

```bash
trellis init -u <developer-name>
```

This creates:
```
.trellis/
├── workflow.md                # Start here
├── structure/                 # Development guidelines
│   ├── frontend/
│   └── backend/
├── agent-traces/<name>/       # Your session history
└── scripts/                   # Automation scripts

.claude/
├── commands/                  # 13 slash commands
├── agents/                    # 6 agent definitions
└── hooks/                     # Automation hooks

.cursor/
└── commands/                  # 12 slash commands

AGENTS.md                      # AI reads this first
```

### Step 4: Verify Setup

```bash
# Check created files
ls -la .trellis/
ls -la .claude/commands/
```

## Post-Setup Instructions

Tell the user:

1. **Start using Trellis** - Run `/start` at the beginning of each session
2. **Add guidelines** - Edit files in `.trellis/structure/` to customize AI behavior
3. **Track progress** - Run `/record-agent-flow` at the end of sessions

## Quick Reference

| Command | When to Use |
|---------|-------------|
| `/start` | Beginning of every session |
| `/parallel` | Complex features (multi-agent pipeline) |
| `/before-frontend-dev` | Before frontend coding |
| `/before-backend-dev` | Before backend coding |
| `/finish-work` | Before committing |
| `/record-agent-flow` | End of session |

## Success Criteria

Setup is complete when:
- [ ] `trellis --version` shows version number
- [ ] `.trellis/` directory exists with `workflow.md`
- [ ] `.claude/commands/` contains slash command files
- [ ] `AGENTS.md` exists in project root

After successful setup, this skill is no longer needed. The user should use `/start` to begin working with Trellis.

---

**Note**: This is a bootstrap skill. Once Trellis is initialized, use the built-in `/start` command instead of this skill.
