/**
 * Stage 6 Cursor Adapter + Middleware (P27 Middleware, P29 Adapter/Profile,
 * P30 Stage 6).
 *
 * Pure helpers persisted through existing create extras / patch. Does not
 * write Kernel store or task.json. Field names here are an implementation
 * choice — not a frozen Manifest / Event ABI schema.
 */

import { KernelError } from "./kernel-contract.js";
import { isPlainObject } from "./schema.js";

export const STAGE6_SOURCE = "stage6-adapter-middleware";
export const STAGE6_SCHEMA_VERSION = 1 as const;

export const STAGE6_HOOK_EVENTS = [
  "sessionStart",
  "preToolUse",
  "beforeSubmitPrompt",
  "beforeShellExecution",
  "afterShellExecution",
  "stop",
] as const;

export type Stage6HookEvent = (typeof STAGE6_HOOK_EVENTS)[number];

export const RETRIEVAL_INTENTS = [
  "exact",
  "semantic",
  "structural",
  "external",
] as const;

export type RetrievalIntent = (typeof RETRIEVAL_INTENTS)[number];

export const DEFAULT_MIDDLEWARE_PROVIDERS = ["smart-search"] as const;
export const OPTIONAL_CODE_INTEL_PROVIDERS = [
  "codegraph",
  "fast-context",
] as const;

export const SMART_SEARCH_PROVIDER = "smart-search";
export const EXTERNAL_KNOWLEDGE_CAPABILITY = "external-knowledge";

export type Stage6CommandPhase = "create" | "start" | "archive" | "patch";

export type ProviderReadinessStatus =
  | "ready"
  | "missing"
  | "failed"
  | "unknown";

export interface EventSubscription {
  event: string;
  module: string;
}

export interface EventBridgeLastEvent {
  event: string;
  at: string;
  source: string;
  delivered: string[];
  skipped: string[];
}

export interface EventBridgeState {
  schema_version: typeof STAGE6_SCHEMA_VERSION;
  source: typeof STAGE6_SOURCE;
  subscriptions: EventSubscription[];
  last_event?: EventBridgeLastEvent;
}

export interface ProviderReadiness {
  status: ProviderReadinessStatus;
  capability: string;
  evidence?: string | null;
}

export interface MiddlewareProviders {
  schema_version: typeof STAGE6_SCHEMA_VERSION;
  source: typeof STAGE6_SOURCE;
  registered: string[];
  required: string[];
  active: string[];
  degraded: string[];
  readiness: Record<string, ProviderReadiness>;
}

export interface CapabilityRouter {
  schema_version: typeof STAGE6_SCHEMA_VERSION;
  source: typeof STAGE6_SOURCE;
  exact?: true;
  semantic?: true;
  structural?: true;
  external?: true;
}

export interface DispatchHookEventInput {
  event: string;
  source?: string;
  at?: string;
}

export function defaultEventBridge(): EventBridgeState {
  return {
    schema_version: STAGE6_SCHEMA_VERSION,
    source: STAGE6_SOURCE,
    subscriptions: [],
  };
}

export function defaultMiddlewareProviders(): MiddlewareProviders {
  return {
    schema_version: STAGE6_SCHEMA_VERSION,
    source: STAGE6_SOURCE,
    registered: [...DEFAULT_MIDDLEWARE_PROVIDERS],
    required: [...DEFAULT_MIDDLEWARE_PROVIDERS],
    active: [],
    degraded: [],
    readiness: {
      [SMART_SEARCH_PROVIDER]: {
        status: "unknown",
        capability: EXTERNAL_KNOWLEDGE_CAPABILITY,
        evidence: null,
      },
    },
  };
}

export function defaultCapabilityRouter(): CapabilityRouter {
  return {
    schema_version: STAGE6_SCHEMA_VERSION,
    source: STAGE6_SOURCE,
    exact: true,
    semantic: true,
    structural: true,
    external: true,
  };
}

