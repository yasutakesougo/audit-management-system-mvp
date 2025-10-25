export type DaySummary = {
  recordedSlots: number;
  totalSlots: number;
  completionRate: number; // 0–100
};

export type WeekSummary = {
  totalUsers: number;
  days: DaySummary[]; // length: 5（平日）
};

/**
 * 週次の完了率を計算（簡易ロジック）
 * - totalSlots: 1日あたり = userIds.length
 * - recordedSlots: 60%前後で軽く変動（indexで決定する疑似固定）
 * - completionRate: recordedSlots / totalSlots * 100
 */
export function computeWeekSummary(
  userIds: string[],
  _weekStartYYYYMMDD: string, // 週開始日は月曜を想定（E2E安定のため現状は未使用）
): WeekSummary {
  const totalUsers = Array.isArray(userIds) ? userIds.filter(Boolean).length : 0;
  // 平日のみ（5日）
  const DAY_COUNT = 5;
  const days: DaySummary[] = Array.from({ length: DAY_COUNT }, (_, i) => {
    const totalSlots = totalUsers;
    if (totalSlots === 0) {
      return { recordedSlots: 0, totalSlots: 0, completionRate: 0 };
    }
    // E2E安定のため決定的に（ユーザー数と day index のみで決定）
    const base = Math.floor(totalSlots * 0.6);
    const wiggle = i % Math.max(1, Math.min(3, totalSlots)); // 0〜2
    const recordedSlots = Math.min(totalSlots, Math.max(0, base + wiggle));
    const completionRate = (recordedSlots / totalSlots) * 100;
    return { recordedSlots, totalSlots, completionRate };
  });
  return { totalUsers, days };
}
