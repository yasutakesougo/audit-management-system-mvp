import { test, expect } from '@playwright/test';
import { readAuditMetrics, expectConsistent } from './utils/metrics';

// Verifies badge metrics (data-testid="audit-metrics") reflect new / duplicate / failed counts after a batch sync & resend.
// Updated: uses stable data-* attributes (data-new, data-duplicates, data-failed, data-success, data-total) instead of
// localized text matching, making the test resilient to i18n or formatting changes.

function buildBatchMultipart(parts: { contentId: number; status: number }[]) {
  const boundary = 'batch_metrics_boundary';
  const changeset = 'changeset_metrics_boundary';
  const segs: string[] = [];
  for (const p of parts) {
    segs.push(`--${changeset}`);
    segs.push('Content-Type: application/http');
    segs.push('Content-Transfer-Encoding: binary');
    segs.push(`Content-ID: ${p.contentId}`);
    segs.push('');
    segs.push(`HTTP/1.1 ${p.status} ${p.status === 201 ? 'Created' : p.status === 409 ? 'Conflict' : (p.status >= 500 ? 'ServerError' : 'Error')}`);
    segs.push('Content-Type: application/json;odata=nometadata');
    segs.push('');
    segs.push(`{"d":{"Id":${p.contentId}}}`);
  }
  segs.push(`--${changeset}--`);
  const body = [
    `--${boundary}`,
    `Content-Type: multipart/mixed; boundary=${changeset}`,
    '',
    ...segs,
    `--${boundary}--`,
    ''
  ].join('\r\n');
  return { body, boundary };
}

 test.describe('Audit metrics badge', () => {
  test.skip('shows new/duplicate/failed counts and updates after resend', async ({ page }) => {
    let first = true;
  // NOTE: Must escape the $ in "$batch"; previous regex /\/$batch$/ incorrectly anchored end-of-string before 'batch'
  await page.route(/\/\$batch$/, async route => {
      if (first) {
        first = false;
        const { body } = buildBatchMultipart([
          { contentId: 1, status: 201 }, // success
          { contentId: 2, status: 409 }, // duplicate
          { contentId: 3, status: 500 }, // failure
          { contentId: 4, status: 503 }, // transient failure
        ]);
        return route.fulfill({ status: 202, headers: { 'Content-Type': 'multipart/mixed; boundary=batch_metrics_boundary' }, body });
      } else {
        const { body } = buildBatchMultipart([
          { contentId: 1, status: 201 },
          { contentId: 2, status: 201 },
        ]);
        return route.fulfill({ status: 202, headers: { 'Content-Type': 'multipart/mixed; boundary=batch_metrics_boundary' }, body });
      }
    });

    // Seed logs (4 entries) before visiting audit route and install batch done hook.
    await page.addInitScript(() => {
      const now = Date.now();
      const key = 'audit_log_v1';
      const logs = Array.from({ length: 4 }).map((_, i) => ({
        ts: new Date(now - i * 1000).toISOString(),
        actor: 'tester',
        action: 'CREATE',
        entity: 'Record',
        entity_id: String(200 + i),
        channel: 'UI',
        after: { n: i }
      }));
      window.localStorage.setItem(key, JSON.stringify(logs));
      (window as any).__TEST_BATCH_DONE__ = () => { (window as any).__BATCH_DONE_FLAG__ = (window as any).__BATCH_DONE_FLAG__ + 1 || 1; };
      let first = true;
      (window as any).__E2E_FORCE_BATCH__ = () => {
        if (first) {
          first = false;
          // success=2 (201,409), duplicates=1, failed=2 (500,503) total=4
          return { body: `--e2e_forced\nContent-Type: multipart/mixed; boundary=changeset_e2e\n\n--changeset_e2e\nHTTP/1.1 201 Created\nContent-ID: 1\n\n--changeset_e2e\nHTTP/1.1 409 Conflict\nContent-ID: 2\n\n--changeset_e2e\nHTTP/1.1 500 ServerError\nContent-ID: 3\n\n--changeset_e2e\nHTTP/1.1 503 ServerError\nContent-ID: 4\n\n--changeset_e2e--\n--e2e_forced--` };
        }
        // resend -> all succeed: 201,201
        return { body: `--e2e_forced\nContent-Type: multipart/mixed; boundary=changeset_e2e\n\n--changeset_e2e\nHTTP/1.1 201 Created\nContent-ID: 1\n\n--changeset_e2e\nHTTP/1.1 201 Created\nContent-ID: 2\n\n--changeset_e2e--\n--e2e_forced--` };
      };
    });

    await page.goto('/audit');

    // Perform batch sync
    await page.getByRole('button', { name: /一括同期/ }).click();

  // Wait until success attribute reflects expected initial success (2)
  const metrics = page.getByTestId('audit-metrics');
  await expect.poll(async () => await page.evaluate(() => (window as any).__BATCH_DONE_FLAG__ || 0)).toBeGreaterThan(0);
  await expect.poll(async () => await metrics.getAttribute('data-success')).toBe('2');
  const initial = await readAuditMetrics(page);
  expectConsistent(initial);
  expect(initial).toMatchObject({ total: 4, success: 2, duplicates: 1, newItems: 1, failed: 2 });
  expect(initial.order).toEqual(['new','duplicates','failed']);

  // Trigger resend (should appear because failures remain)
  await page.getByRole('button', { name: '失敗のみ再送' }).click();
  await expect.poll(async () => await page.evaluate(() => (window as any).__BATCH_DONE_FLAG__ || 0)).toBeGreaterThan(1);
  await expect.poll(async () => await metrics.getAttribute('data-success')).toBe('4');
  const after = await readAuditMetrics(page);
  expectConsistent(after);
  expect(after.failed).toBe(0);
  // success becomes 4 (all), duplicates still 1, newItems 3
  expect(after).toMatchObject({ total: 4, success: 4, duplicates: 1, newItems: 3, failed: 0 });
  });
});
