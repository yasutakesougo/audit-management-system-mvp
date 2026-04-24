// contract:allow-interface — Pure autofill domain types, not API boundary schemas
/**
 * scheduleAutofillRules.ts
 *
 * Phase 7-B: ルールベース自動補完
 *
 * ダイアログが開いた時点で「それっぽく埋まっている」状態をつくる。
 * AIではなく固定ロジック — 説明可能、テスト容易、副作用なし。
 *
 * Design principles:
 * - 補完値は initialOverride として渡す（上書き常に可能）
 * - 補完根拠（provenance）を返す（UIで表示可能）
 * - 保存は自動でしない
 */

import type { ScheduleCategory, ScheduleServiceType } from '../../data';
import type { ScheduleFormState } from '../scheduleFormState';
import type { ScheduleItemForTemplate } from '../builders/scheduleQuickTemplates';

// ── Types ──────────────────────────────────────────────────────────────────

/** The reason why a field was auto-filled */
export type AutofillSource =
  | 'same-timeslot'     // 同時間帯の前回カテゴリ
  | 'same-user'         // 同利用者の直近予定
  | 'same-weekday'      // 同曜日の頻出パターン
  | 'navigation-hint'   // 導線からのヒント (ops → User)
  | 'default';          // 既定値

/** A single auto-filled field with its provenance */
export interface AutofilledField<T = unknown> {
  value: T;
  source: AutofillSource;
  /** Human-readable reason, e.g. "前回 3/18 と同じカテゴリ" */
  reason: string;
}

/** Result of autofill computation */
export interface AutofillResult {
  /** Partial form state to apply as initialOverride */
  override: Partial<ScheduleFormState>;
  /** Provenance map: field name → reason */
  provenance: Partial<Record<keyof ScheduleFormState, AutofilledField>>;
}

