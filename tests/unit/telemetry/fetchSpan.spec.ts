import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Captured spans ─────────────────────────────────────────────────────────

const completedSpans: Array<{
  id: string;
  label: string;
  group?: string;
  meta?: Record<string, unknown>;
  error?: string;
}> = [];

// Mock hydrationHud so we control spans without side-effects
vi.mock('@/lib/hydrationHud', () => ({
  beginHydrationSpan: (
    _labelOrId: string,
    opts?: { id?: string; label?: string; group?: string; meta?: Record<string, unknown> },
  ) => {
    const span = {
      id: opts?.id ?? _labelOrId,
      label: opts?.label ?? _labelOrId,
      group: opts?.group,
      meta: opts?.meta ? { ...opts.meta } : undefined,
      error: undefined as string | undefined,
    };
    return (completion?: { meta?: Record<string, unknown>; error?: string }) => {
      if (completion?.meta) {
        span.meta = { ...span.meta, ...completion.meta };
      }
      if (completion?.error) {
        span.error = completion.error;
      }
      completedSpans.push(span);
      return span;
    };
  },
}));

import {
  startFetchSpan,
  truncatePath,
  _resetCounter,
} from '@/telemetry/fetchSpan';

describe('telemetry/fetchSpan', () => {
  beforeEach(() => {
    _resetCounter();
    completedSpans.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // truncatePath
  // ─────────────────────────────────────────────────────────────────────────

  describe('truncatePath', () => {
    it('removes query parameters', () => {
      expect(truncatePath('/_api/web/lists?$select=Id')).toBe('/_api/web/lists');
    });

    it('truncates paths longer than 80 characters', () => {
      const longPath = '/' + 'a'.repeat(100);
      const result = truncatePath(longPath);
      expect(result).toHaveLength(81); // 80 chars + '…'
      expect(result.endsWith('…')).toBe(true);
    });

    it('leaves short paths intact', () => {
      expect(truncatePath('/_api/web/lists')).toBe('/_api/web/lists');
    });

    it('handles paths with both long path and query params', () => {
      const longPath = '/' + 'x'.repeat(100) + '?foo=bar';
      const result = truncatePath(longPath);
      expect(result.endsWith('…')).toBe(true);
      expect(result).not.toContain('?');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // startFetchSpan
  // ─────────────────────────────────────────────────────────────────────────

  describe('startFetchSpan', () => {
    it('creates a span with correct layer and method', () => {
      const span = startFetchSpan({ layer: 'sp', method: 'GET', path: '/_api/web/lists' });
      span.succeed(200);

      expect(completedSpans).toHaveLength(1);
      expect(completedSpans[0].meta).toMatchObject({
        layer: 'sp',
        method: 'GET',
        status: 200,
        retryCount: 0,
      });
    });

    it('records retryCount on succeed', () => {
      const span = startFetchSpan({ layer: 'sp', method: 'PATCH', path: '/_api/web/lists' });
      span.succeed(200, 2);

      expect(completedSpans[0].meta).toMatchObject({ retryCount: 2 });
    });

    it('records failure with status and errorName', () => {
      const span = startFetchSpan({ layer: 'graph', method: 'GET', path: '/me' });
      span.fail(404, 'GraphApiError', 0);

      expect(completedSpans).toHaveLength(1);
      expect(completedSpans[0].error).toBe('GraphApiError (404)');
      expect(completedSpans[0].meta).toMatchObject({
        status: 404,
        errorName: 'GraphApiError',
        retryCount: 0,
      });
    });

    it('records network error with no HTTP status', () => {
      const span = startFetchSpan({ layer: 'sp', method: 'POST', path: '/_api/web/lists' });
      span.error('TypeError', 3);

      expect(completedSpans[0].error).toBe('TypeError');
      expect(completedSpans[0].meta).toMatchObject({
        status: 0,
        errorName: 'TypeError',
        retryCount: 3,
      });
    });

    it('generates unique span IDs', () => {
      const span1 = startFetchSpan({ layer: 'sp', method: 'GET', path: '/a' });
      const span2 = startFetchSpan({ layer: 'sp', method: 'GET', path: '/a' });
      span1.succeed(200);
      span2.succeed(200);

      expect(completedSpans[0].id).not.toBe(completedSpans[1].id);
    });

    it('uses "graph" layer label', () => {
      const span = startFetchSpan({ layer: 'graph', method: 'PATCH', path: '/me/photo' });
      span.succeed(200);

      expect(completedSpans[0].label).toContain('graph');
      expect(completedSpans[0].label).toContain('PATCH');
    });

    it('truncates path in meta', () => {
      const longPath = '/_api/web/lists/' + 'x'.repeat(200);
      const span = startFetchSpan({ layer: 'sp', method: 'GET', path: longPath });
      span.succeed(200);

      const path = completedSpans[0].meta?.path as string;
      expect(path.length).toBeLessThanOrEqual(81);
      expect(path.endsWith('…')).toBe(true);
    });

    it('defaults retryCount to 0', () => {
      const span = startFetchSpan({ layer: 'sp', method: 'GET', path: '/test' });
      span.succeed(200);

      expect(completedSpans[0].meta).toMatchObject({ retryCount: 0 });
    });
  });
});
