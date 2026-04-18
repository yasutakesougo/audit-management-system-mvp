/**
 * Generic SharePoint list schema discovery + drift validation for CI.
 * Usage: node scripts/ci/validate-list-schema.mjs ./schemas/dailyops.mjs
 *
 * exit 0 — OK (Warning only if optional missing or case mismatch)
 * exit 1 — Essential fields MISSING or case mismatch on essential
 *
 * Note: Case mismatch is reported as warning for now to align with "WARN寄り" policy,
 * but essential missing is FAIL.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { request } from '@playwright/test';
import { validateSchema } from './validate-schema.logic.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Arg Handling ────────────────────────────────────────────────
const schemaRelativePath = process.argv[2];
if (!schemaRelativePath) {
  console.error('❌ Usage: node scripts/ci/validate-list-schema.mjs <relative_path_to_schema_mjs>');
  process.exit(1);
}

// Absolute path for import
const schemaPath = path.isAbsolute(schemaRelativePath)
  ? schemaRelativePath
  : path.resolve(process.cwd(), schemaRelativePath);

const { LIST_TITLE, ESSENTIAL_FIELDS, OPTIONAL_FIELDS } = await import(`file://${schemaPath}`);

// ── Main ────────────────────────────────────────────────────────
const site = process.env.SHAREPOINT_SITE;
if (!site) {
  console.error('❌ SHAREPOINT_SITE is not set');
  process.exit(1);
}

const storageState = process.env.STORAGE_STATE_PATH || 'tests/.auth/storageState.json';

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
    console.error(`❌ Failed to fetch fields for ${LIST_TITLE}: ${res.status()}`);
    console.error(await res.text());
    process.exit(1);
  }

  const json = await res.json();
  const fields = json.value || [];

  // ── Discovery log ──
  console.log(`=== Discovery: ${LIST_TITLE} ===`);
  console.log('InternalName | Title | Type | Required');
  console.log('-------------|-------|------|--------');
  for (const f of fields) {
    console.log(`${f.InternalName} | ${f.Title} | ${f.TypeAsString} | ${f.Required || false}`);
  }

  // ── Validation ──
  const actualNames = fields.map((f) => f.InternalName);
  const result = validateSchema(actualNames, ESSENTIAL_FIELDS, OPTIONAL_FIELDS);

  // ── Report ──
  console.log('');
  console.log(`=== Result: ${LIST_TITLE} ===`);

  if (result.caseMismatch.length) {
    console.warn(`⚠️  Case mismatch (drifting):`);
    for (const { expected, actual } of result.caseMismatch) {
      console.warn(`   expected "${expected}" → found "${actual}"`);
    }
  }

  if (result.optionalMissing.length) {
    console.warn(`⚠️  Optional fields missing: ${result.optionalMissing.join(', ')}`);
  }

  if (!result.ok) {
    console.error(`❌ ESSENTIAL fields MISSING: ${result.missing.join(', ')}`);
    // FAIL the CI
    process.exit(1);
  }

  console.log(`✅ ${LIST_TITLE} schema is valid (Essential fields verified)`);
  if (result.caseMismatch.length || result.optionalMissing.length) {
    console.log('   (Some warnings exist, check logs above)');
  }
} catch (err) {
  console.error('❌ Unexpected error during validation:');
  console.error(err);
  process.exit(1);
} finally {
  await ctx.dispose();
}
