export type AdapterConformanceHost = "cursor" | "codex";

export type AdapterConformanceMode =
  | "native"
  | "provider"
  | "heuristic"
  | "degraded"
  | "unsupported";

export type AdapterConformanceCapability =
  | "skills-agents"
  | "hooks"
  | "mcp"
  | "rules"
  | "assurance"
  | "projection-recovery";

export interface AdapterConformanceCase {
  readonly id: string;
  readonly kind: "host" | "capability" | "ownership" | "fault";
  readonly hosts: readonly AdapterConformanceHost[];
  readonly installOrder: readonly AdapterConformanceHost[];
  readonly capability: AdapterConformanceCapability;
  readonly preexistingState:
    | "none"
    | "foreign"
    | "modified"
    | "borrowed"
    | "shared";
  readonly fault:
    | "none"
    | "host-degraded"
    | "provider-degraded"
    | "provider-unavailable"
    | "unsupported-capability"
    | "projection-busy";
  readonly expectedMode: AdapterConformanceMode;
  readonly expectedEvidence: string;
  readonly expectedOwnership:
    | "pactile-owned"
    | "borrowed"
    | "preserved"
    | "shared";
  readonly userAction: string;
  readonly nonCore?: boolean;
  readonly repeatUpdate?: boolean;
}

