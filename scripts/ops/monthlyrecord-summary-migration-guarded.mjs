/* eslint-disable no-console -- CLI ops script */
/**
 * MonthlyRecord_Summary Guarded Migration (Issue #1722)
 *
 * Safe transition from legacy 'Key' to canonical 'Idempotency_x0020_Key'.
 * 
 * Safety features:
 * - --dry-run flag (default true)
 * - Identifies only 'fallbackOnly' rows (IdempotencyKey is empty, Key is present)
 * - No destructive operations (Key is never deleted)
 * - Detailed audit logging
 */

import { getAccessToken, refreshM365Token } from './auth-helper.mjs';

const DRY_RUN = !process.argv.includes('--execute');

const MIGRATION_GROUPS = {
  idempotency: {
    target: 'Idempotency_x0020_Key',
    fallbacks: ['Key'],
  }
};

async function spFetch(url, options, auth) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Accept': 'application/json;odata=nometadata',
      'Content-Type': 'application/json;odata=nometadata',
      'Authorization': `Bearer ${auth.token}`,
      ...options.headers,
    },
  });

  if (res.status === 401) {
    const newToken = refreshM365Token();
    if (newToken) {
      auth.token = newToken;
      return spFetch(url, options, auth);
    }
  }

  if (res.status === 204) return null; // No content for PATCH/DELETE

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${body}`);
  }

  return res.json();
}

async function fetchItems(siteApiRoot, listTitle, auth) {
  const select = ['Id', 'Idempotency_x0020_Key', 'Key'].join(',');
  const url = `${siteApiRoot}/lists/getbytitle('${listTitle}')/items?$select=${encodeURIComponent(select)}&$top=5000`;
  const data = await spFetch(url, {}, auth);
  return data.value || [];
}

async function patchItem(siteApiRoot, listTitle, itemId, updates, auth) {
  const url = `${siteApiRoot}/lists/getbytitle('${listTitle}')/items(${itemId})`;
  await spFetch(url, {
    method: 'PATCH',
    body: JSON.stringify(updates),
    headers: {
      'IF-MATCH': '*',
    }
  }, auth);
}

function isPresent(v) {
  return v !== null && v !== undefined && String(v).trim() !== '';
}

async function main() {
  const siteUrl = process.env.VITE_SP_SITE_URL;
  const listTitle = process.env.VITE_SP_LIST_BILLING_SUMMARY || 'MonthlyRecord_Summary';
  const auth = { token: getAccessToken() };

  if (!siteUrl || !auth.token) {
    throw new Error('Missing credentials. Ensure VITE_SP_SITE_URL and token are available.');
  }

  const siteApiRoot = siteUrl.endsWith('/_api/web') ? siteUrl : `${siteUrl.replace(/\/$/, '')}/_api/web`;

  console.log(`🚀 MonthlyRecord_Summary Migration (Issue #1722)`);
  console.log(`📍 Site: ${siteUrl}`);
  console.log(`📋 List: ${listTitle}`);
  console.log(`🛡️  Mode: ${DRY_RUN ? 'DRY-RUN (Safe)' : 'EXECUTE (Live)'}`);
  console.log('---');

  const rows = await fetchItems(siteApiRoot, listTitle, auth);
  console.log(`🔍 Scanned ${rows.length} rows.`);

  let processed = 0;
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    processed++;
    const id = row.Id;
    const currentIdempotency = row.Idempotency_x0020_Key;
    const legacyKey = row.Key;

    // Check if migration is needed
    if (!isPresent(currentIdempotency) && isPresent(legacyKey)) {
      console.log(`  [Row ${id}] Migrating Key -> IdempotencyKey: "${legacyKey}"`);
      
      if (DRY_RUN) {
        migrated++;
      } else {
        try {
          await patchItem(siteApiRoot, listTitle, id, { Idempotency_x0020_Key: legacyKey }, auth);
          migrated++;
        } catch (err) {
          console.error(`  ❌ Failed to migrate Row ${id}:`, err.message);
          failed++;
        }
      }
    } else {
      skipped++;
    }
  }

  console.log('---');
  console.log(`📊 Result Summary:`);
  console.log(`- Processed: ${processed}`);
  console.log(`- Migrated:  ${migrated}`);
  console.log(`- Skipped:   ${skipped}`);
  console.log(`- Failed:    ${failed}`);
  console.log('');

  if (DRY_RUN) {
    if (migrated > 0) {
      console.log(`👉 To execute the migration, run with: --execute`);
    } else {
      console.log(`✅ No rows require migration.`);
    }
  } else {
    console.log(`✅ Migration completed.`);
  }
}

main().catch((error) => {
  console.error('❌ Migration failed:', error.message || error);
  process.exit(1);
});
