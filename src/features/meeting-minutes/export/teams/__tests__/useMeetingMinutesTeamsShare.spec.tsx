import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMeetingMinutesTeamsShare } from '../useMeetingMinutesTeamsShare';

describe('useMeetingMinutesTeamsShare', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should open deep link on shareToTeams', async () => {
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    const { result } = renderHook(() => useMeetingMinutesTeamsShare());

    await act(async () => {
      await result.current.shareToTeams({
        title: 'テスト',
        sharePointUrl: 'https://example.com/file.html',
      });
    });

    expect(windowOpenSpy).toHaveBeenCalledTimes(1);
    const calledUrl = windowOpenSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain('https://teams.microsoft.com/share');
    expect(calledUrl).toContain('href=https%3A%2F%2Fexample.com%2Ffile.html');
    expect(result.current.error).toBeNull();
  });

  it('should copy text on copyTeamsShareText', async () => {
    const clipboardWriteTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: clipboardWriteTextSpy,
      },
    });

    const { result } = renderHook(() => useMeetingMinutesTeamsShare());

    await act(async () => {
      await result.current.copyTeamsShareText({
        title: 'テスト',
        sharePointUrl: 'https://example.com/file.html',
      });
    });

    expect(clipboardWriteTextSpy).toHaveBeenCalledTimes(1);
    expect(clipboardWriteTextSpy.mock.calls[0][0]).toContain('https://example.com/file.html');
    expect(result.current.error).toBeNull();
  });
});
