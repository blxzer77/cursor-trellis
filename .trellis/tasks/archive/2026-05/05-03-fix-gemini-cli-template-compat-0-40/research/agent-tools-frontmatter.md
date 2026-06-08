# Research: Gemini CLI 0.40.x sub-agent `tools` frontmatter

- **Query**: Canonical YAML shape Gemini CLI 0.40.x accepts for `tools` in `.gemini/agents/*.md` frontmatter; behavior when omitted; MCP tool name handling; valid examples; when the breaking change landed.
- **Scope**: External (official docs, GitHub source, release notes)
- **Date**: 2026-05-03

---

## 1. Canonical YAML shape — `tools` is an ARRAY OF STRINGS

The Zod schema is the source of truth, in `packages/core/src/agents/agentLoader.ts`:

```ts
const localAgentSchema = z
  .object({
    kind: z.literal('local').optional().default('local'),
    name: nameSchema,
    description: z.string().min(1),
    display_name: z.string().optional(),
    tools: z
      .array(
        z
          .string()
          .refine((val) => isValidToolName(val, { allowWildcards: true }), {
            message: 'Invalid tool name',
          }),
      )
      .optional(),
    mcp_servers: z.record(mcpServerSchema).optional(),
    model: z.string().optional(),
    temperature: z.number().optional(),
    max_turns: z.number().int().positive().optional(),
    timeout_mins: z.number().int().positive().optional(),
  })
  .strict();
```

Source: <https://github.com/google-gemini/gemini-cli/blob/07ab16db/packages/core/src/agents/agentLoader.ts>

