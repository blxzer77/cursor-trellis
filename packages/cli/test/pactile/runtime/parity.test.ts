import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { handleRuntimePathRequest } from "../../../src/pactile/runtime/json-api.js";
import { caseFoldComponent } from "../../../src/pactile/runtime/paths.js";
import { normalizeNfc15 } from "../../../src/pactile/runtime/unicode-nfc.js";
import {
  GenerationStore,
  InstallStateStore,
} from "../../../src/pactile/runtime/stores.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const roots: string[] = [];
function fixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pactile-parity-"));
  roots.push(root);
  return root;
}
afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});
function python(requests: unknown[]): unknown {
  const command = process.platform === "win32" ? "py" : "python3";
  const args = process.platform === "win32" ? ["-3.12"] : [];
  return JSON.parse(
    execFileSync(command, [...args, path.join(here, "parity_runner.py")], {
      input: JSON.stringify(requests),
      encoding: "utf8",
      windowsHide: true,
    }),
  );
}
function treeFingerprint(root: string): string {
  const inventory: [string, string][] = [];
  const visit = (directory: string): void => {
    for (const name of fs.readdirSync(directory).sort()) {
      const file = path.join(directory, name);
      if (fs.lstatSync(file).isDirectory()) visit(file);
      else
        inventory.push([
          path.relative(root, file),
          fs.readFileSync(file).toString("hex"),
        ]);
    }
  };
  visit(root);
  return createHash("sha256").update(JSON.stringify(inventory)).digest("hex");
}

