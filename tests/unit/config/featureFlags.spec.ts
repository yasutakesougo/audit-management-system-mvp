import { describe, expect, it, vi, afterEach } from 'vitest';
import React, { createElement } from 'react';
import { cleanup, render } from '@testing-library/react';
import { featureFlags, getFeatureFlags, resolveFeatureFlags, FeatureFlagsProvider, useFeatureFlags, type FeatureFlagSnapshot } from '@/config/featureFlags';
import * as env from '@/lib/env';

describe('featureFlags config', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('resolves feature flag snapshot using env helpers', () => {
    const schedules = vi.spyOn(env, 'isSchedulesFeatureEnabled').mockReturnValue(true);
    const schedulesCreate = vi.spyOn(env, 'isSchedulesCreateEnabled').mockReturnValue(false);
    const compliance = vi.spyOn(env, 'isComplianceFormEnabled').mockReturnValue(true);

    const snapshot = resolveFeatureFlags();

    expect(snapshot).toEqual({
      schedules: true,
      schedulesCreate: false,
      complianceForm: true,
    });

    expect(schedules).toHaveBeenCalledTimes(1);
    expect(schedulesCreate).toHaveBeenCalledTimes(1);
    expect(compliance).toHaveBeenCalledTimes(1);
  });

  it('passes env override through to helper functions', () => {
    const override = { VITE_FEATURE_SCHEDULES: 'true' };
    const schedules = vi.spyOn(env, 'isSchedulesFeatureEnabled').mockReturnValue(true);
    const schedulesCreate = vi.spyOn(env, 'isSchedulesCreateEnabled').mockReturnValue(false);
    const compliance = vi.spyOn(env, 'isComplianceFormEnabled').mockReturnValue(false);

    resolveFeatureFlags(override);

    expect(schedules).toHaveBeenCalledWith(override);
    expect(schedulesCreate).toHaveBeenCalledWith(override);
    expect(compliance).toHaveBeenCalledWith(override);
  });

  it('exports a default snapshot computed at module load', () => {
    const fresh = resolveFeatureFlags();
    expect(featureFlags).toEqual(fresh);
  });

  it('returns current snapshot from getFeatureFlags', () => {
    expect(getFeatureFlags()).toEqual(featureFlags);

    const override = {
      VITE_FEATURE_SCHEDULES: '0',
      VITE_FEATURE_SCHEDULES_CREATE: '1',
      VITE_FEATURE_COMPLIANCE_FORM: '0',
    };

    expect(getFeatureFlags(override)).toEqual({
      schedules: false,
      schedulesCreate: true,
      complianceForm: false,
    });
  });

  it('updates cached snapshot when provider value changes', () => {
    const probe = vi.fn();

    const Probe: React.FC = () => {
      const flags = useFeatureFlags();
      probe(flags);
      return null;
    };

    const nextSnapshot = {
      schedules: true,
      schedulesCreate: false,
      complianceForm: true,
    } satisfies FeatureFlagSnapshot;

  render(createElement(FeatureFlagsProvider, { value: nextSnapshot, children: createElement(Probe) }));

    expect(probe).toHaveBeenCalledWith(nextSnapshot);
    expect(getFeatureFlags()).toEqual(nextSnapshot);
  });
});
