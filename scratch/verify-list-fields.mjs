
import { request } from '@playwright/test';
import fs from 'fs';

(async () => {
  const storageState = 'tests/.auth/storageState.json';
  if (!fs.existsSync(storageState)) {
    console.error('storageState.json not found');
    process.exit(1);
  }

  const ctx = await request.newContext({ storageState });
  const site = "https://isogokatudouhome.sharepoint.com/sites/app-test";
  const url = `${site}/_api/web/lists/GetByTitle('DailyOpsSignals')/fields?$filter=Hidden eq false and ReadOnlyField eq false&$select=InternalName,Title,TypeAsString`;
  
  const res = await ctx.get(url, {
    headers: { 'Accept': 'application/json;odata=nometadata' },
  });

  if (!res.ok()) {
    console.error('Failed to fetch fields:', res.status(), await res.text());
    process.exit(1);
  }

  const json = await res.json();
  const fields = json.value || [];
  
  const expected = ["date", "targetType", "targetId", "kind", "time", "summary", "status", "source"];
  const foundNames = fields.map(f => f.InternalName);
  
  console.log('=== DailyOpsSignals Field Verification ===');
  expected.forEach(name => {
    const field = fields.find(f => f.InternalName === name);
    if (field) {
      console.log(`[OK] ${name} (${field.TypeAsString})`);
    } else {
      console.log(`[MISSING] ${name}`);
    }
  });

  const missing = expected.filter(name => !foundNames.includes(name));
  if (missing.length === 0) {
    console.log('\nAll 8 columns are verified successfully!');
  } else {
    console.log(`\nVerification FAILED. Missing: ${missing.join(', ')}`);
  }

  await ctx.dispose();
})();
