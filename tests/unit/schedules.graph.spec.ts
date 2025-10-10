import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Event as GraphEvent } from '@microsoft/microsoft-graph-types';
import { makeGraphSchedulesPort } from '@/features/schedules/data';

const from = '2025-10-10T00:00:00Z';
const to = '2025-10-11T00:00:00Z';

describe('Graph schedules adapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches and maps events to sched items', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        {
          ok: true,
          json: async () => ({
            value: [
              {
                id: 'event-1',
                subject: 'Standup',
                organizer: { emailAddress: { name: 'Alice' } },
                location: { displayName: 'Teams' },
                start: { dateTime: '2025-10-10T09:00:00', timeZone: 'Asia/Tokyo' },
                end: { dateTime: '2025-10-10T09:15:00', timeZone: 'Asia/Tokyo' },
              } satisfies GraphEvent,
            ],
          }),
          text: async () => '',
        } as unknown as Response,
      );

    const port = makeGraphSchedulesPort(async () => 'token');
    const items = await port.list({ from, to });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toContain('me/calendarView');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: 'event-1', title: 'Standup' });
  });

  it('throws when token acquisition fails', async () => {
    const port = makeGraphSchedulesPort(async () => null);
    await expect(port.list({ from, to })).rejects.toMatchObject({
      userMessage: expect.stringContaining('サインインをやり直してください'),
    });
  });

  it('surfaces Graph errors with user message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      {
        ok: false,
        status: 500,
        json: async () => ({}),
        text: async () => 'Internal error',
      } as unknown as Response,
    );

    const port = makeGraphSchedulesPort(async () => 'token');
    await expect(port.list({ from, to })).rejects.toMatchObject({
      userMessage: expect.stringContaining('予定の取得に失敗しました'),
    });
  });

  it('aborts older in-flight range requests and resolves the latest', async () => {
    const abortErrors: unknown[] = [];
    let resolvedHits = 0;
    let callIndex = 0;

    const makeAbortError = () => {
      try {
        return new DOMException('Aborted', 'AbortError');
      } catch {
        const error = new Error('Aborted');
        error.name = 'AbortError';
        return error;
      }
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation((_, init?: RequestInit) => {
      const { signal } = init ?? {};
      const currentCall = callIndex++;

      return new Promise<Response>((resolve, reject) => {
        const abortListener = () => {
          const error = makeAbortError();
          abortErrors.push(error);
          reject(error);
        };

        if (signal) {
          if (signal.aborted) {
            abortListener();
            return;
          }
          signal.addEventListener('abort', abortListener, { once: true });
        }

        if (currentCall === 0) {
          return;
        }

        resolvedHits += 1;
        resolve(
          {
            ok: true,
            json: async () => ({ value: [] }),
            text: async () => '',
          } as unknown as Response,
        );
      });
    });

    const port = makeGraphSchedulesPort(async () => 'token');

    const firstRange = port.list({ from, to });
    const secondRange = port.list({ from: '2025-10-11T00:00:00Z', to: '2025-10-12T00:00:00Z' });

    await expect(firstRange).rejects.toHaveProperty('name', 'AbortError');
    await expect(secondRange).resolves.toEqual([]);

    expect(abortErrors).toHaveLength(1);
    expect(resolvedHits).toBe(1);
  });
});
