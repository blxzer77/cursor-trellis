# Gemini CLI Platform Support

## Goal

Add Gemini CLI (Google's AI coding CLI) as a first-class Trellis platform, at the same level as Cursor — commands only, no hooks/agents/settings.

## What I Already Know

### From codebase inspection:
- Trellis has 7 platforms: claude-code, cursor, opencode, iflow, codex, kilo, kiro
- Cursor is the simplest: copyDirFiltered configurator, commands-only templates, no Python hooks
- Platform integration spec (`.trellis/spec/backend/platform-integration.md`) documents 10-step checklist
- Compile-time safety: `CliFlag extends keyof InitOptions` assertion catches missing CLI flags

### From Gemini CLI research:
- **Config dir**: `.gemini/`
- **Command format**: TOML (`.toml`) — NOT Markdown like Claude/Cursor
- **Command location**: `.gemini/commands/` with subdirectory namespacing
- **Namespacing**: `commands/trellis/foo.toml` → `/trellis:foo` (same pattern as Claude!)
- **TOML structure**: `description` (optional) + `prompt` (required)
- **Context file**: `GEMINI.md` at project root (like `CLAUDE.md`)
- **No hooks/agents**: Gemini uses extensions (MCP-based), not hooks — irrelevant for Cursor-level support
- **Settings**: `settings.json` in `.gemini/` (not needed for Cursor-level)

### TOML command format:
```toml
description = "Short description of the command"
prompt = """
The full prompt content goes here.
Multi-line supported.
"""
```

## Assumptions (temporary)

- Gemini CLI is stable enough for integration (it's open source: github.com/google-gemini/gemini-cli)
- TOML format is the only supported command format (no Markdown fallback)
- We will NOT generate `GEMINI.md` (context file) — that's user responsibility

## Open Questions

- ~~Command format conversion~~ → **Decided: 方案 A, 直接存 TOML 模板**
- ~~`defaultChecked`~~ → **Decided: false**

## Decision (ADR-lite)

**Context**: Gemini CLI 的命令格式是 TOML 而不是 Markdown，需要决定如何管理模板。
**Decision**: 方案 A — 在 `src/templates/gemini/commands/trellis/` 直接维护独立的 `.toml` 文件。
**Consequences**:
- 优点：简单直接，不引入转换逻辑，与现有平台模式一致（每个平台维护自己的模板）
- 缺点：修改命令 prompt 时需要同步更新 Gemini 的 TOML 版本
- 可接受：当前只有 14 个命令，同步成本低

## Requirements (evolving)

- Add `"gemini"` to AITool, CliFlag, TemplateDir union types
- Register in AI_TOOLS with configDir: `.gemini`, hasPythonHooks: false
- Add `--gemini` CLI flag
- Create `src/configurators/gemini.ts` (copyDirFiltered, like Cursor)
- Create `src/templates/gemini/` with 14 TOML command files
- Add `getGeminiTemplatePath()` in extract.ts
- Register in PLATFORM_FUNCTIONS in configurators/index.ts
- Update Python `cli_adapter.py` for platform detection
- Update README/README_CN

## Acceptance Criteria (evolving)

- [ ] `trellis init --gemini` creates `.gemini/commands/trellis/` with all commands
- [ ] `trellis update` detects and updates Gemini templates
- [ ] Commands are valid TOML and work in Gemini CLI as `/trellis:xxx`
- [ ] Existing platforms unaffected
- [ ] Lint/typecheck/tests pass

## Definition of Done

- Tests added/updated (unit/integration where appropriate)
- Lint / typecheck / CI green
- Docs/notes updated if behavior changes
- Rollout/rollback considered if risky

## Out of Scope (explicit)

- `GEMINI.md` generation (that's user/project context, not Trellis commands)
- Gemini extensions support
- Settings.json generation for Gemini
- Hooks or agents for Gemini
- Python hook support for Gemini

## Technical Notes

- Platform integration checklist: `.trellis/spec/backend/platform-integration.md`
- 10 files need changes across 6 locations (detailed in spec)
- Gemini CLI docs: https://geminicli.com/docs/
- Gemini CLI GitHub: https://github.com/google-gemini/gemini-cli
