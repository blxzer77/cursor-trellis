import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  assessRetrievalClaimV3,
  buildRetrievalRequestV3,
  classifyRetrievalIntentsV3,
  createRetrievalPlanV3,
  planRetrievalV3,
  type RetrievalPlanV3,
} from "../../../src/pactile/retrieval/index.js";

const cliRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const scriptsDir = path.join(cliRoot, "src/templates/trellis/scripts");
const cases = JSON.parse(
  readFileSync(
    path.join(cliRoot, "test/fixtures/retrieval-v3/cases.json"),
    "utf8",
  ),
) as { name: string; request: unknown; context: unknown }[];

interface EvidenceParityCase {
  readonly name: string;
  readonly planIntent: "exact" | "semantic" | "structural" | "external";
  readonly inputIntent?: string;
  readonly minimumAssurance: "best-effort" | "evidence-backed" | "verified";
  readonly requiredEvidenceKinds: readonly string[];
  readonly candidateRefs: readonly string[];
  readonly corroboration: readonly {
    readonly kind: string;
    readonly ref: string;
  }[];
  readonly resolution: "valid" | null;
  readonly resolutionOverrides?: Readonly<Record<string, unknown>>;
  readonly resolutionExtra?: Readonly<Record<string, unknown>>;
  readonly inputExtra?: Readonly<Record<string, unknown>>;
  readonly expected: {
    readonly accepted: boolean;
    readonly achievedAssurance: string | null;
    readonly reasonCodes: readonly string[];
  };
  readonly outputMustNotContain?: readonly string[];
}

const evidenceCases = JSON.parse(
  readFileSync(
    path.join(cliRoot, "test/fixtures/retrieval-v3/evidence-cases.json"),
    "utf8",
  ),
) as EvidenceParityCase[];

function pythonExe(): string {
  for (const executable of ["python", "py", "python3"]) {
    if (
      spawnSync(executable, ["--version"], { encoding: "utf8" }).status === 0
    ) {
      return executable;
    }
  }
  return "python";
}

function runPython(
  functionName:
    | "plan_retrieval_v3"
    | "classify_codebase_retrieval_intents"
    | "assess_retrieval_claim_v3",
  payload: unknown,
): unknown {
  const invocation =
    functionName === "plan_retrieval_v3"
      ? `${functionName}(payload["request"], payload.get("context", {}))`
      : functionName === "classify_codebase_retrieval_intents"
        ? `${functionName}(payload["request"])`
        : `${functionName}(payload["input"])`;
  const script = [
    "import json, sys",
    "sys.path.insert(0, sys.argv[1])",
    `from common.codebase_retrieval_router import ${functionName}`,
    "payload = json.load(sys.stdin)",
    `result = ${invocation}`,
    'print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))',
  ].join("; ");
  const result = spawnSync(pythonExe(), ["-c", script, scriptsDir], {
    cwd: cliRoot,
    input: JSON.stringify(payload),
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(
      `Python mirror failed (${result.status}): ${result.stderr}`,
    );
  }
  return JSON.parse(result.stdout);
}

function validResolution(
  plan: RetrievalPlanV3,
  intent: Exclude<EvidenceParityCase["planIntent"], "exact">,
  overrides: Readonly<Record<string, unknown>> = {},
  extra: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  const verified = plan.minimumAssurance === "verified";
  return {
    schemaVersion: 1,
    intent,
    minimumAssurance: plan.minimumAssurance,
    origin: "provider",
    providerId: "fixture.provider",
    providerVersion: "1.0.0",
    assurance: plan.minimumAssurance,
    readiness: "ready",
    requestedPolicy: plan.requestedPolicy,
    effectivePolicy: plan.requestedPolicy,
    evidenceRefs: ["evidence://provider/probe"],
    freshness: verified ? "fresh" : "unknown",
    probedAt: verified ? "2026-09-09T01:00:00.000Z" : null,
    probeResult: verified ? "passed" : "not-run",
    fallbackFromProviderId: null,
    ...overrides,
    ...extra,
  };
}

function evidenceInput(fixture: EvidenceParityCase): Record<string, unknown> {
  const plan = createRetrievalPlanV3(
    buildRetrievalRequestV3({
      query: `shared evidence fixture ${fixture.planIntent}`,
      intents: [fixture.planIntent],
      minimumAssurance: fixture.minimumAssurance,
      requiredEvidenceKinds: fixture.requiredEvidenceKinds,
    }),
    fixture.planIntent === "exact"
      ? {}
      : {
          providerAvailability: [
            {
              intent: fixture.planIntent,
              status: "ready",
              readiness: "ready",
            },
          ],
        },
  );
  const input: Record<string, unknown> = {
    plan,
    intent: fixture.inputIntent ?? fixture.planIntent,
    candidateRefs: fixture.candidateRefs,
    corroboration: fixture.corroboration,
  };
  if (fixture.resolution === "valid" && fixture.planIntent !== "exact") {
    input.resolution = validResolution(
      plan,
      fixture.planIntent,
      fixture.resolutionOverrides,
      fixture.resolutionExtra,
    );
  }
  return { ...input, ...fixture.inputExtra };
}

describe("Pactile retrieval V3 TypeScript/Python parity", () => {
  it.each(cases)(
    "matches every field and fingerprint for $name",
    ({ request, context }) => {
      const typescript = planRetrievalV3(request, context as never);
      const python = runPython("plan_retrieval_v3", { request, context });
      expect(python).toEqual(typescript);
      expect(JSON.stringify(typescript)).not.toContain("TOKEN=");
    },
  );

  it.each(evidenceCases)(
    "matches the shared evidence ABI for $name",
    (fixture) => {
      const input = evidenceInput(fixture);
      const typescript = assessRetrievalClaimV3(input as never);
      const python = runPython("assess_retrieval_claim_v3", { input });
      expect(python).toEqual(typescript);
      expect(typescript).toMatchObject(fixture.expected);
      for (const canary of fixture.outputMustNotContain ?? []) {
        expect(JSON.stringify(typescript)).not.toContain(canary);
        expect(JSON.stringify(python)).not.toContain(canary);
      }
    },
  );

  it.each([
    "where is Widget defined",
    "how does account behavior work",
    "caller dependency impact",
    "latest official docs",
    "exact behavior caller latest",
    "未知请求",
  ])("classifies %s identically", (query) => {
    const typescript = classifyRetrievalIntentsV3(query);
    const python = runPython("classify_codebase_retrieval_intents", {
      request: query,
    });
    expect(python).toEqual(typescript);
  });
});
