import type { Command } from "commander";

import { runGoalReviewCommand } from "./review.js";
import {
  acceptGoalPreflight,
  goalStatus,
  listGoalRuns,
  pauseGoal,
  runGoalLoop,
  runGoalPreflight,
} from "../../goal/runtime.js";

export function registerGoalCommand(program: Command): void {
  const goal = program
    .command("goal")
    .description(
      "cstl-goal MVP runtime — preflight, runner/window loop, walls, review seam",
    );

  goal
    .command("preflight")
    .description("Propose done_when contract (PF-1 gate)")
    .requiredOption("--goal <text>", "User goal text")
    .option("--goal-id <id>", "Reuse goal id")
    .option("--window", "Force window-only mode")
    .option("--json", "Machine-readable output")
    .action((opts: { goal: string; goalId?: string; window?: boolean; json?: boolean }) => {
      try {
        const { goalId, result } = runGoalPreflight({
          cwd: process.cwd(),
          goal: opts.goal,
          goalId: opts.goalId,
          window: opts.window === true,
        });
        if (opts.json) {
          console.log(JSON.stringify({ goalId, result }, null, 2));
          return;
        }
        console.log(`goal_id: ${goalId}`);
        if (!result.ok) {
          console.error(`REJECTED: ${result.reason}`);
          process.exitCode = 2;
          return;
        }
        console.log("\n--- proposed contract ---\n");
        for (const [i, item] of result.doneWhen.entries()) {
          console.log(`${i + 1}. ${item}`);
        }
        console.log(`\nevidence_how: ${result.evidenceHow}`);
        console.log(`\nmode: ${result.mode}`);
        console.log(`\n${result.modeNotice}`);
        console.log(`\nAccept: cstl goal accept ${goalId}`);
      } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
      }
    });

  goal
    .command("preflight-accept")
    .alias("accept")
    .description("Accept preflight contract and start G1 run state")
    .argument("<goalId>", "Goal id from preflight")
    .option("--json", "Machine-readable output")
    .action(async (goalId: string, opts: { json?: boolean }) => {
      try {
        const state = acceptGoalPreflight({ cwd: process.cwd(), goalId });
        if (opts.json) {
          console.log(JSON.stringify(state, null, 2));
          return;
        }
        console.log(`Accepted ${goalId}; lifecycle=${state.lifecycle}`);
        if (state.task_dir) console.log(`goal-root task: ${state.task_dir}`);
      } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
      }
    });

  goal
    .command("run")
    .description("Run goal loop (mock worker by default)")
    .argument("<goalId>", "Goal id")
    .option("--mock-worker", "Simulate worker turns without IDE/SDK")
    .option("--max-steps <n>", "Max loop steps", "3")
    .option("--json", "Machine-readable final state")
    .action(
      async (
        goalId: string,
        opts: { mockWorker?: boolean; maxSteps?: string; json?: boolean },
      ) => {
        try {
          const state = await runGoalLoop({
            cwd: process.cwd(),
            goalId,
            mockWorker: opts.mockWorker === true,
            maxSteps: Number(opts.maxSteps ?? "3"),
          });
          if (opts.json) {
            console.log(JSON.stringify(state, null, 2));
            return;
          }
          console.log(`goal ${goalId} lifecycle=${state.lifecycle}`);
        } catch (error) {
          console.error(error instanceof Error ? error.message : error);
          process.exitCode = 1;
        }
      },
    );

  goal
    .command("pause")
    .description("Pause goal run")
    .argument("<goalId>", "Goal id")
    .option("--reason <text>", "Pause reason", "user pause")
    .action((goalId: string, opts: { reason?: string }) => {
      try {
        const state = pauseGoal(process.cwd(), goalId, opts.reason ?? "user pause");
        console.log(`paused ${goalId}; lifecycle=${state.lifecycle}`);
      } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
      }
    });

  goal
    .command("status")
    .description("Show goal state")
    .argument("[goalId]", "Goal id (omit to list)")
    .option("--json", "Machine-readable output")
    .action((goalId: string | undefined, opts: { json?: boolean }) => {
      try {
        if (!goalId) {
          const ids = listGoalRuns(process.cwd());
          if (opts.json) {
            console.log(JSON.stringify({ goals: ids }, null, 2));
            return;
          }
          console.log(ids.length ? ids.join("\n") : "(no goal runs)");
          return;
        }
        const state = goalStatus(process.cwd(), goalId);
        if (opts.json) {
          console.log(JSON.stringify(state, null, 2));
          return;
        }
        console.log(JSON.stringify(state, null, 2));
      } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
      }
    });

  goal
    .command("review")
    .description(
      "Review a GoalActionPacket JSON file and emit GoalReviewDecision on stdout.",
    )
    .requiredOption("--packet <file>", "Path to GoalActionPacket JSON")
    .option("--json", "Alias for machine-readable stdout (always JSON)")
    .action(async (opts: { packet: string; json?: boolean }) => {
      const code = await runGoalReviewCommand({
        packet: opts.packet,
        json: opts.json === true,
      });
      process.exitCode = code;
    });
}
