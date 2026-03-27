import type { UseSP } from '@/lib/spClient';
import { describe, expect, it, vi } from 'vitest';
import { uploadToSharePointLibrary } from '../uploadToSharePoint';

describe('uploadToSharePointLibrary', () => {
  it('uploads bytes and returns SharePoint file URL', async () => {
    const spFetch = vi.fn(async () => new Response(
      JSON.stringify({ d: { ServerRelativeUrl: '/sites/audit/official_forms/test.xlsx' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));
    const sp = { spFetch } as unknown as UseSP;

    const bytes = new ArrayBuffer(4);
    const result = await uploadToSharePointLibrary(sp, 'test file.xlsx', bytes);

    expect(spFetch).toHaveBeenCalledTimes(1);
    const [path, init] = spFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(path).toContain("OfficialForms");
    expect(path).toContain(encodeURIComponent('test file.xlsx'));
    expect(path).toContain("overwrite=true");
    expect(init.method).toBe('POST');
    expect(init.body).toBe(bytes);
    expect(result).toEqual({
      fileUrl: '/sites/audit/official_forms/test.xlsx',
      fileName: 'test file.xlsx',
    });
  });

  it('throws descriptive error when SharePoint responds with non-2xx', async () => {
    const spFetch = vi.fn(async () => new Response('permission denied', { status: 403, statusText: 'Forbidden' }));
    const sp = { spFetch } as unknown as UseSP;

    await expect(
      uploadToSharePointLibrary(sp, 'denied.xlsx', new ArrayBuffer(1)),
    ).rejects.toThrow('SharePoint upload failed: 403 Forbidden.');
  });
});
