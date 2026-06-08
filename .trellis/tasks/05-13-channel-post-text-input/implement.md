# Implementation Plan

## Steps

1. [x] Extract shared channel text-body input helper from `send.ts`.
2. [x] Reuse the helper in `threads.ts` for `channelThreadPost`.
3. [x] Add `--text-file` and `--stdin` options to the `post` command.
4. [x] Update `.trellis/spec/cli/backend/commands-channel.md`.
5. [x] Add focused tests for file and stdin body input.
6. [x] Run targeted tests and typecheck.

## Notes

- Do not add `send --thread`; `post` remains the structured thread event primitive.
- Do not duplicate stdin listeners in `threads.ts`.
- Keep `--text` precedence compatible with `send`.
