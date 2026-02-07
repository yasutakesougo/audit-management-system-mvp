import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useDashboardViewModel } from '../useDashboardViewModel';

describe('useDashboardViewModel', () => {
  it('staff role enables staff section and disables admin section', () => {
    const { result } = renderHook(() =>
      useDashboardViewModel({ role: 'staff', summary: null })
    );

    const sectionMap = new Map(
      result.current.sections.map((section) => [section.key, section])
    );

    expect(sectionMap.get('adminOnly')?.enabled).toBe(false);
    expect(sectionMap.get('staffOnly')?.enabled).toBe(true);
  });

  it('provides titles and preserves default order', () => {
    const { result } = renderHook(() =>
      useDashboardViewModel({ role: 'admin', summary: null })
    );

    const keys = result.current.sections.map((section) => section.key);
    expect(keys).toEqual([
      'safety',
      'attendance',
      'daily',
      'schedule',
      'handover',
      'stats',
      'adminOnly',
      'staffOnly',
    ]);

    const attendance = result.current.sections.find(
      (section) => section.key === 'attendance'
    );
    expect(attendance?.title).toBe('今日の通所 / 出勤状況');
  });

  it('returns full section key set for staff role', () => {
    const { result } = renderHook(() =>
      useDashboardViewModel({ role: 'staff', summary: null })
    );

    const keys = result.current.sections.map((section) => section.key).sort();
    expect(keys).toEqual([
      'adminOnly',
      'attendance',
      'daily',
      'handover',
      'safety',
      'schedule',
      'staffOnly',
      'stats',
    ]);
  });
});
