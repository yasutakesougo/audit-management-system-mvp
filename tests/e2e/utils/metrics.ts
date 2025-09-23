import { expect, Page } from '@playwright/test';

export type BadgeMetrics = {
  new: number;
  duplicates: number;
  failed: number;
  success: number;
  total: number;
};

/** data-testid="audit-metrics" の data-* 属性を読んで数値化 */
export async function readAuditMetrics(page: Page): Promise<BadgeMetrics> {
  const locator = page.locator('[data-testid="audit-metrics"]').first();
  await locator.waitFor({ state: 'visible' });

  const m = await locator.evaluate((el) => {
    const num = (v: string | null) => Number(v ?? '0');
    return {
      new: num(el.getAttribute('data-new')),
      duplicates: num(el.getAttribute('data-duplicates')),
      failed: num(el.getAttribute('data-failed')),
      success: num(el.getAttribute('data-success')),
      total: num(el.getAttribute('data-total')),
    };
  });

  return m;
}

/** 属性間の整合性チェック（UI表示の微妙な文言に依存しない） */
export function expectConsistent(m: BadgeMetrics) {
  expect(m.new).toBeGreaterThanOrEqual(0);
  expect(m.duplicates).toBeGreaterThanOrEqual(0);
  expect(m.failed).toBeGreaterThanOrEqual(0);

  // 成功 = 新規 + 重複
  expect(m.success).toBe(m.new + m.duplicates);
  // 合計 = 成功 + 失敗
  expect(m.total).toBe(m.success + m.failed);
}
