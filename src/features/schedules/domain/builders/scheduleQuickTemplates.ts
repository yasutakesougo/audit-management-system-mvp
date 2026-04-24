// contract:allow-interface — Pure template domain types, not API boundary schemas
/**
 * scheduleQuickTemplates.ts
 *
 * Phase 7-A: 入力最小化のためのクイックテンプレート生成
 *
 * 既存スケジュールから「よく使うパターン」を抽出し、
 * ダイアログ上部にワンクリック入力ボタンとして表示する。
 *
 * Pure function — テスト容易、副作用なし
 */

import type { ScheduleCategory, ScheduleServiceType } from '../../data';
import type { ScheduleFormState } from '../scheduleFormState';

// ── Types ──────────────────────────────────────────────────────────────────

/** A quick template that pre-fills the create dialog */
export interface QuickTemplate {
  /** Display label, e.g. "通所 10:00-16:00" */
  label: string;
  /** Partial form state to apply as override */
  override: Partial<ScheduleFormState>;
  /** How many times this pattern appeared */
  frequency: number;
}

/** A minimal schedule item shape for template extraction */
export interface ScheduleItemForTemplate {
  category?: ScheduleCategory | string;
  serviceType?: ScheduleServiceType | string | null;
  start: string;   // ISO or datetime-local
  end: string;
  userName?: string | null;
  userId?: string | null;
  assignedStaffId?: string | null;
  locationName?: string | null;
}

// ── Constants ──────────────────────────────────────────────────────────────

const SERVICE_TYPE_LABELS: Record<string, string> = {
  normal: '通所',
  absence: '欠席',
  late: '遅刻',
  earlyLeave: '早退',
  respite: '一時ケア',
  shortStay: 'ショートステイ',
  newRegistration: '新規登録',
  meeting: '会議',
  other: 'その他',
};

// ── Core Logic ─────────────────────────────────────────────────────────────

/**
 * Extract time portion (HH:mm) from an ISO or datetime-local string.
 */
function extractTime(iso: string): string {
  // handles "2026-03-20T10:00:00Z", "2026-03-20T10:00", "2026-03-20 10:00"
  const timePart = iso.includes('T') ? iso.split('T')[1] : iso.split(' ')[1];
  if (!timePart) return '';
  return timePart.substring(0, 5); // "HH:mm"
}

/**
 * Build a pattern key for deduplication.
 * Pattern = category + serviceType + startTime + endTime
 */
function patternKey(item: ScheduleItemForTemplate): string {
  const st = extractTime(item.start);
  const et = extractTime(item.end);
  return `${item.category}|${item.serviceType ?? ''}|${st}|${et}`;
}

/**
 * Build a display label for a template.
 */
function buildLabel(
  serviceType: string | null | undefined,
  startTime: string,
  endTime: string,
): string {
  const svc = serviceType ? (SERVICE_TYPE_LABELS[serviceType] ?? serviceType) : '';
  if (svc && startTime && endTime) return `${svc} ${startTime}-${endTime}`;
  if (svc) return svc;
  if (startTime && endTime) return `${startTime}-${endTime}`;
  return '前回と同じ';
}

/**
 * Extract quick templates from existing schedule items.
 *
 * @param items - All schedule items (e.g., from the current week)
 * @param targetDate - The date to create the template for (YYYY-MM-DD)
 * @param options - Optional filters (userId, limit)
 * @returns Up to `limit` most frequent templates, sorted by frequency desc
 */
export function buildQuickTemplates(
  items: ScheduleItemForTemplate[],
  targetDate: string,
  options?: {
    userId?: string;
    limit?: number;
  },
): QuickTemplate[] {
  const limit = options?.limit ?? 3;
  const userId = options?.userId;

  // Filter to relevant items (same user if specified, category=User)
  const relevant = items.filter(item => {
    if (item.category !== 'User') return false;
    if (userId && item.userId !== userId) return false;
    return true;
  });

  if (relevant.length === 0) return [];

  // Count pattern frequencies
  const patternMap = new Map<string, { item: ScheduleItemForTemplate; count: number }>();
  for (const item of relevant) {
    const key = patternKey(item);
    const existing = patternMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      patternMap.set(key, { item, count: 1 });
    }
  }

  // Sort by frequency desc, take top N
  const sorted = [...patternMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  return sorted.map(({ item, count }) => {
    const startTime = extractTime(item.start);
    const endTime = extractTime(item.end);

    return {
      label: buildLabel(item.serviceType, startTime, endTime),
      frequency: count,
      override: {
        category: item.category as ScheduleCategory,
        serviceType: item.serviceType ?? undefined,
        startLocal: `${targetDate}T${startTime}`,
        endLocal: `${targetDate}T${endTime}`,
        userId: item.userId ?? '',
        assignedStaffId: item.assignedStaffId ?? '',
        locationName: item.locationName ?? '',
      },
    };
  });
}

/**
 * Build a "copy last" template from the most recent schedule for a given user.
 *
 * @param items - All schedule items
 * @param userId - Target user ID
 * @param targetDate - The date for the new schedule
 * @returns A QuickTemplate for "前回と同じ", or null if no history
 */
export function buildCopyLastTemplate(
  items: ScheduleItemForTemplate[],
  userId: string,
  targetDate: string,
): QuickTemplate | null {
  // Find the most recent item for this user
  const userItems = items
    .filter(item => item.userId === userId && item.category === 'User')
    .sort((a, b) => b.start.localeCompare(a.start));

  if (userItems.length === 0) return null;

  const last = userItems[0];
  const startTime = extractTime(last.start);
  const endTime = extractTime(last.end);

  return {
    label: '📋 前回と同じ',
    frequency: 1,
    override: {
      category: last.category as ScheduleCategory,
      serviceType: last.serviceType ?? undefined,
      startLocal: `${targetDate}T${startTime}`,
      endLocal: `${targetDate}T${endTime}`,
      userId: last.userId ?? '',
      assignedStaffId: last.assignedStaffId ?? '',
      locationName: last.locationName ?? '',
    },
  };
}
