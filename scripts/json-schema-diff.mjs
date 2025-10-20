#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const { diff } = await import('json-schema-diff');

const baseDir = 'tmp/base/schemas';
const headDir = 'contracts/schemas';

let hasBreaking = false;

let schemaFiles = [];
try {
  schemaFiles = readdirSync(headDir).filter((file) => file.endsWith('.json'));
} catch (error) {
  console.warn('[schema-diff] No schema directory found, skipping.');
  process.exit(0);
}

if (schemaFiles.length === 0) {
  console.log('[schema-diff] No schema files detected, skipping.');
  process.exit(0);
}

for (const file of schemaFiles) {
  const basePath = join(baseDir, file);
  const headPath = join(headDir, file);

  let baseSchema = null;
  let headSchema = null;

  try {
    headSchema = JSON.parse(readFileSync(headPath, 'utf8'));
  } catch (error) {
    console.error(`[schema-diff] Failed to read schema: ${headPath}`);
    throw error;
  }

  try {
    baseSchema = JSON.parse(readFileSync(basePath, 'utf8'));
  } catch {
    console.log(`[schema-diff] base not found (treat as new): ${headPath}`);
    continue;
  }

  const result = await diff({ source: baseSchema }, { source: headSchema });
  const breakingDiffs = result.breakingDifferences ?? [];

  if (breakingDiffs.length > 0) {
    hasBreaking = true;
    console.log(`\n[schema-diff] ${headPath}`);
    console.log('  ❌ Breaking differences detected:');
    for (const item of breakingDiffs) {
      const location = item.path ?? '(root)';
      const description = item.description ? ` - ${item.description}` : '';
      console.log(`   - ${item.action} @ ${location}${description}`);
    }
  } else {
    console.log(`[schema-diff] ${headPath} - ✅ no breaking differences`);
  }
}

if (hasBreaking) {
  console.error('\n[schema-diff] Breaking schema changes detected.');
  process.exit(1);
} else {
  console.log('\n[schema-diff] All schemas compatible.');
}
