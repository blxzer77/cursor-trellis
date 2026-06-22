/**
 * Scrubbers for structured config files during `trellis uninstall`.
 *
 * Each scrubber takes the file content (and any context it needs) and returns
 * `{ content, fullyEmpty }`:
 * - `content` is the post-scrub text to write back if the file should remain.
 * - `fullyEmpty` is true when, after stripping every trellis-managed value,
 *   nothing meaningful is left. The caller deletes the file in that case.
 *
 * Manifest path matching (for hooks.json scrubbers) uses substring containment
 * on the resolved `command` string. The leading `python3 ` / `python ` prefix
 * does not matter — we just look for the manifest-relative file path.
 */

export interface ScrubResult {
  content: string;
  fullyEmpty: boolean;
}

/**
 * Test whether a hook command string references any of the given manifest paths.
 *
 * Trellis-emitted hook commands always have the shape
 *   `<python-cmd> <manifest-path>`
 * so the trailing whitespace-delimited token is the script path. We compare
 * that last token (with surrounding quotes stripped) against the manifest
 * delete-set. This is intentionally stricter than substring matching: a
 * user-added hook whose body merely mentions a deleted path inside an `echo`
 * or comment argument (`echo "see .claude/hooks/session-start.py"`) does NOT
 * match, because the trailing token is `inspiration"` (or similar) — not the
 * path. We also accept absolute-path variants like
 * `/Users/me/proj/.claude/hooks/session-start.py` via `endsWith("/" + p)`.
 */
function commandMatchesDeletedPath(
  command: string,
  deletedPaths: readonly string[],
): boolean {
  const trimmed = command.trim();
  if (trimmed.length === 0) return false;

  const tokens = trimmed.split(/\s+/);
  const lastToken = tokens[tokens.length - 1].replace(/^["']|["']$/g, "");
  if (lastToken.length === 0) return false;

  for (const p of deletedPaths) {
    if (lastToken === p || lastToken.endsWith("/" + p)) {
      return true;
    }
  }
  return false;
}

/**
 * Read the `command` (or fallback `bash` / `powershell`) string out of an
 * arbitrary hook entry. Copilot's flat schema uses `bash` + `powershell`
 * instead of `command` for some events.
 */
function getEntryCommand(entry: unknown): string | null {
  if (entry === null || typeof entry !== "object") {
    return null;
  }
  const obj = entry as Record<string, unknown>;
  if (typeof obj.command === "string") return obj.command;
  if (typeof obj.bash === "string") return obj.bash;
  if (typeof obj.powershell === "string") return obj.powershell;
  return null;
}

/**
 * Scrub a hooks-shaped settings JSON file.
 *
 * `mode = "nested"` → `hooks.{Event}.[ {matcher?, hooks: [ {command,...} ]} ]`
 * `mode = "flat"`   → `hooks.{Event}.[ {command,...} ]`
 *
 * Strips every entry whose command references a path in `deletedPaths`,
 * then bottom-up cleans empty containers (matcher block, event array, hooks
 * object). Any user-defined keys outside `hooks` (e.g. `env`, `model`,
 * `permissions`, `version`) are preserved verbatim.
 */
export function scrubHooksJson(
  content: string,
  deletedPaths: readonly string[],
  mode: "nested" | "flat",
): ScrubResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    // Malformed JSON — leave it untouched, caller will skip.
    return { content, fullyEmpty: false };
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { content, fullyEmpty: false };
  }

  const root = parsed as Record<string, unknown>;
  const hooks = root.hooks;

  if (hooks === undefined) {
    // No hooks block — nothing to scrub. Treat as fully empty only if the
    // entire file has no other keys.
    const fullyEmpty = Object.keys(root).length === 0;
    return { content: JSON.stringify(root, null, 2) + "\n", fullyEmpty };
  }

  if (hooks === null || typeof hooks !== "object" || Array.isArray(hooks)) {
    // hooks is some unexpected shape — leave it alone.
    return { content, fullyEmpty: false };
  }

  const hooksObj = hooks as Record<string, unknown>;

  for (const eventName of Object.keys(hooksObj)) {
    const eventArr = hooksObj[eventName];
    if (!Array.isArray(eventArr)) continue;

    const filteredEvent: unknown[] = [];

    for (const entry of eventArr) {
      if (mode === "flat") {
        const cmd = getEntryCommand(entry);
        if (cmd !== null && commandMatchesDeletedPath(cmd, deletedPaths)) {
          continue; // drop trellis entry
        }
        filteredEvent.push(entry);
      } else {
        // nested: entry is { matcher?, hooks: [...] }
        if (entry === null || typeof entry !== "object") {
          filteredEvent.push(entry);
          continue;
        }
        const matcherBlock = entry as Record<string, unknown>;
        const inner = matcherBlock.hooks;
        if (!Array.isArray(inner)) {
          filteredEvent.push(entry);
          continue;
        }

        const filteredInner = inner.filter((sub) => {
          const cmd = getEntryCommand(sub);
          return !(
            cmd !== null && commandMatchesDeletedPath(cmd, deletedPaths)
          );
        });

        if (filteredInner.length === 0) {
          // Whole matcher block is now empty → drop the block.
          continue;
        }

        // Reconstruct the block with the filtered inner list.
        const rebuilt: Record<string, unknown> = { ...matcherBlock };
        rebuilt.hooks = filteredInner;
        filteredEvent.push(rebuilt);
      }
    }

    if (filteredEvent.length === 0) {
      // Drop the whole event array.
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete hooksObj[eventName];
    } else {
      hooksObj[eventName] = filteredEvent;
    }
  }

  // If hooks is empty → drop the key.
  if (Object.keys(hooksObj).length === 0) {
    delete root.hooks;
  } else {
    root.hooks = hooksObj;
  }

  const fullyEmpty = Object.keys(root).length === 0;
  return {
    content: JSON.stringify(root, null, 2) + "\n",
    fullyEmpty,
  };
}
