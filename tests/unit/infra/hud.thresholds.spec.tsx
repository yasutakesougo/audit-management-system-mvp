import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import HydrationHud from '@/debug/HydrationHud';
import { resetServiceRecords } from '@/serviceRecords';
import { resetParsedEnvForTests } from '@/lib/env.schema';

import { enableHudForTests } from '../../helpers/renderWithAppProviders';

type TestEnv = Record<string, unknown>;
type GlobalWithEnv = typeof globalThis & { __TEST_ENV__?: TestEnv };

const setTestEnv = (values: TestEnv) => {
  (globalThis as GlobalWithEnv).__TEST_ENV__ = values;
};

const clearTestEnv = () => {
  delete (globalThis as GlobalWithEnv).__TEST_ENV__;
};

describe('HUD thresholds section', () => {
  beforeEach(() => {
    clearTestEnv();
    resetParsedEnvForTests();
    resetServiceRecords();
    enableHudForTests();
  });

  afterEach(() => {
    cleanup();
    clearTestEnv();
    resetParsedEnvForTests();
    resetServiceRecords();
  });

  it('renders overrides from env schema', () => {
    setTestEnv({
      VITE_ATTENDANCE_DISCREPANCY_THRESHOLD: '0.25',
      VITE_ABSENCE_MONTHLY_LIMIT: '3',
      VITE_FACILITY_CLOSE_TIME: '18:30',
    });
    resetServiceRecords();

    render(<HydrationHud />);

    const thresholds = screen.getByTestId('hud-thresholds');
    expect(thresholds).toHaveTextContent('discrepancy=15m');
    expect(thresholds).toHaveTextContent('absenceLimit=3');
    expect(thresholds).toHaveTextContent('closeTime=18:30');
  });
});
