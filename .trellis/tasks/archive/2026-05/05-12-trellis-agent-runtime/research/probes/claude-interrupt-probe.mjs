#!/usr/bin/env node
// Probe: spawn claude stream-json, send a long task, then mid-stream
// send {type:"control_request",subtype:"interrupt"} and see what happens.
import { spawn } from "node:child_process";
import fs from "node:fs";

const outPath = process.argv[2] || "claude-interrupt.out.jsonl";
const prompt =
  process.argv[3] ||
  "Count slowly from 1 to 100, one per line. Take your time.";

const args = [
  "-p",
  "--input-format",
  "stream-json",
  "--output-format",
  "stream-json",
  "--permission-mode",
  "bypassPermissions",
  "--dangerously-skip-permissions",
  "--verbose",
];

const child = spawn("claude", args, { stdio: ["pipe", "pipe", "pipe"] });

const out = fs.createWriteStream(outPath);
child.stdout.on("data", (b) => out.write(b));
child.stderr.on("data", (b) => process.stderr.write(b));
child.on("exit", (code, sig) => {
  out.end();
  console.error(`[probe] claude exited code=${code} sig=${sig}`);
});

// Send the initial user message
const userMsg =
  JSON.stringify({
    type: "user",
    message: { role: "user", content: [{ type: "text", text: prompt }] },
  }) + "\n";
console.error("[probe] >>> user message");
child.stdin.write(userMsg);

// After 3s, send an interrupt control_request
setTimeout(() => {
  const req =
    JSON.stringify({
      type: "control_request",
      request_id: "trellis-int-1",
      request: { subtype: "interrupt" },
    }) + "\n";
  console.error("[probe] >>> control_request interrupt");
  child.stdin.write(req);
}, 3000);

// Then 1s later, send a follow-up user message
setTimeout(() => {
  const followup =
    JSON.stringify({
      type: "user",
      message: {
        role: "user",
        content: [
          {
            type: "text",
            text: "After the interrupt, just say SWITCHED in one word and stop.",
          },
        ],
      },
    }) + "\n";
  console.error("[probe] >>> follow-up user message");
  child.stdin.write(followup);
}, 4000);

// Safety timeout: end stdin after 30s
setTimeout(() => {
  console.error("[probe] safety timeout");
  child.stdin.end();
}, 30000);
