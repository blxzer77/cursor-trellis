import { describe, expect, it } from "vitest";

import {
  matchesEventFilter,
  parseChannelKind,
  parseChannelKinds,
  type ChannelEvent,
} from "../../src/channel/index.js";

function makeEvent<K extends ChannelEvent["kind"]>(
  kind: K,
  overrides: Partial<ChannelEvent> = {},
): ChannelEvent {
  return {
    seq: 1,
    ts: "2026-05-15T00:00:00.000Z",
    kind,
    by: "worker",
    ...overrides,
  } as ChannelEvent;
}

describe("parseChannelKind / parseChannelKinds", () => {
  it("parseChannelKind rejects CSV input (single-value only)", () => {
    expect(() => parseChannelKind("done,killed")).toThrow(/Invalid --kind/);
  });

  it("parseChannelKind accepts the new supervisor_warning kind", () => {
    expect(parseChannelKind("supervisor_warning")).toBe("supervisor_warning");
  });

  it("parseChannelKinds returns undefined for undefined input", () => {
    expect(parseChannelKinds(undefined)).toBeUndefined();
  });

  it("parseChannelKinds returns undefined for whitespace-only / empty input", () => {
    expect(parseChannelKinds("")).toBeUndefined();
    expect(parseChannelKinds("   ,  , ")).toBeUndefined();
  });

  it("parseChannelKinds splits CSV and validates each member", () => {
    expect(parseChannelKinds("done,killed")).toEqual(["done", "killed"]);
  });

  it("parseChannelKinds deduplicates while preserving order", () => {
    expect(parseChannelKinds("done, killed ,done")).toEqual(["done", "killed"]);
  });

  it("parseChannelKinds reuses the single-value error path on an invalid member", () => {
    expect(() => parseChannelKinds("done,nope")).toThrow(/Invalid --kind 'nope'/);
  });
});

describe("matchesEventFilter with kind union", () => {
  it("supervisor_warning is not meaningful by default — plain wait does not wake", () => {
    const ev = makeEvent("supervisor_warning", { worker: "w" });
    expect(matchesEventFilter(ev, {})).toBe(false);
  });

  it("supervisor_warning matches when explicitly requested via single kind", () => {
    const ev = makeEvent("supervisor_warning", { worker: "w" });
    expect(matchesEventFilter(ev, { kind: "supervisor_warning" })).toBe(true);
  });

  it("supervisor_warning matches when explicitly listed in a kind array", () => {
    const ev = makeEvent("supervisor_warning", { worker: "w" });
    expect(
      matchesEventFilter(ev, { kind: ["done", "supervisor_warning"] }),
    ).toBe(true);
  });

  it("supervisor_warning is also matched by includeNonMeaningful with no kind filter", () => {
    const ev = makeEvent("supervisor_warning", { worker: "w" });
    expect(matchesEventFilter(ev, { includeNonMeaningful: true })).toBe(true);
  });

  it("OR semantics: done matches kind list [done, killed]", () => {
    const ev = makeEvent("done");
    expect(matchesEventFilter(ev, { kind: ["done", "killed"] })).toBe(true);
  });

  it("OR semantics: killed matches kind list [done, killed]", () => {
    const ev = makeEvent("killed");
    expect(matchesEventFilter(ev, { kind: ["done", "killed"] })).toBe(true);
  });

  it("OR semantics: error does not match kind list [done, killed]", () => {
    const ev = makeEvent("error", { message: "oops" });
    expect(matchesEventFilter(ev, { kind: ["done", "killed"] })).toBe(false);
  });

  it("empty kind list does not falsely match (and re-applies meaningful gate)", () => {
    const warn = makeEvent("supervisor_warning", { worker: "w" });
    expect(matchesEventFilter(warn, { kind: [] })).toBe(false);
    const done = makeEvent("done");
    // empty kind list = no kind constraint; meaningful gate still admits done
    expect(matchesEventFilter(done, { kind: [] })).toBe(true);
  });

  it("single-value kind continues to work unchanged", () => {
    expect(matchesEventFilter(makeEvent("done"), { kind: "done" })).toBe(true);
    expect(matchesEventFilter(makeEvent("killed"), { kind: "done" })).toBe(
      false,
    );
  });
});
