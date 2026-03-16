/**
 * 繰り返しパターン検出 — Pure Function
 *
 * @description
 * HandoffRecord[] から利用者単位の繰り返しパターンを構造化して返す。
 * アラートルール（yes/no）とは異なり、「何がどう繰り返されているか」を
 * 説明可能な形で抽出する。
 *
 * 検出する4種類:
 * 1. same-category-repeat — 同一カテゴリの頻出
 * 2. consecutive-days — 連続日の発生
 * 3. same-timeband-repeat — 同一時間帯への集中
 * 4. unresolved-repeat — 未対応案件の滞留
 *
 * @see alertRules.ts — ルール判定レイヤー（Phase 2-A）
 * @see riskScoring.ts — スコア統合レイヤー（Phase 2-C・後続）
 */

import type {
  HandoffCategory,
  HandoffRecord,
  TimeBand,
} from './analysisTypes';
import { hourToTimeBand } from './computeTimePatterns';

// ────────────────────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────────────────────

export type RepeatingPatternType =
  | 'same-category-repeat'
  | 'consecutive-days'
  | 'same-timeband-repeat'
  | 'unresolved-repeat';

export type PatternConfidence = 'low' | 'medium' | 'high';

export interface RepeatingPattern {
  /** パターン種別 */
  type: RepeatingPatternType;
  /** 対象利用者コード */
  userCode: string;
  /** 対象利用者名 */
  userDisplayName: string;
  /** 関連カテゴリ */
  category?: HandoffCategory;
  /** 関連時間帯 */
  timeBand?: TimeBand;
  /** 出現回数 */
  count: number;
  /** 連続日数（consecutive-days の場合のみ） */
  consecutiveDays?: number;
  /** 根拠となる申し送り ID */
  handoffIds: number[];
  /** 最初に検出された日時 (ISO) */
  firstSeenAt: string;
  /** 最後に検出された日時 (ISO) */
  lastSeenAt: string;
  /** 機械生成のサマリー */
  summary: string;
  /** 信頼度 */
  confidence: PatternConfidence;
}

export interface DetectRepeatingPatternsOptions {
  /** 分析対象期間（日数, デフォルト: 14） */
  periodDays?: number;
  /** 繰り返しと判定する最小回数（デフォルト: 3） */
  minRepeatCount?: number;
  /** 基準日（テスト用, デフォルト: 現在日時） */
  baseDate?: Date;
}

// ────────────────────────────────────────────────────────────
// 内部ヘルパー
// ────────────────────────────────────────────────────────────

function groupByUser(records: HandoffRecord[]): Map<string, HandoffRecord[]> {
  const map = new Map<string, HandoffRecord[]>();
  for (const r of records) {
    if (!r.userCode || r.userCode.trim() === '') continue;
    const group = map.get(r.userCode);
    if (group) group.push(r);
    else map.set(r.userCode, [r]);
  }
  return map;
}

function latestDisplayName(records: HandoffRecord[]): string {
  if (records.length === 0) return '';
  let latest = records[0];
  for (const r of records) {
    if (r.createdAt > latest.createdAt) latest = r;
  }
  return latest.userDisplayName;
}

function computeConfidence(count: number, consecutiveDays?: number): PatternConfidence {
  if ((consecutiveDays ?? 0) >= 3 || count >= 5) return 'high';
  if (count >= 3) return 'medium';
  return 'low';
}

function filterByPeriod(records: HandoffRecord[], periodDays: number, baseDate: Date): HandoffRecord[] {
  const cutoff = new Date(baseDate);
  cutoff.setDate(cutoff.getDate() - periodDays);
  const cutoffIso = cutoff.toISOString();
  return records.filter((r) => r.createdAt >= cutoffIso);
}

function dateRange(records: HandoffRecord[]): { first: string; last: string } {
  if (records.length === 0) return { first: '', last: '' };
  let first = records[0].createdAt;
  let last = records[0].createdAt;
  for (const r of records) {
    if (r.createdAt < first) first = r.createdAt;
    if (r.createdAt > last) last = r.createdAt;
  }
  return { first, last };
}

// ────────────────────────────────────────────────────────────
// パターン検出: 個別関数
// ────────────────────────────────────────────────────────────

