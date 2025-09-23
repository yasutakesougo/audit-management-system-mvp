import { useCallback } from 'react';
import { getAuditLogs, clearAudit } from '../../lib/audit';
import { useSP } from '../../lib/spClient';
import { canonicalJSONStringify, computeEntryHash } from '../../lib/hashUtil';
import { AuditInsertItemDTO } from './types';

// SharePoint リスト名
const AUDIT_LIST_NAME = 'Audit_Events';

// 既存 audit.ts はシンプルな構造なのでそのまま map する
// 想定列: Title, ts, actor, action, entity, entity_id, channel, after_json
export const useAuditSync = () => {
  const { addListItemByTitle } = useSP();

  const syncAll = useCallback(async () => {
    const logs = getAuditLogs();
    if (!logs.length) return { total: 0, success: 0 };

    let success = 0;
    for (const ev of logs) {
      const after_json = ev.after ? canonicalJSONStringify(ev.after) : null;
      const base: Omit<AuditInsertItemDTO, 'entry_hash'> = {
        Title: `${ev.action} ${ev.entity}${ev.entity_id ? ' #' + ev.entity_id : ''}`,
        ts: new Date(ev.ts).toISOString(),
        actor: ev.actor,
        action: ev.action,
        entity: ev.entity,
        entity_id: ev.entity_id ?? null,
        channel: ev.channel,
        after_json
      };
      const entry_hash = await computeEntryHash({
        ts: base.ts,
        actor: base.actor,
        action: base.action,
        entity: base.entity,
        entity_id: base.entity_id,
        after_json: base.after_json
      });
      const body: AuditInsertItemDTO = { ...base, entry_hash };
      try {
        await addListItemByTitle<AuditInsertItemDTO, unknown>(AUDIT_LIST_NAME, body);
        success++;
      } catch (e: any) {
        const msg = String(e?.message || e);
        // Treat unique / duplicate violations as success (already inserted)
        if (/duplicate|unique|conflict/i.test(msg)) {
          success++;
        } else {
          console.error('Audit sync failed for item', ev, e);
        }
      }
    }
    if (success === logs.length) clearAudit();
    return { total: logs.length, success };
  }, [addListItemByTitle]);

  return { syncAll };
};