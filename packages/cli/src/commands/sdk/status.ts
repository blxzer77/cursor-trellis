import fs from "node:fs";
import path from "node:path";

import {
  cursorApiKeySetupGuide,
  hasCursorApiKey,
} from "../../utils/cursor-sdk-gate.js";
import { loadProjectCapabilities } from "../../utils/project-capabilities.js";

export type SdkStatusResult = {
  ok: boolean;
  cwd: string;
  keyPresent: boolean;
  capabilitySelected: boolean;
  sdkModuleResolvable: boolean | null;
  nextSteps: string[];
};

async function probeSdkModuleResolvable(): Promise<boolean> {
  try {
    const dynamicImport = new Function(
      "specifier",
      "return import(specifier)",
    ) as (specifier: string) => Promise<unknown>;
    await dynamicImport("@cursor/sdk");
    return true;
  } catch {
    return false;
  }
}

export async function collectSdkStatus(
  cwd: string = process.cwd(),
): Promise<SdkStatusResult> {
  const keyPresent = hasCursorApiKey();
  const selected = loadProjectCapabilities(cwd);
  const capabilitySelected = selected.includes("cursor-sdk");
  const sdkModuleResolvable = await probeSdkModuleResolvable();

  const nextSteps: string[] = [];
  if (!keyPresent) {
    nextSteps.push(
      "Set CURSOR_API_KEY in this process, then re-run `cstl sdk status` or re-select `cursor-sdk` during init/update.",
    );
    nextSteps.push("Use `cstl sdk run --task <path> --mock` without a key.");
  } else {
    nextSteps.push(
      "Key present. You may enable `cursor-sdk` at init/update and use `cstl sdk run --task <path> --live` after accepting billing/privacy risk.",
    );
  }
  if (!capabilitySelected && fs.existsSync(path.join(cwd, ".cstl"))) {
    nextSteps.push(
      "Project has `.cstl/` but `cursor-sdk` is not in `.cstl/capabilities.json` selected list.",
    );
  }
  if (sdkModuleResolvable === false) {
    nextSteps.push(
      "@cursor/sdk could not be imported from this CLI install; reinstall cursor-trellis / @blxzer/cursor-trellis.",
    );
  }

  return {
    ok: keyPresent,
    cwd,
    keyPresent,
    capabilitySelected,
    sdkModuleResolvable,
    nextSteps,
  };
}

export async function runSdkStatusCommand(options?: {
  cwd?: string;
  json?: boolean;
}): Promise<number> {
  const cwd = options?.cwd ? path.resolve(options.cwd) : process.cwd();
  const status = await collectSdkStatus(cwd);

  if (options?.json) {
    console.log(JSON.stringify(status, null, 2));
    return status.keyPresent ? 0 : 1;
  }

  console.log("Cursor SDK status");
  console.log(`  cwd: ${status.cwd}`);
  console.log(
    `  CURSOR_API_KEY: ${status.keyPresent ? "present" : "missing"} (value never printed)`,
  );
  console.log(
    `  capability cursor-sdk selected: ${status.capabilitySelected ? "yes" : "no"}`,
  );
  console.log(
    `  @cursor/sdk importable from CLI: ${
      status.sdkModuleResolvable === null
        ? "unknown"
        : status.sdkModuleResolvable
          ? "yes"
          : "no"
    }`,
  );
  console.log("  next steps:");
  for (const step of status.nextSteps) {
    console.log(`  - ${step}`);
  }
  if (!status.keyPresent) {
    console.log("");
    console.log(cursorApiKeySetupGuide());
  }
  return status.keyPresent ? 0 : 1;
}
