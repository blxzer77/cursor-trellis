import { describe, expect, it } from "vitest";
import {
  BASELINE_TILE_IDS,
  loadBaselineTileContent,
} from "../../../src/pactile/tiles/content/baseline/index.js";
import { buildTileCatalog } from "../../../src/pactile/tiles/catalog.js";
import { compileTileComposition } from "../../../src/pactile/tiles/compiler.js";

describe("baseline Tile catalog", () => {
  it("loads exactly eight lightweight Tiles into one valid composition", () => {
    const loaded = loadBaselineTileContent();
    expect(loaded.success).toBe(true);
    if (!loaded.success) throw new Error(JSON.stringify(loaded.diagnostics));
    expect(loaded.data.map((entry) => entry.manifest.identity.id).sort()).toEqual(
      [...BASELINE_TILE_IDS].sort(),
    );
    expect(loaded.data).toHaveLength(8);
    expect(
      loaded.data.every(
        (entry) =>
          entry.skillText.length < 500 &&
          entry.fingerprint.startsWith("sha256:") &&
          !entry.skillText.includes("<!-- CSTL:"),
      ),
    ).toBe(true);

    const catalog = buildTileCatalog(loaded.data);
    expect(catalog.success).toBe(true);
    if (!catalog.success) throw new Error(JSON.stringify(catalog.diagnostics));
    const compiled = compileTileComposition(catalog.data, {
      requestedSelection: [...BASELINE_TILE_IDS],
      capabilities: [],
    });
    expect(compiled.success).toBe(true);
    if (!compiled.success) throw new Error(JSON.stringify(compiled.diagnostics));
    expect(compiled.data.expandedSelection).toEqual([
      "intake-basic@1.0.0",
      "context-progressive@1.0.0",
      "define-basic@1.0.0",
      "approval-personal@1.0.0",
      "execute-agent@1.0.0",
      "observability-local@1.0.0",
      "verify-basic@1.0.0",
      "close-basic@1.0.0",
    ]);
    expect(compiled.data.fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});
