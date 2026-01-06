#!/usr/bin/env node

/**
 * write-e2e-runtime-env.mjs
 *
 * Generates `dist/env.runtime.json` with deterministic E2E defaults.
 *
 * Purpose:
 * - Ensures E2E preview runs are deterministic and CI-friendly
 * - Eliminates external DNS/network leakage by using DNS-safe SharePoint settings
 * - No secrets - all values are safe for CI and local development
 *
 * Why DNS-safe values:
 * - Empty string for VITE_SP_RESOURCE prevents DNS lookups to *.sharepoint.com
 * - Avoids ERR_NAME_NOT_RESOLVED errors in E2E tests
 * - App tolerates empty/missing SharePoint config when VITE_SKIP_SHAREPOINT=1
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const distDir = path.join(repoRoot, 'dist');
const outputPath = path.join(distDir, 'env.runtime.json');

// Deterministic E2E runtime environment
const e2eRuntimeEnv = {
  VITE_DEMO_MODE: 'true',
  VITE_E2E: 'true',
  VITE_SKIP_LOGIN: 'true',
  VITE_E2E_MSAL_MOCK: 'true',
  VITE_SKIP_SHAREPOINT: 'true',
  VITE_SKIP_ENSURE_SCHEDULE: 'false',
  VITE_WRITE_ENABLED: 'false',
  VITE_FEATURE_SCHEDULES: 'true',
  VITE_SCHEDULES_TZ: 'Asia/Tokyo',
  // DNS-safe SharePoint settings (no external DNS lookups)
  VITE_SP_RESOURCE: '',
  VITE_SP_SITE_RELATIVE: '',
  // Dummy MSAL credentials (not used since SKIP_LOGIN=1)
  VITE_MSAL_CLIENT_ID: '00000000-0000-0000-0000-000000000000',
  VITE_MSAL_TENANT_ID: '00000000-0000-0000-0000-000000000000',
};

try {
  mkdirSync(distDir, { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(e2eRuntimeEnv, null, 2)}\n`, 'utf8');
  // eslint-disable-next-line no-console
  console.log(`✅ E2E runtime env written to ${outputPath}`);
  // eslint-disable-next-line no-console
  console.log('Configuration:');
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(e2eRuntimeEnv, null, 2));
} catch (error) {
  // eslint-disable-next-line no-console
  console.error('❌ Failed to write E2E runtime env:', error);
  process.exit(1);
}
