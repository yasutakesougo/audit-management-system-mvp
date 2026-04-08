/**
 * Action Center で表示される「決断カード」の共通型定義
 */

export type ActionCenterKind = 'daily' | 'vital' | 'transport' | 'handoff';

export interface ActionCenterItem {
  id: string;          // 一意なID (例: missing-record-2024-04-08)
  kind: ActionCenterKind;
  priority: 'critical' | 'high' | 'medium';
  title: string;       // カードの見出し
  count: number;       // 未完了の件数
  unit: string;        // 件数の単位 (名, 件 など)
  reasonCode: string;  // 理由コード (daily_missing, vital_missing など)
  actionLabel: string; // ボタンのラベル
  href: string;        // 遷移先のパス（クエリパラメータを含む）
}
