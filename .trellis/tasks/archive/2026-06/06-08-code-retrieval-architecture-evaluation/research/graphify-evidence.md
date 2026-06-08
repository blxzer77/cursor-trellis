# Graphify Evidence

Research date: 2026-06-08

Repository: `https://github.com/safishamsi/graphify`

This document records source-backed facts only. No local install, execution, MCP server startup, dependency install, or Trellis source implementation was performed in this task.

## Source Files Read

- `README.md`
- `pyproject.toml`
- `ARCHITECTURE.md`
- `CHANGELOG.md`
- `SECURITY.md`
- `graphify/skill.md`
- `skills/graphify/skill.md` on `main`
- `skills/graphify/skill.md` on `v1`
- `graphify/__main__.py`
- `graphify/serve.py`
- `graphify/detect.py`
- `graphify/build.py`
- `graphify/cluster.py`
- `graphify/analyze.py`
- `graphify/export.py`
- `graphify/wiki.py`
- `graphify/watch.py`
- `graphify/hooks.py`
- `graphify/ingest.py`
- `graphify/security.py`
- `tests/test_pipeline.py`
- `tests/test_serve.py`
- `tests/test_security.py`
- `tests/test_wiki.py`
- `.github/workflows/ci.yml`
- `worked/mixed-corpus/GRAPH_REPORT.md`
- `worked/mixed-corpus/review.md`
- `worked/httpx/GRAPH_REPORT.md`
- `worked/httpx/README.md`

GitHub code search was attempted but failed because the GitHub MCP search endpoint requires authentication. All conclusions below are based on direct file reads.

## README Facts

`README.md` presents Graphify primarily as "A Claude Code skill" invoked with `/graphify`, not as a normal standalone CLI-first product. It says `/graphify .` reads files, builds a knowledge graph, and returns structure. It explicitly targets mixed corpora: code, PDFs, markdown, screenshots, diagrams, whiteboard photos, and multilingual images.

The advertised install path is:

```bash
pip install graphifyy && graphify install
```

The README explains that the PyPI package is temporarily named `graphifyy`, while the CLI and skill command are still `graphify`. Python 3.10+ and Claude Code are listed as requirements.

Advertised output directory:

```text
graphify-out/
  graph.html
  obsidian/
  wiki/
  GRAPH_REPORT.md
  graph.json
  cache/
```

Advertised usage includes build/update/query/path/explain/watch/wiki/svg/graphml/neo4j/MCP flows such as:

```text
/graphify ./raw --update
/graphify query "what connects attention to the optimizer?"
/graphify path "DigestAuth" "Response"
/graphify ./raw --mcp
graphify hook install
```

The README also defines intended user value:

- persistent `graphify-out/graph.json`;
- `EXTRACTED`, `INFERRED`, and `AMBIGUOUS` confidence labels;
- god nodes;
- surprising connections;
- suggested questions;
- auto-sync/watch;
- post-commit hook;
- wiki articles for agent navigation.

The tech stack is stated as NetworkX, Leiden via `graspologic`, tree-sitter, Claude, and vis.js. The README says there is no Neo4j requirement and no server for the base workflow.

## Packaging and Runtime Facts

`pyproject.toml` says:

- package name: `graphifyy`;
- version read: `0.1.14`;
- Python: `>=3.10`;
- script entrypoint: `graphify = "graphify.__main__:main"`;
- package data includes `graphify/skill.md`.

Base dependencies include:

- `networkx`;
- `graspologic`;
- `tree-sitter`;
- multiple tree-sitter language packages for Python, JavaScript, TypeScript, Go, Rust, Java, C, C++, Ruby, C#, Kotlin, Scala, and PHP.

Optional extras:

- `mcp = ["mcp"]`;
- `neo4j = ["neo4j"]`;
- `pdf = ["pypdf", "html2text"]`;
- `watch = ["watchdog"]`;
- `all = ["mcp", "neo4j", "pypdf", "html2text", "watchdog"]`.

CI installs `pip install -e ".[mcp,pdf,watch]"`, runs `python -m pytest tests/ -q --tb=short`, then verifies `graphify --help` and `graphify install`. CI runs on Python 3.10 and 3.12.

