import { SharePointProvisioningCoordinator } from '../../src/sharepoint/spProvisioningCoordinator';
import { createSpClient } from '../../src/lib/spClient';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

async function main() {
  console.log('🚀 Starting Manual Bootstrap...');
  let SITE_URL = process.env.VITE_SP_SITE_URL;
  if (!SITE_URL) {
    console.error('❌ VITE_SP_SITE_URL is not set.');
    process.exit(1);
  }
  if (!SITE_URL.endsWith('/_api/web') && !SITE_URL.endsWith('/_api/web/')) {
    SITE_URL = SITE_URL.replace(/\/$/, '') + '/_api/web';
  }

  // Load token from .token.local or environment
  let token = process.env.VITE_SP_TOKEN || '';
  if (!token) {
    try {
      token = readFileSync(join(process.cwd(), '.token.local'), 'utf-8').trim();
    } catch {
      console.error('❌ VITE_SP_TOKEN is not set and .token.local not found.');
      process.exit(1);
    }
  }

  const client = createSpClient(
    async () => token,
    SITE_URL
  );

  console.log(`📡 Running bootstrap logic on ${SITE_URL}...`);
  console.log(`🔑 Token (prefix): ${token.substring(0, 10)}...`);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await SharePointProvisioningCoordinator.bootstrap(client as any, { force: true });
    
    console.log('\n✅ Bootstrap Completed');
    console.log(`   Total:   ${result.total}`);
    console.log(`   Healthy: ${result.healthy}`);
    console.log(`   Unhealthy: ${result.unhealthy}`);
    
    console.log('\n--- Summaries ---');
    result.summaries.forEach(s => {
      const icon = s.status === 'ok' || s.status === 'provisioned' ? '✅' : s.status === 'drifted' ? '🟡' : '❌';
      console.log(`${icon} [${s.status}] ${s.listKey} (${s.listName}) ${s.details ? `- ${s.details}` : ''}`);
    });

  } catch (err) {
    console.error('❌ Bootstrap failed:', err);
    process.exit(1);
  }
}

main();
