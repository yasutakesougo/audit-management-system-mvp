/* eslint-disable no-console */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAccessToken, refreshM365Token } from './auth-helper.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');

const TARGETS = {
  UserBenefit_Profile: [],
  UserBenefit_Profile_Ext: [
    'Recipient_x0020_Cert_x0020_Expir',
    'Disability_x0020_Support_x0020_L',
  ],
};

const PROTECTED_FIELDS = new Set([
  'Title',
  'UserID',
  'RecipientCertExpiry',
  'DisabilitySupportLevel',
  'GrantedDaysPerMonth',
]);

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(`--${name}`);
const getFlag = (name, fallback = null) => {
  const pref = `--${name}=`;
  const hit = args.find((a) => a.startsWith(pref));
  if (hit) return hit.slice(pref.length);
  const idx = args.indexOf(`--${name}`);
  if (idx >= 0 && idx + 1 < args.length && !args[idx + 1].startsWith('--')) return args[idx + 1];
  return fallback;
};

function loadEnv(path) {
  if (!existsSync(path)) return;
  const raw = readFileSync(path, 'utf-8');
  raw.split('\n').forEach((line) => {
    if (!line.trim() || line.trim().startsWith('#')) return;
    const [k, ...rest] = line.split('=');
    if (!k || rest.length === 0) return;
    process.env[k.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
  });
}

async function spFetch(url, auth, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json;odata=nometadata',
      Authorization: `Bearer ${auth.token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (res.status === 401) {
    const newToken = refreshM365Token();
    if (newToken) {
      auth.token = newToken;
      return spFetch(url, auth, options);
    }
  }

  if (res.status === 204) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return res.json().catch(() => ({}));
}

function ensureSafeTargets() {
  for (const [listTitle, fields] of Object.entries(TARGETS)) {
    for (const f of fields) {
      if (PROTECTED_FIELDS.has(f)) {
        throw new Error(`Protected field is in target set: ${listTitle}.${f}`);
      }
    }
  }
}

function toStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

async function fetchFields(normalizedSiteUrl, auth, listTitle) {
  const url = `${normalizedSiteUrl}/lists/getbytitle('${listTitle}')/fields`;
  const data = await spFetch(url, auth);
  return Array.isArray(data.value) ? data.value : [];
}

async function probeHasNonNull(normalizedSiteUrl, auth, listTitle, internalName) {
  const encodedFilter = encodeURIComponent(`${internalName} ne null`);
  const url = `${normalizedSiteUrl}/lists/getbytitle('${listTitle}')/items?$select=Id,${internalName}&$top=1&$filter=${encodedFilter}`;
  try {
    const data = await spFetch(url, auth);
    return (data.value || []).length > 0;
  } catch (_err) {
    const fallback = `${normalizedSiteUrl}/lists/getbytitle('${listTitle}')/items?$select=Id,${internalName}&$top=50`;
    const data = await spFetch(fallback, auth);
    return (data.value || []).some((r) => r[internalName] !== null && r[internalName] !== undefined && r[internalName] !== '');
  }
}

async function deleteFieldById(normalizedSiteUrl, auth, listTitle, fieldId) {
  const url = `${normalizedSiteUrl}/lists/getbytitle('${listTitle}')/fields(guid'${fieldId}')`;
  await spFetch(url, auth, {
    method: 'POST',
    headers: {
      'X-HTTP-Method': 'DELETE',
      'IF-MATCH': '*',
    },
  });
}

async function main() {
  loadEnv(resolve(REPO_ROOT, '.env'));
  loadEnv(resolve(REPO_ROOT, '.env.local'));

  ensureSafeTargets();

  const execute = hasFlag('execute');
  const listOnly = getFlag('list', null);
  const outDir = resolve(REPO_ROOT, getFlag('out-dir', 'docs/nightly-patrol'));
  const stamp = toStamp();
  const mode = execute ? 'execute' : 'dryrun';

  const siteUrl = (process.env.VITE_SP_SITE_URL || process.env.SP_SITE_URL || '').replace(/\/$/, '');
  const token = getAccessToken();
  if (!siteUrl || !token) throw new Error('Missing VITE_SP_SITE_URL/SP_SITE_URL or auth token');
  const normalizedSiteUrl = siteUrl.endsWith('/_api/web') ? siteUrl : `${siteUrl}/_api/web`;
  const auth = { token };

  const selectedTargets = Object.entries(TARGETS).filter(([k]) => !listOnly || k === listOnly);
  if (selectedTargets.length === 0) throw new Error(`Unknown --list value: ${listOnly}`);

  mkdirSync(outDir, { recursive: true });

  const preSnapshot = { timestamp: new Date().toISOString(), mode, siteUrl, lists: {} };
  const dryRun = { timestamp: new Date().toISOString(), mode, listOnly, targets: [], blockers: [], safeToExecute: true };

  for (const [listTitle, fields] of selectedTargets) {
    const allFields = await fetchFields(normalizedSiteUrl, auth, listTitle);
    preSnapshot.lists[listTitle] = allFields.map((f) => ({
      Id: f.Id,
      InternalName: f.InternalName,
      Title: f.Title,
      Hidden: f.Hidden,
      ReadOnlyField: f.ReadOnlyField,
      Sealed: f.Sealed,
      CanBeDeleted: f.CanBeDeleted,
      TypeAsString: f.TypeAsString,
      FromBaseType: f.FromBaseType,
    }));

    for (const internalName of fields) {
      const found = allFields.find((f) => f.InternalName === internalName);
      if (!found) {
        dryRun.targets.push({ listTitle, internalName, exists: false, action: 'skip_not_found' });
        continue;
      }

      const hasNonNull = await probeHasNonNull(normalizedSiteUrl, auth, listTitle, internalName);
      const risk = {
        hidden: !!found.Hidden,
        readOnly: !!found.ReadOnlyField,
        sealed: !!found.Sealed,
        canBeDeleted: found.CanBeDeleted !== false,
        fromBaseType: !!found.FromBaseType,
      };

      const blockers = [];
      if (hasNonNull) blockers.push('nonNull_data_detected');
      if (risk.readOnly) blockers.push('readonly_field');
      if (risk.sealed) blockers.push('sealed_field');
      if (!risk.canBeDeleted) blockers.push('canBeDeleted_false');
      if (risk.fromBaseType) blockers.push('fromBaseType_true');

      const row = {
        listTitle,
        internalName,
        fieldId: found.Id,
        exists: true,
        hasNonNull,
        risk,
        blockers,
        action: blockers.length === 0 ? (execute ? 'delete' : 'plan_delete') : 'blocked',
      };
      dryRun.targets.push(row);
      if (blockers.length > 0) {
        dryRun.safeToExecute = false;
        dryRun.blockers.push(row);
      }
    }
  }

  const preSnapshotPath = join(outDir, `userbenefit-pre-deletion-snapshot-${stamp}.json`);
  const dryRunPath = join(outDir, `userbenefit-zombie-purge-${mode}-${stamp}.json`);
  writeFileSync(preSnapshotPath, `${JSON.stringify(preSnapshot, null, 2)}\n`, 'utf-8');
  writeFileSync(dryRunPath, `${JSON.stringify(dryRun, null, 2)}\n`, 'utf-8');

  console.log(`Pre-snapshot: ${preSnapshotPath}`);
  console.log(`Plan:         ${dryRunPath}`);
  console.log(`Targets:      ${dryRun.targets.length}`);
  console.log(`Blockers:     ${dryRun.blockers.length}`);

  if (!execute) {
    console.log('Dry-run complete. No deletion executed.');
    return;
  }

  if (dryRun.blockers.length > 0) {
    throw new Error(`Execute aborted: blockers detected (${dryRun.blockers.length}).`);
  }

  for (const t of dryRun.targets) {
    if (t.action !== 'delete') continue;
    await deleteFieldById(normalizedSiteUrl, auth, t.listTitle, t.fieldId);
    console.log(`Deleted: ${t.listTitle}.${t.internalName}`);
  }

  const postSnapshot = { timestamp: new Date().toISOString(), mode, siteUrl, lists: {} };
  for (const [listTitle] of selectedTargets) {
    const allFields = await fetchFields(normalizedSiteUrl, auth, listTitle);
    postSnapshot.lists[listTitle] = allFields.map((f) => ({
      Id: f.Id,
      InternalName: f.InternalName,
      Title: f.Title,
      TypeAsString: f.TypeAsString,
    }));
  }
  const postSnapshotPath = join(outDir, `userbenefit-post-deletion-snapshot-${stamp}.json`);
  writeFileSync(postSnapshotPath, `${JSON.stringify(postSnapshot, null, 2)}\n`, 'utf-8');
  console.log(`Post-snapshot: ${postSnapshotPath}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

