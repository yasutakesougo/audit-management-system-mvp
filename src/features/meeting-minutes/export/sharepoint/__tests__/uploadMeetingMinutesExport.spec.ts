import { describe, expect, it, vi } from 'vitest';
import { uploadMeetingMinutesExport } from '../uploadMeetingMinutesExport';
import type { UseSP } from '@/lib/spClient';

describe('uploadMeetingMinutesExport', () => {
  it('should upload a blob to SharePoint successfully', async () => {
    const mockSpFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ServerRelativeUrl: '/sites/test/Shared Documents/MeetingMinutesArchive/test.pdf' }),
    });

    const spClient = { spFetch: mockSpFetch } as unknown as UseSP;
    const blob = new Blob(['test'], { type: 'application/pdf' });

    const result = await uploadMeetingMinutesExport({
      spClient,
      fileName: 'テスト.pdf',
      blob,
      contentType: 'application/pdf',
    });

    expect(mockSpFetch).toHaveBeenCalledTimes(1);
    expect(mockSpFetch.mock.calls[0][0]).toContain('%E3%83%86%E3%82%B9%E3%83%88.pdf');
    expect(result.fileUrl).toBe('/sites/test/Shared Documents/MeetingMinutesArchive/test.pdf');
    expect(result.fileName).toBe('テスト.pdf');
  });

  it('should throw an error on failure', async () => {
    const mockSpFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: async () => 'Access Denied',
    });

    const spClient = { spFetch: mockSpFetch } as unknown as UseSP;
    const blob = new Blob(['test'], { type: 'application/pdf' });

    await expect(
      uploadMeetingMinutesExport({
        spClient,
        fileName: 'テスト.pdf',
        blob,
        contentType: 'application/pdf',
      })
    ).rejects.toThrow(/SharePoint upload failed.+403/);
  });
});