Implication for Trellis: managing Graphify as a hard Trellis runtime dependency would pull in a Python dependency stack, optional extras, and cross-platform Python packaging behavior. That is a separate runtime-management decision, not a small bundled-skill addition.

## Architecture Facts

`ARCHITECTURE.md` states:

> graphify is a Claude Code skill backed by a Python library. The skill orchestrates the library; the library can be used standalone.

Pipeline:

```text
detect() -> extract() -> build_graph() -> cluster() -> analyze() -> report() -> export()
```

The architecture doc says stages communicate through plain Python dicts and NetworkX graphs, with no shared state and no side effects outside `graphify-out/`.

Module responsibilities include:

- `detect.py`: `collect_files(root)` or detection/classification;
- `extract.py`: file path to `{nodes, edges}`;
- `build.py`: extraction dicts to `nx.Graph`;
- `cluster.py`: graph to community attributes;
- `analyze.py`: god nodes, surprises, questions;
- `report.py`: `GRAPH_REPORT.md`;
- `export.py`: Obsidian, `graph.json`, `graph.html`, SVG, etc.;
- `ingest.py`: URL to local corpus file;
- `cache.py`: semantic extraction cache;
- `security.py`: validation helpers;
- `serve.py`: MCP stdio server for a graph file;
- `watch.py`: local file watcher;
- `benchmark.py`: token comparison.

Extraction schema uses `nodes` and `edges`. Edges carry `confidence` as `EXTRACTED`, `INFERRED`, or `AMBIGUOUS`. `validate.py` enforces schema before graph build.

Implication for Trellis: Graphify has an actual module pipeline that can be used from Python, but the full product workflow is not just one exported CLI command. Trellis should treat the Python modules and artifacts as stable surfaces, and treat the upstream Skill as the orchestration spec.

## Skill Workflow Facts

Both `graphify/skill.md` and `skills/graphify/skill.md` are large Claude-oriented workflow files. The `main` packaged skill is about 47 KB. The `v1` skill is about 43 KB. The `main` skill has additional details such as parallel AST plus semantic extraction, semantic similarity edges, hyperedges, rationale handling, native `CLAUDE.md` integration, and more explicit confidence-score rules.

The Skill frontmatter declares:

```yaml
name: graphify
trigger: /graphify
```

The Skill defines full behavior for:

- installation check;
- corpus detection;
- AST extraction for code;
- semantic extraction through parallel subagents;
- semantic cache check and save;
- AST/semantic merge;
- graph build;
- community detection;
- community labeling by the agent;
- report generation;
- JSON export;
- Obsidian vault export;
- HTML export;
- Neo4j export/push;
- SVG and GraphML export;
- MCP server startup;
- token benchmark;
- manifest/cost tracking;
- cleanup;
- incremental `--update`;
- `--cluster-only`;
- `query`;
- `path`;
- `explain`;
- `add <url>`;
- `--watch`;
- git hook install/status/uninstall;
- project-local `CLAUDE.md` integration.

Important build fact: semantic extraction is not implemented purely inside the Python package. The Skill requires external agent/subagent execution for docs, papers, and images. It says the agent must dispatch all semantic subagents in a single response and return JSON graph fragments. This is a Claude Code Skill workflow, not a normal CLI library call.

Important safety/consent fact: the upstream Skill itself auto-installs with `pip install graphifyy` if import fails. Trellis should not copy that behavior verbatim because Trellis's own safety policy requires user approval before dependency installation.

Important platform fact: the Skill uses Unix-style examples (`python3`, `rm -f`, `cp`) and Claude-specific concepts (`Agent tool`, `CLAUDE.md`, `~/.claude/skills`). Trellis targets multiple platforms and this repository is developed on Windows. Trellis should not vendor the upstream Skill unchanged.

## CLI Entrypoint Facts

`graphify/__main__.py` describes the CLI as:

> `graphify CLI - graphify install sets up the Claude Code skill.`

Actual top-level commands implemented in `main()` are:

- `install`;
- `vscode install`;
- `benchmark [graph.json]`;
- `hook install`;
- `hook uninstall`;
- `hook status`;
- `claude install`;
- `claude uninstall`.

