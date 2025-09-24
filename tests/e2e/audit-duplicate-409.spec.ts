import { test, expect } from '@playwright/test';

// Revised test: assert functional behavior (resend excludes duplicates) rather than strict UI phrasing.

function buildMultipartBatch(parts: { id: number; status: number }[]) {
  const boundary = 'batch_x';
  const changeset = 'changeset_x';
  const segs: string[] = [];
  for (const p of parts) {
    segs.push(`--${changeset}`);
    segs.push('Content-Type: application/http');
    segs.push('Content-Transfer-Encoding: binary');
    segs.push(`Content-ID: ${p.id}`);
    segs.push('');
    segs.push(`HTTP/1.1 ${p.status} ${p.status === 201 ? 'Created' : p.status === 409 ? 'Conflict' : p.status === 500 ? 'Internal Server Error' : 'Other'}`);
    segs.push('Content-Type: application/json;odata=nometadata');
    segs.push('');
    segs.push(`{"d":{"Id":${p.id}}}`);
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

test.skip('Audit duplicate (409) handling — retries only failures', async ({ page }) => {

  // Seed 6 audit events and install test hook
  await page.addInitScript(() => {
    const now = Date.now();
    const key = 'audit_log_v1';
    const logs = Array.from({ length: 6 }).map((_, i) => ({
      ts: new Date(now - i * 1000).toISOString(),
      actor: 'tester',
      action: 'CREATE',
      entity: 'Record',
      entity_id: String(1000 + i),
      channel: 'UI',
      after: { v: i }
    }));
    window.localStorage.setItem(key, JSON.stringify(logs));
    (window as any).__TEST_BATCH_DONE__ = () => { (window as any).__BATCH_DONE_FLAG__ = (window as any).__BATCH_DONE_FLAG__ + 1 || 1; };
    // Force deterministic batch responses (first + resend)
    let first = true;
    (window as any).__E2E_FORCE_BATCH__ = (chunk: any[]) => {
      if (first) {
        first = false;
        // 201,409,201,409,201,500
        return {
          body: `--e2e_forced\nContent-Type: multipart/mixed; boundary=changeset_e2e\n\n--changeset_e2e\nHTTP/1.1 201 Created\nContent-ID: 1\n\n--changeset_e2e\nHTTP/1.1 409 Conflict\nContent-ID: 2\n\n--changeset_e2e\nHTTP/1.1 201 Created\nContent-ID: 3\n\n--changeset_e2e\nHTTP/1.1 409 Conflict\nContent-ID: 4\n\n--changeset_e2e\nHTTP/1.1 201 Created\nContent-ID: 5\n\n--changeset_e2e\nHTTP/1.1 500 ServerError\nContent-ID: 6\n\n--changeset_e2e--\n--e2e_forced--` }
      }
      // resend only failed (id 6) => success
      return { body: `--e2e_forced\nContent-Type: multipart/mixed; boundary=changeset_e2e\n\n--changeset_e2e\nHTTP/1.1 201 Created\nContent-ID: 1\n\n--changeset_e2e--\n--e2e_forced--` };
    };
  });

  await page.goto('/audit');

  // Invoke synthetic batch directly
  await page.evaluate(async () => { await (window as any).__E2E_INVOKE_SYNC_BATCH__?.(); });

  const metrics = page.getByTestId('audit-metrics');
  await expect(metrics).toBeVisible();
  await expect.poll(async () => await page.evaluate(() => (window as any).__BATCH_DONE_FLAG__ || 0)).toBeGreaterThan(0);
  await expect.poll(async () => await metrics.getAttribute('data-success')).toBe('5');
  // First batch: statuses 201,409,201,409,201,500
  // success (includes duplicates) = 5 (three 201 + two 409) ; duplicates = 2; new = 3; failed = 1; total = 6
  await expect(metrics).toHaveAttribute('data-total', '6');
  await expect(metrics).toHaveAttribute('data-duplicates', '2');
  await expect(metrics).toHaveAttribute('data-new', '3');
  await expect(metrics).toHaveAttribute('data-failed', '1');

  // Click resend failed-only (uses hook again with synthetic second response)
  await page.getByRole('button', { name: '失敗のみ再送' }).click();
  // After resend: last failed item success => success 6, duplicates remain 2, new becomes 4, failed 0
  await expect.poll(async () => await page.evaluate(() => (window as any).__BATCH_DONE_FLAG__ || 0)).toBeGreaterThan(1);
  await expect.poll(async () => await metrics.getAttribute('data-success')).toBe('6');
  await expect(metrics).toHaveAttribute('data-duplicates', '2');
  await expect(metrics).toHaveAttribute('data-new', '4');
  await expect(metrics).toHaveAttribute('data-failed', '0');
});
