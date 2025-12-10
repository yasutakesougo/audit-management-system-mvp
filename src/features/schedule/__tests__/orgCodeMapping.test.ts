import { describe, expect, it } from 'vitest';

import type { SpScheduleItem } from '@/types';
import { inferOrgCodeFromSpItem, mapOrgCodeFromServiceType } from '../orgCodeMapping';

const buildItem = (overrides: Partial<SpScheduleItem> = {}): SpScheduleItem => ({
  Id: 1,
  Title: 'dummy',
  Created: '2024-01-01T00:00:00Z',
  Modified: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('mapOrgCodeFromServiceType', () => {
  it('returns shortstay for short-stay service types', () => {
    expect(mapOrgCodeFromServiceType('ショートステイ')).toBe('shortstay');
    expect(mapOrgCodeFromServiceType('一時ケア・短期')).toBe('shortstay');
  });

  it('returns respite for respite-oriented service types', () => {
    expect(mapOrgCodeFromServiceType('一時ケア')).toBe('respite');
    expect(mapOrgCodeFromServiceType('respite')).toBe('respite');
  });

  it('defaults to main for standard services', () => {
    expect(mapOrgCodeFromServiceType('normal')).toBe('main');
    expect(mapOrgCodeFromServiceType('通常利用')).toBe('main');
  });
});

describe('inferOrgCodeFromSpItem', () => {
  it('prioritizes resource hints when present', () => {
    const item = buildItem({ cr014_resourceId: 'ShortStay-Room-A' });
    expect(inferOrgCodeFromSpItem(item)).toBe('shortstay');
  });

  it('falls back to service type when resource hint is missing', () => {
    const item = buildItem({ ServiceType: '一時ケア' });
    expect(inferOrgCodeFromSpItem(item)).toBe('respite');
  });

  it('returns undefined when neither hint is available', () => {
    const item = buildItem();
    expect(inferOrgCodeFromSpItem(item)).toBeUndefined();
  });
});
