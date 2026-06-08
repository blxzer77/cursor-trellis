# Claude Code `settings.json` precedence and `statusLine` resolution

**Source**: claude-code-guide agent, citing official Claude Code docs (https://code.claude.com/docs/en/configuration.md, https://code.claude.com/docs/en/settings.md). Verified 2026-04-27.

## Precedence order (top wins)

1. Managed (enterprise policy)
2. CLI args
3. **`.claude/settings.local.json`** (project-local, **gitignored**, per-user)
4. `.claude/settings.json` (project, checked in — this is what Trellis writes)
5. `~/.claude/settings.json` (user global)
6. Built-in defaults

## Merge rules

- **Array settings**: merge across scopes (e.g., `permissions.allow`).
- **Scalar settings**: higher scope fully wins; no merge, no fallback. **`statusLine` is scalar.**

## Implications for the user complaint

- When Trellis writes `statusLine` into `.claude/settings.json`, it strictly overrides the user's `~/.claude/settings.json` `statusLine`. There is no documented way for the project file to "decline" / "inherit" / "null-out" so the user's value is used.
- Setting `"statusLine": null` in the project file does **not** fall through — it just sets the value to null at project scope, which still wins.
- No `disable-statusline` env var, no precedence-flip flag.

## Available escape hatches

- **User-side**: drop `.claude/settings.local.json` into the project with the user's preferred `statusLine` block. Since local > project, this wins. But this is per-project, manual, and the user has to know about it.
- **Trellis-side** (the only real fix): don't write `statusLine` into `.claude/settings.json` by default; make it opt-in.

## Conclusion

Platform offers no "don't override" knob. Fix must live in Trellis: default the `statusLine` write to off and provide a flag for users who want it.
