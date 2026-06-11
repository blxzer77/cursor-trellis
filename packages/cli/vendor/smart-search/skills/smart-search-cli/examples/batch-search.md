# Batch Search Workflow

Use this workflow when the user gives multiple queries, tools, companies, documents, URLs, or comparison targets. The model should run repeated narrow CLI commands, save each output, and summarize only after reading the saved files.

## Goal

Keep batch work reproducible:

- one evidence directory
- one numbered output per query or URL
- narrow commands selected by intent
- fetched evidence before claim-level conclusions

## Batch Query Discovery

Use a PowerShell loop when several independent queries need the same source-discovery treatment.

```powershell
$Config = smart-search config path --format json | ConvertFrom-Json
$EvidenceDir = Join-Path $Config.resolved_evidence_dir "YYYYMMDD-HHMM-batch"
New-Item -ItemType Directory -Force -Path $EvidenceDir | Out-Null

$Queries = @(
  @{ Name = "openai"; Query = "OpenAI Responses API web_search documentation" },
  @{ Name = "anthropic"; Query = "Anthropic tool use web search documentation" },
  @{ Name = "google"; Query = "Google Gemini grounding search documentation" }
)

$Index = 1
foreach ($Item in $Queries) {
  $OutputPath = Join-Path $EvidenceDir ("{0:D2}-exa-{1}.json" -f $Index, $Item["Name"])
  smart-search exa-search ($Item["Query"]) --num-results 5 --include-text --include-highlights --format json --output $OutputPath
  $Index += 1
}
```

After the loop:

1. Read each saved JSON.
2. Select the top URL or official result for each item.
3. Fetch pages that will support final claims.
4. Compare only what fetched text supports.

## Batch Fetch Known URLs

Use this when the user already provided URLs or when discovery produced a short URL list.

```powershell
$Config = smart-search config path --format json | ConvertFrom-Json
$EvidenceDir = Join-Path $Config.resolved_evidence_dir "YYYYMMDD-HHMM-url-batch"
New-Item -ItemType Directory -Force -Path $EvidenceDir | Out-Null

$Urls = @(
  "https://example.com/source-a",
  "https://example.com/source-b",
  "https://example.com/source-c"
)

$Index = 1
foreach ($Url in $Urls) {
  $OutputPath = Join-Path $EvidenceDir ("{0:D2}-fetch.md" -f $Index)
  smart-search fetch $Url --format markdown --output $OutputPath
  $Index += 1
}
```

## Mixed Intent Batches

Pick the command per item instead of forcing every item through one provider:

- Broad/current/domestic item: run the bilingual `smart-search search` pair and save separate `*-zh.json` / `*-en.json` outputs.
- Docs/API/library item: `smart-search context7-library "library" "topic" --format json --output PATH`, then `context7-docs` for the selected library id.
- Official/trusted-domain item: `smart-search exa-search "query" --num-results 5 --include-text --include-highlights --format json --output PATH`
- Broad first pass: `smart-search search "中文搜索，优先检索中文来源，并回答原问题：query" --validation balanced --extra-sources 1 --format json --output PATH`, then `smart-search search "Search English-language sources and answer the original question: query" --validation balanced --extra-sources 1 --format json --output PATH`
- Known URL: `smart-search fetch "https://example.com/source" --format markdown --output PATH`

## Summarize The Batch

Before answering:

1. Confirm every claim maps to a fetched file or fetched URL.
2. Separate fetched evidence from unfetched candidates.
3. Keep per-item gaps visible instead of smoothing them over.
4. Include the evidence directory and important command lines when useful.

Use a compact summary table:

| Item | Evidence file | Supported conclusion | Gaps |
| --- | --- | --- | --- |
| item-a | `03-fetch-a.md` | supported claim | none |
| item-b | `04-fetch-b.md` | partial claim | missing official source |

## Guardrails

- Keep `--extra-sources` small, usually `1` to `3`.
- Do not use broad `search.content` as proof for a comparison row.
- Do not cite `extra_sources` as verified evidence until fetched.
- Do not silently switch to native web search if a command fails; report the failure and recovery path.
