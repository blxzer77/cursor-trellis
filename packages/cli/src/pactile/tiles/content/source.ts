import {
  loadTileUnit,
  type TileCatalogEntry,
  type TileDiagnostic,
  type TileResult,
  type TileTransportFile,
} from "../loader.js";

export interface TileContentSpec {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly body: string;
  readonly intents: readonly ("exact" | "semantic" | "structural" | "external")[];
  readonly inputs?: readonly string[];
  readonly outputs: readonly string[];
  readonly dependencies?: readonly string[];
  readonly filesystem?: "none" | "read" | "write";
  readonly process?: "none" | "execute";
  readonly credentials?: "forbidden" | "project-authorized";
  readonly network?: "forbidden" | "project-authorized";
  readonly privacy?: "local-only" | "project-approved-egress" | "external";
  readonly telemetry?: "forbidden" | "local-only" | "project-authorized";
  readonly destinations?: readonly string[];
  readonly cost?: "none" | "free" | "low" | "medium" | "high";
  readonly evidenceKind?:
    | "artifact"
    | "command-result"
    | "source-reference"
    | "human-approval"
    | "trace-event";
  readonly evidenceDescription: string;
}

export interface TileContentSource {
  readonly id: string;
  readonly files: readonly TileTransportFile[];
}

function list(name: string, values: readonly string[]): string[] {
  return values.length
    ? [`${name}:`, ...values.map((value) => `  - ${value}`)]
    : [`${name}: []`];
}

/** Trusted bundled data is still serialized through the public Tile transport. */
export function defineTileContent(spec: TileContentSpec): TileContentSource {
  const network = spec.network ?? "forbidden";
  const privacy = spec.privacy ?? "local-only";
  const telemetry = spec.telemetry ?? "local-only";
  const yaml = [
    "schemaVersion: 1",
    "identity:",
    `  id: ${spec.id}`,
    '  version: "1.0.0"',
    `summary: ${JSON.stringify(spec.summary)}`,
    "trigger:",
    "  mode: both",
    "  intents:",
    ...spec.intents.map((intent) => `    - ${intent}`),
    `  description: ${JSON.stringify(spec.summary)}`,
    ...list("inputs", spec.inputs ?? []),
    ...list("outputs", spec.outputs),
    ...list("dependencies", spec.dependencies ?? []),
    "conflicts: []",
    "permissions:",
    `  filesystem: ${spec.filesystem ?? "read"}`,
    `  process: ${spec.process ?? "none"}`,
    `  credentials: ${spec.credentials ?? "forbidden"}`,
    "egress:",
    `  network: ${network}`,
    `  privacy: ${privacy}`,
    `  telemetry: ${telemetry}`,
    ...(spec.destinations?.length
      ? [
          "  destinations:",
          ...spec.destinations.map((destination) => `    - ${destination}`),
        ]
      : ["  destinations: []"]),
    "cost:",
    `  ceiling: ${spec.cost ?? "free"}`,
    "fallback:",
    "  allowed: false",
    "  minimumAssurance: null",
    "  policy: null",
    "stop:",
    "  conditions:",
    "    - success",
    "    - blocked",
    "    - policy-denied",
    "    - provider-unavailable",
    "  maxAttempts: 3",
    "minimumAssurance: evidence-backed",
    "evidence:",
    `  - kind: ${spec.evidenceKind ?? "source-reference"}`,
    "    required: true",
    `    description: ${JSON.stringify(spec.evidenceDescription)}`,
    "",
  ].join("\n");
  return {
    id: spec.id,
    files: [
      { name: "tile.yaml", text: yaml },
      {
        name: "SKILL.md",
        text: `# ${spec.title}\n\n${spec.body.trim()}\n`,
      },
    ],
  };
}

export function loadTileContent(
  sources: readonly TileContentSource[],
): TileResult<readonly TileCatalogEntry[]> {
  const entries: TileCatalogEntry[] = [];
  const diagnostics: TileDiagnostic[] = [];
  for (const source of [...sources].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    const loaded = loadTileUnit(source.files);
    if (loaded.success) entries.push(loaded.data);
    else diagnostics.push(...loaded.diagnostics);
  }
  return diagnostics.length
    ? { success: false, diagnostics }
    : { success: true, data: entries };
}
