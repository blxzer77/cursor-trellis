# Skill Authoring Rules

Use these rules when creating or reviewing a Trellis-compatible skill.

Imperative constraints (length, English, `name` charset, WHAT+WHEN description, Hard Constraints placement and form, no duplicated rules, no `cstl-meta` duplication) live in `SKILL.md` Hard Constraints. This file shows how to apply them.

## Required Shape

Every active skill directory needs a `SKILL.md` with YAML frontmatter:

```markdown
---
name: skill-name
description: Specific capability and trigger scenarios.
---
```

Keep the body focused on trigger, constraints, workflow, references, and boundaries. Long guidance belongs in directly linked files.

## Description Quality

The description is the trigger surface. Platforms inject it into discovery prompts, so write it in third person and include concrete task nouns plus user-intent phrases.

1. **Write in third person**
   - Good: "Processes Excel files and generates reports"
   - Avoid: "I can help you process Excel files"
2. **Be specific and include trigger terms**
   - Good: "Fetch and verify one specific news event with minimal tool calls. Use when user asks whether a specific claim is true."
   - Vague: "Helps with news."
3. **Include both WHAT and WHEN**
   - WHAT: what the skill does (specific capabilities)
   - WHEN: when the agent should use it (trigger scenarios)

Trellis example:

```yaml
description: "Create or improve Trellis-compatible agent skills. Use when the user asks to author a project-local skill, shared .agents skill, platform-specific skill, or upstream Trellis bundled skill."
```

Avoid:

```yaml
description: "Helps with skills."
```

Checklist:

- Names the capability.
- Names common trigger situations.
- Avoids first person.
- Avoids broad utility wording such as "helper", "tools", or "useful".
- Does not claim support for platforms or files the skill does not cover.

## Hard Constraints Form

Put `## Hard Constraints` near the top, before `## Workflow`, when the skill has safety, sequencing, scope, or reliability rules.

Write constraints as imperative one-liners:

- Always inspect local files before editing.
- Never modify global configuration without explicit user approval.
- Always run the validator before final output.

Do not bury constraints in paragraphs. Do not restate the same rule elsewhere; Hard Constraints is the only rule list.

## Progressive Disclosure

`SKILL.md` should route, not carry every detail.

Good candidates for references:

- Detailed authoring rules.
- Domain background.
- Long examples.
- Output templates.
- Platform-specific notes.
- Review checklists.

Keep references one level deep and link them directly from `SKILL.md`. Avoid reference chains where one reference requires reading another reference before it is useful.

## Deterministic Scripts

Add scripts only when they make the skill more reliable than generated ad hoc code.

Script rules:

- Put scripts under the owning skill directory, usually `scripts/`.
- Expose only parameters the agent must supply.
- Let the script decide internal paths, timestamps, defaults, and output filenames when possible.
- Return structured JSON to stdout when the script mutates files or produces machine-readable status.
- State whether the agent should execute the script or read it as reference.
- Avoid shell variables or cross-step state that would not survive separate tool calls.

## Common Anti-Patterns

### Vague description or name

Vague frontmatter descriptions trigger on unrelated work.

- Good names: `processing-pdfs`, `render-mermaid`
- Avoid: `helper`, `utils`, `tools`

### Mixing unrelated workflows

One skill should not address multiple unrelated concerns. Split into separate skills.

### Pasting long prompts or full scripts into SKILL.md

Link references instead of inlining long material.

### Repeated rules

Do not restate the same rule in several sections with slightly different wording.

### Missing stop conditions

Multiple broad search loops without explicit exit criteria.

### Cross-step variable sharing

Each tool call is independent and stateless. Shell variables set in one call do not exist in the next.

```markdown
# Bad — variable $TS differs between Write and Bash calls
Write content to /tmp/data-$TS.txt     # tool call 1: timestamp A
Bash: cmd --input /tmp/data-$TS.txt    # tool call 2: timestamp B → file not found

# Good — use a fixed path; let the script handle dynamic naming internally
Write content to /var/skill-name/input.txt
Bash: cmd --input /var/skill-name/input.txt
```

### Exposing internal decisions as parameters

If a value can be determined by the script itself, do not expose it as a parameter.

```markdown
# Bad — unnecessary parameters the agent must coordinate
cmd --input file.txt --output out.png --format png --theme default

# Good — only the essential input; script decides the rest
cmd --input file.txt
```

### Too many options

```markdown
# Bad
"You can use pypdf, or pdfplumber, or PyMuPDF, or..."

# Good — provide a default with an escape hatch
"Use pdfplumber for text extraction.
For scanned PDFs requiring OCR, use pdf2image with pytesseract instead."
```

### Broken or private references

- References to files, scripts, or examples that do not exist.
- Project-private conventions added to public Trellis bundled skills.