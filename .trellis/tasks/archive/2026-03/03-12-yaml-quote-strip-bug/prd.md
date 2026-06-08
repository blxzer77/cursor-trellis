# fix: parse_simple_yaml strip 引号破坏内嵌引号

## Problem

`parse_simple_yaml()` in `common/worktree.py` uses `.strip('"').strip("'")` to remove surrounding quotes from YAML values. Python's `str.strip()` removes **all matching characters from both ends**, not just one layer of quotes.

This causes values with nested quotes to be corrupted:

```yaml
hooks:
  after_create:
    - "echo 'Task created'"
```

Parse flow:
1. `stripped[2:].strip()` → `"echo 'Task created'"`
2. `.strip('"')` → `echo 'Task created'` (correct — outer `"` removed)
3. `.strip("'")` → `echo 'Task created` (BUG — trailing `'` eaten)

Result: `/bin/sh -c "echo 'Task created"` → **unexpected EOF while looking for matching `'`**

Affected lines:
- `worktree.py:80` — list item parsing
- `worktree.py:85` — key-value parsing

## Root Cause

`str.strip(chars)` strips **all** characters in `chars` from both ends greedily. It's not "remove one surrounding pair of quotes" — it's "remove any `'` characters at both ends".

## Fix

Replace `.strip('"').strip("'")` with a function that removes **exactly one layer** of matching outer quotes:

```python
def _unquote(s: str) -> str:
    """Remove one layer of matching surrounding quotes."""
    if len(s) >= 2 and s[0] == s[-1] and s[0] in ('"', "'"):
        return s[1:-1]
    return s
```

## Acceptance Criteria

- [ ] Values with nested quotes are preserved: `"echo 'hello'"` → `echo 'hello'`
- [ ] Single outer quotes still work: `'value'` → `value`
- [ ] Double outer quotes still work: `"value"` → `value`
- [ ] Unquoted values unchanged: `value` → `value`
- [ ] Mismatched quotes left as-is: `"value'` → `"value'`
- [ ] Both list items (line 80) and key-values (line 85) fixed
- [ ] Dogfooded copy synced (`.trellis/scripts/common/worktree.py`)
- [ ] `parse_simple_yaml` unit tests added (currently **zero** coverage)

## Test Gap

`parse_simple_yaml()` is a core parser used by config.py (hooks, packages, settings) and worktree.py (worktree.yaml, config.yaml), but has **no unit tests at all**. Minimum test cases needed:

- Basic key-value: `key: value`
- Quoted value: `key: "value"`, `key: 'value'`
- Nested quotes: `key: "echo 'hello'"`, `key: 'say "hi"'`
- List items: `- item`, `- "item"`, `- "echo 'hello'"`
- Nested dict: `parent:\n  child: value`
- Comments and blank lines
- Edge cases: empty value, mismatched quotes, trailing whitespace

## Affected Locations (Full Audit)

| File | Line | Strip Method | Severity |
|------|------|-------------|----------|
| `common/worktree.py` | :80, :85 | `.strip('"').strip("'")` | **Critical** — greedy strip eats nested quotes |
| `update.ts:loadUpdateSkipPaths` | :312 | `.trim()` only, no quote removal | Minor — `- "path"` keeps outer quotes, skip won't match |
| `ralph-loop.py` | :126 | `.strip()` only, no quote removal | Minor — `- "cmd"` passes quotes to shell |
| `project-detector.ts` | :390 | `.replace(/^['"]\|['"]$/g, "")` | **Correct** — regex removes exactly one from each end |

## Fix Scope

1. **worktree.py:80,85** (critical) — replace `.strip('"').strip("'")` with `_unquote()`
2. **update.ts:312** (minor) — add quote removal like project-detector.ts does
3. **ralph-loop.py:126** (minor) — add `_unquote()` after `.strip()`
4. Sync all dogfooded + template copies

## Technical Notes

- `project-detector.ts:390` is the correct reference implementation
- This is a hand-rolled YAML parser; long-term consider replacing with a proper library
