/**
 * @fileoverview buildPdcaCycleRecords — モニタリングスケジュールから PdcaCycleRecord を構築
 * @description
 * 既存の calculateMonitoringSchedule() + SuggestionAction から
 * PdcaCycleRecord[] を生成する pure function。
 *
 * データフロー:
 *   supportStartDate + cycleDays → サイクル一覧
 *   SuggestionAction[]           → proposalAcceptedAt
 *   lastMonitoredAt / reviewedAt → reviewCompletedAt
 *   planningSheet.savedAt        → planUpdatedAt (Phase 1 暫定)
 *
 * @see docs/ops/pdca-cycle-record-definition.md
 * @see src/features/planning-sheet/monitoringSchedule.ts
 */

import type { PdcaCycleRecord } from '../pdcaCycleMetrics';
import type { SuggestionAction } from '@/features/daily/domain/legacy/suggestionAction';

// ─── 入力型 ──────────────────────────────────────────────

/** 1 利用者分のサイクル構築入力 */
export interface CycleBuilderInput {
  /** 利用者 ID */
  userId: string;
  /** 支援開始日 ISO 8601 (e.g. '2026-01-15') */
  supportStartDate: string;
  /** モニタリング周期（日数、デフォルト 90） */
  cycleDays?: number;
  /** 当該利用者の SuggestionAction 履歴 */
  suggestionActions?: SuggestionAction[];
  /** モニタリング実施記録: { round → completedAt ISO } */
  monitoringCompletions?: Map<number, string>;
  /** 計画更新記録: { round → updatedAt ISO } */
  planUpdateDates?: Map<number, string>;
  /** 構築対象のラウンド数上限（デフォルト: 現在時刻までの分） */
  maxRounds?: number;
  /** 基準日（テスト用） */
  today?: string;
}

// ─── ユーティリティ ──────────────────────────────────────

function addDaysToDate(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  d.setDate(d.getDate() + days);
  return isNaN(d.getTime()) ? isoDate : d.toISOString();
}

function isWithinRange(isoDate: string, rangeStart: string, rangeEnd: string): boolean {
  const t = new Date(isoDate).getTime();
  const s = new Date(rangeStart).getTime();
  const e = new Date(rangeEnd).getTime();
  if (isNaN(t) || isNaN(s) || isNaN(e)) return false;
  return t >= s && t < e;
}

// ─── メイン構築関数 ──────────────────────────────────────

const DEFAULT_CYCLE_DAYS = 90;

/**
 * 1 利用者分の PdcaCycleRecord[] を構築する。
 *
 * @param input - 利用者の支援データ
 * @returns     - PdcaCycleRecord[]（ラウンド 1 から順番）
 */
export function buildPdcaCycleRecords(input: CycleBuilderInput): PdcaCycleRecord[] {
  const {
    userId,
    supportStartDate,
    cycleDays = DEFAULT_CYCLE_DAYS,
    suggestionActions = [],
    monitoringCompletions = new Map(),
    planUpdateDates = new Map(),
    today = new Date().toISOString(),
  } = input;

  const startDate = new Date(supportStartDate);
  const todayDate = new Date(today);

  if (isNaN(startDate.getTime()) || isNaN(todayDate.getTime())) {
    return [];
  }

  // 最大ラウンド数を算出
  const elapsedDays = Math.max(0,
    (todayDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  
  const safeCycleDays = cycleDays || DEFAULT_CYCLE_DAYS;
  const maxRounds = input.maxRounds ?? Math.max(1, Math.ceil(elapsedDays / safeCycleDays));

  const records: PdcaCycleRecord[] = [];

  for (let round = 1; round <= maxRounds; round++) {
    const startedAt = addDaysToDate(supportStartDate, (round - 1) * safeCycleDays);
    const dueAt = addDaysToDate(supportStartDate, round * safeCycleDays);

    // proposalAcceptedAt: サイクル期間内の最初の accept
    const proposalAcceptedAt = findFirstAcceptInRange(
      suggestionActions, startedAt, dueAt,
    );

    // reviewScheduledAt: dueAt がそのまま予定日
    const reviewScheduledAt = dueAt;

    // reviewCompletedAt: monitoringCompletions から取得
    const reviewCompletedAt = monitoringCompletions.get(round) ?? null;

    // planUpdatedAt: planUpdateDates から取得
    const planUpdatedAt = planUpdateDates.get(round) ?? null;

    records.push({
      cycleId: `${userId}-cycle-${round}`,
      userId,
      startedAt,
      dueAt,
      proposalAcceptedAt,
      reviewScheduledAt,
      reviewCompletedAt,
      planUpdatedAt,
    });
  }

  return records;
}

/**
 * SuggestionAction のうち、指定期間内の最初の accept の timestamp を返す。
 */
function findFirstAcceptInRange(
  actions: SuggestionAction[],
  rangeStart: string,
  rangeEnd: string,
): string | null {
  const accepts = actions
    .filter(a => a.action === 'accept' && isWithinRange(a.timestamp, rangeStart, rangeEnd))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return accepts.length > 0 ? accepts[0].timestamp : null;
}

/**
 * 複数利用者分の PdcaCycleRecord を一括構築する。
 *
 * @param inputs - 利用者ごとの構築入力
 * @returns      - 全利用者分のフラットな PdcaCycleRecord[]
 */
export function buildAllPdcaCycleRecords(inputs: CycleBuilderInput[]): PdcaCycleRecord[] {
  return inputs.flatMap(input => buildPdcaCycleRecords(input));
}
