# Channel post text input flags

## Intent

`trellis channel post` should accept long thread event bodies through `--text-file` and `--stdin`, matching `channel send` ergonomics. This prevents shell quoting failures when posting Markdown comments to thread channels.

## Requirements

- Add `--text-file <path>` to `trellis channel post <name> <action>`.
- Add `--stdin` to `trellis channel post <name> <action>`.
- Preserve existing `--text <text>` behavior.
- Input precedence must match `channel send`: non-empty `--text` first, then `--text-file`, then `--stdin`.
- Trim only trailing newlines/whitespace from the final body, matching `channel send`.
- Empty resolved bodies must fail with a clear error.
- The implementation must reuse existing text-body reading behavior instead of duplicating stdin/file parsing.
- Update command spec and regression coverage.

## Acceptance Criteria

- `trellis channel post <channel> comment --thread <key> --text-file /abs/or/relative/file` writes the file contents to the thread event `text`.
- `cat body.md | trellis channel post <channel> comment --thread <key> --stdin` writes stdin to the thread event `text`.
- Existing `--text` thread posts still work.
- Tests cover `--text-file` and `--stdin` behavior at the command helper level.
