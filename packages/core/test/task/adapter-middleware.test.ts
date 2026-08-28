import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { emptyTaskRecord } from "../../src/task/index.js";
import { KernelError } from "../../src/task/kernel-contract.js";
import {
  applyKernelArchive,
  applyKernelCreate,
  applyKernelPatch,
  applyKernelStart,
} from "../../src/task/kernel-store.js";
import {
  EXTERNAL_KNOWLEDGE_CAPABILITY,
  RETRIEVAL_INTENTS,
  SMART_SEARCH_PROVIDER,
  recordHookEvent,
  subscribeEvent,
} from "../../src/task/adapter-middleware.js";
import { resolveRequiredControls } from "../../src/task/full-quality.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const coreRoot = path.resolve(here, "../..");
const cliTemplates = path.resolve(here, "../../../cli/src/templates");

function stage6Record(
  overrides: Parameters<typeof emptyTaskRecord>[0] = {},
) {
  return emptyTaskRecord({
    id: "stage6-demo",
    name: "stage6-demo",
    title: "Stage 6 Demo",
    status: "planning",
    assignee: "developer",
    creator: "developer",
    priority: "P2",
    ...overrides,
  });
}

function writeSurfaces(taskDir: string): void {
  fs.writeFileSync(path.join(taskDir, "prd.md"), "# Stage 6\n", "utf-8");
  fs.writeFileSync(
    path.join(taskDir, "verify.md"),
    "- validation: core test\n- acceptance: stage6 close\n",
    "utf-8",
  );
}

