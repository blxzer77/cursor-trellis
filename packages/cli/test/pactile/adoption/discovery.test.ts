import {
  mkdtemp,
  mkdir,
  writeFile,
  rm,
  symlink,
  readFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { discoverSkillEntries } from "../../../src/pactile/adoption/discovery.js";
import { planBinding } from "../../../src/pactile/adoption/bindings.js";

const observed = vi.hoisted(() => ({
  lstat: vi.fn(),
  readFile: vi.fn(),
  readdir: vi.fn(),
  realpath: vi.fn(),
  readlink: vi.fn(),
  writeFile: vi.fn(),
  rm: vi.fn(),
}));
vi.mock("node:fs/promises", async (original) => {
  const actual = await original<typeof import("node:fs/promises")>();
  return {
    ...actual,
    ...Object.fromEntries(
      Object.entries(observed).map(([name, spy]) => [
        name,
        (...args: unknown[]) => {
          spy(...args);
          return (
            actual[name as keyof typeof actual] as (
              ...values: unknown[]
            ) => unknown
          )(...args);
        },
      ]),
    ),
  };
});

let fixture: string;
const context = {
  hostId: "editor-one",
  rootId: "repo-skills",
  source: "project-vendored",
  scope: "project",
  owner: { kind: "user", id: null },
};
const metadata = {
  id: "review",
  enabled: true,
  present: true,
  body: "CANARY_PRIVATE_SKILL_BODY",
};
function request(relativePath = "skills/review") {
  return {
    roots: [{ path: fixture, context }],
    entries: [{ rootId: context.rootId, relativePath, metadata }],
  };
}
beforeEach(async () => {
  fixture = await mkdtemp(path.join(tmpdir(), "pactile-adoption-"));
  await mkdir(path.join(fixture, "skills/review"), { recursive: true });
  await writeFile(
    path.join(fixture, "skills/review/SKILL.md"),
    "---\nname: review\n---\nCANARY_PRIVATE_SKILL_BODY",
  );
  for (const spy of Object.values(observed)) spy.mockClear();
});
afterEach(async () => {
  await rm(fixture, { recursive: true, force: true });
});

describe("explicit filesystem entry discovery", () => {
  it("checks declared paths without opening Skill contents or recursively scanning", async () => {
    const result = await discoverSkillEntries(request());
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0]).toMatchObject({
      id: "review",
      kind: "skill",
      readiness: "ready",
    });
    expect(result.diagnostics).toEqual([]);
    expect(observed.lstat).toHaveBeenCalled();
    for (const name of [
      "readFile",
      "readdir",
      "realpath",
      "readlink",
      "writeFile",
      "rm",
    ] as const)
      expect(observed[name]).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain(fixture);
    expect(JSON.stringify(result)).not.toContain("CANARY_PRIVATE_SKILL_BODY");
  });

  it("release simulation only drops the in-memory borrowed binding; external checksum is unchanged", async () => {
    const file = path.join(fixture, "skills/review/SKILL.md");
    const before = createHash("sha256")
      .update(await readFile(file))
      .digest("hex");
    for (const spy of Object.values(observed)) spy.mockClear();
    const inventory = await discoverSkillEntries(request());
    const result = planBinding({
      asset: inventory.assets[0],
      capabilityId: "repo.review",
      intents: ["semantic"],
    });
    expect(result.binding).toMatchObject({
      control: "borrowed",
      deleteBoundary: "preserve",
    });
    const bindings = [result.binding].filter(
      (binding) => binding?.id !== result.binding?.id,
    );
    expect(bindings).toEqual([]);
    expect(observed.writeFile).not.toHaveBeenCalled();
    expect(observed.rm).not.toHaveBeenCalled();
    expect(observed.readFile).not.toHaveBeenCalled();
    expect(
      createHash("sha256")
        .update(await readFile(file))
        .digest("hex"),
    ).toBe(before);
  });

  it("does not follow a real outside symlink or stat/read its target", async () => {
    const outside = await mkdtemp(path.join(tmpdir(), "pactile-outside-"));
    try {
      await writeFile(path.join(outside, "SKILL.md"), "CANARY_OUTSIDE_BODY");
      await symlink(
        outside,
        path.join(fixture, "linked"),
        process.platform === "win32" ? "junction" : "dir",
      );
      for (const spy of Object.values(observed)) spy.mockClear();
      const input = request("linked");
      const result = await discoverSkillEntries({
        ...input,
        entries: [{ ...input.entries[0], linkTarget: outside }],
      });
      expect(result.assets).toEqual([]);
      expect(result.diagnostics).toEqual([
        { code: "outside-allowlist", path: "entries" },
      ]);
      expect(
        observed.lstat.mock.calls.some(([name]) =>
          String(name).startsWith(outside),
        ),
      ).toBe(false);
      for (const name of [
        "readFile",
        "readdir",
        "realpath",
        "readlink",
      ] as const)
        expect(observed[name]).not.toHaveBeenCalled();
      expect(JSON.stringify(result)).not.toContain(outside);
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  it.each([undefined, "inside"])(
    "keeps real %s target links opaque and unknown without following",
    async (declaration) => {
      await symlink(
        path.join(fixture, "skills/review"),
        path.join(fixture, "linked"),
        process.platform === "win32" ? "junction" : "dir",
      );
      for (const spy of Object.values(observed)) spy.mockClear();
      const input = request("linked");
      const result = await discoverSkillEntries({
        ...input,
        entries: [
          {
            ...input.entries[0],
            ...(declaration
              ? { linkTarget: path.join(fixture, "skills/review") }
              : {}),
          },
        ],
      });
      expect(result.assets).toHaveLength(1);
      expect(result.assets[0]).toMatchObject({
        readiness: "unknown",
        fingerprint: null,
      });
      expect(result.diagnostics).toEqual([
        { code: "link-not-followed", path: "entries" },
      ]);
      expect(
        observed.lstat.mock.calls.some(([name]) =>
          String(name).includes(`${path.sep}skills${path.sep}review`),
        ),
      ).toBe(false);
      expect(observed.readlink).not.toHaveBeenCalled();
      expect(observed.realpath).not.toHaveBeenCalled();
      expect(observed.readFile).not.toHaveBeenCalled();
    },
  );

  it("stops at a symlink ancestor before inspecting any descendant", async () => {
    await symlink(
      path.join(fixture, "skills"),
      path.join(fixture, "linked"),
      process.platform === "win32" ? "junction" : "dir",
    );
    for (const spy of Object.values(observed)) spy.mockClear();
    const result = await discoverSkillEntries(
      request("linked/review/SKILL.md"),
    );
    expect(result.assets[0].readiness).toBe("unknown");
    expect(
      observed.lstat.mock.calls.some(([name]) =>
        String(name).includes(`${path.sep}linked${path.sep}`),
      ),
    ).toBe(false);
  });

  it("retains same-name Skills at multiple repo layers and is independent of root/entry ordering", async () => {
    const nested = path.join(fixture, "packages/module");
    await mkdir(path.join(nested, "skills/review"), { recursive: true });
    const input = {
      roots: [
        ...request().roots,
        { path: nested, context: { ...context, rootId: "module-skills" } },
      ],
      entries: [
        ...request().entries,
        { ...request().entries[0], rootId: "module-skills" },
      ],
    };
    const result = await discoverSkillEntries(input);
    expect(result.assets).toHaveLength(2);
    expect(new Set(result.assets.map((asset) => asset.locator)).size).toBe(2);
    expect(result.diagnostics).toEqual([
      { code: "ambiguous-id", path: "assets" },
    ]);
    expect(
      await discoverSkillEntries({
        roots: [...input.roots].reverse(),
        entries: [...input.entries].reverse(),
      }),
    ).toEqual(result);
    expect(
      await discoverSkillEntries({
        ...input,
        entries: [...input.entries, ...input.entries],
      }),
    ).toEqual(result);
  });

  it("normalizes separators without incorporating absolute root paths into identity or fingerprints", async () => {
    const forward = await discoverSkillEntries(request("skills/review"));
    const backward = await discoverSkillEntries(request("skills\\review"));
    expect(backward.assets[0].locator).toBe(forward.assets[0].locator);
    expect(backward.assets[0].fingerprint).toBe(forward.assets[0].fingerprint);
    const relocated = path.join(fixture, "relocated");
    await mkdir(path.join(relocated, "skills/review"), { recursive: true });
    const moved = await discoverSkillEntries({
      ...request(),
      roots: [{ path: relocated, context }],
    });
    expect(moved.assets[0].locator).toBe(forward.assets[0].locator);
    expect(moved.assets[0].fingerprint).toBe(forward.assets[0].fingerprint);
  });

  it.each([
    "../CANARY_OUTSIDE",
    "/CANARY_OUTSIDE",
    "C:\\CANARY_OUTSIDE",
    "skills/../outside",
    "skills//review",
    "skills/review.",
    "x".repeat(1100),
  ])(
    "rejects invalid entry #%# before any filesystem call",
    async (relativePath) => {
      const result = await discoverSkillEntries(request(relativePath));
      expect(result.assets).toEqual([]);
      expect(result.diagnostics).toEqual([
        { code: "outside-allowlist", path: "entries" },
      ]);
      expect(observed.lstat).not.toHaveBeenCalled();
    },
  );

  it("does not use ambient roots; unknown root ids and conflicting grants fail closed", async () => {
    expect(
      (await discoverSkillEntries({ entries: request().entries })).assets,
    ).toEqual([]);
    expect(
      (await discoverSkillEntries({ roots: [], entries: request().entries }))
        .diagnostics,
    ).toEqual([{ code: "outside-allowlist", path: "entries" }]);
    expect(
      (
        await discoverSkillEntries({
          roots: [
            request().roots[0],
            { path: path.join(fixture, "skills"), context },
          ],
          entries: request().entries,
        })
      ).diagnostics,
    ).toEqual([{ code: "invalid-context", path: "roots" }]);
    expect(observed.lstat).not.toHaveBeenCalled();
  });

  it("missing entry yields a symbolic hint, while I/O exception text is never returned", async () => {
    const missing = await discoverSkillEntries(request("skills/missing"));
    expect(missing.assets[0]).toMatchObject({
      readiness: "missing",
      installHint: { mechanism: "manual", label: "install.skill" },
    });
    observed.lstat.mockImplementationOnce(() => {
      throw new Error("CANARY_FILESYSTEM_ERROR");
    });
    const result = await discoverSkillEntries(request());
    expect(result).toEqual({
      assets: [],
      diagnostics: [{ code: "unavailable", path: "entries" }],
    });
  });

  it("discards caller Skill body getters before computing the metadata fingerprint", async () => {
    const base = await discoverSkillEntries(request());
    const body = vi.fn(() => {
      throw new Error("CANARY_BODY_READ");
    });
    const tainted = { id: "review", enabled: true };
    Object.defineProperty(tainted, "body", { get: body });
    const input = request();
    const result = await discoverSkillEntries({
      ...input,
      entries: [{ ...input.entries[0], metadata: tainted }],
    });
    expect(result.assets[0].fingerprint).toBe(base.assets[0].fingerprint);
    expect(body).not.toHaveBeenCalled();
  });
});
