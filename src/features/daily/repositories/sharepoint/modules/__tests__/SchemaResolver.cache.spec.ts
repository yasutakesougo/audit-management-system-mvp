import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpFetchFn } from '@/lib/sp/spLists';
import { DailyRecordSchemaResolver, __clearDailyRecordSchemaResolverCachesForTests } from '../SchemaResolver';
import { DAILY_RECORD_FIELDS } from '../../constants';

const responseJson = (value: unknown): Response =>
  ({
    ok: true,
    json: async () => value,
  }) as Response;

const requiredParentFields = new Set<string>([
  DAILY_RECORD_FIELDS.title,
  DAILY_RECORD_FIELDS.recordDate,
  DAILY_RECORD_FIELDS.reporterName,
  DAILY_RECORD_FIELDS.userRowsJSON,
]);

describe('DailyRecordSchemaResolver list discovery cache', () => {
  beforeEach(() => {
    __clearDailyRecordSchemaResolverCachesForTests();
    vi.clearAllMocks();
  });

  it('shares list discovery across resolver instances for the same SharePoint fetcher', async () => {
    const spFetch = vi.fn<SpFetchFn>().mockResolvedValue(
      responseJson({
        value: [
          { Title: 'SupportRecord_Daily' },
          { Title: 'DailyRecordRows' },
        ],
      }),
    );
    const getListFieldInternalNames = vi.fn().mockResolvedValue(requiredParentFields);

    const first = new DailyRecordSchemaResolver(spFetch, 'SupportRecord_Daily', getListFieldInternalNames);
    const second = new DailyRecordSchemaResolver(spFetch, 'SupportRecord_Daily', getListFieldInternalNames);

    await first.resolveListPath();
    await second.resolveRowsPath('DailyRecordRows');

    expect(spFetch).toHaveBeenCalledTimes(1);
    expect(spFetch).toHaveBeenCalledWith('lists?$select=Title&$top=5000');
  });

  it('coalesces parallel list discovery calls into one request', async () => {
    let resolveResponse: (response: Response) => void = () => {};
    const responsePromise = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    const spFetch = vi.fn<SpFetchFn>().mockReturnValue(responsePromise);

    const first = new DailyRecordSchemaResolver(spFetch, 'SupportRecord_Daily');
    const second = new DailyRecordSchemaResolver(spFetch, 'SupportRecord_Daily');

    const firstResolution = first.resolveRowsPath('DailyRecordRows');
    const secondResolution = second.resolveRowsPath('DailyRecordRows');
    resolveResponse(responseJson({ value: [{ Title: 'DailyRecordRows' }] }));

    await expect(Promise.all([firstResolution, secondResolution])).resolves.toEqual([
      "lists/getbytitle('DailyRecordRows')",
      "lists/getbytitle('DailyRecordRows')",
    ]);
    expect(spFetch).toHaveBeenCalledTimes(1);
  });

  it('does not keep a failed discovery request cached', async () => {
    const throttleError = new Error('SpThrottleRedirectError');
    throttleError.name = 'SpThrottleRedirectError';
    const spFetch = vi
      .fn<SpFetchFn>()
      .mockRejectedValueOnce(throttleError)
      .mockResolvedValueOnce(responseJson({ value: [{ Title: 'DailyRecordRows' }] }));

    const first = new DailyRecordSchemaResolver(spFetch, 'SupportRecord_Daily');
    await expect(first.resolveRowsPath('DailyRecordRows')).rejects.toBe(throttleError);

    const second = new DailyRecordSchemaResolver(spFetch, 'SupportRecord_Daily');
    await expect(second.resolveRowsPath('DailyRecordRows')).resolves.toBe("lists/getbytitle('DailyRecordRows')");
    expect(spFetch).toHaveBeenCalledTimes(2);
  });
});