describe("Stage 6 Adapter and Middleware", () => {
  let tmp: string;
  let taskDir: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-stage6-"));
    taskDir = path.join(tmp, "08-28-stage6");
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("records a hook event and does not fail unsubscribed modules", () => {
    const extras: Record<string, unknown> = {};
    subscribeEvent(extras, "sessionStart", "observability-local");
    subscribeEvent(extras, "stop", "retrieval-extended");
    const last = recordHookEvent(extras, {
      event: "sessionStart",
      source: "cursor-hooks",
      at: "2026-08-28T00:00:00.000Z",
    });
    expect(last.delivered).toEqual(["observability-local"]);
    expect(last.skipped).toEqual(["retrieval-extended"]);
    expect(() =>
      recordHookEvent(extras, { event: "preToolUse", source: "cursor-hooks" }),
    ).not.toThrow();
  });

  it("persists Event Bridge via patch extras without a new Command op", () => {
    const created = applyKernelCreate({
      taskDir,
      actor: "task.py create",
      idempotencyKey: "create:stage6-bridge",
      record: stage6Record(),
    });
    const patched = applyKernelPatch({
      taskDir,
      expectedRevision: created.kernel.revision,
      actor: "task.py",
      idempotencyKey: "patch:stage6-bridge",
      extras: {
        hook_event: { event: "sessionStart", source: "cursor-hooks" },
        event_bridge: {
          subscriptions: [
            { event: "sessionStart", module: "observability-local" },
          ],
        },
      },
    });
    const extras = patched.kernel.projection?.extras ?? {};
    expect(extras.event_bridge).toMatchObject({
      source: "stage6-adapter-middleware",
      last_event: {
        event: "sessionStart",
        delivered: ["observability-local"],
      },
    });
  });

  it("closes Lite without smart-search when external-knowledge is not required", () => {
    expect(fs.existsSync(path.join(tmp, ".git"))).toBe(false);
    const created = applyKernelCreate({
      taskDir,
      actor: "task.py create",
      idempotencyKey: "create:stage6-lite",
      record: stage6Record(),
      extras: {
        required_controls: resolveRequiredControls({ rigor: "lite" }),
        smart_search_probe: { available: false },
      },
    });
    const extras = created.kernel.projection?.extras ?? {};
    expect(extras.profile_health).toBe("degraded");
    expect(extras.middleware_providers).toMatchObject({
      degraded: [SMART_SEARCH_PROVIDER],
      readiness: {
        [SMART_SEARCH_PROVIDER]: {
          status: "missing",
          capability: EXTERNAL_KNOWLEDGE_CAPABILITY,
        },
      },
    });
    expect(extras.capability_router).toMatchObject({
      exact: true,
      semantic: true,
      structural: true,
      external: true,
    });
    expect(created.legacy.status).toBe("planning");
    writeSurfaces(taskDir);

    const started = applyKernelStart({
      taskDir,
      expectedRevision: created.kernel.revision,
      actor: "task.py start-execution --approved",
      idempotencyKey: "start:stage6-lite",
      record: { ...stage6Record(), status: "in_progress" },
      extras: { execution_approval: { approved_by: "user" } },
      evidence: "task.py start-execution --approved",
    });
    expect(started.legacy.status).toBe("in_progress");

    const archived = applyKernelArchive({
      taskDir,
      expectedRevision: started.kernel.revision,
      actor: "task.py archive",
      idempotencyKey: "archive:stage6-lite",
      record: {
        ...stage6Record(),
        status: "completed",
        completedAt: "2026-08-28",
      },
      extras: { close_outcome: "completed" },
      evidence: "verify.md",
    });
    expect(archived.kernel.phase).toBe("close");
    expect(archived.legacy.status).toBe("completed");
  });

  it("starts Full Quality without smart-search when capability is not required", () => {
    const created = applyKernelCreate({
      taskDir,
      actor: "task.py create",
      idempotencyKey: "create:stage6-full",
      record: stage6Record({ id: "stage6-full", name: "stage6-full" }),
      extras: {
        required_controls: resolveRequiredControls({
          rigor: "full",
          verificationProfile: "standard",
        }),
        smart_search_probe: { available: false },
      },
    });
    writeSurfaces(taskDir);
    fs.writeFileSync(
      path.join(taskDir, "implement.md"),
      "execution_mode: inline\nverification_profile: standard\n",
      "utf-8",
    );
    const started = applyKernelStart({
      taskDir,
      expectedRevision: created.kernel.revision,
      actor: "a",
      idempotencyKey: "start:stage6-full",
      record: {
        ...stage6Record({ id: "stage6-full", name: "stage6-full" }),
        status: "in_progress",
      },
      extras: { execution_approval: { approved_by: "user" } },
      evidence: "approved",
    });
    expect(started.legacy.status).toBe("in_progress");
    expect(started.kernel.projection?.extras?.profile_health).toBe("degraded");
  });

  it("blocks start when external-knowledge is required and Provider is missing", () => {
    const created = applyKernelCreate({
      taskDir,
      actor: "a",
      idempotencyKey: "create:stage6-required",
      record: stage6Record(),
      extras: {
        required_capabilities: [EXTERNAL_KNOWLEDGE_CAPABILITY],
        smart_search_probe: { available: false },
      },
    });
    try {
      applyKernelStart({
        taskDir,
        expectedRevision: created.kernel.revision,
        actor: "a",
        idempotencyKey: "start:stage6-required",
        record: { ...stage6Record(), status: "in_progress" },
        extras: { execution_approval: { approved_by: "user" } },
        evidence: "approved",
      });
      expect.unreachable("missing Provider should block required capability");
    } catch (err) {
      expect(err).toBeInstanceOf(KernelError);
      expect((err as KernelError).code).toBe("INVALID_TRANSITION");
    }
  });

  it("allows Policy degrade when external-knowledge is required but missing", () => {
    const created = applyKernelCreate({
      taskDir,
      actor: "a",
      idempotencyKey: "create:stage6-degrade",
      record: stage6Record(),
      extras: {
        required_capabilities: [EXTERNAL_KNOWLEDGE_CAPABILITY],
        external_knowledge_policy: "degrade",
        smart_search_probe: { available: false },
      },
    });
    writeSurfaces(taskDir);
    const started = applyKernelStart({
      taskDir,
      expectedRevision: created.kernel.revision,
      actor: "a",
      idempotencyKey: "start:stage6-degrade",
      record: { ...stage6Record(), status: "in_progress" },
      extras: {
        execution_approval: { approved_by: "user" },
        external_knowledge_policy: "degrade",
      },
      evidence: "approved",
    });
    expect(started.legacy.status).toBe("in_progress");
    expect(started.kernel.projection?.extras?.profile_health).toBe("degraded");
  });

  it("rejects capability_router bindings to Optional tool names", () => {
    try {
      applyKernelCreate({
        taskDir,
        actor: "a",
        idempotencyKey: "create:stage6-tools",
        record: stage6Record(),
        extras: {
          capability_router: { exact: true, codegraph: true },
        },
      });
      expect.unreachable("tool-name binding should fail");
    } catch (err) {
      expect(err).toBeInstanceOf(KernelError);
      expect((err as KernelError).code).toBe("INVALID_REQUEST");
    }
  });

  it("does not load Core through a smart-search dependency", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(coreRoot, "package.json"), "utf-8"),
    ) as {
      dependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
    };
    expect(pkg.dependencies ?? {}).not.toHaveProperty("@blxzer/smart-search");
    expect(pkg.optionalDependencies ?? {}).not.toHaveProperty(
      "@blxzer/smart-search",
    );
    expect(RETRIEVAL_INTENTS).toEqual([
      "exact",
      "semantic",
      "structural",
      "external",
    ]);
  });

  it("default templates do not force codegraph/fast-context or revive Cursor++ / cstl-byok live entries", () => {
    const bootstrap = fs.readFileSync(
      path.join(cliTemplates, "cursor/rules/cstl-bootstrap.mdc"),
      "utf-8",
    );
    expect(bootstrap).toContain("exact");
    expect(bootstrap).toContain("semantic");
    expect(bootstrap).toContain("structural");
    expect(bootstrap).toContain("external");
    expect(bootstrap).toMatch(/Optional/i);
    expect(bootstrap).not.toMatch(/always-on codegraph/i);

    const ruleNames = fs
      .readdirSync(path.join(cliTemplates, "cursor/rules"))
      .filter((name) => name.endsWith(".mdc"));
    expect(ruleNames).toEqual(["cstl-bootstrap.mdc"]);

    const commandsDir = path.join(cliTemplates, "cursor/commands");
    const commandFiles = fs.existsSync(commandsDir)
      ? fs.readdirSync(commandsDir)
      : [];
    expect(commandFiles).not.toContain("cstl-cursor2plus-setup.md");
    expect(commandFiles.some((name) => name.includes("cstl-byok"))).toBe(false);

    const workflow = fs.readFileSync(
      path.join(cliTemplates, "trellis/workflow.md"),
      "utf-8",
    );
    expect(workflow).not.toMatch(/compatible v0\.0\.11\+/);
    expect(workflow).not.toMatch(/\.cstl\/local\/cursor2plus\//);
    expect(workflow).toContain("Adapter and Middleware");
  });
});
