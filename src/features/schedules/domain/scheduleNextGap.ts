// contract:allow-interface — Pure gap-finding domain types, not API boundary schemas
/**
 * scheduleNextGap.ts
 *
 * Phase 7-C: 連続入力ナビゲーション
 *
 * 保存後に「次の未入力枠」を見つけて自動遷移する。
 * 同一日の範囲に限定 — 安全で予測可能。
 *
 * Pure function — テスト容易、副作用なし
 */

import type { ScheduleItemForTemplate } from './scheduleQuickTemplates';

// ── Types ──────────────────────────────────────────────────────────────────

/** A time slot that has no schedule */
export interface GapSlot {
  /** Start time HH:mm */
  startTime: string;
  /** End time HH:mm */
  endTime: string;
  /** Date ISO YYYY-MM-DD */
  date: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

/** Business hours: 06:00 to 21:00, 30-min slots */
const BUSINESS_START = 6 * 60;   // 06:00
const BUSINESS_END = 21 * 60;    // 21:00
const SLOT_DURATION = 60;        // 60 minutes per slot

// ── Helpers ────────────────────────────────────────────────────────────────

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function fromMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function extractTime(iso: string): string {
  const timePart = iso.includes('T') ? iso.split('T')[1] : iso.split(' ')[1];
  if (!timePart) return '';
  return timePart.substring(0, 5);
}

function extractDate(iso: string): string {
  return iso.split('T')[0];
}

// ── Core Logic ─────────────────────────────────────────────────────────────

/**
 * Build a set of occupied time ranges (in minutes) from existing schedules.
 */
function buildOccupiedRanges(
  items: ScheduleItemForTemplate[],
  targetDate: string,
): Array<{ start: number; end: number }> {
  return items
    .filter(item => {
      const itemDate = extractDate(item.start);
      return itemDate === targetDate;
    })
    .map(item => {
      const st = extractTime(item.start);
      const et = extractTime(item.end);
      if (!st || !et) return null;
      return { start: toMinutes(st), end: toMinutes(et) };
    })
    .filter((r): r is { start: number; end: number } => r !== null)
    .sort((a, b) => a.start - b.start);
}

/**
 * Check if a slot overlaps with any occupied range.
 */
function isSlotOccupied(
  slotStart: number,
  slotEnd: number,
  occupied: Array<{ start: number; end: number }>,
): boolean {
  return occupied.some(r => slotStart < r.end && slotEnd > r.start);
}

/**
 * Find the next unfilled time slot on the same day.
 *
 * @param items - All schedule items
 * @param targetDate - The date to search (YYYY-MM-DD)
 * @param afterTime - Start searching after this time (HH:mm).
 *                    If null, search from business start.
 * @returns The next gap slot, or null if no gaps remain
 */
export function findNextGap(
  items: ScheduleItemForTemplate[],
  targetDate: string,
  afterTime?: string | null,
): GapSlot | null {
  const occupied = buildOccupiedRanges(items, targetDate);
  const searchStart = afterTime ? toMinutes(afterTime) : BUSINESS_START;

  // Scan from searchStart in SLOT_DURATION increments
  for (let slotStart = searchStart; slotStart + SLOT_DURATION <= BUSINESS_END; slotStart += SLOT_DURATION) {
    const slotEnd = slotStart + SLOT_DURATION;
    if (!isSlotOccupied(slotStart, slotEnd, occupied)) {
      return {
        startTime: fromMinutes(slotStart),
        endTime: fromMinutes(slotEnd),
        date: targetDate,
      };
    }
  }

  return null;
}

/**
 * Count how many unfilled slots remain on the same day.
 *
 * @param items - All schedule items
 * @param targetDate - The date to count (YYYY-MM-DD)
 * @returns Number of unfilled slots
 */
export function countRemainingGaps(
  items: ScheduleItemForTemplate[],
  targetDate: string,
): number {
  const occupied = buildOccupiedRanges(items, targetDate);
  let count = 0;

  for (let slotStart = BUSINESS_START; slotStart + SLOT_DURATION <= BUSINESS_END; slotStart += SLOT_DURATION) {
    const slotEnd = slotStart + SLOT_DURATION;
    if (!isSlotOccupied(slotStart, slotEnd, occupied)) {
      count++;
    }
  }

  return count;
}
