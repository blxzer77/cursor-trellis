export {
  reduceThreads,
  buildThreadAliasResolver,
  collectThreadTimeline,
} from "@blxzer/cursor-trellis-core/channel";

export type {
  ThreadState,
  ThreadAliasResolver,
} from "@blxzer/cursor-trellis-core/channel";

import type { ThreadState } from "@blxzer/cursor-trellis-core/channel";

export function formatThreadBoard(states: ThreadState[]): string[] {
  if (states.length === 0) return ["(no threads)"];
  return [
    "THREAD  STATUS  TITLE",
    ...states.map((state) => {
      const labels =
        state.labels.length > 0 ? ` labels=${state.labels.join(",")}` : "";
      const assignees =
        state.assignees.length > 0
          ? ` assignees=${state.assignees.join(",")}`
          : "";
      return `${state.thread} [${state.status}] ${state.title ?? ""}${labels}${assignees}`;
    }),
  ];
}
