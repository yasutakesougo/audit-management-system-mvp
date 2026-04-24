import { describe, expect, it } from 'vitest';
import { getTodayPrimaryFlowSteps, TODAY_CORE_FLOW } from './todayCoreFlow';

describe('todayCoreFlow', () => {
  it('defines today overview + 4-step viewer core workflow', () => {
    const keys = TODAY_CORE_FLOW.map((step) => step.key);
    expect(keys).toEqual([
      'today-overview',
      'attendance',
      'daily-table',
      'handoff-timeline',
      'daily-support',
    ]);
  });

  it('returns primary steps in fixed order for staff', () => {
    const steps = getTodayPrimaryFlowSteps('staff');
    expect(steps.map((step) => step.route)).toEqual([
      '/daily/attendance',
      '/daily/table',
      '/handoff-timeline',
      '/daily/support?wizard=user',
    ]);
  });

  it('returns the same core order for admin', () => {
    const steps = getTodayPrimaryFlowSteps('admin');
    expect(steps.map((step) => step.route)).toEqual([
      '/daily/attendance',
      '/daily/table',
      '/handoff-timeline',
      '/daily/support?wizard=user',
    ]);
  });
});

