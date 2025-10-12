import { describe, expect, it } from 'vitest';
import {
  createSpClient,
  type SpClientOptions,
  type SharePointRetryMeta,
  type SharePointBatchOperation,
  type SharePointBatchResult,
} from '../../src/lib/spClient';

describe('spClient exports (smoke)', () => {
  it('exposes factory', () => {
    expect(typeof createSpClient).toBe('function');
  });

  it('type sanity', () => {
    const tuple: [
      SpClientOptions?,
      SharePointRetryMeta?,
      SharePointBatchOperation?,
      SharePointBatchResult?,
    ] = [];
    expect(Array.isArray(tuple)).toBe(true);
  });
});
