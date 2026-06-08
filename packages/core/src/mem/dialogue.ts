/**
 * Dialogue cleaning: injection-tag stripping and bootstrap-turn detection.
 *
 * The cleaning pipeline is what makes plain `String.prototype.includes`
 * relevance ranking viable — without it, Trellis / platform injection tags
 * would dominate every search hit.
 */

const INJECTION_TAGS: readonly string[] = [
  "system-reminder",
  "task-status",
  "ready",
  "current-state",
  "workflow",
  "workflow-state",
  "guidelines",
  "instructions",
  "command-name",
  "command-message",
  "command-args",
  "local-command-stdout",
  "local-command-stderr",
  "permissions instructions",
  "collaboration_mode",
  "environment_context",
  "auto_compact_summary",
  "user_instructions",
];

/** True if this turn is a platform bootstrap injection (AGENTS.md preamble,
 * pure INSTRUCTIONS block, etc.) and should be dropped wholesale rather than
 * partially cleaned. Evaluated AFTER {@link stripInjectionTags}, against the
 * raw `originalLength` so the size threshold is computed on the input. */
export function isBootstrapTurn(
  cleaned: string,
  originalLength: number,
): boolean {
  if (cleaned.startsWith("# AGENTS.md instructions for")) return true;
  if (originalLength > 4000 && /^<INSTRUCTIONS>/i.test(cleaned)) return true;
  return false;
}

/** Case-insensitive removal of every `<tag>...</tag>` block in
 * `INJECTION_TAGS`, plus AGENTS.md preamble. Collapses runs of 3+ newlines to
 * a paragraph break and trims. */
export function stripInjectionTags(text: string): string {
  let out = text;
  for (const tag of INJECTION_TAGS) {
    const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(
      new RegExp(`<${escaped}[^>]*>[\\s\\S]*?</${escaped}>`, "gi"),
      "",
    );
  }
  out = out.replace(
    /^# AGENTS\.md instructions for[\s\S]*?(?=\n\n[A-Z一-龥]|$)/m,
    "",
  );
  return out.replace(/\n{3,}/g, "\n\n").trim();
}