If an unknown command is passed, it prints `error: unknown command '<cmd>'`.

There is no actual `graphify <path>`, `graphify query`, `graphify path`, or `graphify explain` implementation in `__main__.py` as read in this research. Those flows are defined in the Skill as slash-command behavior and Python snippets.

Contradiction found:

- README/Skill examples advertise `/graphify <path>` and related slash-command usage.
- `worked/httpx/README.md` also says "Or from the CLI directly: `graphify ./raw`".
- The observed `__main__.py` does not support `graphify ./raw`; it would treat `./raw` as an unknown command.

Implication for Trellis: do not build Trellis integration around direct `graphify <path>` CLI calls until a smoke test or upstream code change proves that command exists. Build/update routing should use either the upstream Skill workflow as a reference or Python module calls, not the advertised bare CLI path.

## Artifact Facts

Graphify's persistent artifacts are the lowest-friction Trellis integration surface.

`wiki.py` generates an "agent-crawlable" wiki:

- `index.md`;
- one article per community;
- one article per god node;
- cross-community wikilinks;
- source file lists;
- audit trail with confidence breakdown.

`CHANGELOG.md` states that version 0.1.8 changed follow-up questions to check `graphify-out/wiki/index.md` before falling back to `graph.json`, and `--update` regenerates wiki if `graphify-out/wiki/` exists.

`export.py` can write:

- `graph.json`;
- `graph.html`;
- Obsidian vault;
- Obsidian Canvas;
- Neo4j Cypher;
- GraphML;
- SVG.

`graph.html` uses a vis-network script from `https://unpkg.com/vis-network/standalone/umd/vis-network.min.js` when opened in a browser. This does not contradict "no network calls during graph analysis", but it matters if Trellis later documents offline visualization expectations.

Implication for Trellis: artifact-first routing is useful and safe. If `graphify-out/wiki/index.md` exists, Trellis agents can read it before raw files. If absent but `GRAPH_REPORT.md` exists, Trellis can read god nodes, communities, surprising connections, and suggested questions. This needs no runtime, no MCP config, and no dependency installation.

## MCP Server Facts

`graphify/serve.py` starts a local MCP stdio server for an existing graph file. It imports `mcp` only inside `serve()`, so the optional extra is required only when starting the server.

Startup shape:

```bash
python -m graphify.serve graphify-out/graph.json
```

The MCP server loads `graphify-out/graph.json` into a NetworkX graph using `json_graph.node_link_graph(data, edges="links")`. It validates the graph path through `validate_graph_path()`, which defaults to allowing only paths inside `graphify-out/`.

Tools exposed:

- `query_graph(question, mode=bfs|dfs, depth, token_budget)`;
- `get_node(label)`;
- `get_neighbors(label, relation_filter?)`;
- `get_community(community_id)`;
- `god_nodes(top_n?)`;
- `graph_stats()`;
- `shortest_path(source, target, max_hops?)`.

Strengths:

- structured arguments;
- reliable graph traversal operations;
- shortest path support;
- neighborhood/community/god-node inspection;
- no ad hoc JSON parsing by the agent;
- stdio only, no network listener.

Limits:

- requires an already-built `graphify-out/graph.json`;
- does not detect files;
- does not extract semantics;
- does not build or update graph output;
- requires `mcp` optional dependency;
- per-project graph path makes a static global MCP config awkward;
- node search is term-overlap based, not a semantic embedding search.

Implication for Trellis: Graphify MCP is a good candidate for existing-graph query/path/neighborhood operations. It is not the owner for graph build/update. It should be optional or project-scoped, not mandatory for Trellis installation.

## Detection and Update Facts

`detect.py` supports:

