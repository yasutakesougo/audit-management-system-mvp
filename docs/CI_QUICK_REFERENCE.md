# CI Test Quick Reference

## Test Types

| Type | Pattern | When | Duration | Retries |
|------|---------|------|----------|---------|
| **Smoke** | `*.smoke.spec.ts` | Every PR | < 20 min | 1 |
| **Deep** | All other E2E | Main + Nightly | < 45 min | 2 |

## Local Commands

### Run Tests

```bash
# Smoke tests only (fast)
npm run test:e2e:smoke

# All E2E tests
npm run test:e2e

# Specific test file
npx playwright test tests/e2e/my-test.spec.ts

# With UI mode (interactive)
npm run e2e:ui
```

### Environment Setup

```bash
# Copy dev config
cp .env.dev .env.local

# Or E2E config
cp .env.e2e.dev .env.local

# Start dev server
npm run dev

# Or preview server (like CI)
npm run build && npm run preview
```

### Debug Flaky Tests

```bash
# Run test multiple times
npx playwright test my-test.spec.ts --repeat-each=10

# Analyze flaky tests
node scripts/analyze-flaky-tests.mjs

# View trace file
npx playwright show-trace test-results/*/trace.zip
```

## CI Workflows

### Smoke Tests (`.github/workflows/smoke.yml`)

**Triggers:** Every PR
**Jobs:**
1. Lint
2. TypeCheck  
3. Unit Tests (Vitest)
4. E2E Smoke Tests

**Artifacts:**
- `playwright-artifacts-smoke-*`: Test reports
- `junit-e2e-smoke-*`: JUnit reports
- `flaky-test-report-smoke-*`: Flaky test analysis

### Deep Tests (`.github/workflows/e2e-deep.yml`)

**Triggers:** 
- Push to main
- PR to main
- Nightly at 2 AM UTC
- Manual dispatch

**Jobs:**
1. Deep Tests (Chromium) - Non-smoke tests
2. Deep Tests (Integration) - Complex scenarios

**Artifacts:**
- `playwright-report-deep-*`: HTML reports
- `test-results-deep-*`: All test results
- `flaky-test-report-deep-*`: Flaky test analysis
- `failure-artifacts-deep-*`: Failure diagnostics

## Environment Configs

| File | Purpose | Server | Mock Auth |
|------|---------|--------|-----------|
| `.env.dev` | Local dev | Dev (5173) | Yes |
| `.env.e2e.dev` | Test dev | Dev (5173) | Yes |
| `.env.e2e.preview` | CI/CD | Preview (5173) | Yes |

## Flaky Test Severity

| Level | Retries | Action |
|-------|---------|--------|
| **LOW** | 0-2 | Monitor |
| **MEDIUM** | 3-5 | Investigate |
| **HIGH** | 6+ | Fix immediately |

## Common Fixes

### Timing Issues

```typescript
// ❌ Bad
await page.click('button');
await page.locator('.result').textContent();

// ✅ Good
await page.click('button');
await expect(page.locator('.result')).toBeVisible();
```

### Selector Issues

```typescript
// ❌ Bad
await page.click('.btn'); // Fragile CSS

// ✅ Good
await page.click('[data-testid="submit"]'); // Stable
await page.getByRole('button', { name: 'Submit' }).click();
```

### Network Timing

```typescript
// ❌ Bad
await page.goto('/');

// ✅ Good
await page.goto('/', { waitUntil: 'networkidle' });
await page.waitForResponse(res => res.url().includes('/api/'));
```

## Quick Troubleshooting

**Test fails in CI but passes locally?**
1. Check environment variables (CI uses `.env.e2e.preview`)
2. Use `npm run build && npm run preview` locally
3. Review CI logs and artifacts

**Test is flaky?**
1. Check flaky test report in PR artifacts
2. Run locally with `--repeat-each=10`
3. Review trace file: `npx playwright show-trace <path>`
4. See [FLAKY_TEST_RUNBOOK.md](FLAKY_TEST_RUNBOOK.md)

**Need to skip a test temporarily?**
```typescript
test.skip('Flaky test - Issue #123', async ({ page }) => {
  // Will be skipped
});
```

## Documentation

- 📖 [CI Test Stability Strategy](CI_TEST_STABILITY_STRATEGY.md)
- 🔧 [Flaky Test Runbook](FLAKY_TEST_RUNBOOK.md)  
- 📋 [CI Workflow Updates](CI_WORKFLOW_UPDATES.md)
- ⚙️ [Playwright Config](../playwright.config.ts)

## Getting Help

1. Check documentation above
2. Search existing GitHub issues
3. Create issue with label `ci/cd` or `testing`
4. Ask in team chat

---

**Last Updated:** 2026-02-03
