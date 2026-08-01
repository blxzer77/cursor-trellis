// Root barrel — re-exports the channel, task, and rpc public APIs so callers
// can `import { ... } from "@blxzer/cursor-trellis-core"`. Sub-path
// imports (`@blxzer/cursor-trellis-core/channel`, `/task`, `/rpc`) remain the
// recommended form for tree-shake-friendly consumption.

export * from "./channel/index.js";
export * from "./task/index.js";
export * from "./rpc/index.js";
