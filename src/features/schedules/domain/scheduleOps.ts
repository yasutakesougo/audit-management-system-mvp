// contract:allow-interface — Pure domain function types, not API boundary schemas
/**
 * Schedule Ops — Pure domain functions for schedule operations view
 *
 * All functions are pure (no side effects, no UI dependencies, no SP concerns).
 * Service type normalization delegates to serviceTypeMetadata.ts (SSOT).
 *
 * Covered functions:
 *   - toOpsServiceType()      — 業務3分類への正規化
 *   - deriveSupportTags()     — フラグから表示用タグを導出
 *   - computeOpsSummary()     — 当日サマリー算出
 *   - filterOpsItems()        — フィルタリング
 *   - computeWeeklySummary()  — 週間日別集計
 */

import type { ServiceTypeKey } from '../serviceTypeMetadata';
import { normalizeServiceType } from '../serviceTypeMetadata';
import type { OpsStatus, ScheduleOpsItem, SupportTag } from './scheduleOpsSchema';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** 業務3分類 */
export type OpsServiceType = 'normal' | 'respite' | 'shortStay';

/** 定員設定 */
export type OpsCapacity = {
  readonly normalMax: number;
  readonly respiteMax: number;
  readonly shortStayMax: number;
};

/** 当日サマリー */
export type OpsSummary = {
  readonly totalCount: number;
  readonly normalCount: number;
  readonly respiteCount: number;
  readonly shortStayCount: number;
  readonly cancelledCount: number;
  readonly attentionCount: number;

  // 総枠
  readonly availableSlots: number;
  // 種別枠（Phase 2 以降で UI 表示）
  readonly availableNormalSlots: number;
  readonly availableRespiteSlots: number;
  readonly availableShortStaySlots: number;

  readonly requiredStaff: number;
  readonly assignedStaff: number;
};

/** フィルター状態 */
export type OpsFilterState = {
  readonly serviceType: OpsServiceType | 'all';
  readonly staffId: string | null;
  readonly hasAttention: boolean;
  readonly hasPickup: boolean;
  readonly hasBath: boolean;
  readonly hasMedication: boolean;
  readonly includeCancelled: boolean;
  readonly searchQuery: string;
};

/** 表示モード */
export type OpsViewMode = 'daily' | 'weekly' | 'list';

/** サマリーカードキー（onCardClick の型安全な union） */
export type OpsSummaryCardKey =
  | 'total'
  | 'normal'
  | 'respite'
  | 'shortStay'
  | 'cancelled'
  | 'attention'
  | 'capacity'
  | 'staffing';

