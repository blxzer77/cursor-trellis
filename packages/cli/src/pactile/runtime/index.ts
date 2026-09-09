/** Runtime foundation only; lifecycle/host adapters must opt in explicitly. */
export {
  RuntimeError,
  nodeRuntimeFileSystem,
  resolveCanonicalPaths,
  discoverRuntimeRoots,
  assertCanonicalWriteTarget,
  normalizeRuntimeRelativePath,
  caseFoldComponent,
} from "./paths.js";
export type {
  RuntimeErrorCode,
  RuntimeFileSystem,
  RuntimeDiscovery,
} from "./paths.js";
export { GenerationStore, InstallStateStore } from "./stores.js";
export type {
  GenerationFile,
  GenerationSeal,
  InstallStateSnapshot,
  RuntimeRecovery,
} from "./stores.js";
export { handleRuntimePathRequest } from "./json-api.js";
export type { RuntimePathResult } from "./json-api.js";
