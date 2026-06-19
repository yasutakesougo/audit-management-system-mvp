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
  {
    label: 'Assessment',
    to: '/assessment',
    isActive: (pathname) => pathname.startsWith('/assessment'),
    tier: 'more',
    audience: ['staff'],
    group: 'planning',
  },
];

describe('buildVisibleNavItems', () => {
  it('does not apply tier-based collapsing when todayLiteNavV2 is off', () => {
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
      'Assessment',
    ]);
  });

  it('applies lite-nav collapsing when todayLiteNavV2 is on and showMore is false', () => {
    const result = buildVisibleNavItems(items, 'staff', {
      showMore: false,
      todayLiteNavV2: true,
      isKiosk: false,
      hiddenGroups: [],
      hiddenItems: [],
    });

    expect(result.map((x) => x.label)).toEqual(['Today', 'Daily Table', 'Assessment']);
  });

  it('keeps /assessment visible as a forced pillar when todayLiteNavV2 is on and showMore is false', () => {
    const result = buildVisibleNavItems(items, 'staff', {
      showMore: false,
      todayLiteNavV2: true,
      isKiosk: false,
      hiddenGroups: [],
      hiddenItems: [],
    });

    expect(result.some((x) => x.to === '/assessment')).toBe(true);
  });

  it('reveals tier=more items when todayLiteNavV2 is on and showMore is true', () => {
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
      'Assessment',
    ]);
  });

  it('keeps tier=admin visible only for admin when todayLiteNavV2 is on', () => {
    const result = buildVisibleNavItems(items, 'admin', {
      showMore: true,
      todayLiteNavV2: true,
      isKiosk: false,
      hiddenGroups: [],
      hiddenItems: [],
    });

    expect(result.some((x) => x.label === 'Analysis')).toBe(true);
  });

  it('treats tier=more as collapsed-by-default, not removed', () => {
    const collapsed = buildVisibleNavItems(items, 'staff', {
      showMore: false,
      todayLiteNavV2: true,
      isKiosk: false,
      hiddenGroups: [],
      hiddenItems: [],
    });
    const expanded = buildVisibleNavItems(items, 'staff', {
      showMore: true,
      todayLiteNavV2: true,
      isKiosk: false,
      hiddenGroups: [],
      hiddenItems: [],
    });

    expect(collapsed.some((x) => x.label === 'Meeting Minutes')).toBe(false);
    expect(expanded.some((x) => x.label === 'Meeting Minutes')).toBe(true);
  });
});

describe('splitNavItemsByTier', () => {
  it('splits items into core/more/admin buckets', () => {
    const result = splitNavItemsByTier(items);

    expect(result.core.map((x) => x.label)).toEqual(['Today', 'Daily Table']);
    expect(result.more.map((x) => x.label)).toEqual(['Meeting Minutes', 'Assessment']);
    expect(result.admin.map((x) => x.label)).toEqual(['Analysis']);
  });
});
