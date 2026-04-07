import { describe, expect, it } from 'vitest'
import { aggregateEvents, type RawEvent } from './nightly-runtime-patrol'

// Helper to build a minimal RawEvent with required fields only
function makeEvent(overrides: Partial<RawEvent> & Pick<RawEvent, 'eventType' | 'reasonCode'>): RawEvent {
  return {
    id: 'test-1',
    timestamp: '2026-04-07T00:00:00Z',
    area: 'Platform',
    resourceKey: 'Users_Master',
    message: 'test event',
    ...overrides,
  }
}

describe('aggregateEvents / severity classification', () => {
  it('treats essential field missing (health_fail) as critical', () => {
    const summary = aggregateEvents([
      makeEvent({
        eventType: 'health_fail',
        reasonCode: 'essential_resource_unavailable',
        resourceKey: 'Users_Master',
        message: 'Essential field missing',
      }),
    ])

    expect(summary.events).toHaveLength(1)
    expect(summary.events[0]?.severity).toBe('critical')
    expect(summary.countsBySeverity.critical).toBe(1)
  })

  it('treats SharePoint throttling (http_429) as critical', () => {
    const summary = aggregateEvents([
      makeEvent({
        eventType: 'http_429',
        reasonCode: 'rate_limit',
        resourceKey: 'SharePoint_API',
        message: 'Throttle detected',
      }),
    ])

    expect(summary.events).toHaveLength(1)
    expect(summary.events[0]?.severity).toBe('critical')
    expect(summary.countsBySeverity.critical).toBe(1)
  })

  it('treats Strategy E absorbed drift as silent', () => {
    const summary = aggregateEvents([
      makeEvent({
        eventType: 'drift',
        reasonCode: 'absorbed_strategy_e',
        resourceKey: 'UserBenefit_Profile',
        message: 'Drift absorbed by Strategy E',
      }),
    ])

    expect(summary.events).toHaveLength(1)
    expect(summary.events[0]?.severity).toBe('silent')
    expect(summary.countsBySeverity.silent).toBe(1)
  })
})

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
    ])

    expect(summary.events).toHaveLength(1)
    expect(summary.events[0]?.severity).toBe('action_required')
    expect(summary.countsBySeverity.action_required).toBe(1)
  })

  it('treats provision_failed as action_required', () => {
    const summary = aggregateEvents([
      makeEvent({
        eventType: 'provision_failed',
        reasonCode: 'write_error',
        resourceKey: 'SupportRecord_Daily',
        message: 'Failed to provision record.',
      }),
    ])

    expect(summary.events).toHaveLength(1)
    expect(summary.events[0]?.severity).toBe('action_required')
    expect(summary.countsBySeverity.action_required).toBe(1)
  })
})

describe('aggregateEvents / bundling', () => {
  it('bundles repeated identical events into one entry', () => {
    const event = makeEvent({ eventType: 'http_429', reasonCode: 'rate_limit' })
    const summary = aggregateEvents([event, { ...event, id: 'test-2' }, { ...event, id: 'test-3' }])

    expect(summary.totalEvents).toBe(3)
    expect(summary.bundledCount).toBe(1)
    expect(summary.events[0]?.occurrences).toBe(3)
  })

  it('keeps distinct events as separate bundles', () => {
    const summary = aggregateEvents([
      makeEvent({ id: 'a', eventType: 'http_429', reasonCode: 'rate_limit' }),
      makeEvent({ id: 'b', eventType: 'health_fail', reasonCode: 'essential_resource_unavailable' }),
    ])

    expect(summary.bundledCount).toBe(2)
  })
})

describe('aggregateEvents / severity ordering', () => {
  it('sorts critical before watch in output', () => {
    const summary = aggregateEvents([
      makeEvent({ id: 'a', eventType: 'drift', reasonCode: 'unknown_field_added' }),
      makeEvent({ id: 'b', eventType: 'http_429', reasonCode: 'rate_limit' }),
    ])

    expect(summary.events[0]?.severity).toBe('critical')
  })
})
