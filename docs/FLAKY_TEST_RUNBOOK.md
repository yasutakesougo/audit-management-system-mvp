# Flaky Test Runbook

## Quick Reference

**Flaky Test:** A test that exhibits inconsistent behavior, sometimes passing and sometimes failing without code changes.

**Detection:** Run `node scripts/analyze-flaky-tests.mjs` or check GitHub Actions summaries.

**Severity Levels:**
- **LOW:** 0-2 total retries
- **MEDIUM:** 3-5 total retries  
- **HIGH:** 6+ total retries

## Investigation Process

### Step 1: Identify Flaky Tests

**In CI:**
1. Check GitHub Actions summary for "Flaky Test Detection"
2. Download "flaky-test-report-*" artifact
3. Review the markdown report

**Locally:**
```bash
# After running tests
node scripts/analyze-flaky-tests.mjs

# Or specify custom directory
node scripts/analyze-flaky-tests.mjs ./test-results
```

### Step 2: Review Test Artifacts

For each flaky test:

1. **Find retry directories:**
   ```bash
   find test-results -name "*<test-name>*-retry*" -type d
   ```

2. **Review trace files:**
   - Download trace.zip from the retry directory
   - Open in Playwright trace viewer:
     ```bash
     npx playwright show-trace test-results/<test-name>-retry1/trace.zip
     ```

3. **Check screenshots/videos:**
   - Look for timing issues
   - Verify element visibility
   - Check for race conditions

### Step 3: Common Causes and Fixes

#### Timing Issues

**Symptoms:**
- Test passes on retry
- Failures mention "Element not found" or "Timeout"
- Race conditions between actions

**Fixes:**
```typescript
// Bad: No wait
await page.click('button');
await page.locator('.result').textContent();

// Good: Explicit wait
await page.click('button');
await page.waitForSelector('.result', { state: 'visible' });
await page.locator('.result').textContent();

// Better: Built-in auto-waiting
await page.click('button');
await expect(page.locator('.result')).toBeVisible();
await expect(page.locator('.result')).toHaveText(/expected/);
```

#### State Pollution

**Symptoms:**
- Test passes in isolation but fails in suite
- Order-dependent failures
- Data conflicts between tests

**Fixes:**
```typescript
// Use test.describe with beforeEach/afterEach
test.describe('Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Reset state before each test
    await page.goto('/');
    // Clear any storage
    await page.evaluate(() => localStorage.clear());
  });

  test.afterEach(async ({ page }) => {
    // Cleanup after each test
    await page.close();
  });
});

// Or use test isolation
test('scenario 1', async ({ page, context }) => {
  // Each test gets fresh context/page
});
```

#### Selector Instability

**Symptoms:**
- Element found sometimes, not others
- Dynamic IDs or classes cause failures
- CSS animations interfere

**Fixes:**
```typescript
// Bad: Fragile selectors
await page.click('.btn-primary'); // CSS class might change
await page.click('#button-123'); // Dynamic ID

// Good: Stable selectors
await page.click('[data-testid="submit-button"]');
await page.click('button:has-text("Submit")');
await page.getByRole('button', { name: 'Submit' }).click();

// Handle animations
await page.locator('.modal').waitFor({ state: 'visible' });
await page.waitForLoadState('networkidle'); // Wait for animations
```

#### Network Timing

**Symptoms:**
- API response delays
- Intermittent timeout errors
- Works locally, fails in CI

**Fixes:**
```typescript
// Increase timeout for network operations
test('data fetching', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });
  
  // Wait for specific network requests
  await page.waitForResponse(
    response => response.url().includes('/api/users') && response.status() === 200,
    { timeout: 10000 }
  );
});

// Mock slow endpoints in tests
await page.route('**/api/slow-endpoint', route => {
  route.fulfill({ status: 200, body: JSON.stringify({ data: 'mock' }) });
});
```

### Step 4: Apply Fixes

#### Quick Fixes (Immediate)

**Option 1: Add explicit waits**
```typescript
await page.waitForTimeout(1000); // Last resort only!
await page.waitForLoadState('networkidle');
await expect(locator).toBeVisible({ timeout: 10000 });
```

**Option 2: Increase retry count**
```typescript
test.describe('Known flaky area', () => {
  test.describe.configure({ retries: 3 });
  
  test('flaky test', async ({ page }) => {
    // Test code
  });
});
```

**Option 3: Skip temporarily**
```typescript
test.skip('Flaky test - Issue #123', async ({ page }) => {
  // Test code - will be skipped
});

// Or conditionally skip
test('might be flaky', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'Flaky on webkit - Issue #456');
  // Test code
});
```

#### Proper Fixes (Recommended)

**Fix 1: Improve selectors**
- Use `data-testid` attributes
- Prefer role-based selectors
- Avoid CSS classes for test selectors

**Fix 2: Better waiting strategies**
- Use Playwright's auto-waiting
- Wait for specific conditions
- Use expect assertions (built-in retry)

**Fix 3: Improve test isolation**
- Clear state between tests
- Use test fixtures
- Avoid shared test data

### Step 5: Verify Fixes

