import { describe, expect, it, vi } from 'vitest';
import type { SpFetchFn } from '@/lib/sp/spLists';
import { ActivityDiarySchemaResolver } from '../modules/SchemaResolver';

const jsonResponse = (value: unknown): Response =>
  new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

describe('ActivityDiarySchemaResolver', () => {
  it('resolves drifted essential fields and fills optional fields with primary candidates', async () => {
    const spFetch = vi.fn(async (path: string) => {
      if (path.startsWith('lists?$select=Title&$top=5000')) {
        return jsonResponse({
          value: [{ Title: 'ActivityDiary' }],
        });
      }
      if (path.includes("lists/getbytitle('ActivityDiary')/fields")) {
        return jsonResponse({
          value: [
            { InternalName: 'Id' },
            { InternalName: 'Title' },
            { InternalName: 'UserIdId' },
            { InternalName: 'EntryDate' },
            { InternalName: 'Period' },
            { InternalName: 'ActivityCategory' },
            { InternalName: 'Notes' },
          ],
        });
      }
      throw new Error(`Unexpected spFetch path: ${path}`);
    });

    const resolver = new ActivityDiarySchemaResolver(spFetch as unknown as SpFetchFn, 'ActivityDiary');
    const result = await resolver.resolve();

    expect(result).toBeTruthy();
    expect(result?.mapping.userId).toBe('UserIdId');
    expect(result?.mapping.date).toBe('EntryDate');
    expect(result?.mapping.shift).toBe('Period');
    expect(result?.mapping.category).toBe('ActivityCategory');
    // Optional field was not present, so primary candidate fallback should be used.
    expect(result?.mapping.mealMain).toBe('MealMain');
  });

  it('returns null when essential fields cannot be resolved', async () => {
    const spFetch = vi.fn(async (path: string) => {
      if (path.startsWith('lists?$select=Title&$top=5000')) {
        return jsonResponse({
          value: [{ Title: 'ActivityDiary' }],
        });
      }
      if (path.includes("lists/getbytitle('ActivityDiary')/fields")) {
        return jsonResponse({
          value: [
            { InternalName: 'UserID' },
            { InternalName: 'Date' },
            { InternalName: 'Category' },
          ],
        });
      }
      throw new Error(`Unexpected spFetch path: ${path}`);
    });

    const resolver = new ActivityDiarySchemaResolver(spFetch as unknown as SpFetchFn, 'ActivityDiary');
    await expect(resolver.resolve()).resolves.toBeNull();
  });

  it('falls back to direct probe when list catalog lookup fails', async () => {
    const spFetch = vi.fn(async (path: string) => {
      if (path.startsWith('lists?$select=Title&$top=5000')) {
        const err = new Error('catalog unavailable') as Error & { status?: number };
        err.status = 404;
        throw err;
      }
      if (path.includes("lists/getbytitle('ActivityDiary')/fields")) {
        return jsonResponse({
          value: [
            { InternalName: 'UserID' },
            { InternalName: 'Date' },
            { InternalName: 'Shift' },
            { InternalName: 'Category' },
          ],
        });
      }
      throw new Error(`Unexpected spFetch path: ${path}`);
    });

    const resolver = new ActivityDiarySchemaResolver(spFetch as unknown as SpFetchFn, 'ActivityDiary');
    const result = await resolver.resolve();

    expect(result).toBeTruthy();
    expect(result?.listPath).toBe("lists/getbytitle('ActivityDiary')");
  });
});