describe("TS/Python Runtime JSON ABI parity", () => {
  it("pins all 1112064 Unicode scalars against independent Unicode 15 and the shipped Python mirror", () => {
    const command = process.platform === "win32" ? "py" : "python3";
    const args = process.platform === "win32" ? ["-3.12"] : [];
    const run = (file: string): { sha256: string; scalars: number } =>
      JSON.parse(
        execFileSync(
          command,
          [...args, path.join(here, file), "--scalar-digest"],
          { encoding: "utf8", windowsHide: true },
        ),
      );
    const oracle = run("unicode_reference.py");
    const digest = createHash("sha256");
    for (let code = 0; code <= 0x10ffff; code++) {
      if (code >= 0xd800 && code <= 0xdfff) continue;
      const character = String.fromCodePoint(code);
      digest.update(
        `${normalizeNfc15(character)}\0${caseFoldComponent(character)}\0`,
      );
    }
    expect(oracle.scalars).toBe(1112064);
    expect(digest.digest("hex")).toBe(oracle.sha256);
    expect(run("parity_runner.py")).toEqual({
      sha256: oracle.sha256,
      scalars: oracle.scalars,
    });
  }, 60_000);

  it("matches canonical composition/decomposition sequences including newer ICU additions, exclusions, blocking and Hangul", () => {
    const inputs = new Set([
      "\u{105d2}\u0307",
      "\u0301\u0327",
      "A\u030a\u0301",
      "A\u0301\u030a",
      "a\u0315\u0300",
      "\u0915\u093c",
      "\u1100\u1161\u11a8",
      "\uac00\u11a8",
    ]);
    for (let code = 0; code <= 0x10ffff; code++) {
      if (code >= 0xd800 && code <= 0xdfff) continue;
      const character = String.fromCodePoint(code);
      // The HOST supplies sequences including post-15 additions as negative cases;
      // expected output always comes from the independent pinned Unicode 15 oracle.
      const nfd = character.normalize("NFD");
      if (nfd !== character) {
        inputs.add(nfd);
        inputs.add(`${nfd}\u0315\u0300`);
      }
    }
    const values = [...inputs];
    expect(values.length).toBeGreaterThan(24000);
    const command = process.platform === "win32" ? "py" : "python3";
    const args = process.platform === "win32" ? ["-3.12"] : [];
    const oracle = JSON.parse(
      execFileSync(
        command,
        [...args, path.join(here, "unicode_reference.py")],
        {
          input: JSON.stringify(values),
          encoding: "utf8",
          windowsHide: true,
          maxBuffer: 16 * 1024 * 1024,
        },
      ),
    ) as { normalized: string; folded: string }[];
    for (let index = 0; index < values.length; index++) {
      expect(normalizeNfc15(values[index]), `NFC sequence ${index}`).toBe(
        oracle[index].normalized,
      );
      expect(caseFoldComponent(values[index]), `fold sequence ${index}`).toBe(
        oracle[index].folded,
      );
    }
    const requests = values.map((component) => ({
      operation: "fold",
      component,
    }));
    const mirror = JSON.parse(
      execFileSync(command, [...args, path.join(here, "parity_runner.py")], {
        input: JSON.stringify(requests),
        encoding: "utf8",
        windowsHide: true,
        maxBuffer: 16 * 1024 * 1024,
      }),
    );
    expect(mirror).toEqual(
      oracle.map((entry) => ({ ok: true, result: entry.folded })),
    );
  }, 60_000);

  it("agrees with the independent Python Unicode implementation for every changed scalar", () => {
    const command = process.platform === "win32" ? "py" : "python3";
    const args = process.platform === "win32" ? ["-3.12"] : [];
    const values = JSON.parse(
      execFileSync(
        command,
        [
          ...args,
          "-c",
          "import json,unicodedata; print(json.dumps([[i,unicodedata.normalize('NFC',chr(i)).casefold()] for i in range(0x110000) if not 0xD800<=i<=0xDFFF and unicodedata.normalize('NFC',chr(i)).casefold()!=chr(i)],ensure_ascii=True))",
        ],
        { encoding: "utf8", windowsHide: true, maxBuffer: 1024 * 1024 },
      ),
    ) as [number, string][];
    expect(values.length).toBeGreaterThan(2000);
    for (const [code, expected] of values)
      expect(
        caseFoldComponent(String.fromCodePoint(code)),
        `U+${code.toString(16)}`,
      ).toBe(expected);
  });

  it("matches independent expected results over the shared malformed/normalization corpus", () => {
    const corpus = JSON.parse(
      fs.readFileSync(path.join(here, "path-golden.json"), "utf8"),
    ) as { input: unknown; expected: unknown }[];
    const requests = corpus.map((item) => item.input);
    const expected = corpus.map((item) => item.expected);
    expect(
      requests.map((request) => handleRuntimePathRequest(request)),
    ).toEqual(expected);
    expect(python(requests)).toEqual(expected);
  });

  it.each(
    [
      [],
      [".cstl"],
      [".trellis"],
      [".cstl", ".trellis"],
      [".pactile", ".cstl", ".trellis"],
    ].map((names) => ({ names })),
  )(
    "discovers $names deterministically with byte-identical legacy trees",
    ({ names }) => {
      const root = fixture();
      for (const name of names) {
        fs.mkdirSync(path.join(root, name, "nested"), { recursive: true });
        fs.writeFileSync(
          path.join(root, name, "nested/state.json"),
          '{"foreign":"preserve Unicode 文 and CRLF"}\r\n',
        );
      }
      const before = treeFingerprint(root);
      const requests = [
        { operation: "resolve", projectRoot: root },
        { operation: "discover", projectRoot: root },
        {
          operation: "guard",
          projectRoot: root,
          target: ".pactile/runtime/install-state.json",
        },
        { operation: "guard", projectRoot: root, target: ".cstl/forbidden" },
        { operation: "guard", projectRoot: root, target: ".trellis/forbidden" },
      ];
      const outputs = requests.map((request) =>
        handleRuntimePathRequest(request),
      );
      expect(python(requests)).toEqual(outputs);
      expect(outputs[1]).toEqual({
        ok: true,
        result: {
          canonical: {
            root: ".pactile",
            present: names.includes(".pactile"),
            access: "canonical-only",
          },
          legacy: [
            {
              kind: "cstl",
              root: ".cstl",
              present: names.includes(".cstl"),
              access: "read-only",
            },
            {
              kind: "trellis",
              root: ".trellis",
              present: names.includes(".trellis"),
              access: "read-only",
            },
          ],
          diagnostics: [],
        },
      });
      expect(outputs[3]).toEqual({
        ok: false,
        error: { code: "legacy-write-denied" },
      });
      expect(outputs[4]).toEqual({
        ok: false,
        error: { code: "legacy-write-denied" },
      });
      expect(treeFingerprint(root)).toBe(before);
    },
  );

  it("reports equal reason codes for casing, Unicode and real junction escapes", () => {
    const casing = fixture();
    fs.mkdirSync(path.join(casing, ".PACTILE"));
    const unicode = fixture();
    fs.mkdirSync(path.join(unicode, ".pactile"));
    fs.writeFileSync(path.join(unicode, ".pactile/cafe\u0301"), "NFD");
    const links = fixture();
    const external = fixture();
    fs.symlinkSync(
      external,
      path.join(links, ".pactile"),
      process.platform === "win32" ? "junction" : "dir",
    );
    const requests = [
      { operation: "guard", projectRoot: casing, target: ".pactile/file" },
      { operation: "guard", projectRoot: unicode, target: ".pactile/café" },
      { operation: "guard", projectRoot: links, target: ".pactile/file" },
      { operation: "discover", projectRoot: links },
      { operation: "discover", projectRoot: casing },
    ];
    expect(python(requests)).toEqual(
      requests.map((request) => handleRuntimePathRequest(request)),
    );
    expect(
      requests.slice(0, 3).map((request) => handleRuntimePathRequest(request)),
    ).toEqual([
      { ok: false, error: { code: "canonical-collision" } },
      { ok: false, error: { code: "canonical-collision" } },
      { ok: false, error: { code: "link-escape" } },
    ]);
  });

  it("discovers canonical-active state read-only with both legacy sources intact", () => {
    const root = fixture();
    for (const name of [".cstl", ".trellis"]) {
      fs.mkdirSync(path.join(root, name));
      fs.writeFileSync(
        path.join(root, name, "legacy.json"),
        "private original\r\n",
      );
    }
    const legacyBefore = [".cstl", ".trellis"].map((name) =>
      treeFingerprint(path.join(root, name)),
    );
    const generations = new GenerationStore(root);
    generations.stage("gen-active");
    generations.seal("gen-active", []);
    new InstallStateStore(root).compareAndSwap(null, {
      schemaVersion: 1,
      product: "pactile",
      canonicalRoot: ".pactile",
      runtimeVersion: "0.5.0",
      contractVersion: 1,
      generationId: "gen-active",
      status: "active",
      installedAdapters: [],
      lastMigrationJournalId: null,
      createdAt: "2026-09-09T00:00:00Z",
      updatedAt: "2026-09-09T00:00:00Z",
    });
    const before = treeFingerprint(root);
    const requests = [{ operation: "discover", projectRoot: root }];
    expect(python(requests)).toEqual(
      requests.map((request) => handleRuntimePathRequest(request)),
    );
    expect(treeFingerprint(root)).toBe(before);
    expect(
      [".cstl", ".trellis"].map((name) =>
        treeFingerprint(path.join(root, name)),
      ),
    ).toEqual(legacyBefore);
  });
});
