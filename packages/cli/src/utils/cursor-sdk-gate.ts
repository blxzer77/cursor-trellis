/**
 * Cursor SDK capability gate (productization): env probe + user-facing guidance.
 * Never echoes the key value. Never writes secrets to the repo.
 */

export function hasCursorApiKey(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(env.CURSOR_API_KEY?.trim());
}

/** Multi-line guide for missing CURSOR_API_KEY (init/update / sdk status). */
export function cursorApiKeySetupGuide(): string {
  return [
    "Cursor SDK live capability requires CURSOR_API_KEY in the current process environment.",
    "Set it for your shell/session (user-level env or secret store) — never commit the key to the repo.",
    "PowerShell example: $env:CURSOR_API_KEY = '<your-key>'",
    "Then re-run init/update capability selection, or: cstl sdk status",
    "Reminder: SDK live billing/privacy is a separate channel from Cursor IDE Native API vs Cursor++ BYOK model routing.",
    "Until a key is set, cstl sdk run --mock still works; --live will refuse.",
  ].join("\n");
}

export function formatCursorSdkSkippedMessage(): string {
  return [
    "Skipped enabling capability `cursor-sdk` (CURSOR_API_KEY not set).",
    cursorApiKeySetupGuide(),
  ].join("\n");
}

export function formatCursorSdkEnabledMessage(): string {
  return [
    "Enabled capability `cursor-sdk` (CURSOR_API_KEY is present in this process).",
    "Use `cstl sdk status` to re-check, and `cstl sdk run --task <path> --live` only after you accept billing/privacy risk.",
    "Native vs BYOK IDE routing does not replace CURSOR_API_KEY for SDK live runs.",
  ].join("\n");
}
