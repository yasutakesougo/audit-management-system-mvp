// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { 
  deriveTransientFailureEvents,
  formatStepSummary,
  sendTeamsNotification, 
  aggregateEvents, 
  type NightlySummary, 
  type RawEvent,
  type GitHubWorkflowRun,
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
    reasonCodeSummary: [],
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

describe('aggregateEvents / transient failures', () => {
  it('treats transient_failure as watch', () => {
    const summary = aggregateEvents([
      makeEvent({
        eventType: 'transient_failure',
        reasonCode: 'transient_failure',
        resourceKey: 'Staff_Master',
        message: 'Recovered by Nightly Runtime Patrol after integration failure',
      }),
    ]);

    expect(summary.events).toHaveLength(1);
    expect(summary.events[0]?.severity).toBe('watch');
    expect(summary.countsBySeverity.watch).toBe(1);
  });

  it('builds reasonCode summary with count and resources', () => {
    const summary = aggregateEvents([
      makeEvent({
        id: 'a',
        eventType: 'transient_failure',
        reasonCode: 'transient_failure',
        resourceKey: 'Users_Master',
      }),
      makeEvent({
        id: 'b',
        eventType: 'transient_failure',
        reasonCode: 'transient_failure',
        resourceKey: 'Staff_Master',
      }),
      makeEvent({
        id: 'c',
        eventType: 'http_429',
        reasonCode: 'rate_limit',
        resourceKey: 'SharePoint_API',
      }),
    ]);

    expect(summary.reasonCodeSummary[0]).toEqual({
      reasonCode: 'transient_failure',
      count: 2,
      resources: ['Staff_Master', 'Users_Master'],
    });
    expect(summary.reasonCodeSummary[1]).toEqual({
      reasonCode: 'rate_limit',
      count: 1,
      resources: ['SharePoint_API'],
    });
  });
});

describe('deriveTransientFailureEvents', () => {
  it('creates watch events for recent failed integration runs when target is recovered', () => {
    const runs: GitHubWorkflowRun[] = [
      {
        name: 'integration (staff)',
        status: 'completed',
        conclusion: 'failure',
        created_at: '2026-04-07T02:50:00Z',
        html_url: 'https://github.com/example/repo/actions/runs/123',
        run_number: 123,
      },
    ];

    const events = deriveTransientFailureEvents(runs, [], new Date('2026-04-07T06:22:00Z'), 6);

    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe('transient_failure');
    expect(events[0]?.resourceKey).toBe('Staff_Master');
    expect(events[0]?.reasonCode).toBe('transient_failure');
  });

  it('escalates to repeated_transient_failure when the same target failed for 3 consecutive nights', () => {
    const runs: GitHubWorkflowRun[] = [
      {
        name: 'integration (dailyops)',
        status: 'completed',
        conclusion: 'failure',
        created_at: '2026-04-07T17:31:00Z',
        run_number: 100,
      },
      {
        name: 'integration (dailyops)',
        status: 'completed',
        conclusion: 'failure',
        created_at: '2026-04-08T17:32:00Z',
        run_number: 101,
      },
      {
        name: 'integration (dailyops)',
        status: 'completed',
        conclusion: 'failure',
        created_at: '2026-04-09T17:33:00Z',
        run_number: 102,
      },
    ];

    const events = deriveTransientFailureEvents(runs, [], new Date('2026-04-09T21:22:00Z'), 6);

    expect(events).toHaveLength(1);
    expect(events[0]?.resourceKey).toBe('DailyOpsSignals');
    expect(events[0]?.reasonCode).toBe('repeated_transient_failure');

    const summary = aggregateEvents(events);
    expect(summary.events[0]?.severity).toBe('action_required');
    expect(summary.countsBySeverity.action_required).toBe(1);
  });

  it('does not create transient events when the same target still has blocking failures', () => {
    const runs: GitHubWorkflowRun[] = [
      {
        name: 'integration (users)',
        status: 'completed',
        conclusion: 'failure',
        created_at: '2026-04-07T02:49:00Z',
        run_number: 45,
      },
    ];

    const existingEvents: RawEvent[] = [
      makeEvent({
        eventType: 'health_fail',
        reasonCode: 'essential_resource_unavailable',
        resourceKey: 'Users_Master',
        message: 'Users_Master is still unavailable',
      }),
    ];

    const events = deriveTransientFailureEvents(runs, existingEvents, new Date('2026-04-07T06:22:00Z'), 6);
    expect(events).toHaveLength(0);
  });
});

