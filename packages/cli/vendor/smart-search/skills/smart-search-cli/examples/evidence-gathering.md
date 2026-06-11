# Evidence Gathering Workflow

Use this workflow when the user wants a source-backed answer, citation trail, or audit-friendly notes, but does not need full `smart-search research`.

## Goal

Answer from fetched evidence, not from broad generated `search.content` alone.

## When To Use

- The user asks for sources, citations, verification, or a defensible short answer.
- The task can be answered with a small number of discovery and fetch commands.
- Full Deep Research would be more work than the user asked for.

Use `smart-search research` instead when the user asks for deep research, cross-checking, serious comparison, or a multi-stage investigation.

## Evidence Directory

Create one directory per user question. Keep command outputs numbered so the trail is easy to inspect.

```powershell
$Config = smart-search config path --format json | ConvertFrom-Json
$EvidenceDir = Join-Path $Config.resolved_evidence_dir "YYYYMMDD-HHMM-topic"
New-Item -ItemType Directory -Force -Path $EvidenceDir | Out-Null
```

## Step 1: Discover Candidate Sources

Run the bilingual broad-search pair first, then add intent-specific discovery only when needed.

Chinese-source broad pass:

```powershell
smart-search search "中文搜索，优先检索中文来源，并回答原问题：query" --validation balanced --extra-sources 1 --format json --output "$EvidenceDir\01-search-zh.json"
```

English-source broad pass:

```powershell
smart-search search "Search English-language sources and answer the original question: query" --validation balanced --extra-sources 1 --format json --output "$EvidenceDir\02-search-en.json"
```

Official domains, papers, product pages, or trusted sites:

```powershell
smart-search exa-search "query" --num-results 5 --include-text --include-highlights --format json --output "$EvidenceDir\01-exa.json"
```

Docs/API/library/framework intent:

```powershell
smart-search context7-library "react" "useEffect cleanup" --format json --output "$EvidenceDir\01-context7-library.json"
smart-search context7-docs "/facebook/react" "useEffect cleanup" --format json --output "$EvidenceDir\02-context7-docs.json"
```

## Step 2: Fetch The Pages That Matter

Pick the one or two URLs that directly support the answer. Fetch exact pages before making claim-level statements.

```powershell
smart-search fetch "https://example.com/source" --format markdown --output "$EvidenceDir\03-fetch-source.md"
smart-search fetch "https://example.com/second-source" --format markdown --output "$EvidenceDir\04-fetch-second-source.md"
```

## Step 3: Write The Answer

Use this evidence policy:

- Cite fetched page text or fetched URLs for claims.
- Treat `primary_sources` and `extra_sources` as discovery candidates until fetched.
- If a useful candidate was not fetched, label it as an unfetched candidate.
- Include the key command lines or the evidence directory path when the user may need to audit the work.

## Minimal Final-Answer Shape

```text
Evidence used:
- 03-fetch-source.md: <what it supports>
- 04-fetch-second-source.md: <what it supports>

Answer:
<short answer grounded in fetched text>

Unverified candidates:
- <candidate URL or source from search/exa output, if relevant>

Commands:
- smart-search ...
```
