/**
 * Read-only Kernel surface for humans and agents.
 *
 * Dashboard and other projections should use {@link projectKernelSurface}
 * (`phase` / `condition` / `outcome` + human title). `task.json.status`
 * stays a compatibility machine field — this module never deletes it.
 */

import {
  deriveStateForPhase,
  isKernelCondition,
  isKernelOutcome,
  isKernelPhase,
  kernelPhaseToLegacyStatus,
  projectLegacyStatus,
  type KernelCondition,
  type KernelOutcome,
  type KernelPhase,
  type KernelState,
} from "./kernel-contract.js";

export type KernelSurfaceLocale = "en" | "zh";

export const KERNEL_PHASE_HUMAN_EN: Readonly<Record<KernelPhase, string>> = {
  open: "Open",
  define: "Define",
  approve: "Approve",
  execute: "Execute",
  verify: "Verify",
  integrate: "Integrate",
  close: "Close",
};

export const KERNEL_PHASE_HUMAN_ZH: Readonly<Record<KernelPhase, string>> = {
  open: "打开",
  define: "定义",
  approve: "批准",
  execute: "执行",
  verify: "验证",
  integrate: "集成",
  close: "关闭",
};

export interface KernelSurfaceInput {
  phase?: unknown;
  condition?: unknown;
  outcome?: unknown;
  /** Legacy `task.json.status`; kept on the projection, never stripped. */
  status?: string | null;
  /** Topology kind (`single` | `parent-child`). Integrate is optional. */
  topologyKind?: string | null;
  locale?: KernelSurfaceLocale;
}

export interface KernelSurfaceProjection extends KernelState {
  /** Compatibility machine field mirrored from `task.json.status`. */
  status: string;
  /** Dashboard / agent section title (Open/Define/… or zh). */
  humanPhase: string;
  /** True when Integrate is a real lifecycle slot for this task. */
  showIntegrate: boolean;
}

export function kernelPhaseHumanTitle(
  phase: KernelPhase,
  locale: KernelSurfaceLocale = "en",
): string {
  return locale === "zh"
    ? KERNEL_PHASE_HUMAN_ZH[phase]
    : KERNEL_PHASE_HUMAN_EN[phase];
}

export function topologyNeedsIntegrate(
  topologyKind: string | null | undefined,
): boolean {
  return topologyKind === "parent-child";
}

/**
 * Stable read-only 3D Kernel projection plus human phase title.
 *
 * Prefers an explicit Kernel `phase` when valid; otherwise maps the
 * legacy status enum. Does not mutate disk.
 */
export function projectKernelSurface(
  input: KernelSurfaceInput = {},
): KernelSurfaceProjection {
  const locale = input.locale ?? "en";
  const state = resolveSurfaceState(input);
  const status =
    typeof input.status === "string" && input.status.trim() !== ""
      ? input.status
      : kernelPhaseToLegacyStatus(state.phase);
  return {
    ...state,
    status,
    humanPhase: kernelPhaseHumanTitle(state.phase, locale),
    showIntegrate:
      state.phase === "integrate" ||
      topologyNeedsIntegrate(input.topologyKind),
  };
}

function resolveSurfaceState(input: KernelSurfaceInput): KernelState {
  if (isKernelPhase(input.phase)) {
    const derived = deriveStateForPhase(input.phase);
    const condition: KernelCondition = isKernelCondition(input.condition)
      ? input.condition
      : derived.condition;
    const outcome: KernelOutcome | null = resolveOutcome(
      input.outcome,
      derived.outcome,
    );
    return { phase: input.phase, condition, outcome };
  }
  return projectLegacyStatus(
    typeof input.status === "string" ? input.status : "",
  );
}

function resolveOutcome(
  value: unknown,
  fallback: KernelOutcome | null,
): KernelOutcome | null {
  if (value === undefined) return fallback;
  if (value === null || isKernelOutcome(value)) return value;
  return fallback;
}
