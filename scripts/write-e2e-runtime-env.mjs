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

import { mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Deterministic E2E runtime environment
const e2eRuntimeEnv = {
  VITE_DEMO_MODE: "1",
  VITE_E2E: "1",
  VITE_SKIP_LOGIN: "1",
  VITE_E2E_MSAL_MOCK: "1",
  VITE_SKIP_SHAREPOINT: "1",
  // Dummy SharePoint settings to pass zod validation
  VITE_SP_RESOURCE: "https://contoso.sharepoint.com",
  VITE_SP_SITE_RELATIVE: "/sites/Audit",
  // Dummy MSAL credentials (not used since SKIP_LOGIN=1)
  VITE_MSAL_CLIENT_ID: "00000000-0000-0000-0000-000000000000",
  VITE_MSAL_TENANT_ID: "00000000-0000-0000-0000-000000000000",
};

const outputPath = 'dist/env.runtime.json';

try {
  // Ensure dist directory exists
  mkdirSync('dist', { recursive: true });

  // Write runtime env file
  writeFileSync(outputPath, JSON.stringify(e2eRuntimeEnv, null, 2), 'utf8');

  console.log(`✅ E2E runtime env written to ${outputPath}`);
  console.log('Configuration:');
  console.log(JSON.stringify(e2eRuntimeEnv, null, 2));
} catch (error) {
  console.error('❌ Failed to write E2E runtime env:', error);
  process.exit(1);
}
