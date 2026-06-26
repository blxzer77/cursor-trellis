import fs from "node:fs";
import path from "node:path";

import { AI_TOOLS } from "../types/ai-tools.js";
import { getAllRules } from "../templates/cursor/index.js";
import {
  expectedRules,
  type ExpectedRule,
} from "../templates/cursor/fixtures/expected-rules.js";
import { normalizeText, normalizedByteLength } from "./normalize-text.js";

export interface RuleValidationIssue {
  filename: string;
  kind: "missing" | "section" | "size";
  detail: string;
}

export interface RuleValidationResult {
  ok: boolean;
  issues: RuleValidationIssue[];
}

function validateRuleContent(
  filename: string,
  content: string,
  spec: ExpectedRule,
): RuleValidationIssue[] {
  const issues: RuleValidationIssue[] = [];
  const normalized = normalizeText(content);

  for (const section of spec.requiredSections) {
    if (!normalized.includes(section)) {
      issues.push({
        filename,
        kind: "section",
        detail: `missing required section "${section}"`,
      });
    }
  }

  const bytes = normalizedByteLength(content);
  if (bytes < spec.minBytes) {
    issues.push({
      filename,
      kind: "size",
      detail: `content too short (${bytes} bytes, minimum ${spec.minBytes})`,
    });
  }

  return issues;
}

function validateRuleMap(
  rules: Map<string, string>,
  manifest: ExpectedRule[] = expectedRules,
): RuleValidationResult {
  const issues: RuleValidationIssue[] = [];

  for (const spec of manifest) {
    const content = rules.get(spec.filename);
    if (content === undefined) {
      issues.push({
        filename: spec.filename,
        kind: "missing",
        detail: "rule file not found",
      });
      continue;
    }
    issues.push(...validateRuleContent(spec.filename, content, spec));
  }

  return { ok: issues.length === 0, issues };
}

/** Validate template rules from getAllRules() against the expected manifest. */
export function validateTemplateRules(
  manifest: ExpectedRule[] = expectedRules,
): RuleValidationResult {
  const rules = new Map<string, string>();
  for (const rule of getAllRules()) {
    rules.set(rule.name, rule.content);
  }
  return validateRuleMap(rules, manifest);
}

/** Validate installed .cursor/rules/*.mdc on disk against the manifest. */
export function validateRulesDir(
  rulesDir: string,
  manifest: ExpectedRule[] = expectedRules,
): RuleValidationResult {
  const rules = new Map<string, string>();

  for (const spec of manifest) {
    const filePath = path.join(rulesDir, spec.filename);
    if (!fs.existsSync(filePath)) {
      continue;
    }
    rules.set(spec.filename, fs.readFileSync(filePath, "utf-8"));
  }

  return validateRuleMap(rules, manifest);
}

export function formatRuleValidationErrors(
  result: RuleValidationResult,
): string {
  return result.issues
    .map((issue) => `- ${issue.filename}: ${issue.detail}`)
    .join("\n");
}

/**
 * Hard gate: validate template rules and, when Cursor is configured,
 * installed rules under cwd/.cursor/rules.
 */
export function assertCursorRulesValid(cwd: string): void {
  const templateResult = validateTemplateRules();
  if (!templateResult.ok) {
    throw new Error(
      `Cursor rules template validation failed:\n${formatRuleValidationErrors(templateResult)}`,
    );
  }

  const rulesDir = path.join(cwd, AI_TOOLS.cursor.configDir, "rules");
  if (!fs.existsSync(rulesDir)) {
    return;
  }

  const installedResult = validateRulesDir(rulesDir);
  if (!installedResult.ok) {
    throw new Error(
      `Cursor rules installation validation failed (${rulesDir}):\n${formatRuleValidationErrors(installedResult)}`,
    );
  }
}
