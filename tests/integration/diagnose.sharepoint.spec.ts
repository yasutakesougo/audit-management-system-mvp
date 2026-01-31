import { test } from '@playwright/test';
import { resolveSharePointSiteUrl } from './_shared/resolveSiteUrl';

/**
 * Diagnostic: Check SharePoint permissions and list existence
 * 
 * Run: SHAREPOINT_SITE=https://... npm run ci:integration:diagnose
 */
test.describe('SharePoint Diagnostics', () => {
  const siteUrl = resolveSharePointSiteUrl();

  test('1. Current user (who am I?)', async ({ request }) => {
    const url = `${siteUrl}/_api/web/currentuser`;
    console.log(`\n[診断1] Checking current user: ${url}`);

    try {
      const res = await request.get(url);
      const status = res.status();
      console.log(`Status: ${status}`);

      if (res.ok()) {
        const json = await res.json();
        const user = json?.d || json;
        console.log(`✅ Current User:`);
        console.log(`   Title: ${user.Title}`);
        console.log(`   Email: ${user.Email}`);
        console.log(`   LoginName: ${user.LoginName}`);
        console.log(`   Id: ${user.Id}`);
      } else {
        const body = await res.text().catch(() => '');
        console.error(`❌ Failed to get current user (${status})`);
        console.error(`Body: ${body.slice(0, 500)}`);
      }
    } catch (err) {
      console.error(`❌ Exception:`, err);
    }
  });

  test('2. Staff_Master list existence and permissions', async ({ request }) => {
    const url = `${siteUrl}/_api/web/lists/GetByTitle('Staff_Master')?$select=Title,Id,Hidden,HasUniqueRoleAssignments,BaseTemplate`;
    console.log(`\n[診断2] Checking Staff_Master list: ${url}`);

    try {
      const res = await request.get(url);
      const status = res.status();
      console.log(`Status: ${status}`);

      if (res.ok()) {
        const json = await res.json();
        const list = json?.d || json;
        console.log(`✅ List Found:`);
        console.log(`   Title: ${list.Title}`);
        console.log(`   Id: ${list.Id}`);
        console.log(`   Hidden: ${list.Hidden}`);
        console.log(`   HasUniqueRoleAssignments: ${list.HasUniqueRoleAssignments}`);
        console.log(`   BaseTemplate: ${list.BaseTemplate}`);
      } else {
        const body = await res.text().catch(() => '');
        console.error(`❌ Failed to get list (${status})`);
        console.error(`Body: ${body.slice(0, 500)}`);
      }
    } catch (err) {
      console.error(`❌ Exception:`, err);
    }
  });

  test('3. Staff_Master items endpoint', async ({ request }) => {
    const url = `${siteUrl}/_api/web/lists/GetByTitle('Staff_Master')/items?$select=Id&$top=1`;
    console.log(`\n[診断3] Checking items endpoint: ${url}`);

    try {
      const res = await request.get(url);
      const status = res.status();
      console.log(`Status: ${status}`);

      if (res.ok()) {
        const json = await res.json();
        console.log(`✅ Items accessible`);
        console.log(`   Count: ${json?.d?.results?.length ?? json?.value?.length ?? 0}`);
      } else {
        const body = await res.text().catch(() => '');
        console.error(`❌ Failed to get items (${status})`);
        console.error(`Body: ${body.slice(0, 500)}`);

        // Extract sprequestguid
        const headers = res.headers();
        const sprequestguid =
          headers['sprequestguid'] ||
          headers['sp-request-guid'] ||
          headers['request-id'] ||
          'N/A';
        console.error(`   sprequestguid: ${sprequestguid}`);
      }
    } catch (err) {
      console.error(`❌ Exception:`, err);
    }
  });
});
