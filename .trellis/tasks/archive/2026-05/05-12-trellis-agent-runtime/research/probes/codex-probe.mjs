#!/usr/bin/env node
// Probe: spawn `codex app-server` (default stdio), drive a minimal session.
// Logs every byte from stdout to file.
// Run: node codex-probe.mjs <out-jsonl> "<user prompt>"
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const outPath = process.argv[2] || "codex-probe.out.jsonl";
const prompt = process.argv[3] || "Say hi in 5 words and stop.";

const child = spawn("codex", ["app-server"], { stdio: ["pipe", "pipe", "pipe"] });

const out = fs.createWriteStream(outPath);
const stderrLog = fs.createWriteStream(outPath + ".stderr");

let nextId = 1;
const pending = new Map();
let threadId = null;
let done = false;

let stdoutBuf = "";
child.stdout.on("data", (buf) => {
  out.write(buf);
  stdoutBuf += buf.toString("utf-8");
  let nl;
  while ((nl = stdoutBuf.indexOf("\n")) !== -1) {
    const line = stdoutBuf.slice(0, nl);
    stdoutBuf = stdoutBuf.slice(nl + 1);
    if (!line.trim()) continue;
    handleLine(line);
  }
});
child.stderr.on("data", (buf) => stderrLog.write(buf));
child.on("exit", (code, sig) => {
  out.end();
  stderrLog.end();
  console.error(`[probe] codex exited code=${code} sig=${sig}`);
});

function send(method, params) {
  const id = nextId++;
  const msg = { jsonrpc: "2.0", id, method, params };
  const line = JSON.stringify(msg) + "\n";
  console.error(`[probe] >>> ${method} (id=${id})`);
  child.stdin.write(line);
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
  });
}

function handleLine(line) {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    console.error(`[probe] parse error: ${line.slice(0, 120)}`);
    return;
  }
  // Server-to-client request: has both method AND id
  if (msg.method && msg.id !== undefined) {
    console.error(`[probe] <<< server-request: ${msg.method} (id=${msg.id})`);
    handleServerRequest(msg);
    return;
  }
  // Response to our outgoing request
  if (msg.id !== undefined && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(msg.error);
    else resolve(msg.result);
    return;
  }
  // Notification
  if (msg.method) {
    console.error(`[probe] <<< notification: ${msg.method}`);
    if (msg.method === "turn/completed" || msg.method === "turnCompleted") {
      done = true;
      setTimeout(() => child.stdin.end(), 100);
    }
  }
}

function handleServerRequest(msg) {
  let result;
  if (msg.method === "mcpServer/elicitation/request") {
    result = { action: "accept", content: {} };
  } else {
    // Decline anything else by default
    result = { action: "decline" };
  }
  const reply = { jsonrpc: "2.0", id: msg.id, result };
  child.stdin.write(JSON.stringify(reply) + "\n");
  console.error(`[probe] >>> response (id=${msg.id}) ${JSON.stringify(result).slice(0,80)}`);
}

(async () => {
  try {
    const init = await send("initialize", {
      clientInfo: { name: "trellis-grid-probe", version: "0.1" },
      capabilities: {},
    });
    console.error("[probe] initialize result keys:", Object.keys(init || {}));

    const start = await send("thread/start", {
      cwd: process.cwd(),
      approvalPolicy: "never",
      sandbox: "workspace-write",
    });
    threadId = start?.thread?.id ?? start?.threadId;
    console.error("[probe] thread/start result preview:", JSON.stringify(start)?.slice(0, 300));
    console.error("[probe] threadId =", threadId);

    if (!threadId) {
      console.error("[probe] no threadId from thread/start — abort");
      child.stdin.end();
      return;
    }

    const turn = await send("turn/start", {
      threadId,
      input: [{ type: "text", text: prompt }],
    });
    console.error("[probe] turn/start result:", JSON.stringify(turn)?.slice(0, 200));
  } catch (e) {
    console.error("[probe] rpc error:", JSON.stringify(e).slice(0, 400));
    child.stdin.end();
  }
})();

// safety timeout
setTimeout(() => {
  if (!done) {
    console.error("[probe] safety timeout, ending stdin");
    child.stdin.end();
  }
}, 60_000);
