/* eslint-disable no-console -- CLI ops script */
/**
 * Backup List Schema — Creates a full JSON snapshot of a list's fields.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');
const BACKUP_DIR = join(REPO_ROOT, 'docs', 'nightly-patrol', 'backups');

async function main() {
  const listTitle = process.argv[2];
  if (!listTitle) {
    console.error('Usage: node scripts/ops/backup-list-schema.mjs <ListTitle>');
    process.exit(1);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeTitle = listTitle.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `backup-${safeTitle}-${stamp}.json`;

  mkdirSync(BACKUP_DIR, { recursive: true });

  console.log(`📸 Creating snapshot for list: ${listTitle}...`);

  try {
    const raw = execSync(`npx -y @pnp/cli-microsoft365 spo list field list --webUrl "$VITE_SP_SITE_URL" --listTitle "${listTitle}" -o json`, {
      encoding: 'utf-8',
      env: { ...process.env }
    });
    
    const fields = JSON.parse(raw);
    const outputPath = join(BACKUP_DIR, filename);
    writeFileSync(outputPath, JSON.stringify(fields, null, 2));
    
    console.log(`✅ Snapshot saved: ${outputPath} (${fields.length} fields)`);
  } catch (err) {
    console.error('❌ Failed to create snapshot:', err.message);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ Backup failed:', err);
  process.exit(1);
});
