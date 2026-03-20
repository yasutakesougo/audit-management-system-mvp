/**
 * buildUserAlerts — 利用者ごとの直近注意点を ABCRecord[] から導出
 *
 * 純関数。Today の利用者カードに「山田さん: 自傷↑ / 見通しカード実施中」
 * のような1〜2行のアラートを出す。
 *
 * 情報源:
 * - ABCRecord.behavior + intensity → 行動アラート（高強度行動）
 * - ABCRecord.referencedStrategies (applied=true) → 実施中の戦略
 *
 * 設計方針:
 * - 最大 MAX_ALERTS_PER_USER 件に絞る
 * - 情報がなければ空配列（UI側は何も出さない）
 * - 日付境界は関数外で制御（呼び出し側が期間を決める）
 *
 * @see UserCompactList — UI消費先
 */
import type { ABCRecord } from '@/domain/behavior/abc';

// ── 定数 ──────────────────────────────────────────────────────

/** カードに出す注意点の最大数 */
const MAX_ALERTS_PER_USER = 2;

/** この強度以上を「注意が必要」と見なす閾値 */
const HIGH_INTENSITY_THRESHOLD = 3;

/** トレンド判定の期間区切り（直近 N 日を current とする） */
const TREND_CURRENT_DAYS = 3;

// ── 型 ────────────────────────────────────────────────────────

export type AlertSeverity = 'warning' | 'info';

export interface UserAlert {
  /** アラートの種別 */
  type: 'high-intensity' | 'active-strategy';
  /** 表示用ラベル（例: "自傷 ↑", "見通しカード 実施中"） */
  label: string;
  /** 視覚的な重要度 */
  severity: AlertSeverity;
}

export interface UserAlertsResult {
  /** ユーザーID → アラート配列 */
  byUser: Map<string, UserAlert[]>;
}

// ── メイン関数 ─────────────────────────────────────────────────

/**
 * ABCRecord の配列から、利用者ごとの注意点（最大 MAX_ALERTS_PER_USER）を導出する。
 *
 * @param records    - 対象期間の全 ABCRecord（全利用者分）
 * @param now        - 現在日時（テスト可能にするため inject）
 */
export function buildUserAlerts(
  records: ReadonlyArray<ABCRecord>,
  now: Date = new Date(),
): UserAlertsResult {
  // userId 別にグループ化
  const grouped = new Map<string, ABCRecord[]>();
  for (const rec of records) {
    const arr = grouped.get(rec.userId) ?? [];
    arr.push(rec);
    grouped.set(rec.userId, arr);
  }

  const byUser = new Map<string, UserAlert[]>();

  for (const [userId, userRecords] of grouped) {
    const alerts: UserAlert[] = [];

    // ── 1. 高強度行動アラート ──
    const highIntensityAlerts = buildHighIntensityAlerts(userRecords, now);
    alerts.push(...highIntensityAlerts);

    // ── 2. 実施中の戦略ラベル ──
    const strategyAlerts = buildActiveStrategyAlerts(userRecords);
    alerts.push(...strategyAlerts);

    // 上限まで切り詰め
    if (alerts.length > 0) {
      byUser.set(userId, alerts.slice(0, MAX_ALERTS_PER_USER));
    }
  }

  return { byUser };
}

// ── 内部関数: 高強度行動 ──────────────────────────────────────

function buildHighIntensityAlerts(
  records: ABCRecord[],
  now: Date,
): UserAlert[] {
  // 高強度レコードだけ抽出
  const highRecords = records.filter(
    (r) => r.intensity >= HIGH_INTENSITY_THRESHOLD,
  );
  if (highRecords.length === 0) return [];

  // 直近 TREND_CURRENT_DAYS 日とそれ以前で分割 → トレンド算出
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - TREND_CURRENT_DAYS);

  const recent = highRecords.filter(
    (r) => new Date(r.recordedAt) >= cutoff,
  );
  const older = highRecords.filter(
    (r) => new Date(r.recordedAt) < cutoff,
  );

  // 行動種別ごとに最頻出を算出
  const behaviorCounts = new Map<string, number>();
  for (const r of highRecords) {
    behaviorCounts.set(r.behavior, (behaviorCounts.get(r.behavior) ?? 0) + 1);
  }

  // 最頻出行動
  const topBehavior = [...behaviorCounts.entries()]
    .sort((a, b) => b[1] - a[1])[0];

  if (!topBehavior) return [];

  // トレンド: 直近/以前の日平均を比較
  const recentDays = Math.max(TREND_CURRENT_DAYS, 1);
  const olderDays = Math.max(records.length > 0
    ? Math.ceil(
        (now.getTime() - Math.min(...records.map(r => new Date(r.recordedAt).getTime())))
        / (1000 * 60 * 60 * 24),
      ) - TREND_CURRENT_DAYS
    : 1, 1);

  const recentRate = recent.length / recentDays;
  const olderRate = older.length / olderDays;

  let trend = '→';
  if (recentRate > olderRate * 1.3) trend = '↑';
  else if (recentRate < olderRate * 0.7) trend = '↓';

  const [behaviorName] = topBehavior;
  // 短縮: 括弧の前だけ取る（例: "自傷(叩く)" → "自傷"）
  const shortName = behaviorName.replace(/\(.*\)$/, '').trim();

  return [{
    type: 'high-intensity',
    label: `${shortName} ${trend}`,
    severity: trend === '↑' ? 'warning' : 'info',
  }];
}

// ── 内部関数: 実施中戦略 ──────────────────────────────────────

function buildActiveStrategyAlerts(
  records: ABCRecord[],
): UserAlert[] {
  // 直近5件から applied=true の戦略を収集
  const recentRecords = [...records]
    .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())
    .slice(0, 5);

  const strategyUsage = new Map<string, number>();
  for (const rec of recentRecords) {
    if (!rec.referencedStrategies) continue;
    for (const s of rec.referencedStrategies) {
      if (s.applied) {
        strategyUsage.set(s.strategyText, (strategyUsage.get(s.strategyText) ?? 0) + 1);
      }
    }
  }

  if (strategyUsage.size === 0) return [];

  // 最頻出の戦略を1つ
  const topStrategy = [...strategyUsage.entries()]
    .sort((a, b) => b[1] - a[1])[0];

  if (!topStrategy) return [];

  const [text] = topStrategy;
  // 戦略名が長い場合は切り詰め
  const shortText = text.length > 12 ? text.slice(0, 11) + '…' : text;

  return [{
    type: 'active-strategy',
    label: `${shortText} 実施中`,
    severity: 'info',
  }];
}
