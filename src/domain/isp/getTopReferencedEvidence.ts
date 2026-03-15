/**
 * getTopReferencedEvidence — よく参照される根拠（ABC / PDCA）を集計
 *
 * 全 EvidenceLinkMap から、各根拠 ID の採用回数をカウントし、
 * 上位N件を返す純粋関数。
 *
 * @module domain/isp/getTopReferencedEvidence
 */

import type { AbcRecord } from '@/domain/abc/abcRecord';
import type { EvidenceLinkMap, StrategyEvidenceKey } from './evidenceLink';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/** ランキング1件分 */
export interface TopReferencedItem {
  /** 参照先 ID */
  id: string;
  /** 表示用ラベル */
  label: string;
  /** 採用回数 */
  count: number;
}

// ─────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────

const STRATEGY_KEYS: StrategyEvidenceKey[] = [
  'antecedentStrategies',
  'teachingStrategies',
  'consequenceStrategies',
];

const DEFAULT_TOP_N = 3;

/**
 * ABC 記録から短い表示ラベルを生成
 *
 * 例: "3/15 活動場面 — 大声を出して立ち上がった"
 */
export function buildAbcLabel(record: AbcRecord): string {
  const date = new Date(record.occurredAt);
  const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
  const setting = record.setting ? `${record.setting} — ` : '';
  const behavior = record.behavior.length > 20
    ? record.behavior.slice(0, 20) + '…'
    : record.behavior;
  return `${dateStr} ${setting}${behavior}`;
}

// ─────────────────────────────────────────────
// Core functions
// ─────────────────────────────────────────────

/**
 * ユーザーの ABC 記録のうち、支援計画で最もよく参照されているものを
 * 上位N件返す。
 *
 * @param userAbcRecordIds - 対象ユーザーの ABC 記録 ID の Set
 * @param allEvidenceLinkMaps - 全 planningSheet の EvidenceLinkMap
 * @param abcRecords - 対象ユーザーの ABC 記録一覧（ラベル生成用）
 * @param topN - 上位何件返すか（デフォルト 3）
 */
export function getTopReferencedAbcRecords(
  userAbcRecordIds: Set<string>,
  allEvidenceLinkMaps: Record<string, EvidenceLinkMap>,
  abcRecords: AbcRecord[],
  topN: number = DEFAULT_TOP_N,
): TopReferencedItem[] {
  if (userAbcRecordIds.size === 0) return [];

  // 採用回数カウント
  const counts = new Map<string, number>();
  for (const linkMap of Object.values(allEvidenceLinkMaps)) {
    for (const key of STRATEGY_KEYS) {
      for (const link of linkMap[key]) {
        if (link.type === 'abc' && userAbcRecordIds.has(link.referenceId)) {
          counts.set(link.referenceId, (counts.get(link.referenceId) ?? 0) + 1);
        }
      }
    }
  }

  if (counts.size === 0) return [];

  // ABC 記録ルックアップ
  const recordLookup = new Map(abcRecords.map(r => [r.id, r]));

  return [...counts.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, topN)
    .map(([id, count]) => {
      const record = recordLookup.get(id);
      return {
        id,
        label: record ? buildAbcLabel(record) : `ABC-${id.slice(0, 8)}`,
        count,
      };
    });
}

/**
 * 支援計画で最もよく参照されている PDCA 項目を上位N件返す。
 *
 * PDCA は EvidenceLink の label（保存時スナップショット）を使用する。
 * EvidenceLink.label にフェーズ情報も含まれている前提。
 *
 * @param allEvidenceLinkMaps - 全 planningSheet の EvidenceLinkMap
 * @param topN - 上位何件返すか（デフォルト 3）
 */
export function getTopReferencedPdcaItems(
  allEvidenceLinkMaps: Record<string, EvidenceLinkMap>,
  topN: number = DEFAULT_TOP_N,
): TopReferencedItem[] {
  // 採用回数カウント + ラベル取得
  const counts = new Map<string, number>();
  const labels = new Map<string, string>();

  for (const linkMap of Object.values(allEvidenceLinkMaps)) {
    for (const key of STRATEGY_KEYS) {
      for (const link of linkMap[key]) {
        if (link.type === 'pdca') {
          counts.set(link.referenceId, (counts.get(link.referenceId) ?? 0) + 1);
          // 最新のラベルを保持（上書きOK — スナップショットは同じはず）
          if (!labels.has(link.referenceId)) {
            labels.set(link.referenceId, link.label);
          }
        }
      }
    }
  }

  if (counts.size === 0) return [];

  return [...counts.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, topN)
    .map(([id, count]) => ({
      id,
      label: labels.get(id) ?? `PDCA-${id.slice(0, 8)}`,
      count,
    }));
}
