/**
 * Expected Cursor rules manifest for validate-rules hard gate.
 * Update alongside rule content changes in templates/cursor/rules/.
 */

export interface ExpectedRule {
  /** Filename including .mdc extension, e.g. "trellis-triage.mdc" */
  filename: string;
  /** Substrings that must appear in rule body (case-sensitive) */
  requiredSections: string[];
  /** Minimum byte length of normalized rule content */
  minBytes: number;
}

export const expectedRules: ExpectedRule[] = [
  {
    filename: "trellis-triage.mdc",
    requiredSections: [
      "Decision tree",
      "Classification mark",
      "Consent gate",
    ],
    minBytes: 500,
  },
  {
    filename: "trellis-subagent-dispatch.mdc",
    requiredSections: ["Layer 2", "generate_dispatch_prompt", "CLI"],
    minBytes: 400,
  },
  {
    filename: "retrieval-routing.mdc",
    requiredSections: ["Native", "BYOK", "codegraph", "smart-search"],
    minBytes: 600,
  },
];
