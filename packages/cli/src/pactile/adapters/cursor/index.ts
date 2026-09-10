import {
  parseProjectionPlanV1,
  type ProjectionOperationV1,
  type ProjectionPlanV1,
} from "@blxzer/pactile-core";
import {
  fingerprintBytes,
  type ProjectionContent,
  type ProjectionInputs,
} from "../../projection/planner.js";

/**
 * Cursor leaves are optional. The shared `.agents/skills` projection is the
 * default integration surface; these names describe only a deliberately
 * selected Cursor-native overlay.
 */
export const CURSOR_PROJECTION_CAPABILITIES = [
  "commands",
  "rules",
  "agents",
  "hooks",
  "mcp",
] as const;
export type CursorProjectionCapability =
  (typeof CURSOR_PROJECTION_CAPABILITIES)[number];

export interface CursorNativeBindings {
  /** Existing/native hook registration identifiers. Bodies are never copied. */
  readonly hooks?: readonly string[];
  /** Existing/native provider or plugin registration identifiers. */
  readonly mcp?: readonly string[];
}

export interface CursorProjectionRequest {
  readonly shared: ProjectionInputs;
  /** Public host facts. Only selected capabilities are required to be true. */
  readonly hostCapabilities: Readonly<
    Partial<Record<CursorProjectionCapability, boolean>>
  >;
  /** Minimal native overlay selected by the composition compiler. */
  readonly composition?: readonly CursorProjectionCapability[];
  /** Compatibility spelling for callers that call the selection a leaf set. */
  readonly selectedCapabilities?: readonly CursorProjectionCapability[];
  /** Defaults to the action represented by the shared plan. */
  readonly action?: "attach" | "detach";
  /** Logical provider ids to bind through the host-native provider surface. */
  readonly providerIds?: readonly string[];
  readonly nativeBindings?: CursorNativeBindings;
  /** Explicit current-file observations; absent paths are observed via shared. */
  readonly surfaces?: readonly {
    readonly targetPath: string;
    readonly content: string | null;
  }[];
}

export type CursorProjectionResult =
  | {
      readonly status: "ready";
      readonly inputs: ProjectionInputs;
      readonly diagnostics: readonly [];
    }
  | {
      readonly status: "degraded";
      /** A degraded result still contains the safe shared-only transaction. */
      readonly inputs: ProjectionInputs;
      readonly diagnostics: readonly {
        readonly code: "native-binding-required";
        readonly capability: "hooks" | "mcp";
      }[];
    }
  | {
      readonly status: "unsupported" | "review";
      readonly diagnostics: readonly {
        readonly code: "unsupported-capability" | "invalid-input";
        readonly capability: CursorProjectionCapability | "adapter";
      }[];
    };

const encoder = new TextEncoder();
const logicalId = /^[a-z][a-z0-9]*(?:[._:-][a-z0-9]+)*$/;
const safeRelativePath = (value: string): boolean =>
  value.length > 0 &&
  value.length <= 256 &&
  !value.includes("\\") &&
  !value.startsWith("/") &&
  !value.split("/").includes("..") &&
  ![...value].some((character) => character.charCodeAt(0) < 32);

function diagnostic(
  status: "unsupported" | "review",
  code: "unsupported-capability" | "invalid-input",
  capability: CursorProjectionCapability | "adapter",
): CursorProjectionResult {
  return { status, diagnostics: [{ code, capability }] };
}

function inferAction(
  shared: ProjectionPlanV1,
): "attach" | "detach" | "mixed" {
  const actions = new Set(
    shared.operations.map((operation) =>
      operation.action === "remove" || operation.action === "detach"
        ? "detach"
        : "attach",
    ),
  );
  return actions.size === 1 ? ([...actions][0] as "attach" | "detach") : "mixed";
}

function selectedCapabilities(
  request: CursorProjectionRequest,
): CursorProjectionCapability[] | null {
  const selected = request.composition ?? request.selectedCapabilities ?? [];
  if (
    !Array.isArray(selected) ||
    selected.length > CURSOR_PROJECTION_CAPABILITIES.length
  )
    return null;
  const result = [...selected];
  if (
    new Set(result).size !== result.length ||
    result.some((value) => !CURSOR_PROJECTION_CAPABILITIES.includes(value))
  )
    return null;
  return result.sort();
}

function validateIds(values: readonly string[]): boolean {
  return (
    values.length <= 1024 &&
    new Set(values).size === values.length &&
    values.every((value) => logicalId.test(value))
  );
}

/**
 * Build one Cursor transaction from a shared projection plus the explicitly
 * selected native leaves. Hooks and MCP are host-native bindings: Pactile
 * does not invent commands, copy registration files, or merge foreign native
 * configuration. The ProjectionStore remains the only writer.
 */
