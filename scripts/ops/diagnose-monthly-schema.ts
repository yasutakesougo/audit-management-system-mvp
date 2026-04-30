import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
  const root = process.cwd();
  const envFiles = ['.env', '.env.local'];
  
  for (const file of envFiles) {
    const envPath = path.resolve(root, file);
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const [rawKey, ...rest] = trimmed.split('=');
        const key = rawKey.trim();
        if (key && rest.length > 0) {
          const val = rest.join('=').trim().replace(/^["']|["']$/g, '');
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      });
    }
  }
}
loadEnv();

async function main() {
  console.log("Initializing SharePoint Client...");
  
  const { getSharePointClient } = await import('../../src/sharepoint/client/index.ts');
  const { LIST_REGISTRY } = await import('../../src/sharepoint/fields/listRegistry.ts');

  const listId = LIST_REGISTRY.billing_summary.id;
  
  if (!listId) {
    console.error("List ID for billing_summary not found!");
    process.exit(1);
  }

  const spClient = await getSharePointClient();
  console.log(`Fetching fields for list: ${listId}...`);
  
  try {
    const fields = await spClient.read.getFields(listId);
    console.log(`\n=== MonthlyRecord_Summary Fields (${fields.length}) ===`);
    
    fields.sort((a, b) => a.InternalName.localeCompare(b.InternalName));
    
    fields.forEach(f => {
      if (!f.Hidden && !f.ReadOnlyField && f.InternalName !== 'ContentType' && f.InternalName !== 'Attachments') {
         console.log(`- ${f.InternalName.padEnd(30)} [${f.TypeAsString}] (Title: ${f.Title})`);
      }
    });

    console.log('\nDone.');
  } catch (err) {
    console.error("Failed to fetch fields:", err.message);
  }
}

main().catch(console.error);
