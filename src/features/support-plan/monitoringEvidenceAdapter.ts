import type { DailyTableRecord, DateRange } from '@/features/daily/infra/dailyTableRepository';
import { getDailyTableRecords } from '@/features/daily/infra/dailyTableRepository';

export interface MonitoringEvidence {
  userId: string;
  range: DateRange;
  count: number;
  bullets: string[];  // UI表示用
  text: string;       // コピー用
}

const clean = (s: unknown) => {
  const t = String(s ?? '').trim();
  return t ? t : '';
};

const joinNonEmpty = (parts: string[], sep: string) => parts.filter(Boolean).join(sep);

const LUNCH_LABELS: Record<string, string> = {
  full: '完食',
  '80': '8割',
  half: '半分',
  small: '少量',
  none: 'なし',
};

const BEHAVIOR_LABELS: Record<string, string> = {
  selfHarm: '自傷',
  violence: '暴力',
  shouting: '大声',
  pica: '異食',
  other: 'その他',
};

const formatOne = (r: DailyTableRecord): string => {
  const am = clean(r.activities?.am);
  const pm = clean(r.activities?.pm);
  const notes = clean(r.notes);
  const pbStr = (r.problemBehaviors ?? [])
    .map((b) => BEHAVIOR_LABELS[b] || b)
    .join(',');

  const activity = joinNonEmpty(
    [
      am ? `AM:${am}` : '',
      pm ? `PM:${pm}` : '',
    ],
    ' / '
  );

  const meta = joinNonEmpty(
    [
      r.lunchIntake ? `昼食:${LUNCH_LABELS[r.lunchIntake] || r.lunchIntake}` : '',
      pbStr ? `問題行動:${pbStr}` : '',
    ],
    ' / '
  );

  const body = joinNonEmpty(
    [
      activity ? `活動 ${activity}` : '',
      meta ? meta : '',
      notes ? `特記: ${notes}` : '',
    ],
    ' / '
  );

  return `[${r.recordDate}] ${body || '記録あり'}`;
};

export const buildMonitoringEvidence = (args: {
  userId: string;
  range: DateRange;
  limit?: number;
}): MonitoringEvidence => {
  const { userId, range, limit = 60 } = args;
  const records = getDailyTableRecords(userId, range);

  const bullets = records.slice(-limit).map(formatOne);
  const header = `--- Daily Evidence (user=${userId}, from=${range.from} to=${range.to}) ---`;
  const footer = `--- End of Evidence ---`;
  const text = [header, ...bullets.map((b) => `- ${b}`), footer].join('\n');

  return {
    userId: String(userId),
    range,
    count: records.length,
    bullets,
    text,
  };
};
