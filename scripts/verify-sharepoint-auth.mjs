import { request } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * CI/CD pre-check: Verify SharePoint authentication using storageState.json
 */
async function verifyAuth() {
  const site = process.env.SHAREPOINT_SITE;
  if (!site) {
    console.error('::error::SHAREPOINT_SITE environment variable is required');
    process.exit(1);
  }

  const storageStatePath = path.resolve(process.cwd(), 'tests/.auth/storageState.json');
  if (!fs.existsSync(storageStatePath)) {
    console.error(`::error::Storage state not found at ${storageStatePath}`);
    process.exit(1);
  }

  console.log(`Verifying auth for: ${site}`);
  
  const context = await request.newContext({
    storageState: storageStatePath,
  });

  const url = `${site}/_api/web?$select=Title`;
  const res = await context.get(url, {
    headers: { 'Accept': 'application/json;odata=nometadata' },
  });

  const status = res.status();
  const headers = res.headers();
  const guid = headers['sprequestguid'] || 'N/A';

  if (!res.ok()) {
    const body = await res.text().catch(() => 'no body');
    const wwwAuth = headers['www-authenticate'] || 'N/A';
    
    console.error(`::error::SharePoint Authentication Failed (Status: ${status})`);
    console.error(`sprequestguid: ${guid}`);
    console.error(`WWW-Authenticate: ${wwwAuth}`);
    console.error(`Response: ${body.slice(0, 500)}`);
    
    if (status === 401 || status === 403) {
      console.error('\n[Action Required] PW_STORAGE_STATE_B64 is likely expired or unauthorized. Please regenerate it locally.');
    }
    process.exit(1);
  }

  const json = await res.json();
  console.log(`✅ Auth verified: Site Title = "${json.Title}"`);
  console.log(`sprequestguid: ${guid}`);
  
  await context.dispose();
}

verifyAuth().catch(err => {
  console.error('::error::Pre-check script failed with unexpected error');
  console.error(err);
  process.exit(1);
});
