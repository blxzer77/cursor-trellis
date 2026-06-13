# Handoff: Session Memory Retrieval

## Status

Implementation verified and ready for parent review.

## Downstream Contract

`search_memory.py` searches local Trellis workspace journals:

```powershell
python .\.trellis\scripts\search_memory.py --query "retrieval ranking" --json
```

Primary source:

```text
.trellis/workspace/<developer>/journal-N.md
```

Session boundary:

```text
## Session N: <title>
```

Parsed fields:

- `Date`
- `Task`
- `Package`
- `Branch`

Parsed sections:

- `Summary`
- `Main Changes`
- `Git Commits`
- `Testing`
- `Status`
- `Next Steps`

JSON payload shape:

```json
{
  "query": "retrieval ranking",
  "developers": [],
  "filters": {
    "task": "",
    "package": "",
    "branch": "",
    "since": "",
    "until": ""
  },
  "total": 1,
  "results": [
    {
      "version": 1,
      "source": "session-memory",
      "developer": "blxzer77",
      "session": 2,
      "title": "Trellis retrieval context optimization",
      "date": "2026-06-13",
      "task": "Trellis retrieval context optimization",
      "package": "smart-search",
      "branch": "",
      "commits": ["b686eb99"],
      "summary": "Completed retrieval artifact index...",
      "matchedSections": ["Summary", "Next Steps"],
      "matchedFields": ["task"],
      "path": ".trellis/workspace/blxzer77/journal-1.md",
      "line": 25,
      "score": 16,
      "reason": "matched 'retrieval'; matched 'ranking'"
    }
  ]
}
```

`retrieval-context-ranking` should consume `results[]` as reusable local memory evidence, not as authoritative task truth. Durable task artifacts and current source evidence still outrank memory.

## Ranking Semantics

- Empty query returns recent session memories with a small recency score.
- Token matches add explainable weighted score across fields and sections.
- Title/task/package/branch/commit/path are returned in `matchedFields`.
- Session body sections are returned in `matchedSections`.
- `reason` is intentionally compact and display-safe.
- Results sort by score descending, then session recency, path, and line.

## Command Surface

Supported options:

- `--query` / `-q`
- `--developer` (repeatable)
- `--task`
- `--package`
- `--branch`
- `--since`
- `--until`
- `--limit`
- `--json`
- `--root`

No-match and missing-workspace behavior is stable:

```json
{
  "total": 0,
  "results": []
}
```

## Notes For Parent Integration

- This child does not call Smart Search and does not parse Smart Search manifests.
- This child preserves existing journal write behavior.
- `retrieval-context-ranking` can combine this contract with Smart Search manifests by treating `source: "session-memory"` as local historical context and `source: "smart-search"` as explicit external evidence.
- Existing live workspace installations need a Trellis update/sync before `search_memory.py` is available outside the Trellis repo dogfood/runtime template.
