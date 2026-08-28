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
  KernelReadResult,
  KernelTransitionResult,
  KernelCommandResult,
  KernelCreateRequest,
  KernelStartRequest,
  KernelRecordGateRequest,
  KernelArchiveRequest,
} from "./kernel-store.js";

export {
  readKernel,
  applyKernelTransition,
  applyKernelCreate,
  applyKernelStart,
  applyKernelRecordGate,
  applyKernelArchive,
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
