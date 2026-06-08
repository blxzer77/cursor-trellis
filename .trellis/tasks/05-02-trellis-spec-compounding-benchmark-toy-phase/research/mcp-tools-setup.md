# ABCoder + GitNexus MCP Wiring for Claude Agent SDK

## 1. ABCoder

**Repo**: https://github.com/cloudwego/abcoder (CloudWeGo, Apache-2.0, Go). Latest `v0.3.1`.

**What it does**: Parses source code to a Universal AST (UniAST) JSON, exposes that JSON as MCP tools. Languages: `go`, `rust`, `cxx`, `python`, `ts`, `js`, `java`.

**Tools exposed**:
```
list_repos → get_repo_structure → get_package_structure → get_file_structure → get_ast_node
```

**Index step is mandatory and offline**. ABCoder's MCP server does NOT parse on demand — it serves prebuilt JSON files from a directory:

1. Parse one-shot:
   ```bash
   abcoder parse <lang> <repo-path> -o ~/.asts/<repo-name>-ast.json
   ```
   Flags: `--tsconfig <path>` (TS monorepo), `--exclude <pattern>`, `--no-need-test` (Go), `--load-external-symbol`, `--repo-id <id>`, `--lsp` (Java).

2. Serve via MCP (stdio only):
   ```bash
   abcoder mcp <directory>
   ```
   HTTP mode exists in source but is **not wired to CLI** (issue #137). For benchmark, treat as **stdio only**.

**Local install detected**: `/Users/taosu/.local/bin/abcoder`. AST cache at `/Users/taosu/.asts/` already holds 30+ pre-parsed repos. User MCP config in `~/.claude.json` already wired:
```json
"abcoder": { "command": "abcoder", "args": ["mcp", "/Users/taosu/.asts"] }
```

## 2. GitNexus

**Repo**: https://github.com/abhigyanpatwari/GitNexus (npm package `gitnexus`). Docs: https://abhigyanpatwari-gitnexus.mintlify.app/mcp/overview.

**What it does**: Builds a graph database (KuzuDB) over a repo with nodes `File / Function / Class / Interface / Method / Community / Process` and edges `{CALLS, IMPORTS, EXTENDS, IMPLEMENTS, DEFINES, MEMBER_OF, STEP_IN_PROCESS}`. BM25 + optional embeddings for hybrid search.

**MCP tools**:
| Tool | Purpose |
|---|---|
| `list_repos` | Discover indexed repos |
| `query` | Process-grouped hybrid search (BM25 + semantic + RRF) |
| `context` | 360-deg symbol view (callers/callees/processes) |
| `impact` | Blast radius analysis at depth 1/2/3 |
| `detect_changes` | Map git diff to affected processes |
| `rename` | Multi-file coordinated rename |
| `cypher` | Raw Cypher against KuzuDB |

**Index step**: Mandatory.
```bash
npx -y gitnexus@latest analyze <project-path>
npx -y gitnexus@latest analyze <path> --force
npx -y gitnexus@latest analyze <path> --embeddings   # adds vector pass
```
Each `analyze` writes `.gitnexus/` inside the repo and registers in `~/.gitnexus/registry.json`.

**Transport**: `gitnexus mcp` → stdio. Also `gitnexus serve` (HTTP) and `gitnexus eval-server` (HTTP for evaluation; interesting for benchmarking but standard MCP transport is stdio).

**Local install detected**: `/Users/taosu/.nvm/versions/node/v24.10.0/bin/gitnexus`. Registry at `~/.gitnexus/registry.json` shows ~10 indexed repos. Already wired in `~/.claude.json`:
```json
"gitnexus": { "type": "stdio", "command": "npx", "args": ["-y", "gitnexus@latest", "mcp"] }
```

## 3. Per-task attachment cost

Both servers **require a per-repo index**. Indexes persist on disk (`~/.asts/*.json`, `<repo>/.gitnexus/`).

**ABCoder parse**: small repo seconds; large TS monorepo 10s–60s; Java needs `--lsp` (slower).

**GitNexus analyze**: small repo (16 files) seconds; mid (~600–900 files) 20–60s; large (2275 files) 1–2 min. `--embeddings` adds significant time.

**For the benchmark loop**: spawning fresh repo per task → 5s–60s indexing combined. Two strategies:
1. **Pre-index once per fixture**, mount prebuilt indexes into each attempt. ✅ **Recommended for our benchmark.**
2. **Re-index per attempt** — only feasible if attempts are <100 and repos are small.

## 4. Claude Agent SDK MCP config

Both servers run **stdio** mode.

**Python** snippet:
```python
from claude_agent_sdk import query, ClaudeAgentOptions

options = ClaudeAgentOptions(
    setting_sources=[],   # critical: hermeticity, don't inherit ~/.claude.json
    mcp_servers={
        "abcoder": {
            "type": "stdio",
            "command": "abcoder",
            "args": ["mcp", "/Users/taosu/.asts"],
        },
        "gitnexus": {
            "type": "stdio",
            "command": "npx",
            "args": ["-y", "gitnexus@1.6.0", "mcp"],   # pin version
        },
    },
    allowed_tools=[
        "mcp__abcoder__*",
        "mcp__gitnexus__*",
    ],
)
```

**TypeScript** snippet:
```ts
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: taskPrompt,
  options: {
    settingSources: [],
    mcpServers: {
      abcoder: { command: "abcoder", args: ["mcp", "/Users/taosu/.asts"] },
      gitnexus: { command: "npx", args: ["-y", "gitnexus@1.6.0", "mcp"] },
    },
    allowedTools: ["mcp__abcoder__*", "mcp__gitnexus__*"],
  },
})) { /* ... */ }
```

Tool naming convention: `mcp__<server-name>__<tool>`, so `mcp__abcoder__get_ast_node`, `mcp__gitnexus__cypher`, etc.

## 5. Existing MCP usage in this repo

- `Trellis/.claude/` has `agents/`, `commands/`, `hooks/`, `settings.json` but **no `.mcp.json`**.
- Live config at user level: `~/.claude.json` declares 12 MCP servers including abcoder, gitnexus, lark-mcp, playwright, chrome-devtools, codex-cli, notify, reddit, sequential-thinking, context7.
- The benchmark driver should NOT depend on `~/.claude.json`; pass `mcp_servers` programmatically and set `setting_sources=[]` for hermeticity.
- **No existing examples** in Trellis source of programmatic Claude Agent SDK MCP wiring — this benchmark will be the first.

## 6. Determinism

- **ABCoder**: deterministic (same source → same UniAST). Pin version, avoid `--load-external-symbol` unless deps are pinned.
- **GitNexus**: deterministic for `cypher`/`impact`/`context`. `query` BM25 is deterministic; community detection (Louvain-style) **can drift across versions** → pin `gitnexus@1.6.0`. Disable `--embeddings` for benchmark.

## Key local paths

- `/Users/taosu/.local/bin/abcoder`
- `/Users/taosu/.nvm/versions/node/v24.10.0/bin/gitnexus`
- `/Users/taosu/.asts/` — ABCoder cache (populated)
- `/Users/taosu/.gitnexus/registry.json` — GitNexus registry
- `/Users/taosu/.claude.json` — user MCP config (already has both)

## Caveats

- **ABCoder HTTP not exposed** — stdio only.
- **TS monorepo silent fail** if `--tsconfig` missing (AST <1KB). Sanity-check size after parse.
- **Pin both versions** for reproducibility; `gitnexus@latest` resolves at install time.
- **Inherited MCP servers**: with default `setting_sources`, SDK loads ALL 12 servers from `~/.claude.json`. Must set `setting_sources=[]` and pass only abcoder + gitnexus.
- **Indexing wall-time at scale**: pre-index once at fixture creation, not per attempt.

## Implications for benchmark

- ✅ Both tools deterministic enough for reproducible benchmark (with version pinning + no embeddings).
- ✅ MCP wiring in Claude Agent SDK is straightforward — copy-paste templates above.
- ⚠️ Pre-indexing fixture step adds ~30s/repo overhead — acceptable as one-time setup.
- ⚠️ **Hermeticity is the main pitfall** — `setting_sources=[]` + explicit `mcp_servers` are non-negotiable.
