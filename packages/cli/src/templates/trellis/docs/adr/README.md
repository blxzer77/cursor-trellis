# ADR — Architecture Decision Records

`docs/adr/` records architecture decisions. **Lazy-created**: the directory and `0001-*.md` files appear only when a real decision needs recording — do not pre-create them.

## When to write an ADR (all three conditions)

Write an ADR only when **all three** hold:

1. **Hard to reverse** — the decision is difficult or expensive to undo.
2. **Would surprise without context** — a future reader would ask "why is it this way?" without background.
3. **Real tradeoff** — there was a genuine choice between viable alternatives.

A single paragraph is enough. Number sequentially: `0001-<slug>.md`, `0002-<slug>.md`, …

## Three-layer boundary

| Layer | Owns |
| --- | --- |
| Knowledge base (rejections) | Rejection reasons / why-not |
| `docs/adr/` | Decision records / why-chosen |
| `.cstl/spec/` | Coding guidelines / conventions |
