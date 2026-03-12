/**
 * Step 4: CRUD Verification
 *
 * Runs Read / Create / Update against each target entity.
 * Write operations are gated by isWriteEnabled.
 */
import { isWriteEnabled } from '@/env';
import { SP_LIST_REGISTRY } from '@/sharepoint/spListRegistry';
import type { CrudResult, Fetcher } from '../types';
import { CRUD_TARGETS } from './crudTargets';

export async function runStep4(
  fetcher: Fetcher,
  appendLog: (msg: string) => void,
): Promise<CrudResult[]> {
  appendLog('🧪 Step4: CRUD確認開始...');
  const results: CrudResult[] = [];

  for (const target of CRUD_TARGETS) {
    const entry = SP_LIST_REGISTRY.find(e => e.key === target.listKey);
    if (!entry) continue;
    const listName = entry.resolve();
    const listPath = `/_api/web/lists/getbytitle('${encodeURIComponent(listName)}')`;
    appendLog(`  🧪 ${target.entity} (${listName})...`);

    const result: CrudResult = {
      entity: target.entity,
      listName,
      read: 'pending',
      create: target.createPayload ? 'pending' : 'skip',
      update: target.updateField ? 'pending' : 'skip',
    };

    // ── READ ──
    try {
      const readResp = await fetcher(`${listPath}/items?$top=5&$select=${target.selectFields}`);
      if (readResp.ok) {
        const data = await readResp.json();
        result.read = 'ok';
        result.readCount = (data.value || []).length;
        appendLog(`    ✅ Read: ${result.readCount} items`);
      } else {
        result.read = 'fail';
        result.readError = `HTTP ${readResp.status}`;
        appendLog(`    ❌ Read: HTTP ${readResp.status}`);
      }
    } catch (err) {
      result.read = 'fail';
      result.readError = err instanceof Error ? err.message : String(err);
      appendLog(`    ❌ Read: ${result.readError}`);
    }

    // ── CREATE ──
    if (target.createPayload && isWriteEnabled) {
      try {
        const listInfoResp = await fetcher(`${listPath}?$select=ListItemEntityTypeFullName`);
        const listInfo = await listInfoResp.json();
        const entityType = listInfo.ListItemEntityTypeFullName;

        const createResp = await fetcher(`${listPath}/items`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json;odata=nometadata',
            Accept: 'application/json;odata=nometadata',
          },
          body: JSON.stringify({
            ...target.createPayload,
            __metadata: entityType ? { type: entityType } : undefined,
          }),
        });
        if (createResp.ok || createResp.status === 201) {
          const created = await createResp.json();
          result.create = 'ok';
          result.createdId = created.Id;
          appendLog(`    ✅ Create: Id=${created.Id}`);
        } else {
          const errBody = await createResp.text().catch(() => '');
          result.create = 'fail';
          result.createError = `HTTP ${createResp.status}: ${errBody.slice(0, 200)}`;
          appendLog(`    ❌ Create: HTTP ${createResp.status}`);
        }
      } catch (err) {
        result.create = 'fail';
        result.createError = err instanceof Error ? err.message : String(err);
        appendLog(`    ❌ Create: ${result.createError}`);
      }
    } else if (target.createPayload && !isWriteEnabled) {
      result.create = 'skip';
      result.createError = 'WRITE_DISABLED';
      appendLog(`    ⏭ Create: WRITE_DISABLED`);
    }

    // ── UPDATE ──
    if (target.updateField && result.createdId && isWriteEnabled) {
      try {
        const updateResp = await fetcher(`${listPath}/items(${result.createdId})`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json;odata=nometadata',
            Accept: 'application/json;odata=nometadata',
            'X-HTTP-Method': 'MERGE',
            'If-Match': '*',
          },
          body: JSON.stringify({
            [target.updateField]: target.updateValue,
          }),
        });
        if (updateResp.ok || updateResp.status === 204) {
          result.update = 'ok';
          appendLog(`    ✅ Update: Id=${result.createdId}`);
        } else {
          result.update = 'fail';
          result.updateError = `HTTP ${updateResp.status}`;
          appendLog(`    ❌ Update: HTTP ${updateResp.status}`);
        }
      } catch (err) {
        result.update = 'fail';
        result.updateError = err instanceof Error ? err.message : String(err);
        appendLog(`    ❌ Update: ${result.updateError}`);
      }
    } else if (target.updateField && !result.createdId) {
      result.update = 'skip';
      result.updateError = 'No item created';
    }

    results.push(result);
  }

  const readOk = results.filter(r => r.read === 'ok').length;
  const createOk = results.filter(r => r.create === 'ok').length;
  const updateOk = results.filter(r => r.update === 'ok').length;
  appendLog(`🧪 Step4完了: Read ${readOk}/${results.length}, Create ${createOk}, Update ${updateOk}`);
  return results;
}
