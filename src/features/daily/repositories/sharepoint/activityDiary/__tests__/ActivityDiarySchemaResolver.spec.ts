import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { SpFetchFn } from '@/lib/sp/spLists';
import {
  ActivityDiarySchemaResolver,
  __clearActivityDiaryAvailableTitlesCooldownsForTests
} from '../modules/SchemaResolver';
import { SpThrottleRedirectError } from '@/lib/sp/spFetch';

const jsonResponse = (value: unknown): Response =>
  new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

describe('ActivityDiarySchemaResolver', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __clearActivityDiaryAvailableTitlesCooldownsForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });
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

  it('triggers cooldown and skips catalog queries on SpThrottleRedirectError', async () => {
    let isCatalogThrottled = true;
    let isFieldsAvailable = false;
    const spFetch = vi.fn(async (path: string) => {
      if (path.startsWith('lists?$select=Title')) {
        if (isCatalogThrottled) {
          throw new SpThrottleRedirectError('Throttled');
        }
        return jsonResponse({ value: [{ Title: 'ActivityDiary' }] });
      }
      if (path.includes("lists/getbytitle('ActivityDiary')/fields")) {
        if (isFieldsAvailable) {
          return jsonResponse({
            value: [
              { InternalName: 'UserID' },
              { InternalName: 'Date' },
              { InternalName: 'Shift' },
              { InternalName: 'Category' },
            ],
          });
        }
      }
      const err = new Error('Not Found') as any;
      err.status = 404;
      throw err;
    });

    const resolver = new ActivityDiarySchemaResolver(spFetch as unknown as SpFetchFn, 'ActivityDiary');

    // Perform resolution, triggers throttle cooldown
    const firstResult = await resolver.resolve();
    expect(firstResult).toBeNull();
    // Catalog call + direct fallback probes for candidates
    expect(spFetch).toHaveBeenCalled();
    expect(spFetch.mock.calls[0][0]).toBe('lists?$select=Title&$top=5000');

    const totalCallsAfterFirst = spFetch.mock.calls.length;

    // Second call: Within 30 seconds cooldown, list catalog search should be skipped
    const resolver2 = new ActivityDiarySchemaResolver(spFetch as unknown as SpFetchFn, 'ActivityDiary');

    const secondResult = await resolver2.resolve();
    expect(secondResult).toBeNull();

    // The lists?$select=Title fetch should NOT be in any calls after the first resolve
    const postFirstCalls = spFetch.mock.calls.slice(totalCallsAfterFirst);
    const hasCatalogCall = postFirstCalls.some(call => call[0].startsWith('lists?$select=Title'));
    expect(hasCatalogCall).toBe(false);

    // Advance time by 31 seconds to clear cooldown
    vi.advanceTimersByTime(31000);
    isCatalogThrottled = false;
    isFieldsAvailable = true;

    // Third call: Cooldown expired, catalog lookup succeeds
    const resolver3 = new ActivityDiarySchemaResolver(spFetch as unknown as SpFetchFn, 'ActivityDiary');
    const thirdResult = await resolver3.resolve();
    expect(thirdResult).toBeTruthy();
    expect(thirdResult?.listPath).toBe("lists/getbytitle('ActivityDiary')");

    // Catalog call was re-invoked
    const finalCalls = spFetch.mock.calls.slice(totalCallsAfterFirst + postFirstCalls.length);
    const hasCatalogCallAgain = finalCalls.some(call => call[0].startsWith('lists?$select=Title'));
    expect(hasCatalogCallAgain).toBe(true);
  });
});
