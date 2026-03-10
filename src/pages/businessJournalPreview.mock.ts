/**
 * Business Journal Preview — Mock Data
 *
 * Deterministic mock data generator for the business journal preview.
 * Uses seeded random to produce consistent output per year/month.
 *
 * @module pages/businessJournalPreview.mock
 */

import type { MealAmount } from '@/domain/daily/types';

import type { AttendanceStatus, JournalDayEntry, JournalUserRow } from './businessJournalPreviewHelpers';
import { getDaysInMonth } from './businessJournalPreviewHelpers';

// ============================================================================
// Mock Constants
// ============================================================================

const MOCK_USERS = [
  { userId: 'U001', displayName: '田中 太郎' },
  { userId: 'U002', displayName: '鈴木 花子' },
  { userId: 'U003', displayName: '佐藤 一郎' },
  { userId: 'U004', displayName: '高橋 美咲' },
  { userId: 'U005', displayName: '山田 健二' },
  { userId: 'U006', displayName: '渡辺 愛子' },
  { userId: 'U007', displayName: '伊藤 誠' },
  { userId: 'U008', displayName: '中村 さくら' },
  { userId: 'U009', displayName: '小林 大輔' },
  { userId: 'U010', displayName: '加藤 由美' },
] as const;

const MEAL_OPTIONS: MealAmount[] = ['完食', '多め', '半分', '少なめ', 'なし'];
const ATTENDANCE_OPTIONS: AttendanceStatus[] = ['出席', '出席', '出席', '出席', '欠席', '遅刻'];
const AM_ACTIVITIES = ['軽作業', 'ストレッチ', '創作活動', '清掃活動', '園芸', '調理実習'];
const PM_ACTIVITIES = ['レクリエーション', '個別支援', '散歩', '音楽活動', 'PC作業', '読書'];

// ============================================================================
// Seeded Random
// ============================================================================

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ============================================================================
// Data Generator
// ============================================================================

export function generateMockData(year: number, month: number): JournalUserRow[] {
  const days = getDaysInMonth(year, month);
  const rand = seededRandom(year * 100 + month);

  return MOCK_USERS.map((user) => {
    const entries: JournalDayEntry[] = [];
    for (let d = 1; d <= days; d++) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = new Date(year, month - 1, d).getDay();

      // Weekend = holiday
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        entries.push({
          date,
          attendance: '休日',
          amActivities: [],
          pmActivities: [],
        });
        continue;
      }

      const attendance = ATTENDANCE_OPTIONS[Math.floor(rand() * ATTENDANCE_OPTIONS.length)];

      if (attendance === '欠席') {
        entries.push({
          date,
          attendance,
          amActivities: [],
          pmActivities: [],
        });
        continue;
      }

      entries.push({
        date,
        attendance,
        mealAmount: MEAL_OPTIONS[Math.floor(rand() * MEAL_OPTIONS.length)],
        amActivities: [AM_ACTIVITIES[Math.floor(rand() * AM_ACTIVITIES.length)]],
        pmActivities: [PM_ACTIVITIES[Math.floor(rand() * PM_ACTIVITIES.length)]],
        restraint: rand() < 0.03,
        selfHarm: rand() < 0.05,
        otherInjury: rand() < 0.04,
        specialNotes: rand() < 0.15 ? '体調変化あり。詳細は別紙参照。' : undefined,
        hasAttachment: rand() < 0.08,
      });
    }
    return { ...user, entries };
  });
}
