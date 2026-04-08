import { describe, expect, it } from 'vitest';
import { buildVisibleNavItems, splitNavItemsByTier } from '../navigationConfig.helpers';
import type { NavItem } from '../navigationConfig.types';

const items: NavItem[] = [
  {
    label: 'Today',
    to: '/today',
    isActive: (pathname) => pathname.startsWith('/today'),
    tier: 'core',
    audience: ['all'],
    group: 'today',
  },
  {
    label: 'Daily Table',
    to: '/daily/table',
    isActive: (pathname) => pathname.startsWith('/daily/table'),
    tier: 'core',
    audience: ['all'],
    group: 'today',
  },
  {
    label: 'Meeting Minutes',
    to: '/meeting-minutes',
    isActive: (pathname) => pathname.startsWith('/meeting-minutes'),
    tier: 'more',
    audience: ['all'],
    group: 'today',
  },
  {
    label: 'Analysis',
    to: '/analysis/dashboard',
    isActive: (pathname) => pathname.startsWith('/analysis'),
    tier: 'admin',
    audience: ['admin'],
    group: 'planning',
  },
];

describe('buildVisibleNavItems', () => {
  it('returns all items when feature flag is off', () => {
    const result = buildVisibleNavItems(items, 'staff', {
      showMore: false,
      todayLiteNavV2: false,
      isKiosk: false,
      hiddenGroups: [],
      hiddenItems: [],
    });

    expect(result.map((x) => x.label)).toEqual([
      'Today',
      'Daily Table',
      'Meeting Minutes',
      'Analysis',
    ]);
  });

  it('viewer sees only core when showMore is false', () => {
    const result = buildVisibleNavItems(items, 'staff', {
      showMore: false,
      todayLiteNavV2: true,
      isKiosk: false,
      hiddenGroups: [],
      hiddenItems: [],
    });

    expect(result.map((x) => x.label)).toEqual(['Today', 'Daily Table']);
  });

  it('viewer sees more items when showMore is true', () => {
    const result = buildVisibleNavItems(items, 'staff', {
      showMore: true,
      todayLiteNavV2: true,
      isKiosk: false,
      hiddenGroups: [],
      hiddenItems: [],
    });

    expect(result.map((x) => x.label)).toEqual([
      'Today',
      'Daily Table',
      'Meeting Minutes',
    ]);
  });

  it('admin can see admin tier items', () => {
    const result = buildVisibleNavItems(items, 'admin', {
      showMore: true,
      todayLiteNavV2: true,
      isKiosk: false,
      hiddenGroups: [],
      hiddenItems: [],
    });

    expect(result.some((x) => x.label === 'Analysis')).toBe(true);
  });
});

describe('splitNavItemsByTier', () => {
  it('splits items into core/more/admin buckets', () => {
    const result = splitNavItemsByTier(items);

    expect(result.core.map((x) => x.label)).toEqual(['Today', 'Daily Table']);
    expect(result.more.map((x) => x.label)).toEqual(['Meeting Minutes']);
    expect(result.admin.map((x) => x.label)).toEqual(['Analysis']);
  });
});

