/**
 * DriftEvent — SharePoint スキーマのドリフト（不整合）を記録するドメインモデル
 * 
 * 施設運営において「ドリフトは異常ではなくイベント（事実）」として扱い、
 * 自動修復の履歴を可観測性のための資産として蓄積する。
 */
export type DriftResolutionType = 'fuzzy_match' | 'fallback' | 'manual';

/**
 * ドリフトの具体的な種類
 * 予兆検知や自動クリーンアップの判定材料として使用する。
 */
export type DriftType = 
  | 'case_mismatch'   // 大文字小文字の違い (例: FullName vs fullname)
  | 'suffix_mismatch' // カラムサフィックスの付与 (例: Status -> Status0)
  | 'fuzzy_match'    // 文字列置換等による曖昧一致 (例: _x0020_ 変換)
  | 'fallback'       // 代替カラムの使用
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
  /** 緊急度 (ドリフトは原則 warn / info) */
  severity: 'warn' | 'info';
  /** 解決方法 */
  resolutionType: DriftResolutionType;
  /** ドリフトの詳細型 */
  driftType?: DriftType;
  /** 解決済みフラグ（物理名が正規化されたら true） */
  resolved: boolean;
};

import { driftEventBus } from './DriftEventBus';

/**
 * ドリフトイベントの発火
 */
export const emitDriftRecord = (
  listName: string, 
  fieldName: string, 
  resolution: DriftResolutionType = 'fuzzy_match',
  driftType: DriftType = 'unknown'
) => {
  driftEventBus.emit({
    listName,
    fieldName,
    detectedAt: new Date().toISOString(),
    severity: 'warn',
    resolutionType: resolution,
    driftType,
    resolved: false
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
