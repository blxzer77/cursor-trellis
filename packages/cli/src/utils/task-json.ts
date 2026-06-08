/**
 * Canonical task.json shape — single source of truth shared by all TS
 * writers. The canonical types and factory now live in the
 * `@mindfoldhq/trellis-core` task API; this module re-exports them under
 * the legacy `TaskJson` / `emptyTaskJson` names for CLI call sites.
 *
 * New code should prefer `TrellisTaskRecord` / `emptyTaskRecord` from
 * `@mindfoldhq/trellis-core/task` directly.
 */

import {
  emptyTaskRecord,
  type TrellisTaskRecord,
} from "@mindfoldhq/trellis-core/task";

export type TaskJson = TrellisTaskRecord;

export const emptyTaskJson = emptyTaskRecord;
