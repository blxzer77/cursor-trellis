# TDD skill notes

Source: https://github.com/mattpocock/skills/tree/main/skills/engineering/tdd

## Relevant behavior

- Tests should verify behavior through public interfaces, not internal implementation details.
- Good tests are integration-style and read like specifications.
- Avoid horizontal slicing. Do not write all tests first and then all implementation.
- Use vertical tracer bullets: one test, minimal implementation, repeat.
- Refactor only after the test suite is green.
- Mock at system boundaries only: external APIs, time/randomness, file system, and selected database boundaries.
- Prefer dependency injection for external dependencies.
- Prefer small public interfaces with deeper implementations.

## Implication for Trellis workflow

The TDD workflow should not become a separate test-writing checklist bolted onto Phase 2. It should change the execution loop:

1. Pick one observable behavior.
2. Write one failing test through a public interface.
3. Implement the smallest code path that passes.
4. Repeat for the next behavior.
5. Refactor only after green.

The workflow should explicitly reject "write every test first" because that leads the agent to test imagined structure instead of behavior learned during implementation.

