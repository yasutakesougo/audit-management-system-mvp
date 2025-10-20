#!/usr/bin/env node

import { spawnSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const log = (...args) => console.log('[pact:can-i-deploy]', ...args);
const warn = (...args) => console.warn('[pact:can-i-deploy]', ...args);
const error = (...args) => console.error('[pact:can-i-deploy]', ...args);

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

const pacticipant =
  process.env.PACT_PACTICIPANT ||
  process.env.PACT_PROVIDER_NAME ||
  process.env.PACT_CONSUMER_NAME ||
  pkg.name ||
  'unknown-service';
const applicationVersion =
  process.env.PACT_APP_VERSION ||
  process.env.PACT_PROVIDER_VERSION ||
  process.env.GITHUB_SHA ||
  detectGitValue('git rev-parse HEAD', `local-${Date.now()}`);
const toEnvironment =
  process.env.PACT_ENV ||
  process.env.PACT_TO_ENVIRONMENT ||
  process.env.PACT_TARGET_ENVIRONMENT;

if (!toEnvironment) {
  error('PACT_ENV (or PACT_TO_ENVIRONMENT / PACT_TARGET_ENVIRONMENT) must be set to run can-i-deploy.');
  process.exit(1);
}

const fromEnvironment =
  process.env.PACT_FROM_ENVIRONMENT ||
  process.env.PACT_SOURCE_ENVIRONMENT ||
  null;

const outputFormat = process.env.PACT_CAN_I_DEPLOY_OUTPUT || 'table';
const retryWhileUnknown = process.env.PACT_CAN_I_DEPLOY_RETRY ?? '12';
const retryInterval = process.env.PACT_CAN_I_DEPLOY_RETRY_INTERVAL ?? '10';

const args = [
  'can-i-deploy',
  '--pacticipant',
  pacticipant,
  '--version',
  applicationVersion,
  '--to-environment',
  toEnvironment,
  '--broker-base-url',
  brokerBaseUrl,
  '--broker-token',
  brokerToken,
  '--retry-while-unknown',
  String(retryWhileUnknown),
  '--retry-interval',
  String(retryInterval),
  '--output',
  outputFormat,
];

if (fromEnvironment) {
  warn('PACT_FROM_ENVIRONMENT is set but the Pact CLI does not support --from-environment. Value will be surfaced in the summary only.');
}

if (process.env.PACT_BRANCH) {
  args.push('--branch', process.env.PACT_BRANCH);
}

if (process.env.PACT_IGNORE_WIP === 'true') {
  args.push('--ignore', 'wip_pacts');
}

if (process.env.GITHUB_RUN_ID && process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY) {
  args.push('--build-url', `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`);
}

log(`Checking can-i-deploy for ${pacticipant}@${applicationVersion} → ${toEnvironment}${fromEnvironment ? ` (from ${fromEnvironment})` : ''}.`);
log(`Broker: ${brokerBaseUrl}`);

const resolveCli = () => {
  if (process.env.PACT_BROKER_CLI) {
    return {
      command: process.env.PACT_BROKER_CLI,
      args,
    };
  }
  const localCli = path.resolve(process.cwd(), 'node_modules', '.bin', 'pact-broker');
  if (fs.existsSync(localCli)) {
    return { command: localCli, args };
  }
  const cliPackage = process.env.PACT_CLI_PACKAGE || '@pact-foundation/pact-cli';
  return {
    command: 'npx',
    args: ['--yes', '--package', cliPackage, 'pact-broker', ...args],
  };
};

const { command, args: cliArgs } = resolveCli();

const result = spawnSync(command, cliArgs, {
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
  log('can-i-deploy check passed.');
  process.exit(0);
}

const allowOnFailure = process.env.PACT_CAN_I_DEPLOY_ALLOW_BROKER_FAILURE === 'true';
const networkFailure =
  result.error ||
  /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ECONNRESET|EAI_AGAIN|network/i.test(result.stderr || '');

if (allowOnFailure && networkFailure) {
  warn('Broker unreachable, but continuing due to PACT_CAN_I_DEPLOY_ALLOW_BROKER_FAILURE=true.');
  process.exit(0);
}

error('can-i-deploy check failed.');
process.exit(result.status ?? 1);
