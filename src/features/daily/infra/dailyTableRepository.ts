export type LunchIntake = 'full' | '80' | 'half' | 'small' | 'none';
export type ProblemBehaviorType = 'selfHarm' | 'violence' | 'shouting' | 'pica' | 'other';

export interface DailyTableRecord {
  userId: string;              // normalized string
  recordDate: string;          // YYYY-MM-DD
  activities: { am?: string; pm?: string };
  lunchIntake?: LunchIntake;
  problemBehaviors?: ProblemBehaviorType[]; // 種別配列
  notes?: string;
  submittedAt: string;         // ISO
  authorName?: string;
  authorRole?: string;
}

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD (inclusive)
}

const STORAGE_KEY = 'ams-bulk-daily-v1';

const norm = (v: unknown): string => String(v ?? '').trim();

const safeJsonParse = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const isYmd = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const cmpYmd = (a: string, b: string) => a.localeCompare(b);

const inRange = (d: string, r: DateRange) =>
  cmpYmd(d, r.from) >= 0 && cmpYmd(d, r.to) <= 0;

const readMap = (): Record<string, DailyTableRecord> => {
  if (typeof window === 'undefined') return {};
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  const parsed = safeJsonParse(raw);
  if (!parsed || typeof parsed !== 'object') return {};
  return parsed as Record<string, DailyTableRecord>;
};

const writeMap = (map: Record<string, DailyTableRecord>) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
};

export const buildDailyTableKey = (userId: string, recordDate: string) =>
  `${norm(userId)}::${recordDate}`;

export const upsertDailyTableRecords = (records: DailyTableRecord[]) => {
  const map = readMap();
  for (const rec of records) {
    const userId = norm(rec.userId);
    const recordDate = norm(rec.recordDate);
    if (!userId || !isYmd(recordDate)) continue;

    const key = buildDailyTableKey(userId, recordDate);
    map[key] = {
      ...rec,
      userId,
      recordDate,
    };
  }
  writeMap(map);
};

export const getDailyTableRecords = (userId: string, range: DateRange): DailyTableRecord[] => {
  const u = norm(userId);
  if (!u || !isYmd(range.from) || !isYmd(range.to)) return [];

  const map = readMap();
  const out: DailyTableRecord[] = [];
  for (const [key, rec] of Object.entries(map)) {
    if (!key.startsWith(`${u}::`)) continue;
    // Check if the record belongs to the specific user (id normalization check)
    if (rec.userId !== u) continue;

    if (!rec?.recordDate || !isYmd(rec.recordDate)) continue;
    if (!inRange(rec.recordDate, range)) continue;
    out.push(rec);
  }

  // 日付昇順
  out.sort((a, b) => cmpYmd(a.recordDate, b.recordDate));
  return out;
};

export const getDailyTableSourceInfo = () => ({
  kind: 'localStorage' as const,
  key: STORAGE_KEY,
});
