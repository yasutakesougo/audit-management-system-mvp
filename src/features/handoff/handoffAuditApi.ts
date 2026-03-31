/**
 * 申し送り監査ログ（更新履歴）API
 *
 * ステータス変更・フィールド更新・コメント追加などの操作履歴を記録。
 * handoffConfig.storage の値に応じて localStorage / SharePoint を切り替え。
 */

import { auditLog } from '@/lib/debugLogger';
import { useCallback, useMemo, useState } from 'react';
import type { UseSP } from '../../lib/spClient';
import { useSP } from '../../lib/spClient';
import type {
    AuditFieldName,
    HandoffAuditLog,
    NewAuditLogInput,
    SpHandoffAuditLogItem
} from './handoffAuditTypes';
import { fromSpAuditLogItem, toSpAuditLogCreatePayload } from './handoffAuditTypes';
import { handoffConfig } from './handoffConfig';
import { buildEq } from '@/sharepoint/query/builders';

// ────────────────────────────────────────────────────────────
// Handoff Audit sub-list field SSOT
// ────────────────────────────────────────────────────────────

/** Field names for the Handoff Audit Log sub-list (separate from main Handoff list) */
const SP_AUDIT_FIELDS = {
  handoffId: 'HandoffId',
} as const;

// ────────────────────────────────────────────────────────────
// localStorage ストレージ
// ────────────────────────────────────────────────────────────

const AUDIT_STORAGE_KEY = 'handoff.auditLog.dev.v1';

type AuditStorageShape = Record<string, HandoffAuditLog[]>; // key = handoffId

function loadAuditStorage(): AuditStorageShape {
  try {
    const raw = window.localStorage.getItem(AUDIT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuditStorageShape) : {};
  } catch {
    return {};
  }
}

function saveAuditStorage(data: AuditStorageShape): void {
  try {
    window.localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(data));
  } catch {
    auditLog.warn('handoff', 'handoff.audit_storage_save_failed');
  }
}

function generateLocalId(): number {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return parseInt(crypto.randomUUID().replace(/-/g, '').slice(0, 8), 16);
  }
  return Date.now() + Math.floor(Math.random() * 1000);
}

// ────────────────────────────────────────────────────────────
// 監査ログ API クラス
// ────────────────────────────────────────────────────────────

const SP_AUDIT_LIST_TITLE = 'Handoff_AuditLog';

class HandoffAuditApi {
  private sp: UseSP;

  constructor(sp: UseSP) {
    this.sp = sp;
  }

  /**
   * 指定申し送りの更新履歴を取得（新しい順）
   */
  async getAuditLogs(handoffId: number): Promise<HandoffAuditLog[]> {
    if (handoffConfig.storage !== 'sharepoint') {
      return this.getAuditLogsLocal(handoffId);
    }
    return this.getAuditLogsSP(handoffId);
  }

  /**
   * 監査ログを記録
   */
  async recordLog(input: NewAuditLogInput): Promise<HandoffAuditLog> {
    if (handoffConfig.storage !== 'sharepoint') {
      return this.recordLogLocal(input);
    }
    return this.recordLogSP(input);
  }

  /**
   * ステータス変更を記録するヘルパー
   */
  async recordStatusChange(
    handoffId: number,
    oldStatus: string,
    newStatus: string,
    changedBy: string,
    changedByAccount: string
  ): Promise<HandoffAuditLog> {
    return this.recordLog({
      handoffId,
      action: 'status_changed',
      fieldName: 'status',
      oldValue: oldStatus,
      newValue: newStatus,
      changedBy,
      changedByAccount,
    });
  }

  /**
   * フィールド更新を記録するヘルパー
   */
  async recordFieldUpdate(
    handoffId: number,
    fieldName: AuditFieldName,
    oldValue: string | undefined,
    newValue: string | undefined,
    changedBy: string,
    changedByAccount: string
  ): Promise<HandoffAuditLog> {
    return this.recordLog({
      handoffId,
      action: 'field_updated',
      fieldName,
      oldValue,
      newValue,
      changedBy,
      changedByAccount,
    });
  }

  /**
   * 作成を記録するヘルパー
   */
  async recordCreation(
    handoffId: number,
    changedBy: string,
    changedByAccount: string
  ): Promise<HandoffAuditLog> {
    return this.recordLog({
      handoffId,
      action: 'created',
      changedBy,
      changedByAccount,
    });
  }

  /**
   * コメント追加を記録するヘルパー
   */
  async recordCommentAdded(
    handoffId: number,
    changedBy: string,
    changedByAccount: string
  ): Promise<HandoffAuditLog> {
    return this.recordLog({
      handoffId,
      action: 'comment_added',
      changedBy,
      changedByAccount,
    });
  }

  // ── localStorage 実装 ──

  private getAuditLogsLocal(handoffId: number): HandoffAuditLog[] {
    const data = loadAuditStorage();
    return (data[String(handoffId)] ?? []).sort(
      (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
    );
  }

  private recordLogLocal(input: NewAuditLogInput): HandoffAuditLog {
    const data = loadAuditStorage();
    const key = String(input.handoffId);
    const log: HandoffAuditLog = {
      id: generateLocalId(),
      handoffId: input.handoffId,
      action: input.action,
      fieldName: input.fieldName,
      oldValue: input.oldValue,
      newValue: input.newValue,
      changedBy: input.changedBy,
      changedByAccount: input.changedByAccount,
      changedAt: new Date().toISOString(),
    };
    data[key] = [...(data[key] ?? []), log];
    saveAuditStorage(data);
    return log;
  }

  // ── SharePoint 実装 ──

  private async getAuditLogsSP(handoffId: number): Promise<HandoffAuditLog[]> {
    const filter = buildEq(SP_AUDIT_FIELDS.handoffId, handoffId);
    const query = `?$filter=${encodeURIComponent(filter)}&$orderby=Created desc`;
    const response = await this.sp.spFetch(
      `lists/getbytitle('${SP_AUDIT_LIST_TITLE}')/items${query}`
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch audit logs: ${response.status}`);
    }
    const data = await response.json();
    const items: SpHandoffAuditLogItem[] = data.value || [];
    return items.map(fromSpAuditLogItem);
  }

  private async recordLogSP(input: NewAuditLogInput): Promise<HandoffAuditLog> {
    const payload = toSpAuditLogCreatePayload(input);
    const response = await this.sp.spFetch(
      `lists/getbytitle('${SP_AUDIT_LIST_TITLE}')/items`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json;odata=verbose' },
        body: JSON.stringify(payload),
      }
    );
    if (!response.ok) {
      throw new Error(`Failed to create audit log: ${response.status}`);
    }
    const result = await response.json();
    return fromSpAuditLogItem(result.d ?? result);
  }
}

// ────────────────────────────────────────────────────────────
// React Hooks
// ────────────────────────────────────────────────────────────

export const useHandoffAuditApi = () => {
  const sp = useSP();
  return useMemo(() => new HandoffAuditApi(sp), [sp]);
};

/**
 * 申し送り更新履歴参照Hook
 */
export function useHandoffAuditLog(handoffId: number) {
  const api = useHandoffAuditApi();
  const [logs, setLogs] = useState<HandoffAuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getAuditLogs(handoffId);
      setLogs(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新履歴の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [api, handoffId]);

  return {
    logs,
    loading,
    error,
    loadLogs,
    logCount: logs.length,
  };
}
