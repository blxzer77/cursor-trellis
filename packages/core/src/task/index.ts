// Public task API surface — canonical task record shape, factory,
// schema, I/O helpers, directory validation, and phase inference.
//
// Task API is intentionally independent from the channel API.

export type {
  TrellisTaskRecord,
  TaskRecordField,
} from "./schema.js";

export {
  TASK_RECORD_FIELD_ORDER,
  emptyTaskRecord,
  taskRecordSchema,
} from "./schema.js";

export type {
  LoadTaskRecordOptions,
  WriteTaskRecordOptions,
} from "./records.js";

export {
  loadTaskRecord,
  writeTaskRecord,
} from "./records.js";

export type { TaskDirParts } from "./paths.js";
export { validateTaskDirName, isValidTaskDirName } from "./paths.js";

export type { TrellisTaskPhase } from "./phase.js";
export { inferTaskPhase } from "./phase.js";

export type {
  KernelPhase,
  KernelCondition,
  KernelOutcome,
  KernelErrorCode,
  KernelState,
  KernelIdentity,
  KernelAuditEvent,
  KernelSnapshot,
  KernelGates,
  KernelLegacyProjection,
  KernelCommandOp,
  TransitionRequest,
  LegacyTaskProjection,
} from "./kernel-contract.js";

export {
  KERNEL_SCHEMA_VERSION,
  KERNEL_JSON_BASENAME,
  KERNEL_PHASES,
  KERNEL_CONDITIONS,
  KERNEL_OUTCOMES,
  KERNEL_PHASE_EDGES,
  KERNEL_COMMAND_OPS,
  KernelError,
  isKernelPhase,
  isLegalPhaseEdge,
  deriveStateForPhase,
  projectLegacyStatus,
  kernelPhaseToLegacyStatus,
  hopsToExecute,
  hopsToClose,
} from "./kernel-contract.js";

export type {
  LitePackErrorCode,
  LitePackArtifact,
  LitePackItem,
  LitePackOmission,
  LiteContextPackRequest,
  LiteContextPack,
} from "./lite-context-pack.js";

export {
  LITE_PACK_VERSION,
  LITE_PACK_SOURCE,
  LITE_BASELINE_MODULES,
  LITE_BLOCKED_ON_DEMAND_MODULES,
  LITE_RETRIEVAL_INTENTS,
  LITE_DEFAULT_MAX_ITEMS,
  LITE_DEFAULT_MAX_ESTIMATED_TOKENS,
  LiteContextPackError,
  isBlockedOnDemandModule,
  estimateLiteTokens,
  buildLiteContextPack,
} from "./lite-context-pack.js";

export type {
  FullQualityRigor,
  FullQualityPhase,
  FullQualityControlId,
  IndependentCheckMode,
  IndependentCheckResult,
  ResolveRequiredControlsInput,
  RequiredControlsBundle,
  AcceptanceItem,
  AcEvidenceMapping,
  AcEvidenceLedger,
  IndependentCheckVerdict,
  EvaluateIndependentCheckInput,
} from "./full-quality.js";

export {
  FULL_QUALITY_SOURCE,
  FULL_QUALITY_SCHEMA_VERSION,
  FULL_BASELINE_CONTROLS,
  FULL_OPTIONAL_CONTROLS,
  DEFAULT_CONTROL_SURFACES,
  DESIGN_RISK_SIGNALS,
  qualityFingerprint,
  resolveRequiredControls,
  parseAcceptanceItems,
  buildAcEvidenceLedger,
  evaluateIndependentCheck,
  readRequiredControls,
  normalizeRequiredControls,
  normalizeRequiredControlsInExtras,
  assertFullQualityForPhase,
  assertIndependentCheckGateRecord,
} from "./full-quality.js";

export type {
  KernelReadResult,
  KernelTransitionResult,
  KernelCommandResult,
  KernelCreateRequest,
  KernelStartRequest,
  KernelRecordGateRequest,
  KernelArchiveRequest,
  KernelPatchRequest,
} from "./kernel-store.js";

export {
  readKernel,
  applyKernelTransition,
  applyKernelCreate,
  applyKernelStart,
  applyKernelRecordGate,
  applyKernelArchive,
  applyKernelPatch,
  resolveTaskDir,
  kernelJsonPath,
  setKernelAfterWriteHook,
} from "./kernel-store.js";

export type {
  KernelCliSuccess,
  KernelCliFailure,
  KernelCliResponse,
  KernelCliIo,
} from "./kernel-cli.js";

export { handleKernelRequest, runKernelJsonCli } from "./kernel-cli.js";