describe('formatStepSummary', () => {
  it('renders overall counts and reason code summary for GitHub step summary', () => {
    const output = formatStepSummary(
      makeSummary({
        countsBySeverity: { critical: 0, action_required: 1, watch: 1, silent: 0 },
        reasonCodeSummary: [
          { reasonCode: 'repeated_transient_failure', count: 1, resources: ['Users_Master'] },
          { reasonCode: 'transient_failure', count: 1, resources: ['DailyOpsSignals'] },
        ],
        events: [
          {
            fingerprint: 'repeat123',
            severity: 'action_required',
            eventType: 'transient_failure',
            area: 'Runtime',
            resourceKey: 'Users_Master',
            reasonCode: 'repeated_transient_failure',
            occurrences: 1,
            firstSeen: '2026-04-10T06:22:00Z',
            lastSeen: '2026-04-10T06:22:00Z',
            nextAction: 'check auth',
            sampleMessage: 'Repeated transient failure',
          },
          {
            fingerprint: 'watch123',
            severity: 'watch',
            eventType: 'transient_failure',
            area: 'Runtime',
            resourceKey: 'DailyOpsSignals',
            reasonCode: 'transient_failure',
            occurrences: 1,
            firstSeen: '2026-04-10T06:22:00Z',
            lastSeen: '2026-04-10T06:22:00Z',
            nextAction: 'watch',
            sampleMessage: 'Recovered transient failure',
          },
        ],
      }),
    );

    expect(output).toContain('Overall: **🟠 Action Required**');
    expect(output).toContain('Reason Code Summary');
    expect(output).toContain('`repeated_transient_failure`: 1 (Users_Master)');
    expect(output).toContain('Recovered Transient Failures: **1**');
    expect(output).toContain('Repeated Transient Failures: **1**');
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

  it('includes recovered transient failures section when watch items were recovered by nightly', async () => {
    const summary = makeSummary({
      countsBySeverity: { critical: 0, action_required: 0, watch: 1, silent: 0 },
      reasonCodeSummary: [
        { reasonCode: 'transient_failure', count: 1, resources: ['DailyOpsSignals'] },
      ],
      events: [
        {
          fingerprint: 'abc12345',
          severity: 'watch',
          eventType: 'transient_failure',
          area: 'Runtime',
          resourceKey: 'DailyOpsSignals',
          occurrences: 1,
          firstSeen: '2026-04-07T06:22:00Z',
          lastSeen: '2026-04-07T06:22:00Z',
          nextAction: 'watch',
          sampleMessage: 'Recovered by Nightly Runtime Patrol',
        },
      ],
    });

    await sendTeamsNotification(summary, WEBHOOK);

    const text = cardText(capturedCard());
    expect(text).toContain('Recovered transient failures');
    expect(text).toContain('DailyOpsSignals');
    expect(text).toContain('"color":"Warning"');
  });

  it('includes repeated transient failures section when transient failures repeat for 3 nights', async () => {
    const summary = makeSummary({
      countsBySeverity: { critical: 0, action_required: 1, watch: 0, silent: 0 },
      reasonCodeSummary: [
        { reasonCode: 'repeated_transient_failure', count: 1, resources: ['Users_Master'] },
      ],
      events: [
        {
          fingerprint: 'repeat123',
          severity: 'action_required',
          eventType: 'transient_failure',
          area: 'Runtime',
          resourceKey: 'Users_Master',
          reasonCode: 'repeated_transient_failure',
          occurrences: 1,
          firstSeen: '2026-04-10T06:22:00Z',
          lastSeen: '2026-04-10T06:22:00Z',
          nextAction: 'watch',
          sampleMessage: 'Repeated transient failure',
        },
      ],
    });

    await sendTeamsNotification(summary, WEBHOOK);

    const text = cardText(capturedCard());
    expect(text).toContain('Repeated transient failures');
    expect(text).toContain('Users_Master');
    expect(text).toContain('SharePoint');
    expect(text).toContain('Reason Code Summary');
    expect(text).toContain('repeated_transient_failure');
  });
});
