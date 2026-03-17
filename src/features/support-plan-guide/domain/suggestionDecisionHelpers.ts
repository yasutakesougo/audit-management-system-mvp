/**
 * suggestionDecisionHelpers — 提案判断の永続化ヘルパー（純粋関数）
 *
 * P3-D: SmartTab / 改善メモの判断記録を管理する。
 *
 * 設計:
 *  - append-only 配列として保存
 *  - UI は id ごとの最新レコードのみを参照
 *  - getLatestDecisionMap() で最新状態の Map を生成
 */

import type {
  SuggestionDecisionAction,
  SuggestionDecisionRecord,
  SuggestionDecisionSource,
} from '../types';

// ────────────────────────────────────────────
// 最新状態の抽出
// ────────────────────────────────────────────

/**
 * append-only の決定配列から、id ごとの最新アクションを取得する。
 *
 * 後ろから走査するので、同じ id に複数レコードがあれば
 * 最後に追加されたもの（＝最新）が採用される。
 */
export function getLatestDecisionMap(
  records: SuggestionDecisionRecord[],
): Map<string, SuggestionDecisionRecord> {
  const map = new Map<string, SuggestionDecisionRecord>();
  // 先頭から走査 → 同じ id があれば上書き → 結果的に最後が残る
  for (const record of records) {
    map.set(record.id, record);
  }
  return map;
}

/**
 * 特定 source の最新決定のみを Record<id, action> で返す。
 *
 * hook の初期状態復元に使う。
 */
export function getDecisionsBySource(
  records: SuggestionDecisionRecord[],
  source: SuggestionDecisionSource,
): Record<string, SuggestionDecisionAction> {
  const result: Record<string, SuggestionDecisionAction> = {};
  for (const record of records) {
    if (record.source === source) {
      result[record.id] = record.action;
    }
  }
  return result;
}

// ────────────────────────────────────────────
// レコード追加
// ────────────────────────────────────────────

/**
 * 決定レコードを append する（immutable）。
 * undo の場合はレコードを削除するのではなく、配列から該当 id の最新を除去する。
 */
export function appendDecisionRecord(
  records: SuggestionDecisionRecord[],
  id: string,
  source: SuggestionDecisionSource,
  action: SuggestionDecisionAction,
): SuggestionDecisionRecord[] {
  const newRecord: SuggestionDecisionRecord = {
    id,
    source,
    action,
    decidedAt: new Date().toISOString(),
  };
  return [...records, newRecord];
}

/**
 * undo 用: 指定 id + source の全レコードを除去する。
 *
 * pending に戻す操作なので、履歴自体を消す設計。
 * 分析用途で残したい場合は append-only で 'pending' レコードを足す方式に将来変更可能。
 */
export function removeDecisionRecords(
  records: SuggestionDecisionRecord[],
  id: string,
  source: SuggestionDecisionSource,
): SuggestionDecisionRecord[] {
  return records.filter((r) => !(r.id === id && r.source === source));
}

// ────────────────────────────────────────────
// サニタイズ
// ────────────────────────────────────────────

/** 有効な SuggestionDecisionAction の一覧 */
const VALID_ACTIONS: ReadonlySet<string> = new Set<SuggestionDecisionAction>([
  'accepted',
  'dismissed',
  'noted',
  'deferred',
  'promoted',
]);

/** 有効な SuggestionDecisionSource の一覧 */
const VALID_SOURCES: ReadonlySet<string> = new Set<SuggestionDecisionSource>([
  'smart',
  'memo',
]);

/**
 * 外部入力（localStorage / SP）から読み込んだ配列をサニタイズする。
 *
 * 不正なレコードは静かにスキップし、有効なもののみ返す。
 */
export function sanitizeDecisionRecords(
  raw: unknown,
): SuggestionDecisionRecord[] {
  if (!Array.isArray(raw)) return [];

  const result: SuggestionDecisionRecord[] = [];
  for (const item of raw) {
    if (item == null || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    if (
      typeof record.id !== 'string' ||
      typeof record.source !== 'string' ||
      typeof record.action !== 'string' ||
      typeof record.decidedAt !== 'string'
    ) {
      continue;
    }
    if (!VALID_ACTIONS.has(record.action)) continue;
    if (!VALID_SOURCES.has(record.source)) continue;

    result.push({
      id: record.id,
      source: record.source as SuggestionDecisionSource,
      action: record.action as SuggestionDecisionAction,
      decidedAt: record.decidedAt,
    });
  }
  return result;
}
