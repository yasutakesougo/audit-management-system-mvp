import { describe, it, expect, vi } from 'vitest';
import { listItems } from '@/lib/sp/spListRead';
import type { SpFetchFn } from '@/lib/sp/spLists';

describe('listItems fallback logic', () => {
  it('should retry by removing the missing field when a 400 error occurs', async () => {
    const listIdentifier = 'TestList';
    const normalizePath = (path: string) => path;
    
    // 1回目のリクエスト: "MissingField" が存在しないため 400 エラーを返す
    // 2回目のリクエスト: "MissingField" を除外して成功
    const spFetch = vi.fn()
      .mockRejectedValueOnce({
        status: 400,
        message: "The property 'MissingField' does not exist on type 'SP.Data.TestListItem'.",
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [{ Id: 1, Title: 'Success' }],
        }),
      } as Response);

    const onFieldRemoved = vi.fn();
    const select = ['Id', 'Title', 'MissingField'];

    const result = await listItems(spFetch as unknown as SpFetchFn, normalizePath, listIdentifier, {
      select,
      onFieldRemoved,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ Id: 1, Title: 'Success' });
    expect(spFetch).toHaveBeenCalledTimes(2);
    expect(onFieldRemoved).toHaveBeenCalledWith('MissingField', 400, expect.stringContaining('MissingField'));
    
    // 2回目のリクエストのパスに MissingField が含まれていないことを確認
    const secondCallPath = spFetch.mock.calls[1][0] as string;
    expect(secondCallPath).not.toContain('MissingField');
    expect(secondCallPath).toContain('%24select=Id%2CTitle');
  });

  it('should fall back to minimal fields (Id, Title) when multiple retries fail', async () => {
    const listIdentifier = 'TestList';
    const normalizePath = (path: string) => path;

    // 常に 400 エラーを返し、かつメッセージからフィールド名が特定できないケース
    const spFetch = vi.fn()
      .mockRejectedValueOnce({
        status: 400,
        message: "Some mysterious OData error",
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [{ Id: 1, Title: 'Minimal Fallback' }],
        }),
      } as Response);

    const onCriticalFallback = vi.fn();
    const select = ['Id', 'Title', 'Extra1', 'Extra2'];

    const result = await listItems(spFetch as unknown as SpFetchFn, normalizePath, listIdentifier, {
      select,
      onCriticalFallback,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ Id: 1, Title: 'Minimal Fallback' });
    expect(spFetch).toHaveBeenCalledTimes(2);
    expect(onCriticalFallback).toHaveBeenCalledWith(400, "Some mysterious OData error");
    
    const secondCallPath = spFetch.mock.calls[1][0] as string;
    expect(secondCallPath).toContain('%24select=Id%2CTitle');
  });
});