**Local verification:**
```bash
# Run the test multiple times
for i in {1..10}; do
  npm run test:e2e -- tests/e2e/flaky-test.spec.ts
  if [ $? -ne 0 ]; then
    echo "Failed on iteration $i"
    break
  fi
done

# Or use Playwright's repeat option
npx playwright test tests/e2e/flaky-test.spec.ts --repeat-each=10
```

**CI verification:**
1. Create PR with fixes
2. Monitor smoke tests for stability
3. Check flaky test reports in artifacts
4. Merge if stable for 3+ runs

### Step 6: Document and Monitor

**Document the fix:**
```typescript
test('Previously flaky test', async ({ page }) => {
  // Fixed: Added explicit wait for modal animation - Issue #123
  await page.click('[data-testid="open-modal"]');
  await page.locator('.modal').waitFor({ state: 'visible' });
  await expect(page.locator('.modal')).toBeVisible();
});
```

**Monitor in CI:**
1. Check weekly flaky test reports
2. Track retry trends
3. Update this runbook with new patterns

## Prevention Strategies

### 1. Write Stable Tests from Start

```typescript
// ✅ Good test practices
test('stable test example', async ({ page }) => {
  // Use data-testid
  await page.goto('/');
  await page.getByTestId('user-menu').click();
  
  // Use expect with auto-retry
  await expect(page.getByTestId('profile-link')).toBeVisible();
  
  // Wait for specific states
  await page.waitForLoadState('networkidle');
  
  // Use stable text assertions
  await expect(page.getByRole('heading')).toHaveText('Dashboard');
});
```

### 2. Use Test Fixtures

```typescript
// tests/e2e/_fixtures/test-user.ts
export const testUser = {
  email: 'test@example.com',
  name: 'Test User'
};

// In test
import { testUser } from './_fixtures/test-user';

test('user profile', async ({ page }) => {
  // Use consistent test data
  await setupTestUser(page, testUser);
});
```

### 3. Implement Waiting Helpers

```typescript
// tests/e2e/_helpers/wait-helpers.ts
export async function waitForModalToOpen(page: Page, modalSelector: string) {
  await page.locator(modalSelector).waitFor({ state: 'visible' });
  await page.waitForLoadState('networkidle');
  // Extra buffer for animations
  await page.waitForTimeout(100);
}

// In test
await waitForModalToOpen(page, '.modal-dialog');
```

### 4. Smoke vs Deep Test Placement

**Smoke tests (*.smoke.spec.ts):**
- Simple, fast, stable tests only
- Critical path coverage
- Minimal external dependencies
- < 30 seconds per test

**Deep tests (other *.spec.ts):**
- Complex scenarios
- Integration tests
- Tests with known timing issues
- > 30 seconds per test

## Escalation

### When to Escalate

1. **HIGH severity** (6+ retries): Immediate attention
2. **Same test flaky for 3+ runs**: Investigate deeply
3. **Multiple tests in same area**: Potential systemic issue
4. **CI blocking deployments**: Emergency fix needed

### Escalation Process

1. **Create GitHub Issue:**
   ```markdown
   Title: [Flaky Test] Test name is unstable
   
   Labels: flaky-test, testing, priority-high
   
   Description:
   - Test file: tests/e2e/example.spec.ts
   - Failure rate: 3/10 runs
   - Retry count: 5 retries in last run
   - Artifacts: [link to CI artifacts]
   - Trace: [link to trace file if available]
   
   Investigation notes:
   - Appears to be timing-related
   - Fails when API is slow
   
   Proposed fix:
   - Add explicit wait for API response
   ```

2. **Temporary mitigation:**
   - Skip the test with issue reference
   - Add to "known flaky" list
   - Monitor in subsequent runs

3. **Schedule fix:**
   - Add to sprint backlog
   - Assign to test stability epic
   - Set deadline (1-2 weeks max)

## Metrics and Reporting

### Weekly Report Template

```markdown
## Weekly Flaky Test Report

**Week of:** YYYY-MM-DD

### Summary
- Total test runs: X
- Tests requiring retry: Y
- Flaky test rate: (Y/X)%

### Top Flaky Tests
1. test-name-1 (5 retries)
2. test-name-2 (3 retries)
3. test-name-3 (2 retries)

### Actions Taken
- Fixed test-A by adding explicit wait
- Skipped test-B (Issue #123)
- Monitoring test-C

### Trends
- Flaky rate decreased from X% to Y%
- Most flaky area: Dashboard tests
```

### Automated Alerts

Configure alerts for:
- HIGH severity flaky tests
- Flaky rate > 5%
- Same test flaky 3+ times

## Tools and Scripts

### Analyze Flaky Tests
```bash
node scripts/analyze-flaky-tests.mjs [test-results-dir]
```

### Run Stress Test
```bash
# Run test 20 times to check stability
npx playwright test path/to/test.spec.ts --repeat-each=20 --workers=1
```

### View Trace
```bash
npx playwright show-trace test-results/<test-name>-retry1/trace.zip
```

### Generate Report
```bash
# HTML report
npx playwright show-report

# Or open specific report
open playwright-report/index.html
```

## References

- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [CI Test Stability Strategy](./CI_TEST_STABILITY_STRATEGY.md)
- [Playwright Auto-waiting](https://playwright.dev/docs/actionability)
- [Test Isolation](https://playwright.dev/docs/test-isolation)

## Changelog

- **2026-02-03:** Initial runbook created
- Add entries here when updating procedures