/** Context for autofill computation */
export interface AutofillContext {
  /** Target date (YYYY-MM-DD) */
  targetDate: string;
  /** Target start time (HH:mm), if known from click context */
  targetStartTime?: string;
  /** Target end time (HH:mm), if known from click context */
  targetEndTime?: string;
  /** Navigation source (e.g. 'ops' | 'today') */
  source?: string;
  /** Selected user ID, if known */
  userId?: string | null;
  /** All existing schedule items for pattern extraction */
  items: ScheduleItemForTemplate[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function extractTime(iso: string): string {
  const timePart = iso.includes('T') ? iso.split('T')[1] : iso.split(' ')[1];
  if (!timePart) return '';
  return timePart.substring(0, 5);
}

function extractDate(iso: string): string {
  return iso.split('T')[0];
}

function getDayOfWeek(dateIso: string): number {
  return new Date(`${dateIso}T00:00:00`).getDay();
}

/**
 * Check if two time ranges overlap or are close (within 1 hour gap).
 */
function isNearTimeSlot(
  itemStart: string,
  itemEnd: string,
  targetStart: string,
  targetEnd: string,
): boolean {
  const toMinutes = (hhmm: string): number => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };
  const iStart = toMinutes(itemStart);
  const iEnd = toMinutes(itemEnd);
  const tStart = toMinutes(targetStart);
  const tEnd = toMinutes(targetEnd);

  // Overlap or within 60-minute gap
  return iStart < tEnd + 60 && iEnd > tStart - 60;
}

// ── Rules ──────────────────────────────────────────────────────────────────

/**
 * Rule 1: Navigation hint — ops導線ならカテゴリ=User
 */
function applyNavigationHint(
  ctx: AutofillContext,
  result: AutofillResult,
): void {
  if (ctx.source === 'ops' || ctx.source === 'today') {
    if (!result.override.category) {
      result.override.category = 'User';
      result.provenance.category = {
        value: 'User',
        source: 'navigation-hint',
        reason: '運営画面からの作成',
      };
    }
  }
}

/**
 * Rule 2: Same timeslot — 同時間帯の前回カテゴリ・サービス種別を補完
 */
function applySameTimeslotRule(
  ctx: AutofillContext,
  result: AutofillResult,
): void {
  if (!ctx.targetStartTime || !ctx.targetEndTime) return;

  // Find items in similar time slots (any date)
  const matching = ctx.items
    .filter(item => {
      const st = extractTime(item.start);
      const et = extractTime(item.end);
      if (!st || !et) return false;
      return isNearTimeSlot(st, et, ctx.targetStartTime!, ctx.targetEndTime!);
    });

  if (matching.length === 0) return;

  // Count category frequency
  const catCounts = new Map<string, number>();
  for (const item of matching) {
    const cat = item.category ?? 'User';
    catCounts.set(cat, (catCounts.get(cat) ?? 0) + 1);
  }
  const topCat = [...catCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  if (topCat && !result.override.category) {
    result.override.category = topCat[0] as ScheduleCategory;
    result.provenance.category = {
      value: topCat[0],
      source: 'same-timeslot',
      reason: `同時間帯の予定で最多: ${topCat[0]}（${topCat[1]}件）`,
    };
  }

  // Count serviceType frequency (within matching category)
  const topCatItems = matching.filter(i => (i.category ?? 'User') === (result.override.category ?? 'User'));
  const stCounts = new Map<string, number>();
  for (const item of topCatItems) {
    const st = item.serviceType;
    if (st) stCounts.set(st, (stCounts.get(st) ?? 0) + 1);
  }
  const topSt = [...stCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  if (topSt && !result.override.serviceType) {
    result.override.serviceType = topSt[0] as ScheduleServiceType;
    result.provenance.serviceType = {
      value: topSt[0],
      source: 'same-timeslot',
      reason: `同時間帯の予定で最多: ${topSt[0]}（${topSt[1]}件）`,
    };
  }
}

/**
 * Rule 3: Same user — 同利用者の直近予定からサービス種別・場所を補完
 */
function applySameUserRule(
  ctx: AutofillContext,
  result: AutofillResult,
): void {
  if (!ctx.userId) return;

  const userItems = ctx.items
    .filter(item => item.userId === ctx.userId && item.category === 'User')
    .sort((a, b) => b.start.localeCompare(a.start));

  if (userItems.length === 0) return;

  const last = userItems[0];
  const lastDate = extractDate(last.start);

  // Service type from last entry
  if (last.serviceType && !result.override.serviceType) {
    result.override.serviceType = last.serviceType as ScheduleServiceType;
    result.provenance.serviceType = {
      value: last.serviceType,
      source: 'same-user',
      reason: `${lastDate} の予定と同じ種別`,
    };
  }

  // Staff from last entry
  if (last.assignedStaffId && !result.override.assignedStaffId) {
    result.override.assignedStaffId = last.assignedStaffId;
    result.provenance.assignedStaffId = {
      value: last.assignedStaffId,
      source: 'same-user',
      reason: `${lastDate} の予定と同じ担当`,
    };
  }

  // Location from last entry
  if (last.locationName && !result.override.locationName) {
    result.override.locationName = last.locationName;
    result.provenance.locationName = {
      value: last.locationName,
      source: 'same-user',
      reason: `${lastDate} の予定と同じ場所`,
    };
  }
}

/**
 * Rule 4: Same weekday — 同曜日の頻出パターンからサービス種別を補完
 */
function applySameWeekdayRule(
  ctx: AutofillContext,
  result: AutofillResult,
): void {
  const targetDow = getDayOfWeek(ctx.targetDate);

  // Filter items on the same day of week
  const sameDowItems = ctx.items.filter(item => {
    const itemDate = extractDate(item.start);
    return getDayOfWeek(itemDate) === targetDow;
  });

  if (sameDowItems.length < 2) return; // Need at least 2 data points

  // Count serviceType on same weekday
  const stCounts = new Map<string, number>();
  for (const item of sameDowItems) {
    const st = item.serviceType;
    if (st) stCounts.set(st, (stCounts.get(st) ?? 0) + 1);
  }
  const topSt = [...stCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  if (topSt && !result.override.serviceType) {
    const dowNames = ['日', '月', '火', '水', '木', '金', '土'];
    result.override.serviceType = topSt[0] as ScheduleServiceType;
    result.provenance.serviceType = {
      value: topSt[0],
      source: 'same-weekday',
      reason: `${dowNames[targetDow]}曜の予定で最多: ${topSt[0]}（${topSt[1]}件）`,
    };
  }
}

// ── Main Entry Point ───────────────────────────────────────────────────────

/**
 * Compute auto-fill values for a new schedule.
 *
 * Rules are applied in priority order:
 * 1. Navigation hint (ops → User)
 * 2. Same timeslot (前回カテゴリ)
 * 3. Same user (直近の種別/場所/担当)
 * 4. Same weekday (曜日パターン)
 *
 * Later rules do NOT override earlier rules (first-writer-wins).
 *
 * @param ctx - The autofill context
 * @returns AutofillResult with override values and provenance
 */
export function computeAutofill(ctx: AutofillContext): AutofillResult {
  const result: AutofillResult = {
    override: {},
    provenance: {},
  };

  // Apply rules in priority order (first-writer-wins)
  applyNavigationHint(ctx, result);
  applySameTimeslotRule(ctx, result);
  applySameUserRule(ctx, result);
  applySameWeekdayRule(ctx, result);

  return result;
}
