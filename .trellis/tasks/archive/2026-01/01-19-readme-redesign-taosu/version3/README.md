# readme-v2

# Trellis

> Wild AI ships nothing.
> 

**AI Workflow Framework for Claude Code / Cursor**

<!-- TODO: Hero GIF -->

---

## Why Trellis?

| Feature | Problem Solved |
| --- | --- |
| **Auto-Injection** | Write specs and workflow once, auto-loaded in every conversation |
| **Spec Library** | Codify best practices, lessons learned won't be forgotten |
| **Multi-Session Parallel** | Run multitasks in background worktree, keep working on other things |
| **Self-Iteration** | Learns from every task: updates specs automatically. The more you use it, the better it gets. |
| **Team Sharing** | Team shares specs and workflow — one person's best practice benefits everyone |
| **Session Persistence** | Work traces in journal — AI remembers project history, no re-explaining |

---

## Quick Start

```bash
# 1. Install
npm install -g @mindfoldhq/trellis@latest

# 2. Initialize project
cd your-project
trellis init -u your-name

# 3. Open Claude Code, start using
```

- `u` is your identifier, creates personal workspace `.trellis/workspace/your-name/`.

---

## Use Cases（这些都可以考虑上 GIF）

### Add a spec

```
You: We use Zustand, no Redux. Add this to specs.

AI:  Added to .trellis/spec/frontend/state-management.md

```

### Next conversation follows automatically

```
You: Add a user preferences store

AI:  ┌─ Research ─────────────────────────┐
     │ ✓ Found: state-management.md       │
     │ → Spec requires: Use Zustand       │
     └────────────────────────────────────┘

     Created src/stores/userPreferences.ts (Zustand)
     ✓ lint passed

```

### Complex task: /parallel（这个 Case 可以深度考虑， 最好的效果是它用 TMUX 多开了好几个 session 同时做这事，举个例子让他做一个 open cowork，一个是 research 了解 cowork 功能，一个了解现有可以借鉴的代码，每一个都在跑 multi-agent 流程）

```
You: /parallel build a user auth system

AI:  [Plan]      Analyze codebase, write PRD
     [Implement] Write code in isolated worktree
     [Check]     Verify against specs
     [PR]        Create Pull Request

     → <https://github.com/you/repo/pull/42>

```

---

## How It Works

### Project Structure

```
.trellis/
├── workflow.md              # Workflow guide (auto-injected on session start)
├── worktree.yaml            # Multi-agent config (for /parallel)
├── spec/                    # Spec library
│   ├── frontend/            #   Frontend specs
│   ├── backend/             #   Backend specs
│   └── guides/              #   Decision & analysis frameworks
├── workspace/{name}/        # Personal workspace to record journal
├── tasks/                   # Task management (PRD, status, assignee...)
└── scripts/                 # Script utilities

.claude/
├── settings.json            # Hook configuration
├── agents/                  # Agent definitions
│   ├── dispatch.md          #   Dispatcher (pure routing, doesn't read specs)
│   ├── implement.md         #   Implement Agent
│   ├── check.md             #   Check Agent
│   └── research.md          #   Research Agent
├── commands/                # Slash commands (/parallel, /finish-work, etc.)
└── hooks/                   # Hook scripts
    ├── session-start.py     #   Inject context on startup
    ├── inject-subagent-context.py  # Inject specs before subagent calls
    └── ralph-loop.py        #   Retry if Check Agent fails

```

### Workflow

![CleanShot 2026-01-22 at 20.46.30@2x.png](readme-v2/CleanShot_2026-01-22_at_20.46.302x.png)

See [Engineering Docs](https://www.notion.so/docs/README.md) for detailed architecture.

---

## Roadmap

- **Better Code Review Workflow** — More thorough automated review and test workflow
- **Skill Packs** — Pre-built workflow packs, plug and play
- **Broader Agent/IDE Support** — Cursor, OpenCode, Codex integration
- **Stronger Session Continuity** — Auto-save chat history, AI picks up where you left off
- **Visual Parallel Sessions** — CLI with tmux auto-split, real-time progress for each agent

## FAQ

**Q: Why Trellis instead of Skills?**

Skills are optional — AI may skip them, leading to inconsistent quality. Trellis enforces specs via Hook injection: not "can use" but "always applied". This turns randomness into determinism, ensuring quality doesn't degrade over time.

**Q: Do I write spec files manually or let AI create them?**

Most of the time, AI handles it — just say "We use Zustand, no Redux" and it creates the spec file automatically. But when you have architectural insights AI can't figure out on its own, that's where you step in. Teaching AI your team's hard-won lessons — that's why you won't lose your job to AI.

**Q: How is this different from  [CLAUDE.md](http://claude.md/) / [AGENTS.md](http://agents.md/) / .cursorrules ?**

Those are all-in-one files — AI reads everything every time. Trellis uses layered architecture with context compression: only loads relevant specs for current task. Engineering standards should be elegantly layered, not monolithic.

**Q: Will multiple people conflict?**

No. Each person has own space to record journal `.trellis/workspace/{name}/`, spec files are shared (committed to Git).

---

## Community

- Discord

---

FSL License • Mindfold