- code: `.py`, `.ts`, `.js`, `.tsx`, `.go`, `.rs`, `.java`, `.cpp`, `.cc`, `.cxx`, `.c`, `.h`, `.hpp`, `.rb`, `.swift`, `.kt`, `.kts`, `.cs`, `.scala`, `.php`;
- documents: `.md`, `.txt`, `.rst`;
- papers: `.pdf`, plus heuristics for academic text files;
- images: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`.

It skips many noise directories including virtualenvs, `.git`, `node_modules`, caches, build artifacts, and target/dist/out. It uses `os.walk(..., followlinks=False)`.

It silently skips sensitive-looking files such as env files, private keys, certs, credential/secret/password/token paths, and cloud credential patterns.

It includes `graphify-out/memory/` when present. This supports the feedback loop where answered queries are saved as markdown and included in later updates.

Thresholds in code:

- lower warning threshold: 50,000 words;
- upper warning threshold: 500,000 words;
- file count upper threshold: 200 files.

The upstream Skill text mentions a 2,000,000-word warning in one place, while `detect.py` uses 500,000 words. Trellis should trust code for actual behavior and note the docs mismatch.

`detect_incremental()` compares file mtimes against `graphify-out/manifest.json` and returns `new_files`, `unchanged_files`, and `new_total`.

Implication for Trellis: update operations need runtime state and should be user-approved. Trellis can safely inspect artifacts and flags, but should not automatically run update/build hooks.

## Graph Build and Analysis Facts

`build.py` builds an undirected `nx.Graph` from extraction data. It preserves original edge direction with `_src` and `_tgt` attributes because undirected graphs otherwise lose display direction. It skips dangling edges to external/stdlib nodes and removes isolated code nodes.

`cluster.py` runs Leiden community detection through `graspologic.partition.leiden`, handles isolates, splits oversized communities, and returns community IDs sorted by size.

`analyze.py` provides:

- god nodes;
- surprising connections;
- suggested questions;
- graph diff.

Surprising connections prefer non-obvious cross-file, cross-type, cross-repo, cross-community, peripheral-to-hub, semantic-similarity, inferred, and ambiguous signals.

Implication for Trellis: Graphify's strongest differentiated value is not "search this file"; it is structural graph analysis: communities, centrality, bridges, surprising relations, and path reasoning.

## Watch and Hook Facts

`watch.py` requires optional dependency `watchdog`. Behavior:

- code-only changes trigger AST extraction, rebuild, cluster, report, and `graph.json` update without LLM;
- docs, papers, or images write `graphify-out/needs_update` and ask the user to run `/graphify --update`.

`hooks.py` installs a post-commit hook. It respects `core.hooksPath`, appends to an existing hook if present, and runs code-only rebuild behavior after commits.

Implication for Trellis: watch and hook are high-impact local automation. Trellis must ask before starting watch mode or installing hooks. They are not appropriate as default install-time behavior.

## Ingest and Memory Facts

`ingest.py` explicitly fetches URLs and saves graph-ready files. It supports tweets/X, arXiv, PDFs, images, and generic web pages. It validates URLs through `validate_url()`.

`save_query_result()` stores Q&A output as markdown under `graphify-out/memory/` with YAML frontmatter. On the next update, those files can be extracted into the graph.

Implication for Trellis: Graphify can become a persistent project memory layer, but URL ingest and memory mutation are explicit write operations. They need user intent and should not be hidden behind passive workflow text.

## Security Facts

`SECURITY.md` says Graphify is a local development tool. It runs as a Claude Code Skill and optionally as a local MCP stdio server. It makes no network calls during graph analysis; network occurs only for explicit `ingest`.

The security document says Graphify:

- does not run a network listener;
- does not execute source code;
- does not use `shell=True`;
- does not store credentials or API keys.

Mitigations include:

- http/https-only URL validation;
- redirect validation to block `file://`;
- binary fetch capped at 50 MB;
- text fetch capped at 10 MB;
- non-2xx HTTP errors raise;
- graph file path guard under `graphify-out/`;
- HTML/control-character label sanitization;
- YAML newline stripping;
- non-UTF-8 byte decoding with `errors="replace"`;
- `os.walk(..., followlinks=False)`;
- corrupted graph JSON handling.

Tests in `tests/test_security.py` cover URL scheme rejection, safe fetch behavior, graph path traversal guard, missing file/base behavior, and label sanitization.

Implication for Trellis: Graphify has a reasonable local-tool threat model, but Trellis still must preserve user approval boundaries for install, network ingest, hook install, watch startup, Neo4j push, and MCP configuration.

## Test and Example Facts

`tests/test_pipeline.py` verifies an end-to-end pipeline:

