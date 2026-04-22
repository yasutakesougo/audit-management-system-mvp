import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMeetingMinutesSharePointExport } from '../useMeetingMinutesSharePointExport';
import { uploadMeetingMinutesExport } from '../uploadMeetingMinutesExport';

vi.mock('../uploadMeetingMinutesExport', () => ({
  uploadMeetingMinutesExport: vi.fn(),
}));

vi.mock('@/lib/spClient', async () => {
  const actual = await vi.importActual<any>('@/lib/spClient');
  return {
    ...actual,
    useSP: vi.fn(() => ({})),
    ensureConfig: () => ({ baseUrl: 'https://dummy.sharepoint.com' }),
  };
});

describe('useMeetingMinutesSharePointExport', () => {
  it('should upload HTML blob when no blob is provided', async () => {
    vi.mocked(uploadMeetingMinutesExport).mockResolvedValueOnce({
      fileUrl: '/sites/test/Shared Documents/MeetingMinutesArchive/2026-04-05_テスト.html',
      fileName: '2026-04-05_テスト.html',
    });

    const { result } = renderHook(() => useMeetingMinutesSharePointExport());

    await act(async () => {
      const res = await result.current.saveToSharePoint({
        model: {
          title: 'テスト',
          meetingDate: '2026-04-05',
          sections: [],
        },
      });
      expect(res?.fileName).toBe('2026-04-05_テスト.html');
      expect(result.current.isSaving).toBe(false);
      expect(result.current.error).toBeNull();
    });

    expect(uploadMeetingMinutesExport).toHaveBeenCalledTimes(1);
    const args = vi.mocked(uploadMeetingMinutesExport).mock.calls[0][0];
    expect(args.fileName).toBe('2026-04-05_テスト.html');
    expect(args.contentType).toBe('text/html');
  });

  it('should set error on failure', async () => {
    vi.mocked(uploadMeetingMinutesExport).mockRejectedValueOnce(new Error('Network Error'));

    const { result } = renderHook(() => useMeetingMinutesSharePointExport());

    await act(async () => {
      await expect(
        result.current.saveToSharePoint({
          model: {
            title: 'テスト',
            meetingDate: '2026-04-05',
            sections: [],
          },
        })
      ).rejects.toThrow('Network Error');
    });

    expect(result.current.error).toBe('Network Error');
    expect(result.current.isSaving).toBe(false);
  });
});
