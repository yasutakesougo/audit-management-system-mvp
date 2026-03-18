import type { RawActionSource } from '../models/queue.types';

export function fetchMockActionSources(now: Date): RawActionSource[] {
  // 1時間前のタスク（SLA超過想定）
  const tMinus1H = new Date(now.getTime() - 60 * 60 * 1000);
  // 30分後のタスク
  const tPlus30M = new Date(now.getTime() + 30 * 60 * 1000);

  return [
    {
      id: 'mock-incident-1',
      sourceType: 'incident',
      title: '転倒インシデント未確認',
      targetTime: tMinus1H,
      slaMinutes: 15,
      isCompleted: false,
      payload: { incidentId: 'INC-111' },
    },
    {
      id: 'mock-schedule-2',
      sourceType: 'schedule',
      title: '山田様 配薬',
      targetTime: tMinus1H,
      slaMinutes: 30, // SLA30分なので、1時間前だと超過している
      isCompleted: false,
      assignedStaffId: 'staff-a',
      payload: { scheduleId: 'SCH-222' },
    },
    {
      id: 'mock-schedule-3',
      sourceType: 'schedule',
      title: '鈴木様 入浴介助',
      targetTime: tPlus30M,
      slaMinutes: 30,
      isCompleted: false,
      assignedStaffId: 'staff-a',
      payload: { scheduleId: 'SCH-333' },
    },
    {
      id: 'mock-vital-4',
      sourceType: 'vital_alert',
      title: '佐藤様 血圧異常検知',
      targetTime: new Date(now.getTime() - 5 * 60 * 1000),
      slaMinutes: 0,
      isCompleted: false,
      payload: { vitalId: 'VIT-444' },
    },
    {
      id: 'mock-handoff-5',
      sourceType: 'handoff',
      title: '昨晩の不眠報告',
      targetTime: undefined,
      slaMinutes: 0,
      isCompleted: false,
      payload: { handoffId: 'HND-555' },
    },
  ];
}
