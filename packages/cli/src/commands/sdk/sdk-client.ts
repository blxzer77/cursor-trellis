import { cursorApiKeySetupGuide, hasCursorApiKey } from "../../utils/cursor-sdk-gate.js";

export interface CursorAgentOutcome {
  status: string;
  result: string;
}

interface CursorAgent {
  prompt: (
    p: string,
    opts: {
      apiKey: string;
      model: { id: string };
      local: { cwd: string };
    },
  ) => Promise<{ status?: string; result?: string }>;
}

/**
 * Call @cursor/sdk Agent.prompt against a local cwd.
 * Requires CURSOR_API_KEY in the current process (never logged).
 */
export async function promptCursorAgent(
  prompt: string,
  cwd: string,
): Promise<CursorAgentOutcome> {
  if (!hasCursorApiKey()) {
    throw new Error(
      [
        "Live SDK run requires CURSOR_API_KEY (and prior user consent to use it).",
        "Use --mock for offline/CI runs.",
        cursorApiKeySetupGuide(),
      ].join(" "),
    );
  }

  const apiKey = process.env.CURSOR_API_KEY!.trim();
  let Agent: CursorAgent;
  try {
    const dynamicImport = new Function(
      "specifier",
      "return import(specifier)",
    ) as (specifier: string) => Promise<{ Agent: CursorAgent }>;
    const mod = await dynamicImport("@cursor/sdk");
    Agent = mod.Agent;
  } catch {
    throw new Error(
      "@cursor/sdk is not installed. After explicit consent, add the optional dependency, or use --mock.",
    );
  }

  const outcome = await Agent.prompt(prompt, {
    apiKey,
    model: { id: "composer-2.5" },
    local: { cwd },
  });
  return {
    status: outcome.status ?? "unknown",
    result: outcome.result ?? "",
  };
}