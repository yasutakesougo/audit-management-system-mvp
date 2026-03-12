/**
 * Step 2: Field Verification
 *
 * For each list in FIELD_MAPS, fetches tenant fields and compares
 * InternalName / TypeAsString / Required against app expectations.
 */
import { SP_LIST_REGISTRY } from '@/sharepoint/spListRegistry';
import { FIELD_MAPS, FIELD_TYPE_HINTS, TYPE_EXPECTATIONS } from '../constants';
import type { Fetcher, FieldCheckResult } from '../types';

export async function runStep2(
  fetcher: Fetcher,
  appendLog: (msg: string) => void,
): Promise<FieldCheckResult[]> {
  appendLog('🔍 Step2: フィールド照合開始...');
  const results: FieldCheckResult[] = [];

  for (const [listKey, fieldMap] of Object.entries(FIELD_MAPS)) {
    const entry = SP_LIST_REGISTRY.find(e => e.key === listKey);
    if (!entry) continue;
    const listName = entry.resolve();
    appendLog(`  🔎 ${entry.displayName} (${listName}) のフィールド確認中...`);

    const listPath = listName.toLowerCase().startsWith('guid:')
      ? `/_api/web/lists(guid'${listName.slice(5).trim()}')/fields?$filter=Hidden eq false&$select=InternalName,TypeAsString,Required`
      : `/_api/web/lists/getbytitle('${encodeURIComponent(listName)}')/fields?$filter=Hidden eq false&$select=InternalName,TypeAsString,Required`;

    try {
      const response = await fetcher(listPath);
      if (!response.ok) {
        appendLog(`  ⚠️ ${listName}: HTTP ${response.status}`);
        for (const [, spFieldName] of Object.entries(fieldMap)) {
          results.push({
            listKey, listName,
            fieldApp: spFieldName,
            fieldTenant: '(list inaccessible)',
            exists: false,
            typeMatch: null,
            tenantType: null,
            required: false,
            isLookup: false,
            status: 'missing',
          });
        }
        continue;
      }

      const data = await response.json();
      const tenantFields: Array<{ InternalName: string; TypeAsString: string; Required: boolean }> = data.value || [];
      const tenantFieldMap = new Map(tenantFields.map(f => [f.InternalName, f]));

      for (const [logicalName, spFieldName] of Object.entries(fieldMap)) {
        if (['Id', 'Title', 'Created', 'Modified'].includes(spFieldName)) {
          results.push({
            listKey, listName,
            fieldApp: spFieldName,
            fieldTenant: spFieldName,
            exists: true,
            typeMatch: true,
            tenantType: tenantFieldMap.get(spFieldName)?.TypeAsString ?? 'system',
            required: false,
            isLookup: false,
            status: 'ok',
          });
          continue;
        }

        const tenantField = tenantFieldMap.get(spFieldName);
        if (tenantField) {
          const hint = FIELD_TYPE_HINTS[spFieldName];
          const allowed = hint ? (TYPE_EXPECTATIONS[hint] ?? []) : [];
          const isTypeMismatch = hint ? !allowed.includes(tenantField.TypeAsString) : false;

          if (isTypeMismatch) {
            appendLog(`  ⚠️ ${listName}.${spFieldName}: 型不一致 — expected ${hint}(${allowed.join('/')}) actual=${tenantField.TypeAsString}`);
          }

          results.push({
            listKey, listName,
            fieldApp: spFieldName,
            fieldTenant: tenantField.InternalName,
            exists: true,
            typeMatch: !isTypeMismatch,
            tenantType: tenantField.TypeAsString,
            required: tenantField.Required,
            isLookup: tenantField.TypeAsString === 'Lookup',
            status: isTypeMismatch ? 'type_mismatch' : 'ok',
            expectedJsType: hint,
          });
        } else {
          results.push({
            listKey, listName,
            fieldApp: spFieldName,
            fieldTenant: '(not found)',
            exists: false,
            typeMatch: null,
            tenantType: null,
            required: false,
            isLookup: false,
            status: 'missing',
          });
          appendLog(`  ❌ ${listName}.${spFieldName} (${logicalName}) が見つかりません`);
        }
      }
      const mappedInternalNames = new Set(Object.values(fieldMap));
      const unmappedRequired = tenantFields.filter(
        f => f.Required && !mappedInternalNames.has(f.InternalName) && !['ContentType', 'ContentTypeId'].includes(f.InternalName)
      );
      for (const f of unmappedRequired) {
        results.push({
          listKey, listName,
          fieldApp: '(unmapped)',
          fieldTenant: f.InternalName,
          exists: true,
          typeMatch: null,
          tenantType: f.TypeAsString,
          required: true,
          isLookup: f.TypeAsString === 'Lookup',
          status: 'unmapped_required',
        });
        appendLog(`  ⚠️ ${listName}: Required列 "${f.InternalName}" がFIELD_MAPに未定義 — Create時に400エラーの原因になります`);
      }

      const lookupFields = tenantFields.filter(
        f => f.TypeAsString === 'Lookup' && mappedInternalNames.has(f.InternalName)
      );
      for (const f of lookupFields) {
        const existing = results.find(r => r.listKey === listKey && r.fieldTenant === f.InternalName);
        if (existing) {
          existing.isLookup = true;
        }
        appendLog(`  🔗 ${listName}.${f.InternalName}: Lookup型 — REST APIにはnumber(ID)で送信が必要です`);
      }

    } catch (err) {
      appendLog(`  ❌ ${listName}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const missing = results.filter(r => r.status === 'missing').length;
  const ok = results.filter(r => r.status === 'ok').length;
  const typeMismatch = results.filter(r => r.status === 'type_mismatch').length;
  const reqWarnings = results.filter(r => r.status === 'unmapped_required').length;
  const lookupWarnings = results.filter(r => r.isLookup).length;
  appendLog(`🔍 Step2完了: ${ok} OK, ${missing} 未発見, ${typeMismatch} 型不一致, ${reqWarnings} Required警告, ${lookupWarnings} Lookup検出`);
  return results;
}