export function subscribeEvent(
  extras: Record<string, unknown>,
  event: string,
  moduleName: string,
): EventBridgeState {
  const current = readEventBridge(extras);
  const eventName = requireId(event, "event_bridge.subscriptions[].event");
  const module = requireId(moduleName, "event_bridge.subscriptions[].module");
  const subscriptions = [...current.subscriptions];
  if (!subscriptions.some((item) => item.event === eventName && item.module === module)) {
    subscriptions.push({ event: eventName, module });
  }
  const next: EventBridgeState = { ...current, subscriptions };
  extras.event_bridge = next;
  return next;
}

/**
 * Record and dispatch one hook event. Unsubscribed modules are skipped and
 * never fail the hook.
 */
export function recordHookEvent(
  extras: Record<string, unknown>,
  input: DispatchHookEventInput,
): EventBridgeLastEvent {
  const current = readEventBridge(extras);
  const event = requireId(input.event, "event_bridge.last_event.event");
  const delivered: string[] = [];
  const skipped: string[] = [];
  for (const sub of current.subscriptions) {
    if (sub.event !== event) {
      skipped.push(sub.module);
      continue;
    }
    if (!delivered.includes(sub.module)) delivered.push(sub.module);
  }
  const lastEvent: EventBridgeLastEvent = {
    event,
    at: typeof input.at === "string" && input.at.trim() !== ""
      ? input.at
      : new Date().toISOString(),
    source:
      typeof input.source === "string" && input.source.trim() !== ""
        ? input.source
        : "cursor-hooks",
    delivered,
    skipped,
  };
  extras.event_bridge = { ...current, last_event: lastEvent };
  return lastEvent;
}

export function probeSmartSearchReadiness(input: {
  available?: boolean;
  status?: ProviderReadinessStatus;
  evidence?: string | null;
} = {}): ProviderReadiness {
  const status =
    input.status ??
    (input.available === true
      ? "ready"
      : input.available === false
        ? "missing"
        : "unknown");
  return {
    status,
    capability: EXTERNAL_KNOWLEDGE_CAPABILITY,
    evidence: input.evidence ?? null,
  };
}

export function applySmartSearchReadiness(
  extras: Record<string, unknown>,
  readiness: ProviderReadiness,
): MiddlewareProviders {
  const current = readMiddlewareProviders(extras);
  const next: MiddlewareProviders = {
    ...current,
    readiness: {
      ...current.readiness,
      [SMART_SEARCH_PROVIDER]: {
        ...readiness,
        capability: EXTERNAL_KNOWLEDGE_CAPABILITY,
      },
    },
  };
  extras.middleware_providers = applyProviderHealth(next, extras);
  return extras.middleware_providers as MiddlewareProviders;
}

export function normalizeEventBridge(raw: unknown): EventBridgeState {
  if (raw === undefined || raw === null) return defaultEventBridge();
  if (!isPlainObject(raw)) {
    throw new KernelError("INVALID_REQUEST", "event_bridge must be a JSON object");
  }
  const subscriptionsIn = raw.subscriptions;
  const subscriptions: EventSubscription[] = [];
  if (subscriptionsIn !== undefined && subscriptionsIn !== null) {
    if (!Array.isArray(subscriptionsIn)) {
      throw new KernelError(
        "INVALID_REQUEST",
        "event_bridge.subscriptions must be an array",
      );
    }
    for (const item of subscriptionsIn) {
      if (!isPlainObject(item)) {
        throw new KernelError(
          "INVALID_REQUEST",
          "event_bridge.subscriptions[] must be objects",
        );
      }
      const sub: EventSubscription = {
        event: requireId(item.event, "event_bridge.subscriptions[].event"),
        module: requireId(item.module, "event_bridge.subscriptions[].module"),
      };
      if (
        !subscriptions.some(
          (existing) =>
            existing.event === sub.event && existing.module === sub.module,
        )
      ) {
        subscriptions.push(sub);
      }
    }
  }
  const lastRaw = raw.last_event;
  let lastEvent: EventBridgeLastEvent | undefined;
  if (lastRaw !== undefined && lastRaw !== null) {
    if (!isPlainObject(lastRaw)) {
      throw new KernelError(
        "INVALID_REQUEST",
        "event_bridge.last_event must be an object",
      );
    }
    lastEvent = {
      event: requireId(lastRaw.event, "event_bridge.last_event.event"),
      at:
        typeof lastRaw.at === "string" && lastRaw.at.trim() !== ""
          ? lastRaw.at
          : new Date().toISOString(),
      source:
        typeof lastRaw.source === "string" && lastRaw.source.trim() !== ""
          ? lastRaw.source
          : "cursor-hooks",
      delivered: uniqueStrings(asStringArray(lastRaw.delivered)),
      skipped: uniqueStrings(asStringArray(lastRaw.skipped)),
    };
  }
  return {
    schema_version: STAGE6_SCHEMA_VERSION,
    source: STAGE6_SOURCE,
    subscriptions,
    ...(lastEvent ? { last_event: lastEvent } : {}),
  };
}

