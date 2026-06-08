#!/usr/bin/env node
// Probe: spawn `claude -p --input-format stream-json --output-format stream-json`
// Send ONE user message via stdin, log every stdout line to file.
// Run: node claude-probe.mjs <out-jsonl> "<user prompt>"
import { spawn } from "node:child_process";
import fs from "node:fs";

const outPath = process.argv[2] || "claude-probe.out.jsonl";
const prompt = process.argv[3] || "Say hi in 5 words and stop.";

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
const stderrLog = fs.createWriteStream(outPath + ".stderr");

child.stdout.on("data", (buf) => out.write(buf));
child.stderr.on("data", (buf) => stderrLog.write(buf));
child.on("exit", (code, sig) => {
  out.end();
  stderrLog.end();
  console.error(`[probe] claude exited code=${code} sig=${sig}`);
});

const userMsg =
  JSON.stringify({
    type: "user",
    message: { role: "user", content: [{ type: "text", text: prompt }] },
  }) + "\n";

console.error(`[probe] writing user message (${userMsg.length} bytes)`);
child.stdin.write(userMsg);

// Close stdin so claude knows no more input is coming.
// (Some Claude SDK modes wait for stdin EOF before processing.)
child.stdin.end();
