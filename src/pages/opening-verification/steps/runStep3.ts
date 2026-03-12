/**
 * Step 3: SELECT Query Verification
 *
 * Fires $select queries built from FIELD_MAPs against each list
 * to confirm all mapped fields are accessible on the tenant.
 */
import { SP_LIST_REGISTRY } from '@/sharepoint/spListRegistry';
import { SELECT_TARGETS } from '../constants';
import type { Fetcher, SelectCheckResult } from '../types';

export async function runStep3(
  fetcher: Fetcher,
  appendLog: (msg: string) => void,
): Promise<SelectCheckResult[]> {
  appendLog('📊 Step3: SELECTクエリ検証開始...');
  const results: SelectCheckResult[] = [];

  for (const target of SELECT_TARGETS) {
    const entry = SP_LIST_REGISTRY.find(e => e.key === target.listKey);
    if (!entry) {
      appendLog(`  ⚠️ ${target.label}: レジストリに未登録`);
      continue;
    }
    const listName = entry.resolve();
    const selectStr = target.selectFields.join(',');
    appendLog(`  📊 ${target.label} (${target.selectFields.length}列)...`);

    const result: SelectCheckResult = {
      listKey: target.listKey,
      listName,
      selectFields: selectStr,
      fieldCount: target.selectFields.length,
      status: 'pending',
    };

    try {
      const url = `/_api/web/lists/getbytitle('${encodeURIComponent(listName)}')/items?$top=1&$select=${encodeURIComponent(selectStr)}`;
      const response = await fetcher(url);
      result.httpStatus = response.status;

      if (response.ok) {
        const data = await response.json();
        result.status = 'ok';
        result.sampleCount = (data.value || []).length;
        appendLog(`    ✅ SELECT成功: ${target.selectFields.length}列, ${result.sampleCount}件取得`);
      } else {
        const errText = await response.text().catch(() => '');
        result.status = 'fail';
        const fieldMatch = errText.match(/field or property '([^']+)'/i)
          ?? errText.match(/'([^']+)' does not exist/i);
        if (fieldMatch) {
          result.error = `不正フィールド: ${fieldMatch[1]}`;
          appendLog(`    ❌ SELECT失敗: フィールド "${fieldMatch[1]}" がテナントに存在しません`);
        } else {
          result.error = `HTTP ${response.status}: ${errText.slice(0, 150)}`;
          appendLog(`    ❌ SELECT失敗: HTTP ${response.status}`);
        }
      }
    } catch (err) {
      result.status = 'fail';
      result.error = err instanceof Error ? err.message : String(err);
      appendLog(`    ❌ ${target.label}: ${result.error}`);
    }

    results.push(result);
  }

  const ok = results.filter(r => r.status === 'ok').length;
  const fail = results.filter(r => r.status === 'fail').length;
  appendLog(`📊 Step3完了: ${ok}/${results.length} 成功, ${fail} 失敗`);
  return results;
}