/** 週間日別集計 */
export type DaySummaryEntry = {
  readonly dateIso: string;
  readonly totalCount: number;
  readonly respiteCount: number;
  readonly shortStayCount: number;
  readonly attentionCount: number;
  readonly availableSlots: number;
  readonly isOverCapacity: boolean;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Constants
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const DEFAULT_OPS_FILTER: OpsFilterState = {
  serviceType: 'all',
  staffId: null,
  hasAttention: false,
  hasPickup: false,
  hasBath: false,
  hasMedication: false,
  includeCancelled: false,
  searchQuery: '',
};

export const DEFAULT_OPS_CAPACITY: OpsCapacity = {
  normalMax: 20,
  respiteMax: 3,
  shortStayMax: 2,
};

/** SupportTag の日本語ラベル */
export const SUPPORT_TAG_LABELS: Record<SupportTag, string> = {
  pickup: '送迎',
  meal: '昼食',
  bath: '入浴',
  medication: '服薬',
  overnight: '宿泊',
  extension: '延長',
  needsReview: '要確認',
  medical: '医療配慮',
  behavioral: '行動配慮',
  firstVisit: '初回',
  changed: '変更',
};

/** OpsStatus の日本語ラベル */
export const OPS_STATUS_LABELS: Record<OpsStatus, string> = {
  planned: '予定',
  confirmed: '確定',
  changed: '変更あり',
  cancelled: 'キャンセル',
  completed: '対応済み',
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Functions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * ServiceTypeKey → 業務3分類へのマッピング。
 * metadata の normalizeServiceType() で文字列揺れは吸収済み。
 */
const SERVICE_KEY_TO_OPS: Partial<Record<ServiceTypeKey, OpsServiceType>> = {
  normal: 'normal',
  transport: 'normal',   // 送迎は生活介護の一部
  nursing: 'normal',     // 看護は生活介護の一部
  respite: 'respite',
  shortStay: 'shortStay',
};

/**
 * サービス種別を業務3分類に正規化。
 *
 * 既存 serviceTypeMetadata.ts の normalizeServiceType() を内部で使用し、
 * 文字列揺れ（shortStay/short_stay/ショート/短期入所 等）の吸収は metadata 側に一任。
 *
 * @param serviceType - raw service type string（英語キー、日本語ラベル、null 等）
 * @returns OpsServiceType — 'normal' | 'respite' | 'shortStay'
 */
export function toOpsServiceType(
  serviceType?: string | null,
): OpsServiceType {
  if (!serviceType) return 'normal';
  const key = normalizeServiceType(serviceType);
  return SERVICE_KEY_TO_OPS[key] ?? 'normal';
}

/**
 * フラグから表示用 supportTags を導出する。
 * DB に SupportTags 列は持たない（フラグが SSOT）。
 *
 * @param item - ScheduleOpsItem（フラグフィールドを読む）
 * @returns SupportTag[]
 */
export function deriveSupportTags(item: ScheduleOpsItem): SupportTag[] {
  const tags: SupportTag[] = [];
  if (item.hasPickup) tags.push('pickup');
  if (item.hasMeal) tags.push('meal');
  if (item.hasBath) tags.push('bath');
  if (item.hasMedication) tags.push('medication');
  if (item.hasOvernight) tags.push('overnight');
  if (item.hasAttention) tags.push('needsReview');
  if (item.opsStatus === 'changed') tags.push('changed');
  if (item.medicalNote?.trim()) tags.push('medical');
  if (item.behavioralNote?.trim()) tags.push('behavioral');
  return tags;
}

/**
 * 当日サマリーを算出。
 *
 * - キャンセル済みは totalCount に含めない
 * - 種別別の空き枠も算出
 * - 担当職員は Set で重複排除
 *
 * @param items - 対象日のスケジュール一覧
 * @param capacity - 定員設定
 * @returns OpsSummary
 */
export function computeOpsSummary(
  items: readonly ScheduleOpsItem[],
  capacity: OpsCapacity,
): OpsSummary {
  let normalCount = 0;
  let respiteCount = 0;
  let shortStayCount = 0;
  let cancelledCount = 0;
  let attentionCount = 0;
  const staffIds = new Set<string>();

  for (const item of items) {
    if (item.opsStatus === 'cancelled') {
      cancelledCount++;
      continue;
    }
    const svc = toOpsServiceType(item.serviceType);
    if (svc === 'normal') normalCount++;
    else if (svc === 'respite') respiteCount++;
    else if (svc === 'shortStay') shortStayCount++;

    if (item.hasAttention) attentionCount++;
    if (item.assignedStaffId) staffIds.add(item.assignedStaffId);
  }

  const totalCount = normalCount + respiteCount + shortStayCount;
  const totalMax =
    capacity.normalMax + capacity.respiteMax + capacity.shortStayMax;

  return {
    totalCount,
    normalCount,
    respiteCount,
    shortStayCount,
    cancelledCount,
    attentionCount,
    availableSlots: Math.max(0, totalMax - totalCount),
    availableNormalSlots: Math.max(0, capacity.normalMax - normalCount),
    availableRespiteSlots: Math.max(0, capacity.respiteMax - respiteCount),
    availableShortStaySlots: Math.max(
      0,
      capacity.shortStayMax - shortStayCount,
    ),
    requiredStaff: Math.ceil(totalCount / 5), // 5:1 配置基準（将来設定化）
    assignedStaff: staffIds.size,
  };
}

/**
 * フィルター適用。
 *
 * - searchQuery は userName, title, notes, attentionSummary,
 *   handoffSummary, assignedStaffName を対象に部分一致（大文字小文字無視）
 * - 各条件は AND 動作
 *
 * @param items - 全アイテム
 * @param filter - フィルター条件
 * @returns フィルタ済みアイテム
 */
export function filterOpsItems(
  items: readonly ScheduleOpsItem[],
  filter: OpsFilterState,
): ScheduleOpsItem[] {
  return (items as ScheduleOpsItem[]).filter((item) => {
    // キャンセル除外
    if (!filter.includeCancelled && item.opsStatus === 'cancelled')
      return false;

    // サービス種別
    if (filter.serviceType !== 'all') {
      if (toOpsServiceType(item.serviceType) !== filter.serviceType)
        return false;
    }

    // 担当職員
    if (filter.staffId && item.assignedStaffId !== filter.staffId) return false;

    // 注意あり
    if (filter.hasAttention && !item.hasAttention) return false;

    // 送迎あり
    if (filter.hasPickup && !item.hasPickup) return false;

    // 入浴あり
    if (filter.hasBath && !item.hasBath) return false;

    // 服薬あり
    if (filter.hasMedication && !item.hasMedication) return false;

    // テキスト検索
    if (filter.searchQuery) {
      const q = filter.searchQuery.toLowerCase();
      const haystack = [
        item.userName,
        item.title,
        item.notes,
        item.attentionSummary,
        item.handoffSummary,
        item.assignedStaffName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}

/**
 * 週間の日別集計。
 *
 * - キャンセル済みは集計から除外
 * - isOverCapacity は totalMax 超過で true
 *
 * @param items - 週全体のアイテム
 * @param weekDates - 対象日の ISO 日付文字列 ('YYYY-MM-DD') 配列
 * @param capacity - 定員設定
 * @returns 日別集計配列
 */
export function computeWeeklySummary(
  items: readonly ScheduleOpsItem[],
  weekDates: readonly string[],
  capacity: OpsCapacity,
): DaySummaryEntry[] {
  const totalMax =
    capacity.normalMax + capacity.respiteMax + capacity.shortStayMax;

  return weekDates.map((dateIso) => {
    const dayItems = items.filter((item) => {
      const itemDate = item.start?.slice(0, 10);
      return itemDate === dateIso && item.opsStatus !== 'cancelled';
    });

    let respiteCount = 0;
    let shortStayCount = 0;
    let attentionCount = 0;

    for (const item of dayItems) {
      const svc = toOpsServiceType(item.serviceType);
      if (svc === 'respite') respiteCount++;
      if (svc === 'shortStay') shortStayCount++;
      if (item.hasAttention) attentionCount++;
    }

    return {
      dateIso,
      totalCount: dayItems.length,
      respiteCount,
      shortStayCount,
      attentionCount,
      availableSlots: Math.max(0, totalMax - dayItems.length),
      isOverCapacity: dayItems.length > totalMax,
    };
  });
}
