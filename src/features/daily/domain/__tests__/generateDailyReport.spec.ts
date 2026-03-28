import type { ScheduleItem } from '@/features/daily/components/split-stream/ProcedurePanel';
import type { ExecutionRecord } from '@/features/daily/domain/legacy/executionRecordTypes';
import { getScheduleKey } from '@/features/daily/domain/builders/getScheduleKey';
import { describe, expect, it } from 'vitest';

import { generateDailyReport } from '../legacy/generateDailyReport';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SCHEDULE: ScheduleItem[] = [
  { time: '09:00', activity: '朝の受け入れ', instruction: '視線を合わせて挨拶', isKey: true },
  { time: '09:15', activity: '持ち物整理', instruction: 'ロッカーへの収納', isKey: false },
  { time: '10:00', activity: '作業活動', instruction: '作業手順の提示', isKey: true },
  { time: '11:30', activity: '休憩', instruction: '水分補給の声かけ', isKey: false },
];

function makeRecord(
  time: string,
  activity: string,
  status: ExecutionRecord['status'],
  memo = '',
): ExecutionRecord {
  const scheduleItemId = getScheduleKey(time, activity);
  return {
    id: `2025-04-01-U-001-${scheduleItemId}`,
    date: '2025-04-01',
    userId: 'U-001',
    scheduleItemId,
    status,
    triggeredBipIds: [],
    memo,
    recordedBy: '',
    recordedAt: '2025-04-01T10:00:00Z',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateDailyReport', () => {
  it('generates report with all statuses', () => {
    const records: ExecutionRecord[] = [
      makeRecord('09:00', '朝の受け入れ', 'completed'),
      makeRecord('09:15', '持ち物整理', 'completed'),
      makeRecord('10:00', '作業活動', 'triggered', 'イヤーマフで落ち着いた'),
      makeRecord('11:30', '休憩', 'skipped'),
    ];

    const result = generateDailyReport({
      date: '2025-04-01',
      userName: '田中太郎',
      schedule: SCHEDULE,
      records,
    });

    // ヘッダー
    expect(result).toContain('📋 日報: 田中太郎 様 — 2025/04/01');

    // 各行のスタータス
    expect(result).toContain('09:00 朝の受け入れ ✅ 完了');
    expect(result).toContain('09:15 持ち物整理 ✅ 完了');
    expect(result).toContain('10:00 作業活動 ⚠️ 発動 → イヤーマフで落ち着いた');
    expect(result).toContain('11:30 休憩 ⏭️ スキップ');

    // サマリー
    expect(result).toContain('完了: 2 | 発動: 1 | スキップ: 1 | 未記録: 0 (全4件)');
  });

  it('marks unrecorded items when no matching record exists', () => {
    // 1件だけ記録
    const records: ExecutionRecord[] = [
      makeRecord('09:00', '朝の受け入れ', 'completed'),
    ];

    const result = generateDailyReport({
      date: '2025-04-01',
      userName: '田中太郎',
      schedule: SCHEDULE,
      records,
    });

    expect(result).toContain('09:00 朝の受け入れ ✅ 完了');
    expect(result).toContain('09:15 持ち物整理 — 未記録');
    expect(result).toContain('10:00 作業活動 — 未記録');
    expect(result).toContain('11:30 休憩 — 未記録');
    expect(result).toContain('完了: 1 | 発動: 0 | スキップ: 0 | 未記録: 3 (全4件)');
  });

  it('generates report with empty records', () => {
    const result = generateDailyReport({
      date: '2025-04-01',
      userName: '田中太郎',
      schedule: SCHEDULE,
      records: [],
    });

    expect(result).toContain('未記録: 4 (全4件)');
  });

  it('generates report with empty schedule', () => {
    const result = generateDailyReport({
      date: '2025-04-01',
      userName: '田中太郎',
      schedule: [],
      records: [],
    });

    expect(result).toContain('📋 日報: 田中太郎 様 — 2025/04/01');
    expect(result).toContain('(全0件)');
  });

  it('does not append arrow for triggered status without memo', () => {
    const records: ExecutionRecord[] = [
      makeRecord('09:00', '朝の受け入れ', 'triggered', ''),
    ];

    const result = generateDailyReport({
      date: '2025-04-01',
      userName: '田中太郎',
      schedule: SCHEDULE,
      records,
    });

    expect(result).toContain('09:00 朝の受け入れ ⚠️ 発動');
    expect(result).not.toContain('→');
  });

  it('formats date with slashes', () => {
    const result = generateDailyReport({
      date: '2025-12-31',
      userName: 'テスト',
      schedule: [],
      records: [],
    });

    expect(result).toContain('2025/12/31');
    expect(result).not.toContain('2025-12-31');
  });
});