/**
 * 1. 同一カテゴリの繰り返し検出
 */
function detectCategoryRepeats(
  userCode: string,
  displayName: string,
  records: HandoffRecord[],
  minCount: number,
  periodDays: number,
): RepeatingPattern[] {
  const patterns: RepeatingPattern[] = [];
  const catGroups = new Map<HandoffCategory, HandoffRecord[]>();

  for (const r of records) {
    const cat = r.category as HandoffCategory;
    const group = catGroups.get(cat);
    if (group) group.push(r);
    else catGroups.set(cat, [r]);
  }

  for (const [category, catRecords] of catGroups) {
    if (catRecords.length < minCount) continue;

    const ids = catRecords.map((r) => r.id);
    const range = dateRange(catRecords);
    const confidence = computeConfidence(catRecords.length);

    patterns.push({
      type: 'same-category-repeat',
      userCode,
      userDisplayName: displayName,
      category,
      count: catRecords.length,
      handoffIds: ids,
      firstSeenAt: range.first,
      lastSeenAt: range.last,
      summary: `${category}が${periodDays}日間で${catRecords.length}回繰り返されています`,
      confidence,
    });
  }

  return patterns;
}

/**
 * 2. 連続日パターン検出
 */
function detectConsecutiveDayPatterns(
  userCode: string,
  displayName: string,
  records: HandoffRecord[],
  baseDate: Date,
): RepeatingPattern[] {
  const patterns: RepeatingPattern[] = [];

  // カテゴリ別に連続日数を確認
  const catGroups = new Map<HandoffCategory, HandoffRecord[]>();
  for (const r of records) {
    const cat = r.category as HandoffCategory;
    const group = catGroups.get(cat);
    if (group) group.push(r);
    else catGroups.set(cat, [r]);
  }

  for (const [category, catRecords] of catGroups) {
    // 日付ごとにグループ化
    const dateMap = new Map<string, HandoffRecord[]>();
    for (const r of catRecords) {
      const dateKey = r.createdAt.substring(0, 10);
      const group = dateMap.get(dateKey);
      if (group) group.push(r);
      else dateMap.set(dateKey, [r]);
    }

    // baseDate から遡って連続日数を数える
    let consecutive = 0;
    const allIds: number[] = [];
    const d = new Date(baseDate);

    for (let i = 0; i < 30; i++) {
      const key = d.toISOString().substring(0, 10);
      const dayRecords = dateMap.get(key);
      if (dayRecords) {
        consecutive++;
        allIds.push(...dayRecords.map((r) => r.id));
      } else {
        break;
      }
      d.setDate(d.getDate() - 1);
    }

    if (consecutive >= 2) {
      const confidence = computeConfidence(allIds.length, consecutive);
      const range = dateRange(allIds.length > 0
        ? records.filter((r) => allIds.includes(r.id))
        : []);

      patterns.push({
        type: 'consecutive-days',
        userCode,
        userDisplayName: displayName,
        category,
        count: allIds.length,
        consecutiveDays: consecutive,
        handoffIds: allIds,
        firstSeenAt: range.first,
        lastSeenAt: range.last,
        summary: `${category}が${consecutive}日連続で報告されています`,
        confidence,
      });
    }
  }

  return patterns;
}

/**
 * 3. 同一時間帯集中パターン
 */
function detectTimeBandRepeats(
  userCode: string,
  displayName: string,
  records: HandoffRecord[],
  minCount: number,
  periodDays: number,
): RepeatingPattern[] {
  const patterns: RepeatingPattern[] = [];

  // category × timeBand でグループ化
  const groups = new Map<string, { category: HandoffCategory; timeBand: TimeBand; records: HandoffRecord[] }>();

  for (const r of records) {
    const date = new Date(r.createdAt);
    if (isNaN(date.getTime())) continue;

    const timeBand = hourToTimeBand(date.getHours());
    const cat = r.category as HandoffCategory;
    const key = `${cat}:${timeBand}`;

    const group = groups.get(key);
    if (group) {
      group.records.push(r);
    } else {
      groups.set(key, { category: cat, timeBand, records: [r] });
    }
  }

  for (const [, { category, timeBand, records: tbRecords }] of groups) {
    if (tbRecords.length < minCount) continue;

    const ids = tbRecords.map((r) => r.id);
    const range = dateRange(tbRecords);
    const confidence = computeConfidence(tbRecords.length);

    patterns.push({
      type: 'same-timeband-repeat',
      userCode,
      userDisplayName: displayName,
      category,
      timeBand,
      count: tbRecords.length,
      handoffIds: ids,
      firstSeenAt: range.first,
      lastSeenAt: range.last,
      summary: `${timeBand}に${category}が${periodDays}日間で${tbRecords.length}回集中しています`,
      confidence,
    });
  }

  return patterns;
}

