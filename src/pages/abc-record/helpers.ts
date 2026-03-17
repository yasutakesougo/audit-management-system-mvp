/**
 * ABC Record Page — 日付範囲ヘルパー
 */

export type DateRangePreset = 'all' | 'today' | 'week' | 'month' | 'custom';

export function getDateRange(preset: DateRangePreset): { start: string; end: string } | null {
  if (preset === 'all') return null;
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  if (preset === 'today') return { start: end, end };
  if (preset === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return { start: d.toISOString().slice(0, 10), end };
  }
  if (preset === 'month') {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 1);
    return { start: d.toISOString().slice(0, 10), end };
  }
  return null;
}

export const DATE_PRESET_LABELS: Record<DateRangePreset, string> = {
  all: 'すべて',
  today: '今日',
  week: '今週',
  month: '今月',
  custom: '期間指定',
};

/** 強度 → カラー */
export const intensityColor = (i: 'low' | 'medium' | 'high'): 'success' | 'warning' | 'error' =>
  i === 'low' ? 'success' : i === 'medium' ? 'warning' : 'error';