export function normalizeMiddlewareProviders(raw: unknown): MiddlewareProviders {
  if (raw === undefined || raw === null) return defaultMiddlewareProviders();
  if (!isPlainObject(raw)) {
    throw new KernelError(
      "INVALID_REQUEST",
      "middleware_providers must be a JSON object",
    );
  }
  const defaults = defaultMiddlewareProviders();
  const registered = uniqueStrings([
    ...defaults.registered,
    ...asStringArray(raw.registered),
  ]);
  const required = uniqueStrings(asStringArray(raw.required)).filter((name) =>
    registered.includes(name),
  );
  const active = uniqueStrings(asStringArray(raw.active)).filter((name) =>
    registered.includes(name),
  );
  const degraded = uniqueStrings(asStringArray(raw.degraded));
  const readiness: Record<string, ProviderReadiness> = {
    ...defaults.readiness,
  };
  if (isPlainObject(raw.readiness)) {
    for (const [name, value] of Object.entries(raw.readiness)) {
      if (!isPlainObject(value)) continue;
      const status = parseReadinessStatus(value.status);
      readiness[name] = {
        status,
        capability:
          typeof value.capability === "string" && value.capability.trim() !== ""
            ? value.capability
            : name === SMART_SEARCH_PROVIDER
              ? EXTERNAL_KNOWLEDGE_CAPABILITY
              : "unknown",
        evidence:
          typeof value.evidence === "string" ? value.evidence : null,
      };
    }
  }
  return {
    schema_version: STAGE6_SCHEMA_VERSION,
    source: STAGE6_SOURCE,
    registered,
    required: required.length > 0 ? required : [...defaults.required],
    active,
    degraded,
    readiness,
  };
}

export function normalizeCapabilityRouter(raw: unknown): CapabilityRouter {
  if (raw === undefined || raw === null) return defaultCapabilityRouter();
  if (!isPlainObject(raw)) {
    throw new KernelError(
      "INVALID_REQUEST",
      "capability_router must be a JSON object",
    );
  }
  const forbidden = [
    ...OPTIONAL_CODE_INTEL_PROVIDERS,
    "fast_context_search",
    "codegraph_explore",
    "codegraph_search",
    "codegraph_callers",
  ];
  for (const key of Object.keys(raw)) {
    if (forbidden.includes(key)) {
      throw new KernelError(
        "INVALID_REQUEST",
        "capability_router must not bind Optional tool names",
      );
    }
  }
  const next: CapabilityRouter = {
    schema_version: STAGE6_SCHEMA_VERSION,
    source: STAGE6_SOURCE,
  };
  for (const intent of RETRIEVAL_INTENTS) {
    if (raw[intent] !== false) {
      next[intent] = true;
    }
  }
  return next;
}

export function readEventBridge(extras: Record<string, unknown>): EventBridgeState {
  return normalizeEventBridge(extras.event_bridge);
}

export function readMiddlewareProviders(
  extras: Record<string, unknown>,
): MiddlewareProviders {
  return normalizeMiddlewareProviders(extras.middleware_providers);
}

export function readCapabilityRouter(
  extras: Record<string, unknown>,
): CapabilityRouter {
  return normalizeCapabilityRouter(extras.capability_router);
}

export function requiredCapabilities(extras: Record<string, unknown>): string[] {
  return uniqueStrings(asStringArray(extras.required_capabilities));
}

export function externalKnowledgeReady(providers: MiddlewareProviders): boolean {
  const readiness = providers.readiness[SMART_SEARCH_PROVIDER];
  return readiness?.status === "ready";
}

