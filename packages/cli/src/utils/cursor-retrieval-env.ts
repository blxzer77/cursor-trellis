/**
 * Detect Cursor Native vs Cursor++ BYOK for retrieval routing.
 * Mirrors templates/trellis/scripts/common/cursor_retrieval_env.py
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const ENV_NATIVE = "native" as const;
export const ENV_BYOK = "byok" as const;
export const ENV_UNKNOWN = "unknown" as const;

export type CursorRetrievalEnv =
  | typeof ENV_NATIVE
  | typeof ENV_BYOK
  | typeof ENV_UNKNOWN;

export interface CursorRetrievalEnvInfo {
  env: CursorRetrievalEnv;
  source: string;
  byokMode?: number | null;
  routes_path?: string;
  redirect_endpoints?: string[];
  error?: string;
}

export function ccursorHome(): string {
  const env = process.env.TRELLIS_CCURSOR_HOME?.trim();
  if (env) {
    return path.resolve(env.replace(/^~/, os.homedir()));
  }
  return path.join(os.homedir(), ".ccursor");
}

export function detectCursorRetrievalEnvInfo(): CursorRetrievalEnvInfo {
  const envOverride = process.env.TRELLIS_CURSOR_BYOK?.trim();
  if (envOverride === "1") {
    return { env: ENV_BYOK, source: "env-override", byokMode: 1 };
  }
  if (envOverride === "0") {
    return { env: ENV_NATIVE, source: "env-override", byokMode: 0 };
  }

  const routesPath = path.join(ccursorHome(), "routes.json");
  if (!fs.existsSync(routesPath)) {
    return {
      env: ENV_UNKNOWN,
      source: "routes-not-found",
      byokMode: null,
      routes_path: routesPath,
    };
  }
  try {
    const raw = fs.readFileSync(routesPath, "utf8");
    const routes = JSON.parse(raw) as {
      byokMode?: number;
      redirect?: unknown;
    };
    const byok = routes.byokMode;
    const env: CursorRetrievalEnv =
      byok === 1 ? ENV_BYOK : byok === 0 ? ENV_NATIVE : ENV_UNKNOWN;
    const redirect = routes.redirect;
    return {
      env,
      source: "routes.json",
      byokMode: byok ?? null,
      routes_path: routesPath,
      redirect_endpoints: Array.isArray(redirect)
        ? redirect.map(String)
        : [],
    };
  } catch (err) {
    return {
      env: ENV_UNKNOWN,
      source: "routes-parse-error",
      byokMode: null,
      routes_path: routesPath,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function detectCursorRetrievalEnv(): CursorRetrievalEnv {
  const info = detectCursorRetrievalEnvInfo();
  if (
    info.env === ENV_NATIVE ||
    info.env === ENV_BYOK ||
    info.env === ENV_UNKNOWN
  ) {
    return info.env;
  }
  return ENV_UNKNOWN;
}

export function isByok(env?: CursorRetrievalEnv | null): boolean {
  return (env ?? detectCursorRetrievalEnv()) === ENV_BYOK;
}

/** Conservative semantic routing: BYOK plus unknown (no routes.json / ambiguous byokMode). */
export function isByokConservative(env?: CursorRetrievalEnv | null): boolean {
  const resolved = env ?? detectCursorRetrievalEnv();
  return resolved === ENV_BYOK || resolved === ENV_UNKNOWN;
}

export interface SemanticRouteSpec {
  commands: string[];
  rationaleSuffix: string;
  platformNative: boolean;
  semanticBackend: "fast-context-mcp" | "cursor-builtin";
}

export function semanticRouteSpec(
  cursorEnv: CursorRetrievalEnv,
): SemanticRouteSpec {
  if (isByokConservative(cursorEnv)) {
    const unknownCaveat =
      cursorEnv === ENV_UNKNOWN
        ? " Unknown cursorEnv: conservative fast-context primary (same as BYOK)."
        : "";
    return {
      commands: ["fast_context_search (fast-context MCP)"],
      rationaleSuffix:
        " Cursor++ BYOK: built-in semantic unavailable; fast-context MCP primary." +
        unknownCaveat,
      platformNative: false,
      semanticBackend: "fast-context-mcp",
    };
  }
  return {
    commands: ["cursor @codebase or built-in semantic search"],
    rationaleSuffix: " Cursor built-in semantic search.",
    platformNative: true,
    semanticBackend: "cursor-builtin",
  };
}