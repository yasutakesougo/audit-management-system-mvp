export const DAILY_OPS_LIST_TITLE = 'DailyOpsSignals';

// 内部名が仕様どおりである前提（UI作成でこの表記に揃える想定）
export const DAILY_OPS_FIELDS = {
  title: 'Title',
  date: 'date',
  targetType: 'targetType',
  targetId: 'targetId',
  kind: 'kind',
  time: 'time',
  summary: 'summary',
  status: 'status',
  source: 'source',
} as const;
