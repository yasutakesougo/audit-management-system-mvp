/**
 * deriveDefaultStrategies — 直近記録から初期選択すべき戦略セットを導出
 *
 * 責務:
 * - 直近1件の ABCRecord から referencedStrategies.applied === true を抽出
 * - StrategyChipBar 用の StrategyChipKey Set に変換
 * - 各カテゴリ最大1件、合計最大2件に絞る
 * - 直近記録が古すぎる場合（MAX_AGE_DAYS 超過）は空セットを返す
 *
 * 安全策:
 * - 保存後のリセットは呼び出し側の責務（RecordInputStep が管理）
 * - スロット差異判定は将来拡張ポイント（現時点は userId のみで判断）
 *
 * @see StrategyChipBar — UI消費先
 * @see RecordInputStep  — 呼び出し元
 */
import type { ABCRecord } from '@/domain/behavior/abc';
import type { StrategyCategory } from '@/domain/behavior';

// ── 定数 ──────────────────────────────────────────────────────

/** 初期選択の適用上限（日） — これ以上古い記録は参照しない */
const MAX_AGE_DAYS = 3;

/** カテゴリごと最大件数 */
const MAX_PER_CATEGORY = 1;

/** 合計最大件数 */
const MAX_TOTAL = 2;

// ── 型 ──────────────────────────────────────────────────────

export type StrategyChipKey = `${StrategyCategory}:${string}`;

// contract:allow-interface — Pure function return type, not a domain entity
export interface DeriveDefaultResult {
  /** 初期選択すべき戦略キーの Set */
  defaultKeys: Set<StrategyChipKey>;
  /** 初期選択の由来（UIラベル用） */
  sourceLabel: string | null;
}

// ── 純関数 ──────────────────────────────────────────────────────

/**
 * @param recentRecords - 同一ユーザーの直近 ABCRecord（desc 順想定）
 * @param now           - 現在日時（テスト用に注入可能）
 */
export function deriveDefaultStrategies(
  recentRecords: ABCRecord[],
  now: Date = new Date(),
): DeriveDefaultResult {
  const empty: DeriveDefaultResult = { defaultKeys: new Set(), sourceLabel: null };

  if (recentRecords.length === 0) return empty;

  // 最新の1件を取得
  const latest = recentRecords[0];
  if (!latest.referencedStrategies || latest.referencedStrategies.length === 0) {
    return empty;
  }

  // 古すぎる記録は対象外
  const recordDate = new Date(latest.recordedAt);
  const ageMs = now.getTime() - recordDate.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays > MAX_AGE_DAYS) return empty;

  // applied === true のみ抽出
  const appliedItems = latest.referencedStrategies.filter((s) => s.applied);
  if (appliedItems.length === 0) return empty;

  // カテゴリごと最大1件、合計最大2件に絞る
  const keys = new Set<StrategyChipKey>();
  const categoryCount = new Map<StrategyCategory, number>();

  for (const item of appliedItems) {
    if (keys.size >= MAX_TOTAL) break;

    const catCount = categoryCount.get(item.strategyKey) ?? 0;
    if (catCount >= MAX_PER_CATEGORY) continue;

    const key: StrategyChipKey = `${item.strategyKey}:${item.strategyText}`;
    keys.add(key);
    categoryCount.set(item.strategyKey, catCount + 1);
  }

  if (keys.size === 0) return empty;

  // 由来ラベル（日付 + 時刻）
  const hours = recordDate.getHours();
  const minutes = String(recordDate.getMinutes()).padStart(2, '0');
  const dayDiff = Math.floor(ageDays);
  const dayLabel = dayDiff === 0 ? '今日' : dayDiff === 1 ? '昨日' : `${dayDiff}日前`;
  const sourceLabel = `${dayLabel} ${hours}:${minutes} の記録から反映`;

  return { defaultKeys: keys, sourceLabel };
}
