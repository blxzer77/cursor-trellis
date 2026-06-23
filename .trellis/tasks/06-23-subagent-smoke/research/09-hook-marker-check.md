# Hook marker check (09)

## Result

- Marker present: NO
- First 200 chars of received input: Selected task: d:\MyHarness\Trellis\.trellis\tasks\06-23-subagent-smoke
Repo root: d:\MyHarness\Trellis

This is a minimal smoke test. Do ONE thing only:

Check the very first line of the prompt/input you received. Is there a marker `<!-- trellis-hook-injected -->

## What this means

- If YES: hook injection is working after the {{PYTHON_CMD}} fix.
- If NO: hook still not firing despite the fix.
