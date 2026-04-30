import * as fs from 'fs';
import * as path from 'path';

/**
 * MonthlyRecord_Summary (月次請求サマリー) Schema Diagnosis Script
 * 
 * This script connects to SharePoint and fetches the actual field definitions
 * for the list defined by VITE_SP_LIST_BILLING_SUMMARY.
 * It does not perform any write operations.
 */

function loadEnv() {
  const root = process.cwd();
  
  // 1. Load from .env (Base Defaults)
  const baseEnvPath = path.resolve(root, '.env');
  if (fs.existsSync(baseEnvPath)) {
    const content = fs.readFileSync(baseEnvPath, 'utf8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const [rawKey, ...rest] = trimmed.split('=');
      const key = rawKey.trim();
      if (key && rest.length > 0) {
        const val = rest.join('=').trim().replace(/^["']|["']$/g, '');
        process.env[key] = val;
      }
    });
  }

  // 2. Load from public/env.runtime.json (Production OVERRIDES base .env)
  const runtimeJsonPath = path.resolve(root, 'public/env.runtime.json');
  if (fs.existsSync(runtimeJsonPath)) {
    try {
      const runtimeEnv = JSON.parse(fs.readFileSync(runtimeJsonPath, 'utf8'));
      Object.keys(runtimeEnv).forEach(key => {
        // ALWAYS set from runtime.json if present
        process.env[key] = runtimeEnv[key];
      });
    } catch (e) {
      console.warn("⚠️ Warning: Failed to parse public/env.runtime.json");
    }
  }

  // 3. Load from .env.local (User Specific OVERRIDES everything)
  const localEnvPath = path.resolve(root, '.env.local');
  if (fs.existsSync(localEnvPath)) {
    const content = fs.readFileSync(localEnvPath, 'utf8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const [rawKey, ...rest] = trimmed.split('=');
      const key = rawKey.trim();
      if (key && rest.length > 0) {
        const val = rest.join('=').trim().replace(/^["']|["']$/g, '');
        process.env[key] = val;
      }
    });
  }

  // 4. Check for .token.local
  const tokenPath = path.resolve(root, '.token.local');
  if (fs.existsSync(tokenPath)) {
    const token = fs.readFileSync(tokenPath, 'utf8').trim();
    if (token) {
      process.env.SP_TOKEN = token;
    }
  }
}

loadEnv();

async function main() {
  const token = process.env.SP_TOKEN || process.env.VITE_SP_TOKEN;
  const listIdOrTitle = process.env.VITE_SP_LIST_BILLING_SUMMARY || 'MonthlyRecord_Summary';
  const siteRelativePath = process.env.VITE_SP_SITE_RELATIVE || '/sites/welfare';
  const resource = process.env.VITE_SP_RESOURCE || 'https://isogokatudouhome.sharepoint.com';
  
  if (!token) {
    console.error("❌ Error: SP_TOKEN or VITE_SP_TOKEN is not set, and .token.local is missing or empty.");
    process.exit(1);
  }

  const apiBaseUrl = `${resource.replace(/\/$/, '')}${siteRelativePath.startsWith('/') ? '' : '/'}${siteRelativePath}/_api/web`;
  
  // Decide accessor
  const listAccessor = /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(listIdOrTitle)
    ? `lists(guid'${listIdOrTitle}')`
    : `lists/getbytitle('${encodeURIComponent(listIdOrTitle)}')`;

  console.log(`Connecting to: ${apiBaseUrl}`);
  console.log(`Target List: ${listIdOrTitle}`);
  console.log(`Accessor: ${listAccessor}`);

  const url = `${apiBaseUrl}/${listAccessor}/fields?$select=InternalName,Title,TypeAsString,Hidden,ReadOnlyField`;
  
  try {
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json;odata=nometadata',
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`\n❌ API Error: ${res.status} ${res.statusText}`);
      console.error(`URL: ${url}`);
      console.error(`Response: ${errorText}`);
      process.exit(1);
    }

    const data = await res.json() as { value: any[] };
    const fields = data.value;

    console.log(`\n=== MonthlyRecord_Summary Actual Fields (${fields.length}) ===`);
    
    fields.sort((a, b) => a.InternalName.localeCompare(b.InternalName));
    
    fields.forEach(f => {
      // Show non-hidden, or specifically relevant hidden fields
      if (!f.Hidden && !f.ReadOnlyField && f.InternalName !== 'ContentType' && f.InternalName !== 'Attachments') {
         console.log(`- ${f.InternalName.padEnd(30)} [${f.TypeAsString.padEnd(12)}] (Title: ${f.Title})`);
      }
    });

    // Also look for specific drift candidates
    console.log('\n=== Checking for drift candidates ===');
    const specificCandidates = ['UserId', 'YearMonth', 'KPI_TotalDays', 'TotalSupportDays', 'BillableDays'];
    fields.forEach(f => {
      if (specificCandidates.includes(f.InternalName)) {
        console.log(`✅ Found: ${f.InternalName} [${f.TypeAsString}]`);
      }
    });

    console.log('\nDone.');
  } catch (err) {
    console.error("\n💥 Failed to fetch fields:", err.message);
    process.exit(1);
  }
}

main().catch(console.error);
