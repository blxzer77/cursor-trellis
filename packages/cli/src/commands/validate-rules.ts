import chalk from "chalk";

import {
  assertCursorRulesValid,
  formatRuleValidationErrors,
  validateRulesDir,
  validateTemplateRules,
} from "../utils/validate-rules.js";

export interface ValidateRulesOptions {
  dir?: string;
  templatesOnly?: boolean;
}

export async function runValidateRules(
  cwd: string,
  options: ValidateRulesOptions = {},
): Promise<void> {
  if (options.dir) {
    const result = validateRulesDir(options.dir);
    if (!result.ok) {
      console.error(chalk.red("Cursor rules validation failed:"));
      console.error(formatRuleValidationErrors(result));
      process.exit(1);
    }
    console.log(chalk.green(`✓ Cursor rules valid (${options.dir})`));
    return;
  }

  const templateResult = validateTemplateRules();
  if (!templateResult.ok) {
    console.error(chalk.red("Cursor rules template validation failed:"));
    console.error(formatRuleValidationErrors(templateResult));
    process.exit(1);
  }
  console.log(chalk.green("✓ Cursor rules templates valid"));

  if (options.templatesOnly) {
    return;
  }

  try {
    assertCursorRulesValid(cwd);
    console.log(chalk.green(`✓ Cursor rules installation valid (${cwd})`));
  } catch (error) {
    console.error(
      chalk.red("Error:"),
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }
}
