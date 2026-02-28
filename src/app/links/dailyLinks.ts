// ---------------------------------------------------------------------------
// dailyLinks — /daily/* 系 URL の一元管理
//
// ルーティング変更に耐性を持たせるため、ハードコード navigate を避け
// このモジュール経由でパスを参照する。
// ---------------------------------------------------------------------------

export const dailyPaths = {
  hub:              '/dailysupport',
  activity:         '/daily/activity',
  table:            '/daily/table',
  attendance:       '/daily/attendance',
  support:          '/daily/support',
  supportChecklist: '/daily/support-checklist',
  timeBased:        '/daily/time-based',
  health:           '/daily/health',
} as const;

export type DailyPathKey = keyof typeof dailyPaths;
