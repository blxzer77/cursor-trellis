# Pactile Self-Iteration Guide

How to maintain skill documentation when customizing Pactile.

---

## Core Principle

**Every Pactile modification MUST be documented in the appropriate skill.**

```
Modification to Pactile → Update pactile-local (project skill)
Update to Pactile itself → Update pactile-meta (meta skill)
```

---

## Decision Tree

```
Is this a modification to Pactile?
│
├── YES: What kind?
│   │
│   ├── Project-specific customization
│   │   └── Update .claude/skills/pactile-local/SKILL.md
│   │
│   ├── Bug fix to core Pactile
│   │   └── Update ~/.claude/skills/pactile-meta/
│   │       (or project copy if reviewing first)
│   │
│   └── New feature to core Pactile
│       └── Update pactile-meta after release
│
└── NO: Just using Pactile
    └── No skill update needed
```

---

## Self-Iteration Workflow

### Step 1: Before Making Changes

```bash
# Check if project skill exists
ls .claude/skills/pactile-local/SKILL.md

# If not, create it from template
mkdir -p .claude/skills/pactile-local
# Copy template from pactile-meta/references/pactile-local-template.md
```

### Step 2: Make the Pactile Modification

Do your work: add command, modify hook, etc.

### Step 3: Document in Project Skill

Open `.claude/skills/pactile-local/SKILL.md` and:

1. **Find the right section** (Commands/Agents/Hooks/Specs/Workflow)
2. **Add entry using template**
3. **Update changelog**
4. **Update summary counts**

### Step 4: Verify Documentation

Ask yourself:
- [ ] Would another AI understand what was changed?
- [ ] Is the "why" documented?
- [ ] Are affected files listed?
- [ ] Is the date recorded?

---

## Documentation Templates

### New Command

```markdown
#### /pactile:my-command
- **File**: `.claude/commands/pactile/my-command.md`
- **Purpose**: Brief description of what it does
- **Added**: 2026-01-31
- **Reason**: Why this command was needed

**Usage**:
```
/pactile:my-command [args]
```

**Example**:
User asks "..." → Command does "..."
```

### New Agent

```markdown
#### my-agent
- **File**: `.claude/agents/my-agent.md`
- **Purpose**: What this agent specializes in
- **Tools**: Read, Write, Edit, Bash, Glob, Grep
- **Model**: opus
- **Added**: 2026-01-31
- **Reason**: Why this agent was needed

**Hook Integration**:
- Added to `inject-subagent-context.py` at line X
- Uses `my-agent.jsonl` for context

**Invocation**:
```
Task(subagent_type="my-agent", prompt="...")
```
```

### Hook Modification

```markdown
#### inject-subagent-context.py
- **Hook Event**: PreToolUse:Task
- **Change**: Added handling for `my-agent` subagent type
- **Lines Modified**: 45-67, 120-135
- **Date**: 2026-01-31
- **Reason**: Support new agent type

**Code Changes**:

```python
# Added constant
AGENT_MY_AGENT = "my-agent"

# Added to agent list
AGENTS_ALL = (..., AGENT_MY_AGENT)

# Added context function
def get_my_agent_context(repo_root, task_dir):
    ...
```
```

### Spec Category Addition

```markdown
#### security/
- **Path**: `.pactile/spec/security/`
- **Purpose**: Security guidelines for the project
- **Files**:
  - `index.md` - Category overview
  - `auth-guidelines.md` - Authentication patterns
  - `input-validation.md` - Validation requirements
- **Added**: 2026-01-31
- **Reason**: Project requires security-focused development

**JSONL Integration**:
```jsonl
{"file": ".pactile/spec/security/index.md", "reason": "Security guidelines"}
```
```

### Workflow Change

```markdown
#### Custom Phase Order
- **What**: Changed default task phases to include research phase
- **Files Affected**:
  - `.pactile/scripts/task.py` (init-context function)
  - Default task.json template
- **Date**: 2026-01-31
- **Reason**: All tasks in this project need research first

**New Default next_action**:
```json
[
  {"phase": 1, "action": "research"},
  {"phase": 2, "action": "implement"},
  {"phase": 3, "action": "check"},
  {"phase": 4, "action": "finish"},
  {"phase": 5, "action": "create-pr"}
]
```
```

---

## Changelog Format

```markdown
### 2026-01-31 - Feature: Custom Research Phase
- Added research phase as default first phase
- Modified task.py init-context
- Updated task.json template
- Reason: Project complexity requires upfront research

### 2026-01-30 - Bugfix: Hook Timeout
- Increased ralph-loop.py timeout from 10s to 30s
- Reason: Complex verification commands were timing out

### 2026-01-29 - Initial Setup
- Initialized pactile-local skill
- Base Pactile version: 0.3.0
```

---

## Multi-Project Scenario

When working with multiple Pactile projects:

```
~/projects/
├── project-a/
│   └── .claude/skills/pactile-local/   # Project A customizations
├── project-b/
│   └── .claude/skills/pactile-local/   # Project B customizations
└── project-c/
    └── .claude/skills/pactile-local/   # Project C customizations

~/.claude/skills/
└── pactile-meta/                        # Shared meta-skill (vanilla Pactile)
```

**Each project has its own `pactile-local`** documenting that project's specific customizations.

**The meta-skill is shared** and documents vanilla Pactile.

---

## Upgrade Workflow

When upgrading Pactile to a new version:

### 1. Review New Version Changes

```bash
# Compare new meta-skill with current
diff -r ~/.claude/skills/pactile-meta/references/ \
        ./new-pactile-meta/references/
```

### 2. Check for Conflicts

Review each customization in `pactile-local`:
- Does new version include this feature natively?
- Does new version break this customization?
- Can this customization be simplified?

### 3. Merge Carefully

```bash
# Backup current meta-skill
cp -r ~/.claude/skills/pactile-meta ~/.claude/skills/pactile-meta.backup

# Update meta-skill
cp -r ./new-pactile-meta/* ~/.claude/skills/pactile-meta/
```

### 4. Update Project Skills

Add migration note to `pactile-local`:

```markdown
### 2026-02-01 - Upgraded to Pactile 0.4.0
- Updated meta-skill to 0.4.0
- Kept custom `security-agent` (not in vanilla)
- Migrated `my-command` to new command format
- Removed `old-hook` customization (now in vanilla)
```

---

## AI Instructions

When an AI modifies Pactile, it MUST:

1. **Check** if `pactile-local` exists in the project
2. **Create** it from template if missing
3. **Document** the change immediately after making it
4. **Update** the changelog with date and description
5. **Verify** the documentation is complete

**Never** modify `pactile-meta` for project-specific changes.

**Always** tell the user what was documented.

Example AI response:
> "I've added the `/pactile:deploy` command and documented it in `.claude/skills/pactile-local/SKILL.md` under the Commands section."
