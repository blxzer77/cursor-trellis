/**
 * P29 module short-contract catalog.
 *
 * Lists Baseline vs On-demand modules from `index.json` next to this file.
 * The human overview document is not an input. Does not invent a fifth
 * retrieval intent.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const modulesRoot = dirname(fileURLToPath(import.meta.url));

export const BASELINE_RETRIEVAL_INTENTS = [
  "exact",
  "semantic",
  "structural",
  "external",
] as const;

export type BaselineRetrievalIntent =
  (typeof BASELINE_RETRIEVAL_INTENTS)[number];

export type ModuleLayer = "baseline" | "on-demand";

export interface ModuleCatalogEntry {
  id: string;
  layer: ModuleLayer;
  contract: string;
}

export interface ModuleCatalog {
  schema_version: number;
  source: string;
  baseline_intents: string[];
  layers: {
    baseline: string[];
    "on-demand": string[];
  };
  modules: ModuleCatalogEntry[];
}

export function getModulesRoot(): string {
  return modulesRoot;
}

export function getModuleCatalogPath(root = modulesRoot): string {
  return join(root, "index.json");
}

export function loadModuleCatalog(root = modulesRoot): ModuleCatalog {
  const raw = readFileSync(getModuleCatalogPath(root), "utf-8");
  const parsed = JSON.parse(raw) as ModuleCatalog;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("modules/index.json must be an object");
  }
  if (!Array.isArray(parsed.modules)) {
    throw new Error("modules/index.json must list modules");
  }
  return parsed;
}

/** List P29 module ids from the catalog file. */
export function listModuleCatalog(
  root = modulesRoot,
): readonly ModuleCatalogEntry[] {
  return loadModuleCatalog(root).modules;
}

export function readModuleContract(id: string, root = modulesRoot): string {
  const entry = listModuleCatalog(root).find((item) => item.id === id);
  if (!entry) {
    throw new Error(`Unknown module id: ${id}`);
  }
  return readFileSync(join(root, entry.contract), "utf-8");
}
