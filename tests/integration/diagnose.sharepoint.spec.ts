import { test } from '@playwright/test';
import { resolveSharePointSiteUrl } from './_shared/resolveSiteUrl';
import * as fs from 'fs';

/**
 * Diagnostic: Check SharePoint permissions and list existence
 * 
 * Run: SHAREPOINT_SITE=https://... npm run ci:integration:diagnose
 */
test.describe('SharePoint Diagnostics', () => {
  const STORAGE_STATE_PATH = 'tests/.auth/storageState.json';
  
  test.use({
    storageState: STORAGE_STATE_PATH,
  });
  const siteUrl = resolveSharePointSiteUrl();

  test.beforeEach(async () => {
    console.log(`\n--- SharePoint Diagnostic Start ---`);
    console.log(`Site URL: ${siteUrl}`);
    
    if (fs.existsSync(STORAGE_STATE_PATH)) {
      const stats = fs.statSync(STORAGE_STATE_PATH);
      const ageMs = Date.now() - stats.mtimeMs;
      const ageDays = (ageMs / (1000 * 60 * 60 * 24)).toFixed(1);
      console.log(`Auth State: ${STORAGE_STATE_PATH} (${ageDays} days old, mtime: ${stats.mtime.toISOString()})`);
      if (ageMs > 1000 * 60 * 60 * 24 * 7) {
        console.warn(`⚠️ Warning: Auth state is older than 7 days. This might cause 401/403 errors.`);
      }
    } else {
      console.error(`❌ Error: ${STORAGE_STATE_PATH} not found. Run 'npm run auth:setup' first.`);
    }
  });

  test('1. Current user (who am I?)', async ({ context }) => {
    const request = context.request;
    const url = `${siteUrl}/_api/web/currentuser`;
    console.log(`\n[診断1] Checking current user: ${url}`);

    try {
      const res = await request.get(url, {
        headers: { 'Accept': 'application/json;odata=verbose' }
      });
      const status = res.status();
      console.log(`Status: ${status}`);

      if (res.ok()) {
        const json = await res.json();
        const user = json?.d || json;
        console.log(`✅ Current User:`);
        console.log(`   Title: ${user.Title}`);
        console.log(`   Email: ${user.Email}`);
      } else {
        const body = await res.text().catch(() => '');
        classifyAuthError(status, body, 'Current User');
      }
    } catch (err) {
      console.error(`❌ Exception:`, err);
    }
  });

  test('2. Staff_Master list existence and permissions', async ({ context }) => {
    const request = context.request;
    const url = `${siteUrl}/_api/web/lists/GetByTitle('Staff_Master')?$select=Title,Id,Hidden,HasUniqueRoleAssignments,BaseTemplate`;
    console.log(`\n[診断2] Checking Staff_Master list: ${url}`);

    try {
      const res = await request.get(url, {
        headers: { 'Accept': 'application/json;odata=verbose' }
      });
      const status = res.status();
      console.log(`Status: ${status}`);

      if (res.ok()) {
        const json = await res.json();
        const list = json?.d || json;
        console.log(`✅ List Found: ${list.Title} (${list.Id})`);
      } else {
        const body = await res.text().catch(() => '');
        classifyAuthError(status, body, 'List Metadata');
      }
    } catch (err) {
      console.error(`❌ Exception:`, err);
    }
  });

  test('3. Staff_Master items endpoint', async ({ context }) => {
    const request = context.request;
    const url = `${siteUrl}/_api/web/lists/GetByTitle('Staff_Master')/items?$select=Id&$top=1`;
    console.log(`\n[診断3] Checking items endpoint: ${url}`);

    try {
      const res = await request.get(url, {
        headers: { 'Accept': 'application/json;odata=verbose' }
      });
      const status = res.status();
      console.log(`Status: ${status}`);

      if (res.ok()) {
        const json = await res.json();
        console.log(`✅ Items accessible (Count: ${json?.d?.results?.length ?? json?.value?.length ?? 0})`);
      } else {
        const body = await res.text().catch(() => '');
        classifyAuthError(status, body, 'List Items');
        
        const headers = res.headers();
        const sprequestguid = headers['sprequestguid'] || headers['request-id'] || 'N/A';
        console.error(`   sprequestguid: ${sprequestguid}`);
      }
    } catch (err) {
      console.error(`❌ Exception:`, err);
    }
  });
});

function classifyAuthError(status: number, body: string, label: string) {
  if (status === 401) {
    console.error(`❌ [${label}] 401 Unauthorized: Authentication session has expired.`);
    console.error(`👉 Action: Regenerate PW_STORAGE_STATE_B64 by running 'npm run auth:setup' locally.`);
  } else if (status === 403) {
    console.error(`❌ [${label}] 403 Forbidden: Access denied.`);
    console.error(`👉 Action: Check if the user has Read permissions on the site/list AND verify if storageState.json is fresh.`);
  } else {
    console.error(`❌ [${label}] HTTP ${status} Failure`);
  }
  console.error(`   Body snippet: ${body.slice(0, 200)}`);
}
