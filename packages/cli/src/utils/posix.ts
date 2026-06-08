/**
 * POSIX path normalization utility
 *
 * Single source of truth for converting OS-native path separators to POSIX `/`.
 * Use ONLY for logical path strings used as cross-platform persistence keys
 * (e.g. hash dictionary keys, JSON-stored paths). Do NOT use for paths passed
 * to filesystem APIs — those must remain OS-native via `path.join`.
 */

/**
 * Convert any path string's `\` separators to POSIX `/`.
 */
export function toPosix(p: string): string {
  return p.replace(/\\/g, "/");
}
