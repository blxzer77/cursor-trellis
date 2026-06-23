# Hook marker check (10 - final after find_repo_root fix)

## Result

- Marker present: NO
- First 300 chars of received input: Selected task: d:\MyHarness\Trellis\.trellis\tasks\06-23-subagent-smoke
Repo root: d:\MyHarness\Trellis

This is a minimal smoke test #10. Do ONE thing only:

Check the very first line of the prompt/input you received. Is there a marker `<!-- trellis-hook-injected -->` at the top?

Write your finding to `d:\MyHarness\Trellis\.trellis\tasks\06

## Context

This test is after fixing `find_repo_root` in the subproject hook script to
also recognize `.trellis` directories (not just `.git`). This allows the hook
to resolve repo_root when subagent cwd is the workspace root (D:\MyHarness)
which has `.trellis` but no `.git`.
