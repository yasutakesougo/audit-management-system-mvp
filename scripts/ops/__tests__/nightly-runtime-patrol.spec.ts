// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { 
  sendTeamsNotification, 
  aggregateEvents, 
  type NightlySummary, 
  type RawEvent 
} from '../nightly-runtime-patrol';

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

// Helper to build a minimal RawEvent with required fields only
function makeEvent(overrides: Partial<RawEvent> & Pick<RawEvent, 'eventType' | 'reasonCode'>): RawEvent {
  return {
    id: 'test-1',
    timestamp: '2026-04-07T00:00:00Z',
    area: 'Platform',
    resourceKey: 'Users_Master',
    message: 'test event',
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

// ── aggregateEvents — logic tests ──────────────────────────────────────────

describe('aggregateEvents / severity classification', () => {
  it('treats essential field missing (health_fail) as critical', () => {
    const summary = aggregateEvents([
      makeEvent({
        eventType: 'health_fail',
        reasonCode: 'essential_resource_unavailable',
        resourceKey: 'Users_Master',
        message: 'Essential field missing',
      }),
    ]);

    expect(summary.events).toHaveLength(1);
    expect(summary.events[0]?.severity).toBe('critical');
    expect(summary.countsBySeverity.critical).toBe(1);
  });

  it('treats SharePoint throttling (http_429) as critical', () => {
    const summary = aggregateEvents([
      makeEvent({
        eventType: 'http_429',
        reasonCode: 'rate_limit',
        resourceKey: 'SharePoint_API',
        message: 'Throttle detected',
      }),
    ]);

    expect(summary.events).toHaveLength(1);
    expect(summary.events[0]?.severity).toBe('critical');
    expect(summary.countsBySeverity.critical).toBe(1);
  });

  it('treats Strategy E absorbed drift as silent', () => {
    const summary = aggregateEvents([
      makeEvent({
        eventType: 'drift',
        reasonCode: 'absorbed_strategy_e',
        resourceKey: 'UserBenefit_Profile',
        message: 'Drift absorbed by Strategy E',
      }),
    ]);

    expect(summary.events).toHaveLength(1);
    expect(summary.events[0]?.severity).toBe('silent');
    expect(summary.countsBySeverity.silent).toBe(1);
  });
});

describe('aggregateEvents / action_required escalation', () => {
  it('treats remediation failure as action_required', () => {
    const summary = aggregateEvents([
      makeEvent({
        eventType: 'remediation',
        reasonCode: 'manual',
        resourceKey: 'UserBenefit_Profile',
        fieldKey: 'RecipientCertNumber',
        message: 'RecipientCertNumber のインデックス作成に失敗しました: Network Error',
      }),
    ]);

    expect(summary.events).toHaveLength(1);
    expect(summary.events[0]?.severity).toBe('action_required');
    expect(summary.countsBySeverity.action_required).toBe(1);
  });

  it('treats provision_failed as action_required', () => {
    const summary = aggregateEvents([
      makeEvent({
        eventType: 'provision_failed',
        reasonCode: 'write_error',
        resourceKey: 'SupportRecord_Daily',
        message: 'Failed to provision record.',
      }),
    ]);

    expect(summary.events).toHaveLength(1);
    expect(summary.events[0]?.severity).toBe('action_required');
    expect(summary.countsBySeverity.action_required).toBe(1);
  });
});

describe('aggregateEvents / bundling', () => {
  it('bundles repeated identical events into one entry', () => {
    const event = makeEvent({ eventType: 'http_429', reasonCode: 'rate_limit' });
    const summary = aggregateEvents([event, { ...event, id: 'test-2' }, { ...event, id: 'test-3' }]);

    expect(summary.totalEvents).toBe(3);
    expect(summary.bundledCount).toBe(1);
    expect(summary.events[0]?.occurrences).toBe(3);
  });

  it('keeps distinct events as separate bundles', () => {
    const summary = aggregateEvents([
      makeEvent({ id: 'a', eventType: 'http_429', reasonCode: 'rate_limit' }),
      makeEvent({ id: 'b', eventType: 'health_fail', reasonCode: 'essential_resource_unavailable' }),
    ]);

    expect(summary.bundledCount).toBe(2);
  });
});

describe('aggregateEvents / severity ordering', () => {
  it('sorts critical before watch in output', () => {
    const summary = aggregateEvents([
      makeEvent({ id: 'a', eventType: 'drift', reasonCode: 'unknown_field_added' }),
      makeEvent({ id: 'b', eventType: 'http_429', reasonCode: 'rate_limit' }),
    ]);

    expect(summary.events[0]?.severity).toBe('critical');
  });
});

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
