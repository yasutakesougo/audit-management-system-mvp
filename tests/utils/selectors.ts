// tests/utils/selectors.ts
// E2E test utility for expectVisible and TESTIDS re-export
import { expect } from '@playwright/test';
import { TESTIDS as RAW_TESTIDS } from '../../src/testids';

export const TESTIDS = RAW_TESTIDS;

export async function expectVisible(page: any, testid: keyof typeof TESTIDS) {
  await expect(page.getByTestId(testid)).toBeVisible();
}