export function buildCursorProjectionPlan(
  request: CursorProjectionRequest,
): CursorProjectionResult {
  try {
    const parsedShared = parseProjectionPlanV1(request.shared.plan);
    if (
      !parsedShared.success ||
      parsedShared.data.adapterId !== "adapter.cursor"
    )
      return diagnostic("review", "invalid-input", "adapter");

    const selected = selectedCapabilities(request);
    if (!selected) return diagnostic("review", "invalid-input", "adapter");
    const inferred = inferAction(parsedShared.data);
    if (inferred === "mixed")
      return diagnostic("review", "invalid-input", "adapter");
    if (request.action !== undefined && request.action !== inferred)
      return diagnostic("review", "invalid-input", "adapter");
    const action = request.action ?? inferred;
    if (action !== "attach" && action !== "detach")
      return diagnostic("review", "invalid-input", "adapter");

    for (const capability of selected) {
      if (request.hostCapabilities[capability] !== true)
        return diagnostic("unsupported", "unsupported-capability", capability);
    }

    const providerIds = [...(request.providerIds ?? [])];
    const nativeMcp = [...(request.nativeBindings?.mcp ?? [])];
    const nativeHooks = [...(request.nativeBindings?.hooks ?? [])];
    if (
      !validateIds(providerIds) ||
      !validateIds(nativeMcp) ||
      !validateIds(nativeHooks) ||
      (providerIds.length > 0 && !selected.includes("mcp"))
    )
      return diagnostic("review", "invalid-input", "adapter");

    const mcpBindings = providerIds.length > 0 ? providerIds : nativeMcp;
    const missingNative: ("hooks" | "mcp")[] = [];
    if (selected.includes("hooks") && nativeHooks.length === 0)
      missingNative.push("hooks");
    if (selected.includes("mcp") && mcpBindings.length === 0)
      missingNative.push("mcp");

    const surfaces = new Map<string, Uint8Array | null>();
    for (const surface of request.surfaces ?? []) {
      if (
        typeof surface.targetPath !== "string" ||
        !safeRelativePath(surface.targetPath) ||
        surfaces.has(surface.targetPath) ||
        (surface.content !== null &&
          (typeof surface.content !== "string" ||
            surface.content.length > 16 * 1024 * 1024))
      )
        return diagnostic("review", "invalid-input", "adapter");
      surfaces.set(
        surface.targetPath,
        surface.content === null ? null : encoder.encode(surface.content),
      );
    }

    const content = new Map<string, ProjectionContent>();
    const operations: ProjectionOperationV1[] = [
      ...parsedShared.data.operations,
    ];
    const observe = (targetPath: string): Uint8Array | null =>
      surfaces.has(targetPath)
        ? (surfaces.get(targetPath) ?? null)
        : request.shared.observe(targetPath);
    const addFile = (
      name: "command" | "rule" | "agent",
      targetPath: string,
      body: string,
    ): void => {
      const bytes = encoder.encode(body);
      const contentRef = `cursor.${name}.${fingerprintBytes(bytes).slice(7)}`;
      content.set(contentRef, { bytes });
      const current = observe(targetPath);
      operations.push({
        id: `cursor.${name}`,
        resourceId: `cursor.${name}`,
        claimantId: "adapter.cursor",
        action: action === "attach" ? "ensure" : "remove",
        control: "pactile-owned",
        targetPath,
        format: "text",
        contentRef: action === "attach" ? contentRef : null,
        desiredFingerprint: action === "attach" ? fingerprintBytes(bytes) : null,
        expectedCurrentFingerprint:
          current === null ? null : fingerprintBytes(current),
        externalAssetId: null,
      });
    };
    const tileIds = parsedShared.data.operations
      .map(
        ({ resourceId }) =>
          resourceId.match(/^shared\.skill\.([a-z0-9._:-]+)$/)?.[1],
      )
      .filter((value): value is string => value !== undefined)
      .sort();
    const compositionLabel =
      [...new Set(tileIds)].join(", ") || "selected shared skills";
    if (selected.includes("commands"))
      addFile(
        "command",
        ".cursor/commands/pactile.md",
        `# Pactile composition\n\nApply the selected shared Skills (${compositionLabel}) and honor their declared evidence, policy, and stop conditions. This file is a Cursor-native entry point; it does not install or invoke a provider.\n`,
      );
    if (selected.includes("rules"))
      addFile(
        "rule",
        ".cursor/rules/pactile.mdc",
        `---\ndescription: Pactile composition policy\nalwaysApply: true\n---\n\nThe active Pactile composition is ${compositionLabel}. Use only selected capabilities, preserve user-owned files, and stop on an unsupported or degraded requirement.\n`,
      );
    if (selected.includes("agents"))
      addFile(
        "agent",
        ".cursor/agents/pactile.md",
        `---\nname: pactile\ndescription: Execute the selected Pactile composition\n---\n\nCoordinate the selected Pactile composition (${compositionLabel}) through the host's native agent surface. Do not invent provider commands or copy credentials.\n`,
      );

    const addBinding = (
      kind: "hooks" | "mcp",
      externalAssetId: string,
    ): void => {
      operations.push({
        id: `cursor.${kind}.${externalAssetId}.${action}`,
        resourceId: `cursor.native.${kind}.${externalAssetId}`,
        claimantId: "adapter.cursor",
        action: action === "attach" ? "bind" : "detach",
        control: "borrowed",
        targetPath: null,
        format: "external-ref",
        contentRef: null,
        desiredFingerprint: null,
        expectedCurrentFingerprint: null,
        externalAssetId,
      });
    };
    if (missingNative.length === 0) {
      if (selected.includes("hooks"))
        for (const id of nativeHooks) addBinding("hooks", id);
      if (selected.includes("mcp"))
        for (const id of mcpBindings) addBinding("mcp", id);
    }

    const plan: ProjectionPlanV1 = {
      ...parsedShared.data,
      id: `cursor.${parsedShared.data.generationId}`,
      operations,
    };
    const inputs: ProjectionInputs = {
      ...request.shared,
      plan,
      observe,
      resolveContent: (contentRef) =>
        content.get(contentRef) ?? request.shared.resolveContent(contentRef),
    };
    if (missingNative.length > 0)
      return {
        status: "degraded",
        inputs,
        diagnostics: missingNative.map((capability) => ({
          code: "native-binding-required" as const,
          capability,
        })),
      };
    return { status: "ready", inputs, diagnostics: [] };
  } catch {
    return diagnostic("review", "invalid-input", "adapter");
  }
}
