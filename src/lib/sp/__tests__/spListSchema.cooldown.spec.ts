import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  getExistingListTitlesAndIds, 
  __clearGetExistingListTitlesCooldownsForTests 
} from '../spListSchema';
import { SpThrottleRedirectError, __clearSharePointThrottleCircuitBreakerForTests } from '../spFetch';

describe('getExistingListTitlesAndIds throttle cooldown and cache preservation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __clearGetExistingListTitlesCooldownsForTests();
    __clearSharePointThrottleCircuitBreakerForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('successfully returns list titles and caches the result on first successful fetch', async () => {
    const mockJson = {
      value: [
        { Title: 'ListA', Id: '{11111111-1111-1111-1111-111111111111}' },
        { Title: 'ListB', Id: '{22222222-2222-2222-2222-222222222222}' },
      ]
    };
    
    const spFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockJson,
    } as Response);

    const result = await getExistingListTitlesAndIds(spFetch);
    
    expect(spFetch).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(Set);
    expect(result.has('ListA')).toBe(true);
    expect(result.has('ListB')).toBe(true);
    expect(result.has('11111111-1111-1111-1111-111111111111')).toBe(true);
  });

  it('triggers cooldown and returns the last successful cached result on SpThrottleRedirectError', async () => {
    const mockJson = {
      value: [
        { Title: 'ListCached', Id: '{99999999-9999-9999-9999-999999999999}' }
      ]
    };

    const spFetch = vi.fn();
    
    // First call: Success
    spFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockJson,
    } as Response);

    // Fetch once to populate successful cache
    const initialResult = await getExistingListTitlesAndIds(spFetch);
    expect(initialResult.has('ListCached')).toBe(true);
    expect(spFetch).toHaveBeenCalledTimes(1);

    // Second call: Throttle Error
    const throttleError = new SpThrottleRedirectError('Throttled for testing');
    spFetch.mockRejectedValueOnce(throttleError);

    // Fetch again, which triggers throttle error and sets 30s cooldown
    const errorResult = await getExistingListTitlesAndIds(spFetch);
    expect(spFetch).toHaveBeenCalledTimes(2);
    // Should still return last successful cache
    expect(errorResult.has('ListCached')).toBe(true);

    // Third call: Should be immediately suppressed due to cooldown, returning cached result
    const suppressedResult = await getExistingListTitlesAndIds(spFetch);
    // spFetch is NOT called again
    expect(spFetch).toHaveBeenCalledTimes(2);
    expect(suppressedResult.has('ListCached')).toBe(true);

    // Advance time by 31 seconds (exceeding the 30-second cooldown)
    vi.advanceTimersByTime(31000);

    // Fourth call: Cooldown expired, should query SharePoint again
    spFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ value: [{ Title: 'ListNew', Id: '{12345678-1234-1234-1234-123456789012}' }] }),
    } as Response);

    const expiredResult = await getExistingListTitlesAndIds(spFetch);
    expect(spFetch).toHaveBeenCalledTimes(3);
    expect(expiredResult.has('ListNew')).toBe(true);
    expect(expiredResult.has('ListCached')).toBe(false);
  });

  it('returns empty Set on SpThrottleRedirectError if no successful cache exists', async () => {
    const spFetch = vi.fn().mockRejectedValue(new SpThrottleRedirectError('Throttled immediately'));

    const result = await getExistingListTitlesAndIds(spFetch);
    expect(spFetch).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);

    // Subsequent call should be suppressed by cooldown
    const secondResult = await getExistingListTitlesAndIds(spFetch);
    expect(spFetch).toHaveBeenCalledTimes(1);
    expect(secondResult.size).toBe(0);
  });

  it('does NOT trigger cooldown and retries immediately on standard network errors', async () => {
    const spFetch = vi.fn();
    
    // First call: Standard error
    spFetch.mockRejectedValueOnce(new Error('Network disconnected'));
    const firstResult = await getExistingListTitlesAndIds(spFetch);
    expect(spFetch).toHaveBeenCalledTimes(1);
    expect(firstResult.size).toBe(0);

    // Second call: Cooldown should NOT be active, so it calls spFetch again
    spFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ value: [{ Title: 'RecoveredList', Id: '{55555555-5555-5555-5555-555555555555}' }] })
    } as Response);

    const secondResult = await getExistingListTitlesAndIds(spFetch);
    expect(spFetch).toHaveBeenCalledTimes(2);
    expect(secondResult.has('RecoveredList')).toBe(true);
  });
});
