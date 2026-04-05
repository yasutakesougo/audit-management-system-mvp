import { describe, expect, it } from 'vitest';
import { buildMeetingMinutesTeamsShareText } from '../buildMeetingMinutesTeamsShareText';

describe('buildMeetingMinutesTeamsShareText', () => {
  it('should generate text for field audience', () => {
    const text = buildMeetingMinutesTeamsShareText({
      title: '朝会',
      meetingDate: '2026-04-05',
      audience: 'field',
      fileName: '2026-04-05_朝会_現場向け.html',
      sharePointUrl: 'https://example.com/sp/file.html',
    });

    expect(text).toContain('【現場申し送り】');
    expect(text).toContain('朝会（2026-04-05）');
    expect(text).toContain('2026-04-05_朝会_現場向け.html');
    expect(text).toContain('https://example.com/sp/file.html');
  });

  it('should generate text for admin audience', () => {
    const text = buildMeetingMinutesTeamsShareText({
      title: '定例会議',
      audience: 'admin',
      sharePointUrl: 'https://example.com/sp/admin.html',
    });

    expect(text).toContain('【管理者共有】');
    expect(text).toContain('定例会議');
    expect(text).toContain('https://example.com/sp/admin.html');
  });

  it('should generate fallback text with minimal info', () => {
    const text = buildMeetingMinutesTeamsShareText({
      sharePointUrl: 'https://example.com/sp/file.html',
    });

    expect(text).toContain('【議事録共有】');
    expect(text).toContain('無題の議事録');
    expect(text).toContain('https://example.com/sp/file.html');
  });
});
