# Verification Evidence

## Validation results

- Verified `packages/cli/src/templates/shared-hooks/session-start.py` uses `_PYTHON_CMD = "python" if sys.platform == "win32" else "python3"` and all five user-visible Next-Action / guidelines command hints reference `{_PYTHON_CMD}` (lines 344, 644, 675, 742, 839–844).
- Normalized diff vs dogfood `.cursor/hooks/session-start.py`: MATCH after sync (smart-search hint block included).

Validation evidence: template source grep + normalized file compare (2026-06-24).

## Final acceptance evidence

H-2 resolved: Windows sessionStart injected commands no longer hardcode `python3`.

Accepted by user: inline Parent closure session (2026-06-24).

## Durable learning decision

No durable learning for this task scope (Windows resolver pattern already documented in hook header comment).
