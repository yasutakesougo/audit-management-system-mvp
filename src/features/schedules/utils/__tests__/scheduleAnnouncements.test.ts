import { describe, expect, it } from 'vitest';
import type { CreateScheduleEventInput } from '../../data';
import { buildScheduleFailureAnnouncement, buildScheduleSuccessAnnouncement } from '../scheduleAnnouncements';

const baseInput: CreateScheduleEventInput = {
  title: '山田太郎さんの送迎',
  category: 'User',
  startLocal: '2025-05-01T10:00',
  endLocal: '2025-05-01T11:00',
  serviceType: 'transport',
  userId: 'user-1',
};

describe('scheduleAnnouncements', () => {
  it('includes user name, time range, and service label on success', () => {
    const message = buildScheduleSuccessAnnouncement({ input: baseInput, userName: '山田太郎', mode: 'create' });
    expect(message).toContain('山田太郎さん');
    expect(message).toContain('10:00〜11:00');
    expect(message).toContain('送迎');
    expect(message).toContain('登録しました');
  });

  it('falls back to title when user name is missing', () => {
    const message = buildScheduleSuccessAnnouncement({ input: baseInput, userName: '', mode: 'edit' });
    expect(message).toContain(baseInput.title);
    expect(message).toContain('更新しました');
  });

  it('expresses failure with context', () => {
    const message = buildScheduleFailureAnnouncement({ input: baseInput, userName: '佐藤花子', mode: 'create' });
    expect(message).toContain('佐藤花子さん');
    expect(message).toContain('10:00〜11:00');
    expect(message).toContain('できませんでした');
  });

  it('treats identical start/end timestamps as all-day', () => {
    const input: CreateScheduleEventInput = {
      ...baseInput,
      startLocal: '2025-05-02T00:00',
      endLocal: '2025-05-02T00:00',
    };
    const message = buildScheduleSuccessAnnouncement({ input, userName: '田中花子', mode: 'create' });
    expect(message).toContain('田中花子さん');
    expect(message).toContain('終日の予定');
    expect(message).toContain('登録しました');
  });
});
