/**
 * DriftEvent — SharePoint スキーマのドリフト（不整合）を記録するドメインモデル
 * 
 * 施設運営において「ドリフトは異常ではなくイベント（事実）」として扱い、
 * 自動修復の履歴を可観測性のための資産として蓄積する。
 */
export type DriftResolutionType = 'fuzzy_match' | 'fallback' | 'manual' | 'runtime_skip' | 'action_required';

/**
 * ドリフトの具体的な種類
 * 予兆検知や自動クリーンアップの判定材料として使用する。
 */
export type DriftType = 
  | 'case_mismatch'   // 大文字小文字の違い (例: FullName vs fullname)
  | 'suffix_mismatch' // カラムサフィックスの付与 (例: Status -> Status0)
  | 'fuzzy_match'    // 文字列置換等による曖昧一致 (例: _x0020_ 変換)
  | 'fallback'       // 代替カラムの使用
  | 'resolution_failure' // 解決失敗（実行時にスキップされた）
  | 'fallback_to_minimal_fields' // 最小構成へのフォールバック
  | 'unknown';

export type DriftEvent = {
  /** ユニークID */
  id?: string;
  /** 対象リストのキー (registry key) または表示名 */
  listName: string;
  /** 対象フィールドの内部名 */
  fieldName: string;
  /** 検知日時 (ISOString) */
  detectedAt: string;
  /** 緊急度 (ドリフトは原則 warn / info / silent) */
  severity: 'warn' | 'info' | 'silent';
  /** 解決方法 */
  resolutionType: DriftResolutionType;
  /** ドリフトの詳細型 */
  driftType?: DriftType;
  /** 解決済みフラグ（物理名が正規化されたら true） */
  resolved: boolean;
  /**
   * 修復実行元の識別子（インデックス修復イベントのみ）
   * - 'ui'      : 管理者がUIボタンから手動実行
   * - 'nightly' : Nightly Patrol による自動実行
   */
  remediationSource?: 'ui' | 'nightly';
  /** 追加詳細（400エラーメッセージ等） */
  description?: string;
};

import { driftEventBus } from './DriftEventBus';

/**
 * ドリフトイベントの発火
 */
export const emitDriftRecord = (
  listName: string, 
  fieldName: string, 
  resolution: DriftResolutionType = 'fuzzy_match',
  driftType: DriftType = 'unknown',
  description?: string,
  severity?: 'warn' | 'info' | 'silent'
) => {
  driftEventBus.emit({
    listName,
    fieldName,
    detectedAt: new Date().toISOString(),
    severity: severity || (resolution === 'action_required' ? 'warn' : 'info'),
    resolutionType: resolution,
    driftType,
    resolved: false,
    description
  });
};

/**
 * 重複排除キーの生成
 * (リスト名 + フィールド名 + 日付) で重複を判定する
 */
export const getDriftEventDedupeKey = (event: Omit<DriftEvent, 'id'>): string => {
  const dateStr = event.detectedAt.split('T')[0]; // YYYY-MM-DD
  return `${event.listName}:${event.fieldName}:${dateStr}`;
};

/**
 * インデックス修復イベントの発火
 *
 * @param source 実行元の識別子。'ui' = 管理者UIから手動実行、'nightly' = Nightly Patrol による自動実行
 */
export const emitIndexRemediationRecord = (
  listName: string,
  fieldName: string,
  action: 'create' | 'delete',
  status: 'success' | 'error',
  _message?: string,
  source: 'ui' | 'nightly' = 'ui'
) => {
  // DriftEventBus を流用して監査ログとする
  driftEventBus.emit({
    listName,
    fieldName,
    detectedAt: new Date().toISOString(),
    severity: status === 'success' ? 'info' : 'warn',
    resolutionType: 'manual',
    driftType: 'unknown',
    resolved: status === 'success',
    remediationSource: source,
  });
};
