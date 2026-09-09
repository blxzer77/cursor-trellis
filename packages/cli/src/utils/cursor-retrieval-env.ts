/**
 * Legacy import-path shim.
 *
 * Retrieval planning no longer reads user-global route state or process
 * environment to select an implementation. Host capability probing and
 * concrete Provider binding belong to Adapter/Middleware integration.
 */

export const ENV_UNKNOWN = "unknown" as const;
export type CursorRetrievalEnv = typeof ENV_UNKNOWN;

export interface CursorRetrievalEnvInfo {
  readonly env: CursorRetrievalEnv;
  readonly source: "neutral-compat";
  readonly detail: null;
}

export function detectCursorRetrievalEnvInfo(): CursorRetrievalEnvInfo {
  return {
    env: ENV_UNKNOWN,
    source: "neutral-compat",
    detail: null,
  };
}

export function detectCursorRetrievalEnv(): CursorRetrievalEnv {
  return ENV_UNKNOWN;
}
