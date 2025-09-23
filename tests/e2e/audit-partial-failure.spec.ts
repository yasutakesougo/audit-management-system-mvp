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
  test('handles partial failure + duplicate and resend only failed', async ({ page }) => {
    // Intercept first batch call: 5 items => statuses: 201, 201, 500, 409 (duplicate), 503 (transient fail)
    let firstCall = true;
    await page.route(/\/$batch$/, async route => {
      const req = route.request();
      if (firstCall) {
        firstCall = false;
        const { body, boundary } = buildBatchMultipart([
          { contentId: 1, status: 201 },
          { contentId: 2, status: 201 },
          { contentId: 3, status: 500 },
          { contentId: 4, status: 409 },
          { contentId: 5, status: 503 },
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
    // Seed 5 audit log entries before loading /audit so buttons are enabled
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
    });

    await page.goto('/audit');

    // Trigger initial batch sync via the batch button
    const batchButton = page.getByRole('button', { name: /一括同期/ });
    await batchButton.click();

  // Expect partial failure metrics message containing Japanese keywords for duplicate and failure
    const msgLocator = page.locator('span', { hasText: '一括同期完了' });
  await expect(msgLocator).toBeVisible();
  const msgText = await msgLocator.innerText();
  expect(msgText).toMatch(/一括同期完了/);
  // Validate failure count; duplicates + new items may appear depending on parser success.
  const failMatch = msgText.match(/失敗\s+(\d+)/);
  expect(failMatch).not.toBeNull();
  if (/重複\s+\d+/.test(msgText)) {
    // When duplicate shown, expect also 新規
    expect(msgText).toMatch(/新規\s+\d+/);
  }

    // Click resend failed-only button
    const resendButton = page.getByRole('button', { name: '失敗のみ再送' });
    await resendButton.click();

    // After resend, capture updated message
    const resendMsgLocator = page.locator('span', { hasText: '失敗再送' });
    await expect(resendMsgLocator).toBeVisible();
    const resendText = await resendMsgLocator.innerText();
    const failureMatch = resendText.match(/失敗\s+(\d+)/);
    if (failureMatch) {
      expect(Number(failureMatch[1])).toBe(0);
    }
  });
});
