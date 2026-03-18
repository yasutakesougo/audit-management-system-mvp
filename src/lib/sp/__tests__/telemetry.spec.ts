import { describe, test, expect, vi } from 'vitest';
import { beginSpQueryTelemetry, endSpQueryTelemetry } from '../telemetry';
import { GuardedQueryParams } from '../queryGuard';

describe('spQueryTelemetry', () => {
  test('records basic telemetry metrics successfully', () => {
    // Mock performance.now to control duration
    let mockTime = 1000;
    vi.spyOn(globalThis.performance, 'now').mockImplementation(() => mockTime);

    // Initial parameters
    const params: GuardedQueryParams = {
      listName: 'TestList',
      queryKind: 'list',
      top: 100,
      select: ['Id', 'Title'],
      filter: "Active eq true"
    };

    // 1. Begin Telemetry
    const payload = beginSpQueryTelemetry(params, 'medium', ['FILTER_MAY_NEED_INDEX']);
    
    // Simulate some time passed during fetch
    mockTime = 1250;

    // Simulate Fake Response
    const fakeResponse = new Response(JSON.stringify({ value: [] }), { 
      status: 200, 
      statusText: 'OK' 
    });

    // 2. End Telemetry
    const metrics = endSpQueryTelemetry({
      payload,
      response: fakeResponse,
      retryCount: 0,
      resultCount: 15
    });

    // Assertions
    expect(metrics.listName).toBe('TestList');
    expect(metrics.queryKind).toBe('list');
    expect(metrics.durationMs).toBe(250);
    expect(metrics.warningCodes).toEqual(['FILTER_MAY_NEED_INDEX']);
    expect(metrics.riskLevel).toBe('medium');
    expect(metrics.resultCount).toBe(15);
    expect(metrics.retryCount).toBe(0);
    expect(metrics.hasFilter).toBe(true);
    expect(metrics.hasOrderBy).toBe(false); // Because orderBy was missing
    expect(metrics.statusCode).toBe(200);
    expect(metrics.throttled).toBe(false);
    expect(metrics.isError).toBe(false);

    vi.restoreAllMocks();
  });

  test('records 429 throttle events correctly', () => {
    let mockTime = 0;
    vi.spyOn(globalThis.performance, 'now').mockImplementation(() => mockTime);

    const params: GuardedQueryParams = { top: 5000 };
    const payload = beginSpQueryTelemetry(params, 'high', ['TOP_CAPPED']);
    mockTime = 1500;

    const fakeThrottleResponse = new Response(null, { status: 429 });

    const metrics = endSpQueryTelemetry({
      payload,
      response: fakeThrottleResponse,
      retryCount: 3
    });

    expect(metrics.isError).toBe(true);
    expect(metrics.throttled).toBe(true);
    expect(metrics.durationMs).toBe(1500);
    expect(metrics.retryCount).toBe(3);

    vi.restoreAllMocks();
  });
});
