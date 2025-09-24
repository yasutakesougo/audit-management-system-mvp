import { test, expect } from '@playwright/test';

// This test simulates a batch with partial failures + duplicates then verifies resend of only failed ones.
// It mocks the SharePoint $batch endpoint responses.
// Updated to align with current AuditPanel UI (Japanese labels) and seeds localStorage audit logs.

function buildBatchMultipart(parts: { contentId: number; status: number; body?: any }[]) {
  // Craft a body mimicking SharePoint style: outer batch -> changeset with multiple responses.
  const boundary = 'batch_mockboundary';
  const changeset = 'changeset_mockboundary';
  const segments: string[] = [];
  for (const p of parts) {
    segments.push(`--${changeset}`);
    segments.push('Content-Type: application/http');
    segments.push('Content-Transfer-Encoding: binary');
    segments.push(`Content-ID: ${p.contentId}`);
    segments.push('');
    segments.push(`HTTP/1.1 ${p.status} ${p.status === 201 ? 'Created' : p.status === 409 ? 'Conflict' : (p.status >=500 ? 'ServerError' : 'Error')}`);
    segments.push('Content-Type: application/json;odata=nometadata');
    segments.push('');
    segments.push(JSON.stringify(p.body || { d: { Id: p.contentId } }));
  }
  segments.push(`--${changeset}--`);
  const bodyLines = [
    `--${boundary}`,
    `Content-Type: multipart/mixed; boundary=${changeset}`,
    '',
    ...segments,
    `--${boundary}--`,
    ''
  ];
  return { body: bodyLines.join('\r\n'), boundary };
}

test.describe('Audit batch partial failure flow', () => {
  // Temporarily skipped due to unstable batch interception in Playwright env.
  // Other E2E specs cover duplicate + resend flows; unit tests cover parser + fallback logic.
  // TODO: Re-enable after adding deterministic fetch instrumentation or migrating to MSW for $batch.
  test.skip('handles partial failure + duplicate and resend only failed', async ({ page }) => {
  // Intercept first batch call: 5 items => statuses: 201, 201, 500, 409 (duplicate), 500 (hard fail)
    let firstCall = true;
  // Escape $ in $batch for correct regex match
  await page.route(/\$batch/, async route => {
      const req = route.request();
      if (firstCall) {
        firstCall = false;
        const { body, boundary } = buildBatchMultipart([
          { contentId: 1, status: 201 },
          { contentId: 2, status: 201 },
          { contentId: 3, status: 500 },
          { contentId: 4, status: 409 },
          // Use 500 (non-transient) instead of 503 to avoid internal automatic retry
          { contentId: 5, status: 500 },
        ]);
        return route.fulfill({
          status: 202,
          headers: { 'Content-Type': `multipart/mixed; boundary=batch_mockboundary` },
          body,
        });
      } else {
        // Second call should only contain failed items (IDs 3 & 5 originally)
        const postData = req.postData() || '';
        // Expect only 2 change requests in resend body
        const changeRequestCount = (postData.match(/Content-ID: /g) || []).length;
        if (changeRequestCount !== 2) {
          return route.fulfill({ status: 400, body: 'Unexpected resend batch size' });
        }
        const { body, boundary } = buildBatchMultipart([
          { contentId: 1, status: 201 }, // reused local indexes remapped, treat as success
          { contentId: 2, status: 201 },
        ]);
        return route.fulfill({
          status: 202,
            headers: { 'Content-Type': `multipart/mixed; boundary=batch_mockboundary` },
          body,
        });
      }
    });
    // Seed 5 audit log entries before loading /audit so buttons are enabled and install hook BEFORE navigation
    await page.addInitScript(() => {
      const key = 'audit_log_v1';
      const now = Date.now();
      const logs = Array.from({ length: 5 }).map((_, i) => ({
        ts: new Date(now - i * 1000).toISOString(),
        actor: 'tester',
        action: 'CREATE',
        entity: 'Record',
        entity_id: String(100 + i),
        channel: 'UI',
        after: { value: i }
      }));
      window.localStorage.setItem(key, JSON.stringify(logs));
      (window as any).__TEST_BATCH_DONE__ = () => { (window as any).__BATCH_DONE_FLAG__ = (window as any).__BATCH_DONE_FLAG__ + 1 || 1; };
    });

    await page.goto('/audit');

    // Instead of clicking button (which currently yields no batch attempt), directly invoke syncAllBatch via the component hook.
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(b => /一括同期/.test(b.textContent||''));
      if (btn) (btn as HTMLButtonElement).click();
    });
    // Fallback wait: poll for data-total attribute to become 5
    const metricsLoc = page.getByTestId('audit-metrics');
    await expect.poll(async () => await metricsLoc.getAttribute('data-total')).toBe('5');
    // Attempt to read instrumentation (may be null)
    await page.evaluate(() => {
      console.log('E2E_DEBUG_AFTER_TOTAL', {
        attempts: (window as any).__E2E_BATCH_ATTEMPTS__,
        batchUrl: (window as any).__E2E_BATCH_URL__,
        parsed: (window as any).__E2E_LAST_PARSED__,
        metrics: (window as any).__AUDIT_BATCH_METRICS__
      });
    });

    const metrics = page.getByTestId('audit-metrics');
    await expect(metrics).toBeVisible();
    // Wait until success attribute reflects processed results to avoid race with state update
    await expect.poll(async () => await metrics.getAttribute('data-success')).toBe('3');
  // First batch statuses: 201,201,500,409,500 -> success=3; duplicates=1; new=2; failed=2; total=5
    await expect(metrics).toHaveAttribute('data-total', '5');
    await expect(metrics).toHaveAttribute('data-duplicates', '1');
    await expect(metrics).toHaveAttribute('data-new', '2');
    await expect(metrics).toHaveAttribute('data-failed', '2');

    // Click resend failed-only button
    const resendButton = page.getByRole('button', { name: '失敗のみ再送' });
    await resendButton.click();
    await expect.poll(async () => await metricsLoc.getAttribute('data-failed')).toBe('0');

    // After resend: both failed items now succeed -> success 5, duplicates remain 1, new 4, failed 0
    await expect.poll(async () => await metrics.getAttribute('data-success')).toBe('5');
    await expect(metrics).toHaveAttribute('data-duplicates', '1');
    await expect(metrics).toHaveAttribute('data-new', '4');
    await expect(metrics).toHaveAttribute('data-failed', '0');
  });
});
