#!/usr/bin/env node

import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5_000;

const TRANSIENT_PATTERNS = [
  /ERR_STREAM_PREMATURE_CLOSE/,
  /Premature close/i,
  /Failed to fetch GitHub pull request files/i,
  /Failed to fetch pull request diff/i,
  /\/pulls\/[^/\s]+\/commits[\s\S]*(?:Failed to fetch|fetch failed|failure|error)/i,
  /(?:Failed to fetch|fetch failed|failure|error)[\s\S]*\/pulls\/[^/\s]+\/commits/i,
];

export function isTransientDangerFailure(output) {
  return TRANSIENT_PATTERNS.some((pattern) => pattern.test(output));
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function runDangerOnce() {
  return new Promise((resolve) => {
    const child = spawn("npx", ["danger", "ci"], {
      env: process.env,
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";

    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
      output += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
      output += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      const message = error instanceof Error ? error.stack ?? error.message : String(error);
      process.stderr.write(`${message}\n`);
      output += `\n${message}\n`;
      resolve({ code: 1, output });
    });

    child.on("close", (code, signal) => {
      resolve({
        code: code ?? 1,
        output,
        signal,
      });
    });
  });
}

async function main() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    console.log(`[danger-retry] running Danger.js attempt ${attempt}/${MAX_ATTEMPTS}`);
    const result = await runDangerOnce();

    if (result.code === 0) {
      console.log(`[danger-retry] Danger.js passed on attempt ${attempt}/${MAX_ATTEMPTS}`);
      process.exit(0);
    }

    const transient = isTransientDangerFailure(result.output);
    const exitDetail = result.signal ? `signal ${result.signal}` : `exit code ${result.code}`;

    if (!transient) {
      console.error(
        `[danger-retry] non-transient failure detected (${exitDetail}); failing without retry.`,
      );
      process.exit(result.code || 1);
    }

    if (attempt === MAX_ATTEMPTS) {
      console.error(
        `[danger-retry] transient API failure detected (${exitDetail}); retry exhausted after ${MAX_ATTEMPTS} attempts.`,
      );
      process.exit(result.code || 1);
    }

    console.warn(
      `[danger-retry] transient API failure detected (${exitDetail}); retrying in ${RETRY_DELAY_MS / 1000}s.`,
    );
    await wait(RETRY_DELAY_MS);
  }
}

const isDirectRun =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main();
}
