import { describe, expect, it } from 'vitest';
import { buildMeetingMinutesPdfFileName } from '../buildMeetingMinutesPdfFileName';

describe('buildMeetingMinutesPdfFileName', () => {
  it('should generate file name with date, title, and audience', () => {
    const filename = buildMeetingMinutesPdfFileName({
      meetingDate: '2026-04-05',
      title: '朝会',
      audience: 'field',
    });
    expect(filename).toBe('2026-04-05_朝会_現場申し送り.pdf');
  });

  it('should generate file name for admin audience', () => {
    const filename = buildMeetingMinutesPdfFileName({
      meetingDate: '2026-04-05',
      title: '朝会',
      audience: 'admin',
    });
    expect(filename).toBe('2026-04-05_朝会_管理者共有.pdf');
  });

  it('should sanitize invalid characters', () => {
    const filename = buildMeetingMinutesPdfFileName({
      meetingDate: '2026/04/05', // slash is invalid
      title: 'テスト: 議事録 "重要" <確認>', // colon, quotes, brackets are invalid
    });
    expect(filename).toBe('2026_04_05_テスト_ 議事録 _重要_ _確認_.pdf');
  });

  it('should handle empty or null values gracefully', () => {
    const filename = buildMeetingMinutesPdfFileName({});
    expect(filename).toBe('日付未定_無題の議事録.pdf');
  });
});
