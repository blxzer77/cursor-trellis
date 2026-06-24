# Quality

## Review Checklist

- The skill has a precise trigger-rich `description`.
- `SKILL.md` states scope, constraints, workflow, output expectations, and when not to use it.
- Long instructions are moved to direct references instead of bloating the entry file.
- Scripts are deterministic and avoid hidden global state.
- README status matches reality: active, deprecated, or pending update.
- Deprecated skills are not silently modernized unless the task asks for legacy migration.

## Current Skill Status

- Active: `chrome-cdp`, `hk-ipo-multi-compare`, `skill-creator`, `trd-planner`, `trd-writer-v2`.
- Deprecated/reference only: `trd-writer-full`.
- Pending update: `trd-updater`.

Keep this status aligned with `README.md` and `README.zh-CN.md`.

## Common Mistakes

- Creating a broad "helper" skill instead of a workflow-specific skill.
- Adding scripts that require interactive state without saying so in `SKILL.md`.
- Updating prompts without updating the phase gates in `SKILL.md`.
- Forgetting that user-facing output language may differ from the English skill body.

