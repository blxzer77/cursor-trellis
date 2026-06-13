# Design

## Goal

Add a Trellis-native session memory retrieval layer for reusable decisions, prior work, and task history without depending on Smart Search.

## Evidence

- `.trellis/workspace/<developer>/journal-N.md` stores structured session records.
- `.trellis/workspace/<developer>/index.md` stores session history and active journal metadata.
- `add_session.py` writes session entries and rotates journals.
- `session_context.py` reports active journal metadata but does not search prior sessions.
- Phase 1 `artifact_search.py` indexes `workspace` artifacts generically, but downstream ranking needs a session-specific result shape.

## Proposed Runtime Boundary

Add a session memory helper that parses workspace journals into compact memory entries:

```json
{
  "version": 1,
  "source": "session-memory",
  "developer": "blxzer77",
  "title": "Session title",
  "date": "YYYY-MM-DD",
  "task": "optional task title or slug",
  "package": "optional package",
  "branch": "optional branch",
  "commits": ["abcdef0"],
  "summary": "session summary",
  "matchedSections": ["Summary", "Main Changes", "Next Steps"],
  "path": ".trellis/workspace/<developer>/journal-1.md",
  "line": 42,
  "score": 12,
  "reason": "matched task slug and summary keyword"
}
```

The helper can be used by a script such as `search_memory.py` or by context loading later. It should remain local, deterministic, and fast enough for startup/context use.

## Parsing Strategy

- Use Markdown headings from `add_session.py` output as the session boundary: `## Session N: <title>`.
- Extract stable fields from bold labels: `Date`, `Task`, `Package`, `Branch`.
- Extract sections: `Summary`, `Main Changes`, `Git Commits`, `Testing`, `Status`, and `Next Steps`.
- Keep parsing tolerant of older entries that lack package or branch fields.

## Ranking Strategy

Start simple and explainable:

- Title/task slug match: high weight.
- Summary and next steps match: high weight.
- Main changes match: medium weight.
- Commit hash/path/package/branch match: medium weight.
- Recent session boost: small weight.

Ranking should return reasons and matched fields so context ranking can reuse the explanation.

## Compatibility

- Do not change the `add_session.py` write format in this child unless necessary.
- Preserve existing journal rotation and index update behavior.
- No network or Smart Search calls.
- JSON output should be additive and stable for downstream ranking.
