/**
 * Alert Action Types
 *
 * Today Execution Layer: 朝会アラートを "行動リスト" として扱うための型定義。
 * ステータスは全アラート共通、アクションは種類別。
 */

/** 共通ステータス（全アラート共通） */
export type ActionStatus = 'todo' | 'doing' | 'done' | 'snoozed';

/** アラート種類ごとのアクション定義 */
export type ActionDef = {
  id: string;
  label: string;
  primary?: boolean;
};

/** 種類別アクション定義マップ */
export const ALERT_ACTION_DEFS: Record<string, ActionDef[]> = {
  absent: [
    { id: 'contact-confirm', label: '📞 連絡確認', primary: true },
    { id: 'handover-create', label: '📝 申し送り作成' },
  ],
  late: [
    { id: 'arrival-confirm', label: '⏱ 到着確認', primary: true },
    { id: 'transport-confirm', label: '🚗 送迎確認' },
    { id: 'handover-create', label: '📝 申し送り作成' },
  ],
  early: [
    { id: 'departure-confirm', label: '✅ 退所確認', primary: true },
    { id: 'handover-create', label: '📝 申し送り作成' },
  ],
};

/** アラートキー生成 */
export function buildAlertKey(alertType: string, userId: string, ymd: string): string {
  return `${alertType}:${userId}:${ymd}`;
}

/** localStorage の状態マップ: alertKey → ActionStatus */
export type AlertActionState = Record<string, ActionStatus>;
