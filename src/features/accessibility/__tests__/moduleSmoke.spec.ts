import { describe, expect, it } from 'vitest';

describe('accessibility modules', () => {
  it('loads feature modules without runtime errors', async () => {
    await expect(import('../index')).resolves.toBeTruthy();
    await expect(import('../keyboardNavigation')).resolves.toBeTruthy();
    await expect(import('../AccessibilityContext')).resolves.toBeTruthy();
    await expect(import('../AccessibilitySettingsPanel')).resolves.toBeTruthy();
  });
});
