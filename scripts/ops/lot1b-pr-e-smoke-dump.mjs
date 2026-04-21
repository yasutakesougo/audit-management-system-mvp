#!/usr/bin/env node
/* eslint-disable no-console */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const LIST_BENEFIT = 'UserBenefit_Profile';
const LIST_BENEFIT_EXT = 'UserBenefit_Profile_Ext';
const STAGE_ENV_KEY = 'VITE_USER_BENEFIT_PROFILE_CUTOVER_STAGE';

const BENEFIT_FIELDS = [
  'Id',
  'UserID',
  'GrantMunicipality',
  'Grant_x0020_Municipality',
  'GrantPeriodStart',
  'Grant_x0020_Period_x0020_Start',
  'GrantPeriodEnd',
  'Grant_x0020_Period_x0020_End',
  'MealAddition',
  'Meal_x0020_Addition',
  'UserCopayLimit',
  'User_x0020_Copay_x0020_Limit',
  'CopayPaymentMethod',
  'Copay_x0020_Payment_x0020_Method',
  'RecipientCertExpiry',
  'Modified',
];

const BENEFIT_EXT_FIELDS = [
  'Id',
  'UserID',
  'RecipientCertNumber',
  'Recipient_x0020_Cert_x0020_Numbe',
  'Modified',
];

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(`--${name}`);
const getFlagValue = (name, fallback = null) => {
  const prefix = `--${name}=`;
  const inline = args.find((a) => a.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const idx = args.indexOf(`--${name}`);
  if (idx >= 0 && idx + 1 < args.length && !args[idx + 1].startsWith('--')) return args[idx + 1];
  return fallback;
};

const dateStamp = new Date().toISOString().slice(0, 10);
const siteUrl = (process.env.VITE_SP_SITE_URL || process.env.SP_SITE_URL || '').trim();
const explicitOut = getFlagValue('out');
const defaultOut = `docs/nightly-patrol/lot1b-pr-e-staging-smoke-evidence-${dateStamp}.json`;
const outPath = resolve(process.cwd(), explicitOut || defaultOut);

const userId = getFlagValue('user-id');
const step = getFlagValue('step', 'UNSPECIFIED');
const stage = getFlagValue('stage', process.env[STAGE_ENV_KEY] || 'UNSPECIFIED');
const timing = getFlagValue('timing', 'after');
const judgement = getFlagValue('judgement', 'PENDING');

if (hasFlag('help') || !userId) {
  console.log('Usage:');
  console.log('  node scripts/ops/lot1b-pr-e-smoke-dump.mjs --user-id TEST-CUTOVER-001 --stage DUAL_WRITE --step B1');
  console.log('Optional:');
  console.log('  --out <path>      output JSON path (default: docs/nightly-patrol/lot1b-pr-e-staging-smoke-evidence-YYYY-MM-DD.json)');
  console.log('  --record-id <id>  manual record id used in UI/repository logs');
  console.log('  --timing <before|after>  mark capture timing per step');
  console.log('  --judgement <PASS|WARN|PENDING>  quick decision tag');
  process.exit(userId ? 0 : 2);
}

if (!siteUrl) {
  console.error('Missing site URL. Set VITE_SP_SITE_URL or SP_SITE_URL.');
  process.exit(2);
}

function readToken() {
  const envToken = (process.env.VITE_SP_TOKEN || process.env.SMOKE_TEST_BEARER_TOKEN || '').trim();
  if (envToken) return envToken;

  const tokenFile = join(process.cwd(), '.token.local');
  if (existsSync(tokenFile)) {
    return readFileSync(tokenFile, 'utf-8').trim();
  }
  return '';
}

const token = readToken();
if (!token) {
  console.error('Missing bearer token. Set VITE_SP_TOKEN/SMOKE_TEST_BEARER_TOKEN or provide .token.local.');
  process.exit(2);
}

function escapeODataString(value) {
  return String(value).replace(/'/g, "''");
}

async function fetchByUserId(listTitle, fields, targetUserId) {
  const params = new URLSearchParams();
  params.set('$select', fields.join(','));
  params.set('$filter', `UserID eq '${escapeODataString(targetUserId)}'`);
  params.set('$top', '1');

  const url = `${siteUrl}/_api/web/lists/getbytitle('${encodeURIComponent(listTitle)}')/items?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json;odata=nometadata',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${listTitle}: HTTP ${res.status} ${res.statusText} :: ${body.slice(0, 400)}`);
  }

  const json = await res.json();
  return Array.isArray(json?.value) ? json.value[0] || null : null;
}

function toObjectOrNull(value) {
  return value && typeof value === 'object' ? value : null;
}

function loadEvidenceFile(path) {
  if (!existsSync(path)) {
    return { version: 1, createdAt: new Date().toISOString(), records: [] };
  }
  const parsed = JSON.parse(readFileSync(path, 'utf-8'));
  if (!Array.isArray(parsed?.records)) parsed.records = [];
  return parsed;
}

(async () => {
  const benefitRow = await fetchByUserId(LIST_BENEFIT, BENEFIT_FIELDS, userId);
  const benefitExtRow = await fetchByUserId(LIST_BENEFIT_EXT, BENEFIT_EXT_FIELDS, userId).catch(() => null);

  const evidence = loadEvidenceFile(outPath);
  const record = {
    capturedAt: new Date().toISOString(),
    step,
    stage,
    timing,
    env: {
      [STAGE_ENV_KEY]: stage,
      VITE_SP_SITE_URL: siteUrl,
    },
    userId,
    recordId: getFlagValue('record-id', ''),
    sharepoint_raw: {
      userBenefitProfile: toObjectOrNull(benefitRow),
      userBenefitProfileExt: toObjectOrNull(benefitExtRow),
    },
    repository_read: null,
    ui_readback: null,
    verdict: 'PENDING',
    judgement,
    notes: [],
  };

  evidence.records.push(record);
  evidence.updatedAt = new Date().toISOString();

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf-8');

  console.log(`[lot1b-pr-e-smoke-dump] appended step=${step} stage=${stage} userId=${userId}`);
  console.log(`[lot1b-pr-e-smoke-dump] output=${outPath}`);
})();
