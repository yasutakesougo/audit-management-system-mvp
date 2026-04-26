/* eslint-disable no-console -- CLI ops script */
/**
 * Zombie Purge Executor — Safely removes fields flagged as keep-warn.
 * 
 * SAFETY GATES:
 * 1. Must use --confirm flag.
 * 2. usageCount must be 0 in the ledger.
 * 3. hasData must be false in the ledger.
 * 4. Final live check of hasData before deletion.
 * 5. Independent Blocklist (Safety Belt).
 * 6. Confidence filter (High required by default).
 * 7. "Lookup Base" Protection: Fields without numeric suffixes require --force-base-field.
 * 
 * AUDITABILITY:
 * - Local Deletion Log (JSON)
 * - SharePoint RemediationAuditLog (via direct API)
 * - Session Summary
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAccessToken, refreshM365Token } from './auth-helper.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');

async function spFetch(url, auth, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Accept': 'application/json;odata=nometadata',
      'Authorization': `Bearer ${auth.token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (res.status === 401) {
    console.log('🔑 Token expired (401). Attempting auto-refresh...');
    const newToken = refreshM365Token();
    if (newToken) {
      auth.token = newToken;
      return spFetch(url, auth, options);
    }
  }

  if (res.status === 204) return null; // No content for DELETE
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return res.json().catch(() => ({}));
}

async function logToSharePoint(normalizedSiteUrl, auth, entry, batchId) {
  try {
    const payload = {
      Title: `purge:${entry.internalName}`,
      Correlation_x0020_ID: batchId,
      Plan_x0020_ID: entry.fieldId,
      Phase: 'executed',
      List_x0020_Key: entry.listKey,
      Field_x0020_Name: entry.internalName,
      Action: 'delete_zombie',
      Risk: 'safe',
      Auto_x0020_Executable: true,
      Requires_x0020_Approval: false,
      Reason: `Institutionalized Purge: ${entry.displayName}. Gate: ${entry.evidence.confidence} confidence, usage=${entry.evidence.usageCount}, hasData=${entry.evidence.hasData}. Tier: keep-warn`,
      Audit_x0020_Source: 'execute-zombie-purge',
      Audit_x0020_Timestamp: entry.deletedAt,
      Execution_x0020_Status: 'success'
    };

    const url = `${normalizedSiteUrl}/lists/getbytitle('RemediationAuditLog')/items`;
    await spFetch(url, auth, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    // console.log(`📡 Logged to SharePoint RemediationAuditLog.`);
  } catch (err) {
    console.warn(`⚠️  Failed to log to SharePoint audit list: ${err.message}`);
  }
}

async function main() {
  // Load .env if exists
  try {
    const envFile = join(REPO_ROOT, '.env');
    const envContent = readFileSync(envFile, 'utf-8');
    envContent.split('\n').forEach(line => {
      const [key, ...valParts] = line.split('=');
      if (key && valParts.length > 0) {
        process.env[key.trim()] = valParts.join('=').trim();
      }
    });
  } catch (_error) {
    // Ignore
  }

  const args = process.argv.slice(2);
  const confirm = args.includes('--confirm');
  const targetList = args.find(a => a.startsWith('--list='))?.split('=')[1];
  const targetField = args.find(a => a.startsWith('--field='))?.split('=')[1];
  const maxDeletes = parseInt(args.find(a => a.startsWith('--max-deletes='))?.split('=')[1] || '999');
  const batchSize = parseInt(args.find(a => a.startsWith('--batch-size='))?.split('=')[1] || '50');
  const forceBaseField = args.includes('--force-base-field');

  const LEDGER_FILE = join(REPO_ROOT, 'docs', 'nightly-patrol', 'drift-ledger.csv');
  const SITE_URL = process.env.VITE_SP_SITE_URL;
  const auth = { token: getAccessToken() };

  if (!SITE_URL || !auth.token) {
    console.error('❌ Missing credentials (VITE_SP_SITE_URL or .token.local).');
    process.exit(2);
  }

  const normalizedSiteUrl = SITE_URL.endsWith('/_api/web') ? SITE_URL : SITE_URL.replace(/\/$/, '') + '/_api/web';
  const BATCH_ID = `batch-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;

  console.log(`💀 Zombie Purge Executor — Mode: ${confirm ? 'EXECUTE' : 'DRY-RUN'}`);
  console.log(`📦 Batch ID: ${BATCH_ID}\n`);

  let content = '';
  try {
    content = readFileSync(LEDGER_FILE, 'utf-8');
  } catch (_error) {
    console.error(`❌ Ledger file not found at ${LEDGER_FILE}. Run patrol:ledger first.`);
    process.exit(1);
  }

  const lines = content.split('\n').filter(Boolean);
  const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
  
  const hMap = {};
  headers.forEach((h, i) => hMap[h] = i);

  // Simple CSV parser handling quotes
  const candidates = lines.slice(1).map(line => {
    const parts = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        parts.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    parts.push(current);

    const row = {};
    headers.forEach((h, i) => row[h] = parts[i]);
    return row;
  }).filter(r => r.classification === 'keep-warn');

  // Filter candidates early based on list/field args
  const activeCandidates = candidates.filter(r => {
    if (targetList && r.listKey !== targetList) return false;
    if (targetField && r.internalName !== targetField) return false;
    return true;
  });

  // DRY-RUN SUMMARY TABLE
  const stats = {};
  activeCandidates.forEach(c => {
    stats[c.listTitle] = (stats[c.listTitle] || 0) + 1;
  });

  if (activeCandidates.length === 0) {
    console.log('✅ No candidates found matching criteria.');
    process.exit(0);
  }

  console.log('📊 CANDIDATE SUMMARY:');
  console.log('------------------------------------------------------------');
  console.log(`${'List Title'.padEnd(40)} | ${'Fields'}`);
  console.log('------------------------------------------------------------');
  for (const [list, count] of Object.entries(stats)) {
    console.log(`${list.padEnd(40)} | ${count} fields`);
  }
  console.log('------------------------------------------------------------');
  console.log(`Total active candidates: ${activeCandidates.length}\n`);

  if (!confirm) {
    console.log('💡 Dry-run complete. Use --confirm to execute purge.');
    process.exit(0);
  }

  let successCount = 0;
  let failCount = 0;
  const backedUpLists = new Set();

  for (const row of activeCandidates) {
    // Batch sizing
    if (successCount >= maxDeletes) {
      console.log(`\n🛑 Reached --max-deletes limit (${maxDeletes}). Stopping.`);
      break;
    }
    if (successCount + failCount >= batchSize) {
      console.log(`\n⏸️  Reached --batch-size limit (${batchSize}) for this run. Stopping.`);
      break;
    }

    // 🛡️ FULL LIST BACKUP (Once per list per session)
    if (!backedUpLists.has(row.listTitle)) {
      console.log(`\n📸 Backing up full schema for list: ${row.listTitle}...`);
      try {
        const fieldsUrl = `${normalizedSiteUrl}/lists/getbytitle('${row.listTitle}')/fields`;
        const allFields = await spFetch(fieldsUrl, auth);
        const BACKUP_DIR = join(REPO_ROOT, 'docs', 'nightly-patrol', 'backups');
        
        const { mkdirSync } = await import('node:fs');
        mkdirSync(BACKUP_DIR, { recursive: true });

        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `full-backup-${row.listTitle.replace(/[^a-zA-Z0-9]/g, '_')}-${stamp}.json`;
        writeFileSync(join(BACKUP_DIR, filename), JSON.stringify(allFields, null, 2));
        console.log(`✅ Full backup saved: ${filename}`);
        backedUpLists.add(row.listTitle);
      } catch (err) {
        console.warn(`⚠️  Full list backup failed for ${row.listTitle}: ${err.message}. Proceeding with individual snapshots.`);
      }
    }

    console.log(`\n--- Candidate: ${row.listTitle} / ${row.internalName} (${row.displayName}) ---`);
    
    // Safety Gates
    if (parseInt(row.usageCount) > 0 || row.hasData === 'true') {
      console.warn(`⚠️  Skipping: ledger says usage=${row.usageCount}, hasData=${row.hasData}`);
      continue;
    }

    // Protection for "Base Fields" (no numeric suffix)
    const hasNumericSuffix = /[0-9]+$/.test(row.internalName);
    const isExplicitlyGoverned = row.evidence === 'explicit_registry_governance';
    
    if (!hasNumericSuffix && !forceBaseField && !isExplicitlyGoverned) {
      console.warn(`⚠️  Skipping: ${row.internalName} is a base field (no number suffix) and has no explicit governance. Use --force-base-field to override.`);
      continue;
    }

    if (row.confidence !== 'high' && !args.includes('--force-low-confidence')) {
      console.warn(`⚠️  Skipping: confidence is ${row.confidence}. Use --force-low-confidence to override.`);
      continue;
    }

    // Gate 5: Independent Blocklist (Safety Belt)
    const SYSTEM_PREFIXES = ['_', 'OData_', 'SMTotal', 'SMLastModified'];
    const SYSTEM_PATTERNS = [
      /Virus/i, /Compliance/i, /File/i, /Version/i, /Workflow/i, /MediaService/i, 
      /ParentUniqueId/i, /SortBehavior/i, /Restricted/i, /NoExecute/i, /AccessPolicy/i, 
      /MainLinkSettings/i, /HTML_x0020_File/i,
      /LinkTitle/i, /LinkFilename/i // Batch 5 learning: Protect derived shadow fields
    ];
    const HARD_BLOCKLIST = ['Title', 'ID', 'Id', 'Created', 'Modified', 'Author', 'Editor', 'Attachments', 'GUID', 'ContentType', 'ContentTypeId', 'owshiddenversion'];

    const isSystemBlocked = HARD_BLOCKLIST.includes(row.internalName) || 
                          SYSTEM_PREFIXES.some(p => row.internalName.startsWith(p)) ||
                          SYSTEM_PATTERNS.some(p => p.test(row.internalName));

    if (isSystemBlocked) {
      console.warn(`❌ GATE 5 VIOLATION: ${row.internalName} is a system/protected field! Purge blocked.`);
      continue;
    }

    // Gate 6: Sensitive List Protection (Business Core)
    const SENSITIVE_LISTS = ['SupportRecord_Daily', 'SupportProcedureRecord_Daily'];
    if (SENSITIVE_LISTS.includes(row.listTitle) && !args.includes('--force-sensitive-list')) {
      console.warn(`❌ GATE 6 VIOLATION: ${row.listTitle} is a sensitive business list. Use --force-sensitive-list to purge.`);
      continue;
    }

    // Final live check of data
    try {
      const checkUrl = `${normalizedSiteUrl}/lists/getbytitle('${row.listTitle}')/items?$select=${row.internalName}&$top=1&$filter=${row.internalName} ne null`;
      const data = await spFetch(checkUrl, auth);
      if (data.value && data.value.length > 0) {
        console.warn(`❌ ABORT: Live probe found data in ${row.internalName}!`);
        continue;
      }
    } catch (e) {
      // Fallback for non-filterable fields (e.g., Note/Multiline)
      if (e.message.includes('Note') || e.message.includes('SPException')) {
        try {
          const checkUrl = `${normalizedSiteUrl}/lists/getbytitle('${row.listTitle}')/items?$select=${row.internalName}&$top=1`;
          const data = await spFetch(checkUrl, auth);
          if (data.value && data.value.length > 0 && data.value[0][row.internalName] != null) {
            console.warn(`❌ ABORT: Live probe (select fallback) found data in ${row.internalName}!`);
            continue;
          }
        } catch (_error) {
          console.warn(`⚠️  Live probe failed even with select fallback for ${row.internalName}, skipping for safety.`);
          continue;
        }
      } else {
        console.warn(`⚠️  Live probe failed for ${row.internalName}, skipping for safety: ${e.message}`);
        continue;
      }
    }

    // EXECUTE DELETE
    console.log(`🔥 DELETING field ${row.internalName}...`);
    try {
      // PRE-DELETION SNAPSHOT
      const fieldDetailUrl = `${normalizedSiteUrl}/lists/getbytitle('${row.listTitle}')/fields(guid'${row.fieldId}')`;
      const fullFieldData = await spFetch(fieldDetailUrl, auth);
      
      const deleteUrl = `${normalizedSiteUrl}/lists/getbytitle('${row.listTitle}')/fields(guid'${row.fieldId}')`;
      await spFetch(deleteUrl, auth, { 
        method: 'POST', 
        headers: {
          'X-HTTP-Method': 'DELETE',
          'IF-MATCH': '*'
        }
      });
      console.log(`✅ Deleted successfully.`);
      
      const deletedAt = new Date().toISOString();

      // LOG DELETION WITH SNAPSHOT
      const logFile = join(REPO_ROOT, 'docs', 'nightly-patrol', 'deletion-log.json');
      const logEntry = {
        listKey: row.listKey,
        listTitle: row.listTitle,
        internalName: row.internalName,
        displayName: row.displayName,
        fieldId: row.fieldId,
        deletedAt: deletedAt,
        batchId: BATCH_ID,
        evidence: {
          usageCount: row.usageCount,
          hasData: row.hasData,
          confidence: row.confidence
        },
        snapshot: fullFieldData
      };
      
      let existingLogs = [];
      if (existsSync(logFile)) {
        try {
          existingLogs = JSON.parse(readFileSync(logFile, 'utf-8'));
        } catch (_error) { /* ignore */ }
      }
      existingLogs.push(logEntry);
      writeFileSync(logFile, JSON.stringify(existingLogs, null, 2));

      // SHAREPOINT AUDIT LOG
      await logToSharePoint(normalizedSiteUrl, auth, logEntry, BATCH_ID);

      successCount++;
      // Delay to avoid throttle
      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      console.error(`❌ Failed to delete ${row.internalName}: ${e.message}`);
      failCount++;
    }
  }

  console.log(`\n🏁 Purge process completed. Success: ${successCount}, Failed: ${failCount}`);

  // GENERATE SESSION SUMMARY
  if (successCount > 0 || failCount > 0) {
    const dateStamp = new Date().toISOString().split('T')[0];
    const summaryFile = join(REPO_ROOT, 'docs', 'nightly-patrol', `purge-summary-${dateStamp}.json`);
    const summary = {
      batchId: BATCH_ID,
      timestamp: new Date().toISOString(),
      mode: confirm ? 'EXECUTE' : 'DRY-RUN',
      totalFound: activeCandidates.length,
      successCount,
      failCount,
      targetList: targetList || 'ALL',
      maxDeletes,
      batchSize
    };
    writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
    console.log(`📝 Session summary saved to ${summaryFile}`);
    
    const latestFile = join(REPO_ROOT, 'docs', 'nightly-patrol', 'latest-purge-summary.json');
    writeFileSync(latestFile, JSON.stringify(summary, null, 2));
  }
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