```text
detect -> extract -> build -> cluster -> analyze -> report -> export
```

The test explicitly says it uses existing test fixtures and no LLM calls. It catches module connection regressions, not semantic subagent behavior.

`tests/test_serve.py` covers MCP query helpers without requiring the `mcp` package. It tests community reconstruction, node scoring, BFS/DFS, text truncation, and graph load behavior.

`tests/test_wiki.py` verifies wiki index, community articles, god node articles, cross links, cohesion, audit trail, missing god nodes, fallback labels, navigation footer, and truncation notices.

Worked examples show expected report shape:

- `worked/httpx/GRAPH_REPORT.md`: 144 nodes, 330 edges, 6 communities, god nodes such as `Client`, `AsyncClient`, `Response`, and suggested bridge/inferred-edge questions.
- `worked/mixed-corpus/GRAPH_REPORT.md`: report sections include corpus check, summary, god nodes, surprising connections, communities, and suggested questions.
- `worked/mixed-corpus/review.md`: records a live evaluation by Claude Sonnet 4.6 and says query results saved under `graphify-out/memory/` were detected on the next scan.

These examples are useful for output format and intended behavior. They are not Trellis-verified benchmarks.

## Contradictions and Uncertainties

### CLI Usage Mismatch

Evidence:

- README and worked example docs imply direct CLI usage such as `graphify ./raw`.
- `graphify/__main__.py` does not implement `graphify <path>`.

Decision impact: Trellis must not rely on direct `graphify <path>` until smoke testing proves it works in the installed package or upstream changes the CLI.

### Skill Is Claude-Specific

Evidence:

- Skill uses Claude Code slash-command semantics, `Agent tool`, `CLAUDE.md`, and Unix command examples.

Decision impact: Trellis should not vendor upstream `skill.md` unchanged. It should write a Trellis-native routing Skill that adapts the capability to Codex/multi-platform rules.

### Semantic Extraction Depends on Agent Behavior

Evidence:

- Skill mandates subagents for docs/papers/images and instructs them to return JSON fragments.
- Python module tests cover AST/no-LLM pipeline but not full semantic extraction.

Decision impact: Trellis cannot honestly claim fully automated mixed-corpus Graphify builds unless it owns or adapts this agent orchestration.

### MCP Requires Existing Graph

Evidence:

- `serve.py` only loads `graphify-out/graph.json`.
- Tools query/traverse loaded graph; none detect, extract, build, update, or export.

Decision impact: MCP is a query surface, not a build/update owner.

### Static MCP Config Is Awkward

Evidence:

- `serve.py` accepts a graph path.
- The valid graph path is project-local under `graphify-out/`.

Decision impact: global Trellis installation should not hardcode one Graphify MCP server. A future implementation should be project-scoped or launched on demand after graph creation.

## Evidence-Based Capability Boundaries

Use `fast-context-mcp` when the user needs:

- live semantic code search;
- relevant file paths and line ranges;
- implementation location discovery;
- grep keyword suggestions;
- low-setup research during active coding.

Use Graphify artifacts when the user needs:

- project architecture overview;
- god nodes;
- communities;
- surprising connections;
- suggested architectural questions;
- persistent graph/wiki memory already generated.

Use Graphify MCP when the user needs:

- shortest path between concepts;
- node details;
- direct neighbors;
- community membership;
- graph stats;
- broad BFS/DFS traversal over an existing graph.

Use Graphify Skill/library orchestration when the user needs:

- first-time graph build;
- incremental update;
- mixed code/docs/papers/images semantic extraction;
- report/export/wiki generation;
- watch/hook behavior;
- URL ingest and memory feedback.

## Working Conclusion From Evidence

Graphify should not be assigned to one global integration surface.

Evidence supports a hybrid ownership model:

- build/update: Trellis routing Skill plus external Graphify runtime/library, with user approval;
- existing-graph queries: optional Graphify MCP is the strongest structured interface;
- architecture preflight: artifact reading is the cheapest and safest first step;
- runtime installation: external/user-approved initially;
- Trellis bundled asset: a concise `trellis-graphify` Skill later, not the upstream 47 KB Claude Skill.

