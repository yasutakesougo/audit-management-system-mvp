// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { sendTeamsNotification, type NightlySummary } from '../nightly-runtime-patrol';

// ── fetch mock ───────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockResolvedValue(new Response('', { status: 200 }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  mockFetch.mockReset();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSummary(overrides: Partial<NightlySummary> = {}): NightlySummary {
  return {
    reportDate: '2026-04-07',
    totalEvents: 0,
    bundledCount: 0,
    countsBySeverity: { critical: 0, action_required: 0, watch: 0, silent: 0 },
    events: [],
    ...overrides,
  };
}

function capturedCard(): unknown {
  const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
  return body.attachments[0].content;
}

function cardText(card: unknown): string {
  return JSON.stringify(card);
}

// ── sendTeamsNotification — persistent_drift section ────────────────────────

describe('sendTeamsNotification — persistent_drift section', () => {
  const WEBHOOK = 'https://teams.example.com/webhook';

  it('includes persistent_drift section when status is persistent_drift', async () => {
    const summary = makeSummary({
      fieldSkipStreaks: [{ reasonKey: 'users:UserID', streak: 3, status: 'persistent_drift' }],
    });

    await sendTeamsNotification(summary, WEBHOOK);

    const text = cardText(capturedCard());
    expect(text).toContain('Persistent Field Drift Detected');
    expect(text).toContain('users:UserID');
    expect(text).toContain('3日連続スキップ');
  });

  it('omits persistent_drift section when no persistent_drift entries', async () => {
    const summary = makeSummary({
      fieldSkipStreaks: [{ reasonKey: 'users:UserID', streak: 1, status: 'watching' }],
    });

    await sendTeamsNotification(summary, WEBHOOK);

    const text = cardText(capturedCard());
    expect(text).not.toContain('Persistent Field Drift Detected');
  });

  it('omits persistent_drift section when fieldSkipStreaks is undefined', async () => {
    const summary = makeSummary({ fieldSkipStreaks: undefined });

    await sendTeamsNotification(summary, WEBHOOK);

    expect(mockFetch).toHaveBeenCalledOnce();
    const text = cardText(capturedCard());
    expect(text).not.toContain('Persistent Field Drift Detected');
  });

  it('omits persistent_drift section when fieldSkipStreaks is empty', async () => {
    const summary = makeSummary({ fieldSkipStreaks: [] });

    await sendTeamsNotification(summary, WEBHOOK);

    const text = cardText(capturedCard());
    expect(text).not.toContain('Persistent Field Drift Detected');
  });

  it('sets statusColor to Attention when persistent_drift exists (no critical)', async () => {
    const summary = makeSummary({
      fieldSkipStreaks: [{ reasonKey: 'daily:RecordDate', streak: 3, status: 'persistent_drift' }],
    });

    await sendTeamsNotification(summary, WEBHOOK);

    const text = cardText(capturedCard());
    // statusColor Attention appears in the Status TextBlock
    expect(text).toContain('"color":"Attention"');
  });

  it('includes multiple persistent_drift entries each as a separate line', async () => {
    const summary = makeSummary({
      fieldSkipStreaks: [
        { reasonKey: 'users:UserID', streak: 3, status: 'persistent_drift' },
        { reasonKey: 'schedules:Status', streak: 4, status: 'persistent_drift' },
      ],
    });

    await sendTeamsNotification(summary, WEBHOOK);

    const text = cardText(capturedCard());
    expect(text).toContain('users:UserID');
    expect(text).toContain('schedules:Status');
  });

  it('does not send notification when webhook URL is not set', async () => {
    const summary = makeSummary({
      fieldSkipStreaks: [{ reasonKey: 'users:UserID', streak: 3, status: 'persistent_drift' }],
    });

    const result = await sendTeamsNotification(summary, undefined);

    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
