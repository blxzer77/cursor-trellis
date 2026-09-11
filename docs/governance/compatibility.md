# Compatibility and migration policy

English | [简体中文](compatibility.zh-CN.md)

The supported compatibility window is the 0.5.x line. New documentation,
commands, packages, bins, and generated state use Pactile names. A legacy input
may be read only when the migration path is explicit, reviewable, and writes
only canonical `.pactile/` state.

| Surface                          | 0.5.x rule                                                        | Exit condition                                           |
| -------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------- |
| Legacy project input             | Explicit read-only import; preserve the source.                   | A verified migration receipt and no remaining claimants. |
| Compatibility executable/package | Thin bridge with a canonical replacement warning.                 | Reassess no earlier than 0.6.0.                          |
| Managed markers or blocks        | Recognize only with ownership evidence; emit one canonical block. | All active projects use the canonical marker.            |
| Historical release/tag/manifest  | Immutable fact.                                                   | Never rewrite history as current guidance.               |

Do not promise undocumented host parity or Provider availability. The
[native-adoption model](../capabilities/native-adoption.md) and
[upgrade guide](../lifecycle/upgrade-and-migrate.md) define the user-visible
boundaries.
