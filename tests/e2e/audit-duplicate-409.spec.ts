import { test, expect } from '@playwright/test';

// Focused test for 409 duplicate handling: ensure duplicates are counted as success (重複) and not retained for resend.
// Verifies UI badge + DEV metrics modal (if available) show duplicates separated from new items.

function buildBatchMultipart(parts: { contentId: number; status: number }[]) {
  const boundary = 'batch_dup_boundary';
  const changeset = 'changeset_dup_boundary';
  const segs: string[] = [];
  for (const p of parts) {
    segs.push(`--${changeset}`);
    segs.push('Content-Type: application/http');
    segs.push('Content-Transfer-Encoding: binary');
    segs.push(`Content-ID: ${p.contentId}`);
    segs.push('');
    segs.push(`HTTP/1.1 ${p.status} ${p.status === 201 ? 'Created' : p.status === 409 ? 'Conflict' : 'Other'}`);
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

test.describe('Audit duplicate (409) handling', () => {
  test('counts duplicates separately and does not retry them', async ({ page }) => {
    let first = true;
    await page.route(/\/$batch$/, async route => {
      if (first) {
        first = false;
        // 6 items: 3 new (201), 2 duplicates (409), 1 server fail (500)
        const { body } = buildBatchMultipart([
          { contentId: 1, status: 201 },
          { contentId: 2, status: 409 },
          { contentId: 3, status: 201 },
          { contentId: 4, status: 409 },
          { contentId: 5, status: 201 },
          { contentId: 6, status: 500 }
        ]);
        return route.fulfill({ status: 202, headers: { 'Content-Type': 'multipart/mixed; boundary=batch_dup_boundary' }, body });
      } else {
        // Resend should only include failed item(s). We expect 1 (former contentId=6) now remapped to ID 1 in second batch body.
        const postData = route.request().postData() || '';
        const count = (postData.match(/Content-ID: /g) || []).length;
        if (count !== 1) {
          return route.fulfill({ status: 400, body: 'Unexpected resend batch count' });
        }
        const { body } = buildBatchMultipart([
          { contentId: 1, status: 201 }
        ]);
        return route.fulfill({ status: 202, headers: { 'Content-Type': 'multipart/mixed; boundary=batch_dup_boundary' }, body });
      }
    });

    // Seed 6 audit log entries
    await page.addInitScript(() => {
      const now = Date.now();
      const key = 'audit_log_v1';
      const logs = Array.from({ length: 6 }).map((_, i) => ({
        ts: new Date(now - i * 1000).toISOString(),
        actor: 'tester',
        action: 'CREATE',
        entity: 'Record',
        entity_id: String(300 + i),
        channel: 'UI',
        after: { k: i }
      }));
      window.localStorage.setItem(key, JSON.stringify(logs));
    });

    await page.goto('/audit');

    await page.getByRole('button', { name: /一括同期/ }).click();

    const metrics = page.getByTestId('audit-metrics');
    await expect(metrics).toBeVisible();
    const firstText = await metrics.innerText();
    // Expect: 新規 3, 重複 2, 失敗 1 (order may differ but match counts)
    expect(firstText).toMatch(/新規\s+3/);
    expect(firstText).toMatch(/重複\s+2/);
    expect(firstText).toMatch(/失敗\s+1/);

    // Resend failed only
    await page.getByRole('button', { name: '失敗のみ再送' }).click();

    // After resend, failure count becomes 0, duplicates and new unaffected
    await expect(metrics).toHaveText(/失敗 0/);

    // (Optional) If DEV metrics button exists, open and inspect parserFallbackCount
    const infoButton = page.getByRole('button', { name: 'batch metrics' });
    if (await infoButton.isVisible()) {
      await infoButton.click();
      const modal = page.getByText('Batch Metrics');
      await expect(modal).toBeVisible();
      // Basic sanity: metrics JSON should include duplicates
      const modalContent = await page.locator('pre').innerText();
      expect(modalContent).toMatch(/"duplicates"\s*:\s*2/);
      // Close
      await page.getByRole('button', { name: '閉じる' }).click();
    }
  });
});
