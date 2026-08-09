# Fowler 12 Smells — Quick Criterion Reference

Scan the change surface line by line: report when a smell is hit, write `N/A` when not. Each criterion is a one-line "is" definition; the **don't-report** boundaries guard against false positives (paired with the ~35% false-positive discipline in `.cstl/spec/guides/index.md`).

1. **Mysterious Name** — a name fails to express the code's intent (what it does / why it exists); the reader must read the implementation to understand it.
   Don't report: evaluate only within the changed lines; do not opportunistically flag historical naming outside the change surface.
2. **Duplicated Code** — the same structure/expression is repeated in 2+ places, so a change must be synced across several sites.
   Don't report: small test boilerplate (e.g. a one-line setup) where extraction would reduce readability.
3. **Feature Envy** — a method uses another object's data/methods far more than its own.
   Don't report: an orchestration point that coordinates multiple collaborators is the method's job, not envy.
4. **Data Clumps** — the same group of fields/parameters keep appearing together and should be bundled into an object.
   Don't report: don't force types that only bundle without adding behavior (lazy creation discipline).
5. **Primitive Obsession** — primitives (string/number/bool) carry concepts that deserve their own type (IDs, amounts, states).
   Don't report: when the value domain is already constrained by an existing validation/config layer and adds no new behavior.
6. **Repeated Switches** — the same discriminating field (kind/type/status) drives switch/if-else chains repeated in multiple places.
   Don't report: 1–2 occurrences where that is the language idiom (e.g. ADT pattern matching).
7. **Shotgun Surgery** — one conceptual change requires synchronized edits scattered across many places.
   Don't report: when the multiple edits are concentrated in one cohesive module (locality holds).
8. **Divergent Change** — one module changes frequently for many different reasons.
   Don't report: when the module is an intentional facade/aggregator.
9. **Speculative Generality** — abstractions/parameters/hooks are built for imagined future needs with no current caller.
   Don't report: abstractions actually used in this change.
10. **Message Chains** — a long call chain `a.b().c().d()` is needed to reach a target value, with intermediate links being pure pass-through.
    Don't report: when the fluent/builder chain is itself the public interface.
11. **Middle Man** — a class/method mostly forwards to somewhere else and adds little value of its own.
    Don't report: when the forwarding provides encapsulation/seam value (e.g. an adapter sitting at a seam).
12. **Refused Bequest** — a subclass barely uses inherited parent behavior/fields, making the inheritance relationship nominal.
    Don't report: when inheritance is used only for type identity/interface satisfaction (is-a semantics) or the unused members are minimal.
