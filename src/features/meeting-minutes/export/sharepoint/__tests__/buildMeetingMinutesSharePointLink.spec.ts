import { describe, expect, it } from 'vitest';
import { buildMeetingMinutesSharePointLink } from '../buildMeetingMinutesSharePointLink';

describe('buildMeetingMinutesSharePointLink', () => {
  it('should return absoluteUrl if provided', () => {
    const link = buildMeetingMinutesSharePointLink({
      absoluteUrl: 'https://example.com/file.html',
      serverRelativeUrl: '/file.html',
    });
    expect(link).toBe('https://example.com/file.html');
  });

  it('should combine siteUrl and serverRelativeUrl successfully', () => {
    const link = buildMeetingMinutesSharePointLink({
      siteUrl: 'https://tenant.sharepoint.com/sites/test',
      serverRelativeUrl: '/sites/test/Shared Documents/file.html',
    });
    expect(link).toBe('https://tenant.sharepoint.com/sites/test/Shared%20Documents/file.html');
  });

  it('should return null if insufficient data provided without window context', () => {
    // Since unit tests run in node/jsdom, we handle the case where window might exist.
    // We override window for this test explicitly using vi scope if needed, but jsdom has window.
    const link = buildMeetingMinutesSharePointLink({});
    expect(link).toBeNull();
  });
});
