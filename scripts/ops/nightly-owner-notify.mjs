/* eslint-disable no-console -- CLI ops script */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Nightly Owner Notify
 *
 * reasonCodeActions を owner ごとに分配し、Webhook へ通知する。
 *
 * Env:
 * - NIGHTLY_OWNER_WEBHOOKS_JSON: {"Release Owner":"https://...","Platform Owner":"https://..."}
 * - NIGHTLY_OWNER_MENTIONS_JSON: {"Release Owner":"<at>release-owner</at>"}
 * - NOTIFY_WEBHOOK_URL: fallback webhook
 * - NIGHTLY_OWNER_NOTIFY_STRICT: "1" | "true" で unresolved owner があれば exit 1
 * - NIGHTLY_OWNER_NOTIFY_INCLUDE_WARN: "1" | "true" で warn bucket も通知対象
 */

const DEFAULT_DECISION_DIR = path.join(process.cwd(), 'docs', 'nightly-patrol');
const DECISION_FILE_RE = /^decision-(\d{4}-\d{2}-\d{2})\.json$/;
const MAX_LINES_PER_OWNER = 8;
const SEVERITY_EMOJI = {
  watch: '🟡',
  action_required: '🔴',
  blocked: '⛔',
};
const BUCKET_EMOJI = {
  fail: '🔴',
  warn: '🟡',
};

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function toBool(value, fallback = false) {
  if (!isNonEmptyString(value)) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function parseJsonMap(raw, label) {
  if (!isNonEmptyString(raw)) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      console.warn(`[owner-notify] ${label} must be an object map. Ignore.`);
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([k, v]) => isNonEmptyString(k) && isNonEmptyString(v))
        .map(([k, v]) => [k.trim(), v.trim()]),
    );
  } catch (error) {
    console.warn(`[owner-notify] Failed to parse ${label}: ${error instanceof Error ? error.message : error}`);
    return {};
  }
}

function sanitizeReasonAction(bucket, entry) {
  if (!entry || typeof entry !== 'object') return null;
  const row = /** @type {Record<string, unknown>} */ (entry);
  const code = isNonEmptyString(row.code) ? row.code.trim() : '';
  const owner = isNonEmptyString(row.owner) ? row.owner.trim() : '';
  const severity = isNonEmptyString(row.severity) ? row.severity.trim() : '';
  const firstAction = isNonEmptyString(row.firstAction) ? row.firstAction.trim() : '';
  const runbookLink = isNonEmptyString(row.runbookLink) ? row.runbookLink.trim() : '';
  if (!code || !owner || !severity || !firstAction || !runbookLink) return null;
  return { bucket, code, owner, severity, firstAction, runbookLink };
}

export function collectOwnerActions(decisionJson, options = {}) {
  const includeWarn = options.includeWarn === true;
  const fail = Array.isArray(decisionJson?.runbook?.reasonCodeActions?.fail)
    ? decisionJson.runbook.reasonCodeActions.fail
    : [];
  const warn = Array.isArray(decisionJson?.runbook?.reasonCodeActions?.warn)
    ? decisionJson.runbook.reasonCodeActions.warn
    : [];
  const rows = [
    ...fail.map((entry) => sanitizeReasonAction('fail', entry)),
    ...(includeWarn ? warn.map((entry) => sanitizeReasonAction('warn', entry)) : []),
  ].filter((entry) => Boolean(entry));

  /** @type {Record<string, Array<{bucket:string, code:string, owner:string, severity:string, firstAction:string, runbookLink:string}>>} */
  const grouped = {};
  for (const row of rows) {
    const key = row.owner;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(row);
  }

  return grouped;
}

function parseArgs(argv) {
  const options = {
    decisionPath: '',
    dryRun: false,
    includeWarn: undefined,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--decision' && isNonEmptyString(argv[i + 1])) {
      options.decisionPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--include-warn') {
      options.includeWarn = true;
      continue;
    }
  }
  return options;
}

function pickLatestDecisionPath() {
  if (!fs.existsSync(DEFAULT_DECISION_DIR)) return null;
  const entries = fs.readdirSync(DEFAULT_DECISION_DIR, { withFileTypes: true });
  const latest = entries
    .filter((entry) => entry.isFile() && DECISION_FILE_RE.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a))[0];
  if (!latest) return null;
  return path.join(DEFAULT_DECISION_DIR, latest);
}

