#!/usr/bin/env node

import { spawnSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const log = (...args) => console.log('[pact:publish]', ...args);
const warn = (...args) => console.warn('[pact:publish]', ...args);
const error = (...args) => console.error('[pact:publish]', ...args);

const defaultDirectories = [
  process.env.PACT_PUBLISH_DIR,
  'contracts/pacts',
  'pacts',
].filter(Boolean);

const collectPactFiles = (directory) => {
  const results = [];
  if (!directory) {
    return results;
  }
  const absolute = path.resolve(process.cwd(), directory);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isDirectory()) {
    return results;
  }
  const entries = fs.readdirSync(absolute, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(absolute, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectPactFiles(entryPath));
    } else if (entry.isFile() && /\.(json|pact)$/i.test(entry.name)) {
      results.push(entryPath);
    }
  }
  return results;
};

const pactFiles = [];
let publishDirectory = null;
for (const candidate of defaultDirectories) {
  const files = collectPactFiles(candidate);
  if (files.length > 0) {
    pactFiles.push(...files);
    publishDirectory = path.resolve(process.cwd(), candidate);
    break;
  }
}

if (pactFiles.length === 0 || !publishDirectory) {
  log('No pact files found. Skipping publish step.');
  process.exit(0);
}

const brokerBaseUrl = process.env.PACT_BROKER_BASE_URL;
const brokerToken = process.env.PACT_BROKER_TOKEN;

if (!brokerBaseUrl || !brokerToken) {
  error('PACT_BROKER_BASE_URL and PACT_BROKER_TOKEN must be set.');
  process.exit(1);
}

const detectGitValue = (command, fallback) => {
  try {
    const value = execSync(command, { encoding: 'utf8' }).trim();
    return value || fallback;
  } catch {
    return fallback;
  }
};

const participant =
  process.env.PACT_PACTICIPANT ||
  process.env.PACT_CONSUMER_NAME ||
  pkg.name ||
  'unknown-service';
const appVersion =
  process.env.PACT_APP_VERSION ||
  process.env.PACT_CONSUMER_VERSION ||
  process.env.GITHUB_SHA ||
  detectGitValue('git rev-parse HEAD', `local-${Date.now()}`);
const branch =
  process.env.PACT_BRANCH ||
  process.env.GITHUB_REF_NAME ||
  detectGitValue('git rev-parse --abbrev-ref HEAD', 'main');
const envTag = process.env.PACT_ENV ? `env:${process.env.PACT_ENV}` : null;
const additionalTags = (process.env.PACT_ADDITIONAL_TAGS || '')
  .split(',')
  .map((tag) => tag.trim())
  .filter(Boolean);

const tags = new Set([
  `service:${participant}`,
  `branch:${branch}`,
  envTag,
  ...additionalTags,
]);

const publishArgs = [
  'publish',
  publishDirectory,
  '--consumer-app-version',
  appVersion,
  '--branch',
  branch,
  '--broker-base-url',
  brokerBaseUrl,
  '--broker-token',
  brokerToken,
  '--retry-while-unknown=6',
  '--retry-interval=10',
];

for (const tag of tags) {
  if (tag) {
    publishArgs.push('--tag', tag);
  }
}

if (process.env.GITHUB_RUN_ID && process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY) {
  publishArgs.push('--build-url', `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`);
}

log(`Publishing ${pactFiles.length} pact file(s) as ${participant}@${appVersion} (branch ${branch}).`);
log(`Broker: ${brokerBaseUrl}`);
if (envTag) {
  log(`Environment tag: ${envTag}`);
}

const pactBrokerCli = () => {
  if (process.env.PACT_BROKER_CLI) {
    return {
      command: process.env.PACT_BROKER_CLI,
      args: publishArgs,
    };
  }
  const localCli = path.resolve(process.cwd(), 'node_modules', '.bin', 'pact-broker');
  if (fs.existsSync(localCli)) {
    return { command: localCli, args: publishArgs };
  }
  const cliPackage = process.env.PACT_CLI_PACKAGE || '@pact-foundation/pact-cli';
  return {
    command: 'npx',
    args: ['--yes', '--package', cliPackage, 'pact-broker', ...publishArgs],
  };
};

const { command, args } = pactBrokerCli();

const result = spawnSync(command, args, {
  cwd: process.cwd(),
  env: process.env,
  encoding: 'utf8',
});

if (result.stdout) {
  process.stdout.write(result.stdout);
}
if (result.stderr) {
  process.stderr.write(result.stderr);
}

if (result.status === 0) {
  log('Pact publish completed.');
  process.exit(0);
}

const allowOnFailure = process.env.PACT_ALLOW_PUBLISH_ON_BROKER_FAILURE === 'true';
const networkFailure =
  result.error ||
  /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ECONNRESET|EAI_AGAIN|network/i.test(result.stderr || '');

if (allowOnFailure && networkFailure) {
  warn('Broker unreachable, but continuing due to PACT_ALLOW_PUBLISH_ON_BROKER_FAILURE=true.');
  process.exit(0);
}

error('Pact publish failed.');
process.exit(result.status ?? 1);
