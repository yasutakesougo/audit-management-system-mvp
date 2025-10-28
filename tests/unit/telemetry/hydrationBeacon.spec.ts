import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createSpan = (overrides?: Partial<{ key: string; dur: number; status: 'completed' | 'error' | 'superseded' }>) => ({
  key: overrides?.key ?? 'route:test',
  dur: overrides?.dur ?? 12,
  status: overrides?.status ?? 'completed',
});

const restoreFns: Array<() => void> = [];

const overrideSendBeacon = (mock: ReturnType<typeof vi.fn>): void => {
  const navigatorRecord = window.navigator as unknown as Record<string, unknown>;
  const descriptor = Object.getOwnPropertyDescriptor(navigatorRecord, 'sendBeacon');
  Object.defineProperty(navigatorRecord, 'sendBeacon', {
    configurable: true,
    writable: true,
    value: mock,
  });
  restoreFns.push(() => {
    if (descriptor) {
      Object.defineProperty(navigatorRecord, 'sendBeacon', descriptor);
    } else {
      delete navigatorRecord.sendBeacon;
    }
  });
};

describe('telemetry/hydrationBeacon', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    restoreFns.splice(0, restoreFns.length);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    while (restoreFns.length) {
      const restore = restoreFns.pop();
      if (restore) {
        restore();
      }
    }
    delete window.__ENV__;
  });

  it('skips when there are no spans', async () => {
    const sendBeaconMock = vi.fn();
    overrideSendBeacon(sendBeaconMock);
    const module = await import('@/telemetry/hydrationBeacon');
    const result = module.sendHydrationSpans([], { now: () => 0, rand: () => 0 });
    expect(result).toBe(false);
    expect(sendBeaconMock).not.toHaveBeenCalled();
  });

  it('honours sample rate of zero', async () => {
    window.__ENV__ = { VITE_TELEMETRY_SAMPLE: '0' };
    const sendBeaconMock = vi.fn();
    overrideSendBeacon(sendBeaconMock);
    const module = await import('@/telemetry/hydrationBeacon');
    const result = module.sendHydrationSpans([createSpan()], { now: () => 123, rand: () => 0.1 });
    expect(result).toBe(false);
    expect(sendBeaconMock).not.toHaveBeenCalled();
  });

  it('sends via navigator.sendBeacon when available', async () => {
    const sendBeaconMock = vi.fn().mockReturnValue(true);
    overrideSendBeacon(sendBeaconMock);
    const module = await import('@/telemetry/hydrationBeacon');
    const result = module.sendHydrationSpans([createSpan()], { now: () => 456, rand: () => 0.2 });
    expect(result).toBe(true);
    expect(sendBeaconMock).toHaveBeenCalledTimes(1);
    const [url, body] = sendBeaconMock.mock.calls[0] as [string, unknown];
    expect(url).toBe('/__telemetry__');
    expect(typeof body === 'string' || body instanceof Blob).toBe(true);
  });

  it('falls back to fetch when sendBeacon fails', async () => {
    const sendBeaconMock = vi.fn().mockReturnValue(false);
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    overrideSendBeacon(sendBeaconMock);
    vi.stubGlobal('fetch', fetchMock);
    const module = await import('@/telemetry/hydrationBeacon');
    const result = module.sendHydrationSpans([createSpan({ key: 'route:dashboard' })], { now: () => 789, rand: () => 0.05 });
    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/__telemetry__');
    expect(init?.method).toBe('POST');
    const jsonBody = typeof init?.body === 'string'
      ? init.body
      : init?.body instanceof Blob
        ? await init.body.text()
        : '';
    expect(JSON.parse(jsonBody as string).spans[0]).toMatchObject({ key: 'route:dashboard' });
  });
});