export function normalizeStage6InExtras(extras: Record<string, unknown>): void {
  extras.event_bridge = normalizeEventBridge(extras.event_bridge);
  extras.capability_router = normalizeCapabilityRouter(extras.capability_router);
  const incoming = extras.hook_event;
  if (isPlainObject(incoming) && typeof incoming.event === "string") {
    recordHookEvent(extras, {
      event: incoming.event,
      source: typeof incoming.source === "string" ? incoming.source : undefined,
      at: typeof incoming.at === "string" ? incoming.at : undefined,
    });
    delete extras.hook_event;
  }
  extras.middleware_providers = normalizeMiddlewareProviders(
    extras.middleware_providers,
  );
  if (isPlainObject(extras.smart_search_probe)) {
    const probeStatus = extras.smart_search_probe.status;
    applySmartSearchReadiness(
      extras,
      probeSmartSearchReadiness({
        available:
          extras.smart_search_probe.available === true
            ? true
            : extras.smart_search_probe.available === false
              ? false
              : undefined,
        status:
          probeStatus === "ready" ||
          probeStatus === "missing" ||
          probeStatus === "failed" ||
          probeStatus === "unknown"
            ? probeStatus
            : undefined,
        evidence:
          typeof extras.smart_search_probe.evidence === "string"
            ? extras.smart_search_probe.evidence
            : null,
      }),
    );
    delete extras.smart_search_probe;
  } else {
    extras.middleware_providers = applyProviderHealth(
      extras.middleware_providers as MiddlewareProviders,
      extras,
    );
  }
}

export function assertStage6ForPhase(
  extras: Record<string, unknown>,
  phase: Stage6CommandPhase,
): void {
  if (phase === "create" || phase === "patch") return;
  const providers = readMiddlewareProviders(extras);
  const needsExternal = requiredCapabilities(extras).includes(
    EXTERNAL_KNOWLEDGE_CAPABILITY,
  );
  if (!needsExternal) return;
  if (externalKnowledgeReady(providers)) return;
  if (extras.external_knowledge_policy === "degrade") {
    extras.profile_health = "degraded";
    return;
  }
  throw new KernelError(
    "INVALID_TRANSITION",
    "external-knowledge required but smart-search Provider is not ready",
  );
}

export function normalizeStage6InExtrasAndAssert(
  extras: Record<string, unknown>,
  phase: Stage6CommandPhase,
): void {
  normalizeStage6InExtras(extras);
  assertStage6ForPhase(extras, phase);
}

function applyProviderHealth(
  providers: MiddlewareProviders,
  extras: Record<string, unknown>,
): MiddlewareProviders {
  const degraded = uniqueStrings([...providers.degraded]);
  const smart = providers.readiness[SMART_SEARCH_PROVIDER];
  if (smart && smart.status !== "ready" && smart.status !== "unknown") {
    if (!degraded.includes(SMART_SEARCH_PROVIDER)) {
      degraded.push(SMART_SEARCH_PROVIDER);
    }
    extras.profile_health = "degraded";
  }
  const missing = uniqueStrings(asStringArray(extras.ondemand_required_missing));
  if (
    missing.includes(EXTERNAL_KNOWLEDGE_CAPABILITY) ||
    missing.includes(SMART_SEARCH_PROVIDER)
  ) {
    if (!degraded.includes(SMART_SEARCH_PROVIDER)) {
      degraded.push(SMART_SEARCH_PROVIDER);
    }
    extras.profile_health = "degraded";
  }
  return { ...providers, degraded };
}

function parseReadinessStatus(value: unknown): ProviderReadinessStatus {
  if (
    value === "ready" ||
    value === "missing" ||
    value === "failed" ||
    value === "unknown"
  ) {
    return value;
  }
  return "unknown";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function uniqueStrings(values: readonly unknown[]): string[] {
  const out: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const id = value.trim();
    if (!id || out.includes(id)) continue;
    out.push(id);
  }
  return out;
}

function requireId(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new KernelError("INVALID_REQUEST", `${field} must be a non-empty string`);
  }
  return value.trim();
}