/**
 * 4. 未対応案件の滞留パターン
 */
function detectUnresolvedRepeats(
  userCode: string,
  displayName: string,
  records: HandoffRecord[],
): RepeatingPattern[] {
  const patterns: RepeatingPattern[] = [];

  const TERMINAL_STATUSES = new Set(['対応済', '完了', '確認済']);
  const WATCH_CATEGORIES: HandoffCategory[] = ['家族連絡', '事故・ヒヤリ', '体調'];

  for (const category of WATCH_CATEGORIES) {
    const unresolved = records.filter(
      (r) => r.category === category && !TERMINAL_STATUSES.has(r.status),
    );

    if (unresolved.length < 2) continue;

    const ids = unresolved.map((r) => r.id);
    const range = dateRange(unresolved);
    const confidence = computeConfidence(unresolved.length);

    patterns.push({
      type: 'unresolved-repeat',
      userCode,
      userDisplayName: displayName,
      category,
      count: unresolved.length,
      handoffIds: ids,
      firstSeenAt: range.first,
      lastSeenAt: range.last,
      summary: `${category}の未対応案件が${unresolved.length}件滞留しています`,
      confidence,
    });
  }

  return patterns;
}

// ────────────────────────────────────────────────────────────
// メイン関数
// ────────────────────────────────────────────────────────────

/**
 * 申し送りの繰り返しパターンを検出する。
 *
 * @param records 分析対象の申し送りレコード
 * @param options 検出オプション
 * @returns 検出されたパターン一覧（confidence 降順 → count 降順 → lastSeenAt 降順）
 *
 * @example
 * ```ts
 * const patterns = detectRepeatingPatterns(records, { periodDays: 14 });
 * // patterns[0] → { type: 'consecutive-days', category: '体調', consecutiveDays: 3, ... }
 * ```
 */
export function detectRepeatingPatterns(
  records: HandoffRecord[],
  options?: DetectRepeatingPatternsOptions,
): RepeatingPattern[] {
  const periodDays = options?.periodDays ?? 14;
  const minRepeatCount = options?.minRepeatCount ?? 3;
  const baseDate = options?.baseDate ?? new Date();

  if (records.length === 0) return [];

  // 期間フィルタ
  const filtered = filterByPeriod(records, periodDays, baseDate);
  if (filtered.length === 0) return [];

  const userGroups = groupByUser(filtered);
  const allPatterns: RepeatingPattern[] = [];

  for (const [userCode, userRecords] of userGroups) {
    const displayName = latestDisplayName(userRecords);

    // 4種類のパターンを個別に検出
    allPatterns.push(
      ...detectCategoryRepeats(userCode, displayName, userRecords, minRepeatCount, periodDays),
      ...detectConsecutiveDayPatterns(userCode, displayName, userRecords, baseDate),
      ...detectTimeBandRepeats(userCode, displayName, userRecords, minRepeatCount, periodDays),
      ...detectUnresolvedRepeats(userCode, displayName, userRecords),
    );
  }

  // ソート: confidence 降順 → count 降順 → lastSeenAt 降順
  const confidenceWeight: Record<PatternConfidence, number> = { high: 3, medium: 2, low: 1 };

  allPatterns.sort((a, b) => {
    const confDiff = confidenceWeight[b.confidence] - confidenceWeight[a.confidence];
    if (confDiff !== 0) return confDiff;
    const countDiff = b.count - a.count;
    if (countDiff !== 0) return countDiff;
    return b.lastSeenAt.localeCompare(a.lastSeenAt);
  });

  return allPatterns;
}
