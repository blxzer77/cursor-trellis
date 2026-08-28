/**
 * Expected Cursor rules manifest for validate-rules hard gate.
 * Update alongside rule content changes in templates/cursor/rules/.
 */

export interface ExpectedRule {
  /** Filename including .mdc extension, e.g. "cstl-bootstrap.mdc" */
  filename: string;
  /** Substrings that must appear in rule body (case-sensitive) */
  requiredSections: string[];
  /** Minimum byte length of normalized rule content */
  minBytes: number;
}

export const expectedRules: ExpectedRule[] = [
  {
    filename: "cstl-bootstrap.mdc",
    requiredSections: [
      "Event Bridge",
      "Capability router",
      "external-knowledge",
      "Optional",
      "Native SSOT",
    ],
    minBytes: 400,
  },
];
