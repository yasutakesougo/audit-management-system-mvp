#!/usr/bin/env node

import fs from "node:fs";

const ISSUE_TITLE = "CI: act(...) warning regression detected";
const ISSUE_MARKER = "<!-- act-warning-regression -->";
const SEARCH_API_BASE = "https://api.github.com";

function printUsage() {
  console.error(
    [
      "Usage:",
      "  node scripts/ci/create-act-warning-issue.mjs --summary <path> [--repo <owner/repo>]",
      "    [--workflow <name>] [--run-url <url>] [--branch <name>] [--sha <sha>]",
    ].join("\n"),
  );
}

function parseArgs(argv) {
  const options = {
    branch: process.env.GITHUB_REF_NAME ?? "",
    repo: process.env.GITHUB_REPOSITORY ?? "",
    runUrl:
      process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
        ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
        : "",
    sha: process.env.GITHUB_SHA ?? "",
    summaryPath: "",
    workflow: process.env.GITHUB_WORKFLOW ?? "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--summary") {
      options.summaryPath = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (arg === "--repo") {
      options.repo = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (arg === "--workflow") {
      options.workflow = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (arg === "--run-url") {
      options.runUrl = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (arg === "--branch") {
      options.branch = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (arg === "--sha") {
      options.sha = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
  }

  return options;
}

function parseRepo(repo) {
  const [owner, name] = repo.split("/");
  if (!owner || !name) return null;
  return { name, owner };
}

function toSortedCounts(countsByFile) {
  return Object.entries(countsByFile ?? {})
    .map(([file, count]) => ({
      count: Number.isFinite(Number(count)) ? Number(count) : 0,
      file,
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.file.localeCompare(b.file);
    });
}

function buildCountsMarkdown(summary) {
  const entries = toSortedCounts(summary.countsByFile);
  if (entries.length === 0) return "- (none)";

  return [
    "| Count | File |",
    "| ---: | --- |",
    ...entries.map((entry) => `| ${entry.count} | \`${entry.file}\` |`),
  ].join("\n");
}

function buildMetadataBlock(meta) {
  const lines = [];
  lines.push(`- detectedAt: \`${new Date().toISOString()}\``);
  lines.push(`- workflow: \`${meta.workflow || "unknown"}\``);
  lines.push(`- run: ${meta.runUrl || "(missing run url)"}`);
  lines.push(`- branch: \`${meta.branch || "unknown"}\``);
  lines.push(`- sha: \`${meta.sha || "unknown"}\``);
  return lines.join("\n");
}

function buildSummaryBlock(summary) {
  return [
    "- totalWarnings: **" + summary.totalWarnings + "**",
    "- affectedFiles: **" + summary.affectedFiles + "**",
    "- maxWarningsFile: **" + (summary.maxWarningsFile ?? "none") + "**",
    "- maxWarningsPerFile: **" + summary.maxWarningsPerFile + "**",
  ].join("\n");
}

function buildIssueBody(summary, meta) {
  return [
    ISSUE_MARKER,
    "",
    "## CI detected `act(...)` warning regression",
    "",
    buildMetadataBlock(meta),
    "",
    "### Summary",
    buildSummaryBlock(summary),
    "",
    "### countsByFile",
    buildCountsMarkdown(summary),
    "",
    "### Response Rule (fixed)",
    "- `1 file = 1 PR`",
    "- `test-only`",
    "- `production code 無変更`",
  ].join("\n");
}

function buildIssueComment(summary, meta) {
  return [
    "## Regression detected again",
    "",
    buildMetadataBlock(meta),
    "",
    "### Summary",
    buildSummaryBlock(summary),
    "",
    "### countsByFile",
    buildCountsMarkdown(summary),
    "",
    "### Response Rule (fixed)",
    "- `1 file = 1 PR`",
    "- `test-only`",
    "- `production code 無変更`",
  ].join("\n");
}

async function githubRequest({ token, method, path, body }) {
  const response = await fetch(`${SEARCH_API_BASE}${path}`, {
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    method,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${method} ${path} failed: ${response.status} ${response.statusText} ${text}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function findOpenIssue({ token, owner, repo }) {
  const query = `repo:${owner}/${repo} is:issue is:open in:title "${ISSUE_TITLE}"`;
  const encoded = encodeURIComponent(query);
  const data = await githubRequest({
    method: "GET",
    path: `/search/issues?q=${encoded}&per_page=10&sort=updated&order=desc`,
    token,
  });

  const exact = (data.items ?? []).find((item) => item.title === ISSUE_TITLE);
  return exact ?? null;
}

async function hasCommentWithRunUrl({ token, owner, repo, issueNumber, runUrl }) {
  if (!runUrl) return false;

  const comments = await githubRequest({
    method: "GET",
    path: `/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100`,
    token,
  });

  return (comments ?? []).some((comment) => typeof comment.body === "string" && comment.body.includes(runUrl));
}

function safeReadJson(path) {
  try {
    const raw = fs.readFileSync(path, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    console.error(`[act-warning-issue] failed to read summary JSON: ${path}`);
    console.error(error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.summaryPath) {
    printUsage();
    process.exit(2);
  }

  if (!fs.existsSync(opts.summaryPath)) {
    console.log(`[act-warning-issue] summary file not found, skipping: ${opts.summaryPath}`);
    process.exit(0);
  }

  const summary = safeReadJson(opts.summaryPath);
  if (!summary) process.exit(0);

  const totalWarnings = Number(summary.totalWarnings ?? 0);
  if (!Number.isFinite(totalWarnings) || totalWarnings <= 0) {
    console.log("[act-warning-issue] totalWarnings is 0, no issue action needed.");
    process.exit(0);
  }

  const repoInfo = parseRepo(opts.repo);
  if (!repoInfo) {
    console.log(`[act-warning-issue] invalid repo value: ${opts.repo}`);
    process.exit(0);
  }

  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    console.log("[act-warning-issue] missing GITHUB_TOKEN/GH_TOKEN, skipping.");
    process.exit(0);
  }

  const meta = {
    branch: opts.branch,
    runUrl: opts.runUrl,
    sha: opts.sha,
    workflow: opts.workflow,
  };

  try {
    const existing = await findOpenIssue({
      owner: repoInfo.owner,
      repo: repoInfo.name,
      token,
    });

    if (!existing) {
      const created = await githubRequest({
        body: {
          body: buildIssueBody(summary, meta),
          title: ISSUE_TITLE,
        },
        method: "POST",
        path: `/repos/${repoInfo.owner}/${repoInfo.name}/issues`,
        token,
      });
      console.log(`[act-warning-issue] created issue #${created.number}: ${created.html_url}`);
      process.exit(0);
    }

    const duplicatedRun = await hasCommentWithRunUrl({
      issueNumber: existing.number,
      owner: repoInfo.owner,
      repo: repoInfo.name,
      runUrl: meta.runUrl,
      token,
    });

    if (duplicatedRun) {
      console.log(
        `[act-warning-issue] existing issue #${existing.number} already has this run URL; skipping comment.`,
      );
      process.exit(0);
    }

    await githubRequest({
      body: {
        body: buildIssueComment(summary, meta),
      },
      method: "POST",
      path: `/repos/${repoInfo.owner}/${repoInfo.name}/issues/${existing.number}/comments`,
      token,
    });
    console.log(`[act-warning-issue] appended comment to issue #${existing.number}: ${existing.html_url}`);
    process.exit(0);
  } catch (error) {
    console.error("[act-warning-issue] GitHub API operation failed; not blocking workflow.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(0);
  }
}

await main();