Implications:
- `tools` MUST be a YAML sequence (array). A scalar string like `Read, Write, Edit` is rejected by Zod with the exact error `tools: Expected array, received string` — which is what Trellis issue #224 reports.
- Both YAML block sequence and flow sequence are valid (standard YAML — js-yaml `load` is what parses the frontmatter, per the `loader.ts` rename in PR #16094):
  - Block: `tools:\n  - Read\n  - Write`
  - Flow: `tools: [Read, Write]`
- The schema is `.strict()` so unknown frontmatter keys also throw.
- Each string element is further validated by `isValidToolName(..., { allowWildcards: true })`.

---

## 2. What happens if `tools:` is OMITTED — defaults to ALL parent tools

Two pieces of evidence converge here:

(a) Official docs, <https://geminicli.com/docs/core/subagents/#configuration-schema>:

> `tools` | array | No | List of tool names this agent can use. Supports wildcards: `*` (all tools), `mcp_*` (all MCP tools), `mcp_server_*` (all tools from a server). **If omitted, it inherits all tools from the parent session.**

(b) Runtime code, `packages/core/src/agents/local-executor.ts` (main branch):

```ts
if (definition.toolConfig) {
  for (const toolRef of definition.toolConfig.tools) {
    if (typeof toolRef === 'string') {
      registerToolByName(toolRef);
    } else if (
      typeof toolRef === 'object' &&
      'name' in toolRef &&
      'build' in toolRef
    ) {
      agentToolRegistry.registerTool(toolRef);
    }
  }
} else {
  // If no tools are explicitly configured, default to all available tools.
  for (const toolName of parentToolRegistry.getAllToolNames()) {
    registerToolByName(toolName);
  }
}
```

Source: <https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/agents/local-executor.ts>

Note the historical wrinkle: prior to PR #17422 (`fix(agents): default to all tools when tool list is omitted in subagents`, opened 2026-01-24, issue #17420), omitting `tools` produced the WRONG default ("no tools"). That bug was fixed well before 0.40.x (released 2026-04-28), so 0.40.x correctly inherits all parent tools when `tools:` is omitted. PR: <https://github.com/google-gemini/gemini-cli/pull/17422>; issue: <https://github.com/google-gemini/gemini-cli/issues/17420>.

---

## 3. MCP tool names — must be `mcp_<server>_<tool>`, NOT `mcp__<server>__<tool>`

Trellis currently writes `mcp__exa__web_search_exa` (Claude Code's double-underscore convention). Gemini CLI rejects this format.

Evidence from PR #22069 (`fix(core): resolve MCP tool FQN validation, schema export, and wildcards in subagents`, merged 2026-03-11):

> Fixes an issue where subagents rejected standard `mcp_{serverName}_{toolName}` Fully Qualified Names (FQNs) due to outdated validation logic that incorrectly permitted only the deprecated `server__tool` legacy format.
>
> - The `isValidToolName` logic in `tool-names.ts` now securely validates `mcp_` names by strictly adhering to the parsing constraints given by `mcp-tool.ts`.
> - Removed the dead fallback block for parsing `__` inside `tool-registry.ts`...
> - Updated the `agentLoader.ts` Zod schema to allow wildcards when parsing the `tools` array of a subagent configuration file (by supplying `{ allowWildcards: true }` to `isValidToolName`).

Source: <https://github.com/google-gemini/gemini-cli/pull/22069>

So the canonical FQN form for an MCP tool in a sub-agent's `tools` array is:

- `mcp_exa_web_search_exa`  (single underscores; `mcp_` prefix + server name + tool name)

Wildcard alternatives (cleaner for ergonomics):

- `*` — all built-in + discovered tools
- `mcp_*` — all tools from all MCP servers
- `mcp_exa_*` — all tools from the `exa` MCP server

Note: tool names in Gemini CLI's built-in registry use snake_case (e.g. `read_file`, `grep_search`, `glob`, `list_directory`, `web_fetch`, `google_web_search`) — NOT the PascalCase Trellis currently emits (`Read`, `Write`, `Edit`, `Glob`, `Grep`, `Bash`). The PascalCase names are Claude Code conventions and are likely silently dropped (or passed through but unmatched at registration time in `registerToolByName`, which only registers a tool if `parentToolRegistry.getTool(toolName)` returns one).

Reference for built-in tool names: subagents docs example and the Google Developers Blog post:

> ```yaml
> tools:
>   - read_file
>   - grep_search
>   - glob
>   - list_directory
>   - web_fetch
>   - google_web_search
> ```

Source: <https://developers.googleblog.com/subagents-have-arrived-in-gemini-cli/>

---

## 4. Valid examples from official sources

### 4.1 Security auditor (official docs, geminicli.com)

```markdown
---
name: security-auditor
description: Specialized in finding security vulnerabilities in code.
kind: local
tools:
  - read_file
  - grep_search
model: gemini-3-flash-preview
temperature: 0.2
max_turns: 10
---
```

Source: <https://geminicli.com/docs/core/subagents/#file-format>

### 4.2 Frontend specialist (Google Developers Blog announcement)

```markdown
---
name: frontend-specialist
description: Frontend specialist in building high-performance, accessible, and
  scalable web applications using modern frameworks and standards.
tools:
  - read_file
  - grep_search
  - glob
  - list_directory
  - web_fetch
  - google_web_search
model: inherit
---
```

Source: <https://developers.googleblog.com/subagents-have-arrived-in-gemini-cli/>

### 4.3 Isolated agent with inline MCP server (official docs)

```yaml
---
name: my-isolated-agent
tools:
  - grep_search
  - read_file
mcpServers:
  my-custom-server:
    command: 'node'
    args: ['path/to/server.js']
---
```

Source: <https://geminicli.com/docs/core/subagents/#configuring-isolated-tools-and-servers>

(Caveat: docs use `mcpServers` while the Zod schema field is `mcp_servers` — there is a known doc/code drift here. Trellis doesn't currently set inline MCP servers, so this isn't blocking.)

---

## 5. When the breaking change landed

This is NOT a 0.40.x-introduced change. The frontmatter format itself was introduced in PR #16094 (`Markdown w/ Frontmatter Agent Parser`, merged ~2026-01-09), which migrated agent definitions from TOML to Markdown + YAML frontmatter.

Source: <https://github.com/google-gemini/gemini-cli/pull/16094>

From the inception of `.gemini/agents/*.md`, the schema has required `tools` to be an array. The relevant evolution after that:

- 2026-01-24 — PR #17422: omitting `tools` now defaults to "all tools" (was "no tools").
- 2026-03-11 — PR #22069: subagent `tools` array validation accepts wildcards (`*`, `mcp_*`, `mcp_server_*`) and standard `mcp_<server>_<tool>` FQNs; legacy `server__tool` double-underscore form is removed.
- 2026-04-28 — v0.40.0 stable release (no `tools` schema changes in this release per the changelog at <https://geminicli.com/docs/changelogs/latest/>).
- 2026-04 — v0.40.1 patch (issue #224 in Trellis surfaces here, but the validation has been array-only the whole time).

So the practical answer: the Trellis template never matched Gemini CLI's schema. Users either didn't notice until 0.40.1 surfaces clearer error messages (PR #16515 added a more descriptive `AgentLoadError` for missing/invalid frontmatter), or Trellis hasn't been heavily used on Gemini CLI before now.

Reference for v0.40.0 release: <https://github.com/google-gemini/gemini-cli/releases/tag/v0.40.0>; changelog summary: <https://geminicli.com/docs/changelogs/latest/>.

---

## 6. Recommendation for Trellis

Trellis ships sub-agents that need a curated tool subset (Read, Write, Edit, Bash, Glob, Grep, plus two Exa MCP tools). Two viable options:

**Option A — Omit `tools:` entirely.** Cleanest fix; sub-agent inherits parent tools, which means whatever the user has configured in their main session (built-ins + any MCP servers they've registered). Pros: zero name-mapping work, immune to future Gemini renames, matches the "delegate, don't sandbox" philosophy of the other Trellis platforms. Cons: no isolation — if the parent session loses a tool, the sub-agent loses it too. No way to declare "this agent specifically needs Exa search" as a contract.

**Option B — Emit a Gemini-specific array with snake_case + correct MCP FQNs.** Map Trellis's logical tool names to Gemini CLI's actual tool registry:

```yaml
tools:
  - read_file
  - write_file
  - edit
  - run_shell_command   # or shell, depending on registry
  - glob
  - grep_search
  - mcp_exa_web_search_exa
  - mcp_exa_get_code_context_exa
```

Pros: explicit contract, isolation works, sub-agent will fail fast if user hasn't configured the Exa MCP server. Cons: requires a Trellis-side mapping table; tool names differ across Gemini versions; each new Trellis-supported tool needs a Gemini-specific entry.

**Recommended: Option A (omit `tools:`)** for the Gemini CLI configurator only, with these reasons:
1. Smallest diff — single template change, no name-mapping table to maintain.
2. Survives future Gemini tool renames (which already happened once: `__` → `_` in PR #22069).
3. Matches the user's actual environment — if the user runs `/agents` and the sub-agent has tools the user doesn't have, it would fail anyway. Inheriting is honest.
4. Trellis sub-agents are workflow orchestrators; they don't need a security boundary against the parent — the user trusts both equally.
5. The official `frontend-specialist` example in Google's launch blog uses an explicit list, but the docs explicitly call out omission as valid and the runtime defaults correctly since PR #17422 (well before 0.40.x).

If isolation is later wanted, switch to `tools: ['*']` (wildcard for "all parent tools") which is also valid post-PR #22069 and gives the same effective behavior as omission while being explicit.

Avoid: keeping the comma-separated string. That format has never been valid for `.gemini/agents/*.md` and never will be — it's a Claude Code / Cursor convention being copied into a platform that requires a YAML sequence.

---

## Caveats / Not Found

- Did not directly read Gemini CLI's tool-name registry to confirm the exact built-in tool slugs (`run_shell_command` vs `shell`, `edit` vs `edit_file`, `write_file` vs `create_file`). If the team chooses Option B, that is the next research item — read `packages/core/src/tools/*.ts` in the gemini-cli repo to enumerate registered names. Option A sidesteps this.
- Trellis issue #224 itself was not fetched; the analysis assumes the user-reported error string `tools: Expected array, received string` matches the Zod failure path described above. The Zod error format `<field>: Expected <expected>, received <actual>` matches exactly.
- Docs/code drift on `mcpServers` (docs) vs `mcp_servers` (schema) noted but not relevant to this fix.