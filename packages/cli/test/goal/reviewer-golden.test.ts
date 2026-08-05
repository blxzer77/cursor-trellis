import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { ReviewDecision } from "../../src/goal/action-packet.js";
import { validateGoalReviewDecision } from "../../src/goal/action-packet.js";
import { reviewGoalActionPacket } from "../../src/goal/reviewer.js";

interface GoldenExpect {
  decision?: ReviewDecision;
  decisionIn?: ReviewDecision[];
  hard_deny_hit?: string | null;
  h3_allowed?: boolean;
  constraintsInclude?: string[];
  alternativeNonEmpty?: boolean;
  forbidDecisions?: ReviewDecision[];
  notHardDeny?: string;
}

interface GoldenCase {
  id: string;
  bucket: string;
  exempt_local?: boolean;
  packet?: Record<string, unknown>;
  syntheticDecision?: Record<string, unknown>;
  expect?: GoldenExpect;
  expectInvalid?: boolean;
}

interface GoldenFixture {
  version: number;
  cases: GoldenCase[];
}

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../fixtures/goal-reviewer-golden/cases.json",
);

const fixture = JSON.parse(
  readFileSync(fixturePath, "utf8"),
) as GoldenFixture;

const HARD_DENY_BUCKETS = new Set(["hard-deny"]);
const MIS_ALLOW_DECISIONS = new Set<ReviewDecision>([
  "allow",
  "allow_with_constraints",
  "uncertain",
]);

describe("goal reviewer golden suite", () => {
  for (const c of fixture.cases) {
    it(c.id, () => {
      if (c.expectInvalid && c.syntheticDecision) {
        const result = validateGoalReviewDecision(c.syntheticDecision);
        expect(result.valid, `${c.id} invalid decision`).toBe(false);
        if (!result.valid) {
          expect(result.invalid_reason, `${c.id} reason`).toBeTruthy();
        }
        return;
      }

      if (c.expectInvalid) {
        const result = reviewGoalActionPacket(c.packet);
        expect(result.valid, `${c.id} invalid packet`).toBe(false);
        expect(result.invalid_reason, `${c.id} reason`).toBeTruthy();
        return;
      }

      const result = reviewGoalActionPacket(c.packet);
      expect(result.valid, `${c.id} valid review`).toBe(true);
      const decision = result.decision!;

      const exp = c.expect!;
      if (exp.decision) {
        expect(decision.decision, `${c.id} decision`).toBe(exp.decision);
      }
      if (exp.decisionIn) {
        expect(exp.decisionIn, `${c.id} decisionIn`).toContain(
          decision.decision,
        );
      }
      if (exp.hard_deny_hit !== undefined) {
        expect(decision.hard_deny_hit, `${c.id} hard_deny_hit`).toBe(
          exp.hard_deny_hit,
        );
      }
      if (exp.h3_allowed !== undefined) {
        expect(decision.h3_allowed, `${c.id} h3_allowed`).toBe(exp.h3_allowed);
      }
      if (exp.constraintsInclude) {
        for (const needle of exp.constraintsInclude) {
          expect(
            decision.constraints?.join(" ") ?? "",
            `${c.id} constraints`,
          ).toContain(needle);
        }
      }
      if (exp.alternativeNonEmpty) {
        expect(decision.alternative?.length ?? 0, `${c.id} alternative`).toBeGreaterThan(0);
      }
      if (exp.forbidDecisions) {
        expect(exp.forbidDecisions, `${c.id} forbid`).not.toContain(
          decision.decision,
        );
      }
      if (exp.notHardDeny) {
        expect(decision.hard_deny_hit, `${c.id} notHardDeny`).not.toBe(
          exp.notHardDeny,
        );
      }

      expect(decision.l1_ready.rollback_hint.length, `${c.id} l1`).toBeGreaterThan(0);
    });
  }

  it("mis-allow gate is zero on hard-deny bucket", () => {
    let misAllow = 0;
    for (const c of fixture.cases) {
      if (c.expectInvalid || !c.packet) continue;
      const result = reviewGoalActionPacket(c.packet);
      if (!result.valid || !result.decision) continue;
      if (
        HARD_DENY_BUCKETS.has(c.bucket) &&
        MIS_ALLOW_DECISIONS.has(result.decision.decision)
      ) {
        misAllow += 1;
      }
    }
    expect(misAllow).toBe(0);
  });

  it("exempt_local false-deny rate <= 20%", () => {
    let exemptFalseDeny = 0;
    let exemptTotal = 0;
    for (const c of fixture.cases) {
      if (!c.exempt_local || c.expectInvalid || !c.packet) continue;
      exemptTotal += 1;
      const result = reviewGoalActionPacket(c.packet);
      if (
        result.valid &&
        result.decision?.decision === "deny_suggest_alternative"
      ) {
        exemptFalseDeny += 1;
      }
    }
    if (exemptTotal === 0) return;
    expect(exemptFalseDeny / exemptTotal).toBeLessThanOrEqual(0.2);
  });
});
