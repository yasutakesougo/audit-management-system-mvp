import { describe, expect, it } from 'vitest';
import {
  applyCallLogStatusTransition,
  deriveInitialCallLogStatus,
} from '@/domain/callLogs/statusTransition';

describe('deriveInitialCallLogStatus', () => {
  it('returns callback_pending when needCallback is true', () => {
    expect(
      deriveInitialCallLogStatus({
        needCallback: true,
        callbackDueAt: undefined,
      }),
    ).toBe('callback_pending');
  });

  it('returns callback_pending when callbackDueAt exists even if needCallback is false', () => {
    expect(
      deriveInitialCallLogStatus({
        needCallback: false,
        callbackDueAt: '2026-03-28T10:00:00.000Z',
      }),
    ).toBe('callback_pending');
  });

  it('returns new when callback requirement does not exist', () => {
    expect(
      deriveInitialCallLogStatus({
        needCallback: false,
        callbackDueAt: undefined,
      }),
    ).toBe('new');
  });
});

describe('applyCallLogStatusTransition', () => {
  const NOW = new Date('2026-03-28T10:00:00.000Z');

  it('sets completedAt when transitioning to done', () => {
    const result = applyCallLogStatusTransition(
      {
        status: 'new',
        completedAt: undefined,
      },
      'done',
      NOW,
    );

    expect(result.status).toBe('done');
    expect(result.completedAt).toBe('2026-03-28T10:00:00.000Z');
  });

  it('preserves completedAt when already done', () => {
    const result = applyCallLogStatusTransition(
      {
        status: 'done',
        completedAt: '2026-03-28T09:30:00.000Z',
      },
      'done',
      NOW,
    );

    expect(result.status).toBe('done');
    expect(result.completedAt).toBe('2026-03-28T09:30:00.000Z');
  });

  it('clears completedAt when reopening to callback_pending', () => {
    const result = applyCallLogStatusTransition(
      {
        status: 'done',
        completedAt: '2026-03-28T09:30:00.000Z',
      },
      'callback_pending',
      NOW,
    );

    expect(result.status).toBe('callback_pending');
    expect(result.completedAt).toBeUndefined();
  });

  it('clears completedAt when reopening to new', () => {
    const result = applyCallLogStatusTransition(
      {
        status: 'done',
        completedAt: '2026-03-28T09:30:00.000Z',
      },
      'new',
      NOW,
    );

    expect(result.status).toBe('new');
    expect(result.completedAt).toBeUndefined();
  });
});
