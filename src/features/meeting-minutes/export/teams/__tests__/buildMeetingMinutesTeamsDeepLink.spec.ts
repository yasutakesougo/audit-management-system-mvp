import { describe, expect, it } from 'vitest';
import { buildMeetingMinutesTeamsDeepLink } from '../buildMeetingMinutesTeamsDeepLink';

describe('buildMeetingMinutesTeamsDeepLink', () => {
  it('should build a valid Teams share link', () => {
    const link = buildMeetingMinutesTeamsDeepLink({
      shareText: 'テストの共有',
      sharePointUrl: 'https://example.com/file.html',
    });

    expect(link).not.toBeNull();
    const url = new URL(link!);
    expect(url.origin).toBe('https://teams.microsoft.com');
    expect(url.pathname).toBe('/share');
    expect(url.searchParams.get('href')).toBe('https://example.com/file.html');
    expect(url.searchParams.get('msgText')).toBe('テストの共有');
  });

  it('should return null if no input is provided', () => {
    expect(buildMeetingMinutesTeamsDeepLink({ shareText: '', sharePointUrl: '' })).toBeNull();
  });
});
