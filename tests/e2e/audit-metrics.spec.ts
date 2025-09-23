import { test, expect } from '@playwright/test';

// Verifies badge metrics (data-testid="audit-metrics") reflect new / duplicate / failed counts after a batch sync & resend.
// Uses a crafted $batch response including success, duplicate (409), server + transient failures, then a clean resend.

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
  test('shows new/duplicate/failed counts and updates after resend', async ({ page }) => {
    let first = true;
    await page.route(/\/$batch$/, async route => {
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

    // Seed logs (4 entries) before visiting audit route.
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
    });

    await page.goto('/audit');

    // Perform batch sync
    await page.getByRole('button', { name: /一括同期/ }).click();

    const metrics = page.getByTestId('audit-metrics');
    await expect(metrics).toBeVisible();
    const text = await metrics.innerText();
    // Expect at least: 新規, 重複, 失敗 segments present
    expect(text).toMatch(/新規\s+\d+/);
    expect(text).toMatch(/重複\s+\d+/);
    expect(text).toMatch(/失敗\s+\d+/);

    // Trigger resend (should appear because failures remain)
    await page.getByRole('button', { name: '失敗のみ再送' }).click();

    // After resend, wait for metrics update (失敗 0)
    await expect(metrics).toHaveText(/失敗 0/);
  });
});
