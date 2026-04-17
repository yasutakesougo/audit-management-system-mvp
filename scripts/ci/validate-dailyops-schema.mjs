/**
 * DailyOpsSignals schema discovery + drift validation for CI.
 *
 * Fetches field metadata from SharePoint, logs it (discovery),
 * then validates against the SSOT essential-field list.
 *
 * Exit codes:
 *   0 — all essential fields present
 *   1 — one or more essential fields missing (drift FAIL)
 *
 * SSOT reference: src/features/dailyOps/data/spSchema.ts
 * Provisioning:   scripts/create-dailyops-list-rest.sh
 *
 * Env:
 *   SHAREPOINT_SITE          — e.g. https://tenant.sharepoint.com/sites/app-test
 *   STORAGE_STATE_PATH       — path to Playwright storageState.json
 *                               (default: tests/.auth/storageState.json)
 */

import { request } from '@playwright/test';
import { validateSchema } from './validate-dailyops-schema.logic.mjs';

// ── Main ────────────────────────────────────────────────────────
const site = process.env.SHAREPOINT_SITE;
if (!site) {
  console.error('❌ SHAREPOINT_SITE is not set');
  process.exit(1);
}

const storageState =
  process.env.STORAGE_STATE_PATH || 'tests/.auth/storageState.json';

const LIST_TITLE = 'DailyOpsSignals';

const ctx = await request.newContext({ storageState });

try {
  const url =
    `${site}/_api/web/lists/GetByTitle('${LIST_TITLE}')/fields?` +
    `$filter=Hidden eq false and ReadOnlyField eq false` +
    `&$select=InternalName,Title,TypeAsString,Required,DefaultValue`;

  const res = await ctx.get(url, {
    headers: { Accept: 'application/json;odata=nometadata' },
  });

  if (!res.ok()) {
    console.error(
      `❌ Failed to fetch fields: ${res.status()} ${await res.text()}`,
    );
    process.exit(1);
  }

  const json = await res.json();
  const fields = json.value || [];

  // ── Discovery log (same format as the old inline step) ──────
  console.log(`=== ${LIST_TITLE} Fields ===`);
  console.log('InternalName | Title | Type | Required');
  console.log('-------------|-------|------|--------');
  for (const f of fields) {
    console.log(
      `${f.InternalName} | ${f.Title} | ${f.TypeAsString} | ${f.Required || false}`,
    );
  }

  // ── Validation ──────────────────────────────────────────────
  const actualNames = fields.map((f) => f.InternalName);
  const result = validateSchema(actualNames);

  // ── Report ──────────────────────────────────────────────────
  console.log('');
  console.log('=== Schema Validation ===');

  if (result.caseMismatch.length) {
    console.warn('⚠️  Case mismatch (resolved but drifted):');
    for (const { expected, actual } of result.caseMismatch) {
      console.warn(`   expected "${expected}" → found "${actual}"`);
    }
  }

  if (result.optionalMissing.length) {
    console.warn(
      `⚠️  Optional fields missing: ${result.optionalMissing.join(', ')}`,
    );
  }

  if (result.missing.length) {
    console.error(`❌ Essential fields MISSING: ${result.missing.join(', ')}`);
    console.error('');
    console.error(
      'The SharePoint list is missing fields required by the application.',
    );
    console.error(
      'Run scripts/create-dailyops-list-rest.sh to provision, or add them manually.',
    );
    process.exit(1);
  }

  console.log('✅ All essential fields present');
  if (result.caseMismatch.length) {
    console.log(
      `   (${result.caseMismatch.length} case-mismatch warning(s) — application will resolve via fuzzy match)`,
    );
  }
} finally {
  await ctx.dispose();
}