export const ADAPTER_CONFORMANCE_CASES = [
  {
    id: "host.cursor-only",
    kind: "host",
    hosts: ["cursor"],
    installOrder: ["cursor"],
    capability: "skills-agents",
    preexistingState: "foreign",
    fault: "none",
    expectedMode: "native",
    expectedEvidence: "ownership-ledger+projection-receipt",
    expectedOwnership: "pactile-owned",
    userAction: "none",
  },
  {
    id: "host.codex-only",
    kind: "host",
    hosts: ["codex"],
    installOrder: ["codex"],
    capability: "skills-agents",
    preexistingState: "foreign",
    fault: "none",
    expectedMode: "native",
    expectedEvidence: "ownership-ledger+projection-receipt",
    expectedOwnership: "pactile-owned",
    userAction: "none",
  },
  {
    id: "host.cursor-then-codex",
    kind: "host",
    hosts: ["cursor", "codex"],
    installOrder: ["cursor", "codex"],
    capability: "skills-agents",
    preexistingState: "foreign",
    fault: "none",
    expectedMode: "native",
    expectedEvidence: "ownership-ledger+projection-receipt",
    expectedOwnership: "shared",
    userAction: "none",
  },
  {
    id: "host.codex-then-cursor",
    kind: "host",
    hosts: ["cursor", "codex"],
    installOrder: ["codex", "cursor"],
    capability: "skills-agents",
    preexistingState: "foreign",
    fault: "none",
    expectedMode: "native",
    expectedEvidence: "ownership-ledger+projection-receipt",
    expectedOwnership: "shared",
    userAction: "none",
  },
  {
    id: "host.repeat-bind-update",
    kind: "host",
    hosts: ["cursor", "codex"],
    installOrder: ["cursor", "codex"],
    capability: "skills-agents",
    preexistingState: "foreign",
    fault: "none",
    expectedMode: "native",
    expectedEvidence: "stable-ledger+stable-host-tree",
    expectedOwnership: "shared",
    userAction: "none",
    repeatUpdate: true,
  },
  {
    id: "capability.cursor-hooks-native",
    kind: "capability",
    hosts: ["cursor"],
    installOrder: ["cursor"],
    capability: "hooks",
    preexistingState: "none",
    fault: "none",
    expectedMode: "native",
    expectedEvidence: "external-claim:cursor.native.hooks.fixture-hook",
    expectedOwnership: "borrowed",
    userAction: "none",
  },
  {
    id: "capability.cursor-mcp-provider",
    kind: "capability",
    hosts: ["cursor"],
    installOrder: ["cursor"],
    capability: "mcp",
    preexistingState: "borrowed",
    fault: "none",
    expectedMode: "provider",
    expectedEvidence: "external-claim:cursor.native.mcp.provider-fixture",
    expectedOwnership: "borrowed",
    userAction: "none",
  },
  {
    id: "capability.codex-hooks-native",
    kind: "capability",
    hosts: ["codex"],
    installOrder: ["codex"],
    capability: "hooks",
    preexistingState: "none",
    fault: "none",
    expectedMode: "native",
    expectedEvidence: "external-claim:codex.native.hooks.fixture-hook",
    expectedOwnership: "borrowed",
    userAction: "none",
  },
  {
    id: "capability.codex-mcp-provider",
    kind: "capability",
    hosts: ["codex"],
    installOrder: ["codex"],
    capability: "mcp",
    preexistingState: "borrowed",
    fault: "none",
    expectedMode: "provider",
    expectedEvidence: "external-claim:codex.native.mcp.provider-fixture",
    expectedOwnership: "borrowed",
    userAction: "none",
  },
  {
    id: "capability.codex-app-degraded",
    kind: "capability",
    hosts: ["codex"],
    installOrder: ["codex"],
    capability: "assurance",
    preexistingState: "none",
    fault: "host-degraded",
    expectedMode: "degraded",
    expectedEvidence: "probe-hint:host-degraded",
    expectedOwnership: "pactile-owned",
    userAction: "restore-or-authenticate-chatgpt-desktop-app",
  },
  {
    id: "capability.cursor-rules-unsupported",
    kind: "capability",
    hosts: ["cursor"],
    installOrder: ["cursor"],
    capability: "rules",
    preexistingState: "none",
    fault: "unsupported-capability",
    expectedMode: "unsupported",
    expectedEvidence: "diagnostic:unsupported-capability:rules",
    expectedOwnership: "preserved",
    userAction: "enable-a-supported-cursor-rules-surface",
    nonCore: true,
  },
  {
    id: "capability.provider-heuristic",
    kind: "capability",
    hosts: ["cursor"],
    installOrder: ["cursor"],
    capability: "assurance",
    preexistingState: "none",
    fault: "none",
    expectedMode: "heuristic",
    expectedEvidence: "evidence://probe/cursor-semantic/passed",
    expectedOwnership: "borrowed",
    userAction: "none",
  },
  {
    id: "capability.provider-degraded",
    kind: "capability",
    hosts: ["cursor"],
    installOrder: ["cursor"],
    capability: "assurance",
    preexistingState: "none",
    fault: "provider-degraded",
    expectedMode: "degraded",
    expectedEvidence: "evidence://probe/cursor-semantic/passed",
    expectedOwnership: "borrowed",
    userAction: "install-or-enable-provider",
  },
  {
    id: "capability.provider-unavailable",
    kind: "capability",
    hosts: ["codex"],
    installOrder: ["codex"],
    capability: "assurance",
    preexistingState: "none",
    fault: "provider-unavailable",
    expectedMode: "unsupported",
    expectedEvidence: "evidence://probe/codex-explorer/failed",
    expectedOwnership: "preserved",
    userAction: "install-or-enable-provider",
    nonCore: true,
  },
  {
    id: "capability.assurance-evidence-backed",
    kind: "capability",
    hosts: ["cursor", "codex"],
    installOrder: ["cursor", "codex"],
    capability: "assurance",
    preexistingState: "none",
    fault: "none",
    expectedMode: "provider",
    expectedEvidence: "evidence://probe/smart-search/passed",
    expectedOwnership: "borrowed",
    userAction: "none",
  },
  {
    id: "ownership.foreign-skill",
    kind: "ownership",
    hosts: ["cursor"],
    installOrder: ["cursor"],
    capability: "skills-agents",
    preexistingState: "foreign",
    fault: "none",
    expectedMode: "degraded",
    expectedEvidence: "adapter-result:whole-file-not-owned",
    expectedOwnership: "preserved",
    userAction: "review-the-foreign-skill-before-adoption",
  },
  {
    id: "ownership.modified-skill",
    kind: "ownership",
    hosts: ["cursor"],
    installOrder: ["cursor"],
    capability: "skills-agents",
    preexistingState: "modified",
    fault: "none",
    expectedMode: "degraded",
    expectedEvidence: "adapter-result:whole-file-not-owned",
    expectedOwnership: "preserved",
    userAction: "review-the-user-modification-before-reconcile",
  },
  {
    id: "ownership.borrowed-skill",
    kind: "ownership",
    hosts: ["codex"],
    installOrder: ["codex"],
    capability: "skills-agents",
    preexistingState: "borrowed",
    fault: "none",
    expectedMode: "provider",
    expectedEvidence: "external-claim:shared.skill.user-intake",
    expectedOwnership: "borrowed",
    userAction: "none",
  },
  {
    id: "ownership.shared-detach",
    kind: "ownership",
    hosts: ["cursor", "codex"],
    installOrder: ["cursor", "codex"],
    capability: "skills-agents",
    preexistingState: "shared",
    fault: "none",
    expectedMode: "native",
    expectedEvidence: "ledger-claimant:adapter.codex",
    expectedOwnership: "shared",
    userAction: "none",
  },
  {
    id: "fault.codex-projection-busy",
    kind: "fault",
    hosts: ["cursor", "codex"],
    installOrder: ["cursor", "codex"],
    capability: "projection-recovery",
    preexistingState: "none",
    fault: "projection-busy",
    expectedMode: "degraded",
    expectedEvidence: "adapter-result:adapter.codex:retryable",
    expectedOwnership: "pactile-owned",
    userAction: "retry-the-failed-adapter",
  },
] as const satisfies readonly AdapterConformanceCase[];

export const HOST_CONFORMANCE_CASES = ADAPTER_CONFORMANCE_CASES.filter(
  (testCase) => testCase.kind === "host",
);

export const CAPABILITY_CONFORMANCE_CASES = ADAPTER_CONFORMANCE_CASES.filter(
  (testCase) => testCase.kind === "capability",
);

export const OWNERSHIP_CONFORMANCE_CASES = ADAPTER_CONFORMANCE_CASES.filter(
  (testCase) => testCase.kind === "ownership",
);

export const FAULT_CONFORMANCE_CASES = ADAPTER_CONFORMANCE_CASES.filter(
  (testCase) => testCase.kind === "fault",
);
