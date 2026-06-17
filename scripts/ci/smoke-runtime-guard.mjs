#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";

const BOOTSTRAP_PATTERNS = [/a\.jsxDEV is not a function/i, /a\.jsxDEV/i, /jsxDEV is not a function/i];

const ASSET_PATTERNS = [/^index-[^/\\]+\.js$/i, /^app-[^/\\]+\.js$/i];

function parseArgs(argv) {
  const options = {
    baseUrl: "http://127.0.0.1:5173",
    distDir: "dist",
    logDir: "logs/runtime-guard",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--base-url") {
      options.baseUrl = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--dist-dir") {
      options.distDir = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--log-dir") {
      options.logDir = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log(`Usage: node scripts/ci/smoke-runtime-guard.mjs [options]
  --base-url http://127.0.0.1:5173
  --dist-dir dist
  --log-dir logs/runtime-guard`);
      process.exit(0);
    }
  }

  return options;
}

function collectPackageVersions(dependency, node, seen = new Set(), versions = new Set()) {
  if (!node || typeof node !== "object" || seen.has(node)) {
    return versions;
  }
  seen.add(node);
  if (node.name === dependency && node.version) {
    versions.add(node.version);
  }
  if (node.dependencies) {
    for (const dep of Object.values(node.dependencies)) {
      collectPackageVersions(dependency, dep, seen, versions);
    }
  }
  return versions;
}

function writeJSON(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function detectJsxDevInAssets(distDir, patterns) {
  const assetsDir = path.join(distDir, "assets");
  const entries = fs.readdirSync(assetsDir);
  const indexFiles = entries.filter((file) => ASSET_PATTERNS[0].test(file));
  const appFiles = entries.filter((file) => ASSET_PATTERNS[1].test(file));

  if (indexFiles.length === 0) {
    throw new Error("No dist/assets/index-*.js file found.");
  }
  if (appFiles.length === 0) {
    throw new Error("No dist/assets/App-*.js file found.");
  }

  const files = [...indexFiles, ...appFiles];
  const report = [];
  const hits = [];

  for (const file of files) {
    const filePath = path.join(assetsDir, file);
    const source = fs.readFileSync(filePath, "utf8");
    const lines = source.split("\n");
    let hasHit = false;
    for (let index = 0; index < lines.length; index += 1) {
      if (patterns.some((pattern) => pattern.test(lines[index]))) {
        hits.push({
          file,
          line: index + 1,
          text: lines[index].slice(0, 200),
        });
        hasHit = true;
      }
    }
    report.push({ file, size: source.length, matched: hasHit, matchedLines: hits.filter((hit) => hit.file === file).length });
  }

  return { files: files.length, report, hits };
}

function runDependencyCheck() {
  const command = [
    "npm",
    ["ls", "react", "react-dom", "@vitejs/plugin-react", "vite", "--json", "--depth", "10"],
    { encoding: "utf8", cwd: process.cwd() },
  ];
  const result = spawnSync(...command);
  if (!result.stdout) {
    throw new Error("npm ls failed to output JSON");
  }
  const tree = JSON.parse(result.stdout);
  const resultPackages = ["react", "react-dom", "@vitejs/plugin-react", "vite"].map((dep) => ({
    dependency: dep,
    versions: Array.from(collectPackageVersions(dep, tree)).sort(),
  }));

  const failures = resultPackages.filter((item) => item.versions.length === 0);
  const conflicts = resultPackages.filter((item) => item.versions.length > 1);

  if (failures.length > 0) {
    throw new Error(`Missing dependency resolution for: ${failures.map((item) => item.dependency).join(", ")}`);
  }

  return { raw: result.stdout, packages: resultPackages, status: { failures, conflicts } };
}

async function runBrowserGuard(baseUrl, logDir) {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const markers = {
    pageError: [],
    consoleError: [],
    bootstrapHits: [],
    requestFailed: [],
  };

  page.on("pageerror", (error) => {
    const message = `${error?.message ?? String(error)}`;
    const stack = error?.stack;
    markers.pageError.push(message);
    if (stack) {
      markers.pageError.push(stack);
    }
  });
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error") {
      markers.consoleError.push(text);
    }
  });
  page.on("requestfailed", (request) => {
    const resourceType = request.resourceType();
    const url = request.url();
    if (resourceType === "script" || resourceType === "document" || resourceType === "xhr") {
      markers.requestFailed.push(`${resourceType} ${url} failed`);
    }
  });

  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(2000);
    await page.goto(`${baseUrl}/checklist`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(1000);
  } catch (error) {
    markers.pageError.push(`navigation failure: ${error?.message ?? String(error)}`);
  }

  markers.bootstrapHits = [
    ...markers.pageError,
    ...markers.consoleError,
  ].filter((entry) => BOOTSTRAP_PATTERNS.some((pattern) => pattern.test(entry)));

  const logs = {
    bootstrapHits: markers.bootstrapHits,
    pageError: markers.pageError,
    consoleError: markers.consoleError,
    requestFailed: markers.requestFailed,
    finalUrl: page.url(),
  };

  writeJSON(path.join(logDir, "smoke-runtime-browser.json"), logs);

  await browser.close();
  return logs;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  fs.mkdirSync(options.logDir, { recursive: true });
  const reports = {
    packageResolution: null,
    assetScan: null,
    browserBootstrap: null,
  };
  let failed = false;

  try {
    const deps = runDependencyCheck();
    reports.packageResolution = deps;
    writeJSON(path.join(options.logDir, "dependency-resolution.json"), deps);
    if (deps.status.conflicts.length > 0) {
      failed = true;
      console.error("[runtime-guard] multiple versions detected for dependency resolutions", deps.status.conflicts);
    }
  } catch (error) {
    failed = true;
    console.error(`[runtime-guard] dependency check failed: ${error.message}`);
    reports.packageResolution = { error: error.message };
  }

  try {
    const scan = detectJsxDevInAssets(options.distDir, BOOTSTRAP_PATTERNS);
    reports.assetScan = scan;
    writeJSON(path.join(options.logDir, "asset-scan.json"), scan);
    if (scan.hits.length > 0) {
      failed = true;
      console.error("[runtime-guard] jsxDEV-like token detected in dist assets", scan.hits);
    }
  } catch (error) {
    failed = true;
    console.error(`[runtime-guard] asset scan failed: ${error.message}`);
    reports.assetScan = { error: error.message };
  }

  try {
    const browserLogs = await runBrowserGuard(options.baseUrl, options.logDir);
    reports.browserBootstrap = browserLogs;
    if (browserLogs.bootstrapHits.length > 0) {
      failed = true;
      console.error("[runtime-guard] bootstrap log contains jsxDEV-like errors", browserLogs.bootstrapHits);
    }
  } catch (error) {
    failed = true;
    console.error(`[runtime-guard] browser smoke failed: ${error.message}`);
    reports.browserBootstrap = { error: error.message };
  }

  if (failed) {
    writeJSON(path.join(options.logDir, "smoke-runtime-guard-summary.json"), {
      status: "failed",
      ...reports,
    });
    console.error("[runtime-guard] failure detected; aborting before full E2E run.");
    process.exit(1);
  }

  writeJSON(path.join(options.logDir, "smoke-runtime-guard-summary.json"), { status: "passed", ...reports });
  console.log("[runtime-guard] all checks passed.");
}

main().catch((error) => {
  console.error(`[runtime-guard] unexpected failure: ${error.message}`);
  process.exit(1);
});
