# Publish Skill to Docs Site

Sync a marketplace skill to the documentation site. Creates skill detail pages (EN/ZH), updates the marketplace index, and updates docs.json navigation.

## Arguments

- `$ARGUMENTS` — Skill directory name under `marketplace/skills/` (e.g., `cc-codex-spec-bootstrap`). If omitted, list available skills and ask.

## Steps

### Step 1: Identify the Skill

```bash
# If no argument, list available skills
ls marketplace/skills/
```

Read the skill's `SKILL.md` to extract:
- **name** (from frontmatter)
- **description** (from frontmatter)
- What the skill does (from body)
- Prerequisites / tools needed
- What files are included

```bash
cat marketplace/skills/<skill-name>/SKILL.md
```

### Step 2: Check Existing Docs

Verify the skill doesn't already have docs pages:

```bash
ls docs-site/skills-market/<skill-name>.mdx 2>/dev/null
```

If pages already exist, ask user if they want to update them.

### Step 3: Create EN Detail Page

Create `docs-site/skills-market/<skill-name>.mdx`.

Follow the format of existing skill pages (see `docs-site/skills-market/trellis-meta.mdx` as reference):

```markdown
---
title: '<skill-name>'
description: '<one-line description>'
---

<what the skill does - 1-2 paragraphs>

## Install

```bash
npx skills add mindfold-ai/Trellis/marketplace --skill <skill-name>
```

Or install all available skills:

```bash
npx skills add mindfold-ai/Trellis/marketplace
```

Options:

| Flag | Description |
| --- | --- |
| `-g` | Install globally (`~/.claude/skills/`) |
| `-a claude-code` | Target a specific agent |
| `-y` | Non-interactive mode |

## Verify Installation

...

## Usage

<example prompts>

## What's Included

<table of directories/files>
```

### Step 4: Create ZH Detail Page

Create `docs-site/zh/skills-market/<skill-name>.mdx` with Chinese translation of the EN page.

### Step 5: Update Index Pages

Add the skill to the Official Skills table in both:
- `docs-site/skills-market/index.mdx`
- `docs-site/zh/skills-market/index.mdx`

### Step 6: Update docs.json

Add the new page to both EN and ZH Skills navigation groups in `docs-site/docs.json`:

- EN: `"skills-market/<skill-name>"` in the Skills pages array
- ZH: `"zh/skills-market/<skill-name>"` in the ZH Skills pages array

### Step 7: Commit and Push Docs

```bash
cd docs-site
git add skills-market/<skill-name>.mdx zh/skills-market/<skill-name>.mdx \
  skills-market/index.mdx zh/skills-market/index.mdx docs.json
git commit -m "docs: add <skill-name> skill to marketplace"
git push
```

### Step 8: Ensure Skill on Main Branch

If the marketplace skill isn't on `main` yet (e.g., committed on a feature branch):

```bash
# Check if skill exists on main
git log main --oneline -- marketplace/skills/<skill-name>/ | head -1
```

If not on main, cherry-pick the commit:

```bash
# Find the commit that added the skill
git log --oneline -- marketplace/skills/<skill-name>/ | head -1

# Cherry-pick to main
git stash
git checkout main && git pull
git cherry-pick <commit-hash>
git push origin main
git checkout - && git stash pop
```

### Step 9: Confirm

Report:
- Docs-site pages created (EN + ZH)
- Index pages updated
- docs.json updated
- Docs-site pushed
- Marketplace skill available on main
