// Root barrel — re-exports the channel, task, and Pactile contract APIs so callers
// can `import { ... } from "@blxzer/cursor-trellis-core"`. Sub-path
// imports (`@blxzer/cursor-trellis-core/channel`, `/task`) remain the
// recommended form for tree-shake-friendly consumption.

export * from "./channel/index.js";
export * from "./task/index.js";
export * from "./pactile/index.js";
