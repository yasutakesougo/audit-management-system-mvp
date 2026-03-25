import type { ExceptionItem, ExceptionSeverity } from './exceptionLogic';

export type ExceptionPrioritySignal = 'sync-fail' | 'stale' | 'none';

export type ExceptionPriorityBreakdown = {
  severity: number;
  structure: number;
  signal: number;
  age: number;
  volume: number;
  total: number;
  signalKind: ExceptionPrioritySignal;
  childCount: number;
};

export type ComputeExceptionPriorityScoreOptions = {
  now?: Date;
  childCountByParentId?: ReadonlyMap<string, number>;
};

const SEVERITY_SCORES: Record<ExceptionSeverity, number> = {
  critical: 100,
  high: 70,
  medium: 40,
  low: 20,
};

const STRUCTURE_SCORES = {
  child: 18,
  parent: 10,
  standalone: 0,
} as const;

const SIGNAL_SCORES: Record<ExceptionPrioritySignal, number> = {
  'sync-fail': 28,
  stale: 18,
  none: 0,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function resolveBaseDate(item: ExceptionItem): string | undefined {
  return item.updatedAt || item.targetDate;
}

function toTimestamp(value: string | undefined): number | null {
  if (!value) return null;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? null : ts;
}

function detectSignal(item: ExceptionItem): ExceptionPrioritySignal {
  const text = `${item.id} ${item.title} ${item.description} ${item.actionPath ?? ''}`.toLowerCase();

  if (
    text.includes('sync-fail')
    || text.includes('同期失敗')
    || text.includes('同期に失敗')
  ) {
    return 'sync-fail';
  }

  if (
    text.includes('stale')
    || text.includes('停滞')
  ) {
    return 'stale';
  }

  return 'none';
}

function extractMaxNumberByPattern(text: string, pattern: RegExp): number {
  let max = 0;
  for (const match of text.matchAll(pattern)) {
    const raw = match[1];
    const parsed = Number(raw);
    if (!Number.isNaN(parsed)) {
      max = Math.max(max, parsed);
    }
  }
  return max;
}

function computeAgeScore(item: ExceptionItem, now: Date): number {
  const base = resolveBaseDate(item);
  const ts = toTimestamp(base);
  if (ts === null) return 0;

  const hours = Math.max(0, (now.getTime() - ts) / (1000 * 60 * 60));
  if (hours < 1) return 0;

  // 6時間ごとに +2、最大 +20
  return clamp(Math.floor(hours / 6) * 2, 0, 20);
}

function computeVolumeScore(item: ExceptionItem, childCount: number): number {
  const text = `${item.title} ${item.description}`;
  const minutes = extractMaxNumberByPattern(text, /(\d+)\s*分/g);
  const count = extractMaxNumberByPattern(text, /(\d+)\s*件/g);

  const byChildren = clamp(childCount * 2, 0, 16);
  const byMinutes = clamp(Math.floor(minutes / 30) * 2, 0, 10);
  const byCount = clamp(count, 0, 10);

  return clamp(byChildren + byMinutes + byCount, 0, 24);
}

export function buildChildCountByParentId(items: ExceptionItem[]): ReadonlyMap<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    if (!item.parentId) continue;
    map.set(item.parentId, (map.get(item.parentId) ?? 0) + 1);
  }
  return map;
}

export function computeExceptionPriorityBreakdown(
  item: ExceptionItem,
  options: ComputeExceptionPriorityScoreOptions = {},
): ExceptionPriorityBreakdown {
  const now = options.now ?? new Date();
  const childCount = options.childCountByParentId?.get(item.id) ?? 0;

  const severity = SEVERITY_SCORES[item.severity];
  const structure = item.parentId
    ? STRUCTURE_SCORES.child
    : childCount > 0
      ? STRUCTURE_SCORES.parent
      : STRUCTURE_SCORES.standalone;

  const signalKind = detectSignal(item);
  const signal = SIGNAL_SCORES[signalKind];
  const age = computeAgeScore(item, now);
  const volume = computeVolumeScore(item, childCount);

  const total = severity + structure + signal + age + volume;

  return {
    severity,
    structure,
    signal,
    age,
    volume,
    total,
    signalKind,
    childCount,
  };
}

export function computeExceptionPriorityScore(
  item: ExceptionItem,
  options: ComputeExceptionPriorityScoreOptions = {},
): number {
  return computeExceptionPriorityBreakdown(item, options).total;
}