function normalizeRepoBaseUrl(repoOptions = {}) {
  const server = isNonEmptyString(repoOptions.serverUrl)
    ? repoOptions.serverUrl.trim()
    : isNonEmptyString(process.env.GITHUB_SERVER_URL)
      ? process.env.GITHUB_SERVER_URL.trim()
      : '';
  const repository = isNonEmptyString(repoOptions.repository)
    ? repoOptions.repository.trim()
    : isNonEmptyString(process.env.GITHUB_REPOSITORY)
      ? process.env.GITHUB_REPOSITORY.trim()
      : '';
  const refName = isNonEmptyString(repoOptions.refName)
    ? repoOptions.refName.trim()
    : isNonEmptyString(process.env.GITHUB_REF_NAME)
      ? process.env.GITHUB_REF_NAME.trim()
      : 'main';
  if (!server || !repository) return '';
  return `${server}/${repository}/blob/${refName}`;
}

export function formatRunbookLink(rawLink, repoOptions = {}) {
  if (!isNonEmptyString(rawLink)) return '';
  const link = rawLink.trim();
  if (link.startsWith('http://') || link.startsWith('https://')) return link;
  if (link.startsWith('#')) return link;

  const base = normalizeRepoBaseUrl(repoOptions);
  if (!base) return link;

  const [filePart, anchorPart] = link.split('#');
  const normalizedFile = filePart.replace(/^\.?\//, '');
  return `${base}/${normalizedFile}${anchorPart ? `#${anchorPart}` : ''}`;
}

export function buildOwnerMessage({ owner, mention, decision, actions, repoOptions = {} }) {
  const header = [
    '🚨 Nightly Patrol Owner Route',
    `- Date: ${decision.date || 'unknown'}`,
    `- Verdict: ${decision.final?.line || decision.final?.label || 'unknown'}`,
    `- Owner: ${owner}`,
  ];
  if (mention) {
    header.push(`- Mention: ${mention}`);
  }

  // Inject Purge Status if available
  const purgeStatus = process.env.PURGE_STATUS;
  const purgeReason = process.env.PURGE_REASON;
  if (purgeStatus && purgeStatus !== 'no_candidates') {
    const purgeEmoji = {
      auto_confirmed: '✅',
      manual_required: '✋',
      blocked: '⛔',
    }[purgeStatus] || '⚪';
    
    header.push('');
    header.push(`### 🛡️ Guardian Purge Status: ${purgeEmoji} ${purgeStatus.toUpperCase()}`);
    header.push(`- Reason: ${purgeReason || 'No reason provided'}`);
  }

  const displayedActions = actions.slice(0, MAX_LINES_PER_OWNER);
  const body = displayedActions.flatMap((action, index) => {
    const severityEmoji = SEVERITY_EMOJI[action.severity] || '⚪';
    const bucketEmoji = BUCKET_EMOJI[action.bucket] || '⚪';
    const runbookLink = formatRunbookLink(action.runbookLink, repoOptions);
    return [
      `### Action ${index + 1}/${displayedActions.length}`,
      `- Reason Code: \`${action.code}\``,
      `- Bucket: ${bucketEmoji} ${action.bucket}`,
      `- Severity: ${severityEmoji} ${action.severity}`,
      `- First Action: ${action.firstAction}`,
      `- Runbook: ${runbookLink}`,
      '',
    ];
  });
  if (actions.length > MAX_LINES_PER_OWNER) {
    body.push(`- ... and ${actions.length - MAX_LINES_PER_OWNER} more`);
  }

  return [...header, '', ...body].join('\n').trim();
}

async function postWebhook(url, text) {
  if (!isNonEmptyString(url)) {
    throw new Error('webhook URL is empty');
  }
  if (!url.startsWith('https://')) {
    throw new Error('only HTTPS webhooks are supported');
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    throw new Error(`webhook failed: ${response.status} ${response.statusText}${raw ? ` / ${raw}` : ''}`);
  }
}

export function buildOwnerRoutes(groupedActions, routes, fallbackWebhook) {
  /** @type {Array<{owner:string, webhook:string, actions:Array<{bucket:string, code:string, owner:string, severity:string, firstAction:string, runbookLink:string}>}>} */
  const deliveries = [];
  /** @type {string[]} */
  const unresolvedOwners = [];

  for (const [owner, actions] of Object.entries(groupedActions)) {
    const webhook = routes[owner] || fallbackWebhook || '';
    if (!isNonEmptyString(webhook)) {
      unresolvedOwners.push(owner);
      continue;
    }
    deliveries.push({ owner, webhook, actions });
  }

  return { deliveries, unresolvedOwners };
}

export async function runOwnerNotify(options = {}) {
  const includeWarn = options.includeWarn === true;
  const dryRun = options.dryRun === true;
  const strict = options.strict === true;
  const ownerWebhooks = options.ownerWebhooks || {};
  const ownerMentions = options.ownerMentions || {};
  const fallbackWebhook = options.fallbackWebhook || '';
  const repoOptions = options.repoOptions || {};
  const decisionPath = options.decisionPath || pickLatestDecisionPath();

  if (!decisionPath) {
    console.log('[owner-notify] decision file not found. Skip.');
    return { sent: 0, unresolvedOwners: [], failedOwners: [], deliveries: 0, skipped: true };
  }

  const decision = JSON.parse(fs.readFileSync(decisionPath, 'utf8'));
  const grouped = collectOwnerActions(decision, { includeWarn });
  const ownerCount = Object.keys(grouped).length;
  if (ownerCount === 0) {
    console.log('[owner-notify] no owner actions. Skip.');
    return { sent: 0, unresolvedOwners: [], failedOwners: [], deliveries: 0, skipped: true };
  }

  const { deliveries, unresolvedOwners } = buildOwnerRoutes(grouped, ownerWebhooks, fallbackWebhook);
  let sent = 0;
  /** @type {string[]} */
  const failedOwners = [];
  for (const route of deliveries) {
    const mention = ownerMentions[route.owner] || '';
    const text = buildOwnerMessage({
      owner: route.owner,
      mention,
      decision,
      actions: route.actions,
      repoOptions,
    });

    if (dryRun) {
      console.log(`[owner-notify][dry-run] owner=${route.owner} webhook=${route.webhook}`);
      console.log(text);
      continue;
    }

    try {
      await postWebhook(route.webhook, text);
      sent += 1;
      console.log(`[owner-notify] sent owner route: ${route.owner}`);
    } catch (error) {
      failedOwners.push(route.owner);
      console.warn(`[owner-notify] failed owner route: ${route.owner} (${error instanceof Error ? error.message : error})`);
    }
  }

  if (unresolvedOwners.length > 0) {
    console.warn(`[owner-notify] unresolved owner routes: ${unresolvedOwners.join(', ')}`);
  }

  const blockingOwners = [...unresolvedOwners, ...failedOwners];
  if (strict && blockingOwners.length > 0) {
    throw new Error(`owner routes unresolved: ${blockingOwners.join(', ')}`);
  }

  return {
    sent,
    unresolvedOwners,
    failedOwners,
    deliveries: deliveries.length,
    skipped: false,
  };
}

async function main() {
  const cli = parseArgs(process.argv.slice(2));
  const includeWarn = cli.includeWarn ?? toBool(process.env.NIGHTLY_OWNER_NOTIFY_INCLUDE_WARN, false);
  const strict = toBool(process.env.NIGHTLY_OWNER_NOTIFY_STRICT, false);
  const ownerWebhooks = parseJsonMap(process.env.NIGHTLY_OWNER_WEBHOOKS_JSON, 'NIGHTLY_OWNER_WEBHOOKS_JSON');
  const ownerMentions = parseJsonMap(process.env.NIGHTLY_OWNER_MENTIONS_JSON, 'NIGHTLY_OWNER_MENTIONS_JSON');
  const fallbackWebhook = isNonEmptyString(process.env.NOTIFY_WEBHOOK_URL)
    ? process.env.NOTIFY_WEBHOOK_URL.trim()
    : '';

  const result = await runOwnerNotify({
    decisionPath: cli.decisionPath,
    includeWarn,
    dryRun: cli.dryRun,
    strict,
    ownerWebhooks,
    ownerMentions,
    fallbackWebhook,
    repoOptions: {
      serverUrl: process.env.GITHUB_SERVER_URL,
      repository: process.env.GITHUB_REPOSITORY,
      refName: process.env.GITHUB_REF_NAME,
    },
  });

  console.log(
    `[owner-notify] done: deliveries=${result.deliveries}, sent=${result.sent}, unresolved=${result.unresolvedOwners.length}, failed=${result.failedOwners.length}`,
  );
}

const entryHref = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === entryHref) {
  main().catch((error) => {
    console.error(`[owner-notify] failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  });
}
