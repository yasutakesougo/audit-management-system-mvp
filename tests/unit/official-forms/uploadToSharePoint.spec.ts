/**
 * uploadToSharePoint — Unit Tests
 *
 * SP REST API の呼び出しとエラーハンドリングを検証。
 * sp client は vi.fn() でモック。
 */
import { uploadToSharePointLibrary } from '@/features/official-forms/uploadToSharePoint';
import type { UseSP } from '@/lib/spClient';
import { describe, expect, it, vi } from 'vitest';

// ─── モックヘルパー ───────────────────────────────────────────

function createMockSP(overrides?: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  json?: Record<string, unknown>;
  textBody?: string;
}): UseSP {
  const {
    ok = true,
    status = 200,
    statusText = 'OK',
    json = { d: { ServerRelativeUrl: '/sites/test/OfficialForms/test.xlsx' } },
    textBody = '',
  } = overrides ?? {};

  return {
    spFetch: vi.fn().mockResolvedValue({
      ok,
      status,
      statusText,
      json: vi.fn().mockResolvedValue(json),
      text: vi.fn().mockResolvedValue(textBody),
    }),
  } as unknown as UseSP;
}

// ─── テスト ───────────────────────────────────────────────────

describe('uploadToSharePointLibrary', () => {
  const testBytes = new ArrayBuffer(8);
  const testFileName = '生活介護_テスト.xlsx';

  it('calls spFetch with correct URL and method', async () => {
    const sp = createMockSP();
    await uploadToSharePointLibrary(sp, testFileName, testBytes);

    expect(sp.spFetch).toHaveBeenCalledTimes(1);
    const [path, options] = (sp.spFetch as ReturnType<typeof vi.fn>).mock.calls[0];

    // URL にファイル名（エンコード済み）が含まれる
    expect(path).toContain(encodeURIComponent(testFileName));
    expect(path).toContain('OfficialForms');
    expect(path).toContain("add(url='");
    expect(path).toContain("overwrite=true");

    // POST メソッド
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/octet-stream');
    expect(options.body).toBe(testBytes);
  });

  it('returns fileUrl and fileName on success', async () => {
    const sp = createMockSP({
      json: { d: { ServerRelativeUrl: '/sites/test/OfficialForms/生活介護_テスト.xlsx' } },
    });

    const result = await uploadToSharePointLibrary(sp, testFileName, testBytes);

    expect(result.fileUrl).toBe('/sites/test/OfficialForms/生活介護_テスト.xlsx');
    expect(result.fileName).toBe(testFileName);
  });

  it('handles response without "d" wrapper (flat JSON)', async () => {
    const sp = createMockSP({
      json: { ServerRelativeUrl: '/flat/path/test.xlsx' },
    });

    const result = await uploadToSharePointLibrary(sp, testFileName, testBytes);
    expect(result.fileUrl).toBe('/flat/path/test.xlsx');
  });

  it('throws on HTTP error with status and body excerpt', async () => {
    const sp = createMockSP({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      textBody: 'Access denied. You do not have permission to perform this action.',
    });

    await expect(
      uploadToSharePointLibrary(sp, testFileName, testBytes)
    ).rejects.toThrow(/403.*Forbidden/);
  });

  it('throws on HTTP 500 with truncated body', async () => {
    const longBody = 'A'.repeat(500);
    const sp = createMockSP({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      textBody: longBody,
    });

    try {
      await uploadToSharePointLibrary(sp, testFileName, testBytes);
      expect.fail('Should have thrown');
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).toContain('500');
      // Body は 200文字で切り捨て
      expect(msg.length).toBeLessThan(300);
    }
  });

  it('handles JSON parse failure gracefully', async () => {
    const sp = {
      spFetch: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
        text: vi.fn().mockResolvedValue(''),
      }),
    } as unknown as UseSP;

    const result = await uploadToSharePointLibrary(sp, testFileName, testBytes);

    // JSON パース失敗時は空文字回復
    expect(result.fileUrl).toBe('');
    expect(result.fileName).toBe(testFileName);
  });

  it('encodes Japanese filename characters in URL', async () => {
    const jpFileName = '生活介護_令和８年_テスト太郎.xlsx';
    const sp = createMockSP();

    await uploadToSharePointLibrary(sp, jpFileName, testBytes);

    const [path] = (sp.spFetch as ReturnType<typeof vi.fn>).mock.calls[0];
    // 日本語部分がエンコードされている
    expect(path).not.toContain('生活介護');
    expect(path).toContain(encodeURIComponent(jpFileName));
  });
});
