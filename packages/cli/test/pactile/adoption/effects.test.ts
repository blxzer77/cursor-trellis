import { describe, expect, it, vi } from "vitest";
import { discoverSnapshot } from "../../../src/pactile/adoption/inventory.js";
import {
  createInstallHint,
  planBinding,
} from "../../../src/pactile/adoption/bindings.js";

const effects = vi.hoisted(() => ({ process: vi.fn(), network: vi.fn() }));
vi.mock("node:child_process", () => ({
  spawn: effects.process,
  spawnSync: effects.process,
  exec: effects.process,
  execSync: effects.process,
  execFile: effects.process,
  execFileSync: effects.process,
  fork: effects.process,
}));
vi.mock("node:http", () => ({
  request: effects.network,
  get: effects.network,
}));
vi.mock("node:https", () => ({
  request: effects.network,
  get: effects.network,
}));
vi.mock("node:net", () => ({
  connect: effects.network,
  createConnection: effects.network,
}));
vi.mock("node:tls", () => ({ connect: effects.network }));
vi.mock("node:dns", () => ({
  lookup: effects.network,
  resolve: effects.network,
}));
vi.mock("undici", () => ({
  fetch: effects.network,
  request: effects.network,
  Client: effects.network,
}));

describe("discovery and proposal side-effect boundary", () => {
  it("does not execute config commands, authenticate, fetch, or install any kind", () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(effects.network);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    try {
      const canary = "CANARY_AUTH_BODY_COMMAND";
      const context = {
        hostId: "editor-one",
        rootId: "explicit-snapshot",
        source: "user-installed",
        scope: "host",
        owner: { kind: "user", id: null },
      };
      for (const kind of ["skill", "mcp", "plugin", "executable", "service"]) {
        const inventory = discoverSnapshot({
          context,
          assets: [
            {
              id: "search",
              kind,
              locatorToken: "server",
              present: false,
              enabled: true,
              requiresAuthentication: true,
              env: { TOKEN: canary },
              headers: { Authorization: canary },
              oauth: { state: canary },
              command: canary,
              args: [canary],
              body: canary,
            },
          ],
        });
        expect(inventory.assets).toHaveLength(1);
        const proposal = planBinding({
          asset: inventory.assets[0],
          capabilityId: "repo.search",
          intents: ["external"],
        });
        expect(proposal.binding).toBeNull();
        expect(proposal.diagnostics).toEqual([]);
        expect(proposal.installHint).toEqual(inventory.assets[0].installHint);
        expect(proposal.installHint?.requiresAuthentication).toBe(true);
        expect(
          JSON.stringify([
            inventory,
            proposal,
            createInstallHint({
              kind,
              mechanism: "manual",
              requiresAuthentication: true,
              command: canary,
            }),
          ]),
        ).not.toContain(canary);
      }
      expect(effects.process).not.toHaveBeenCalled();
      expect(effects.network).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
      expect(log).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
      log.mockRestore();
      warn.mockRestore();
      error.mockRestore();
    }
  });
});
