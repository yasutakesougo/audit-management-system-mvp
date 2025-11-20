# E2E Batch Sync Testing Example

## Using `__E2E_INVOKE_SYNC_BATCH__` Hook

The audit batch synchronization system provides an E2E testing hook that allows direct invocation from Playwright tests without requiring UI interaction.

### Prerequisites

- Development environment (`isDev: true` in config)
- Browser context with the audit system loaded
- Valid SharePoint connection (or mocked responses)

### Basic Usage

```typescript
// tests/e2e/audit-batch-sync.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Audit Batch Synchronization', () => {
  test('should sync audit logs in batches', async ({ page }) => {
    // Navigate to a page where audit system is loaded
    await page.goto('/dashboard');

    // Wait for the audit system to initialize
    await page.waitForFunction(() =>
      typeof window.__E2E_INVOKE_SYNC_BATCH__ === 'function'
    );

    // Invoke batch synchronization with custom chunk size
    const result = await page.evaluate(async (chunkSize) => {
      if (!window.__E2E_INVOKE_SYNC_BATCH__) {
        throw new Error('E2E hook not available');
      }
      return await window.__E2E_INVOKE_SYNC_BATCH__(chunkSize);
    }, 50);

    // Validate successful sync result
    if ('error' in result) {
      throw new Error(`Batch sync failed: ${result.error}`);
    }

    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.success).toBeGreaterThanOrEqual(0);
    expect(result.durationMs).toBeGreaterThan(0);

    console.log(`Synced ${result.success}/${result.total} audit logs in ${result.durationMs}ms`);
  });

  test('should handle empty audit log scenarios', async ({ page }) => {
    await page.goto('/dashboard');

    await page.waitForFunction(() =>
      typeof window.__E2E_INVOKE_SYNC_BATCH__ === 'function'
    );

    const result = await page.evaluate(async () => {
      return await window.__E2E_INVOKE_SYNC_BATCH__!();
    });

    if ('error' in result) {
      throw new Error(`Batch sync failed: ${result.error}`);
    }

    // Even with no logs, should return valid structure
    expect(result).toMatchObject({
      total: expect.any(Number),
      success: expect.any(Number),
      durationMs: expect.any(Number)
    });
  });

  test('should handle batch sync errors gracefully', async ({ page }) => {
    await page.goto('/dashboard');

    // Mock SharePoint to return errors
    await page.route('**/_api/web/lists**', route => {
      route.fulfill({
        status: 500,
        body: 'Internal Server Error'
      });
    });

    await page.waitForFunction(() =>
      typeof window.__E2E_INVOKE_SYNC_BATCH__ === 'function'
    );

    const result = await page.evaluate(async () => {
      return await window.__E2E_INVOKE_SYNC_BATCH__!();
    });

    // Should either return error object or sync result with failed items
    if ('error' in result) {
      expect(result.error).toContain('500');
    } else {
      expect(result.failed).toBeGreaterThan(0);
    }
  });
});
```

### Advanced Patterns

#### Monitoring Batch Metrics

```typescript
test('should expose batch metrics for monitoring', async ({ page }) => {
  await page.goto('/dashboard');

  // Execute batch sync
  await page.evaluate(async () => {
    await window.__E2E_INVOKE_SYNC_BATCH__!();
  });

  // Check if metrics are available
  const metrics = await page.evaluate(() => window.__AUDIT_BATCH_METRICS__);

  if (metrics) {
    expect(metrics.total).toBeGreaterThanOrEqual(0);
    expect(metrics.timestamp).toBeDefined();
    expect(metrics.categories).toBeInstanceOf(Object);
  }
});
```

#### Testing Different Chunk Sizes

```typescript
test.describe('Chunk Size Performance', () => {
  [10, 50, 100, 200].forEach(chunkSize => {
    test(`should handle chunk size ${chunkSize}`, async ({ page }) => {
      await page.goto('/dashboard');

      const result = await page.evaluate(async (size) => {
        return await window.__E2E_INVOKE_SYNC_BATCH__!(size);
      }, chunkSize);

      if ('error' in result) {
        throw new Error(result.error);
      }

      // Larger chunks might be faster overall, but this depends on data volume
      expect(result.durationMs).toBeGreaterThan(0);
      expect(result.success).toBeGreaterThanOrEqual(0);
    });
  });
});
```

### Type Safety

The E2E hook returns strictly typed results:

```typescript
// Success result
interface SyncResult {
  total: number;
  success: number;
  failed?: number;
  duplicates?: number;
  errors?: { contentId: number; status: number; statusText: string }[];
  durationMs?: number;
  categories?: Record<string, number>;
}

// Error result
interface ErrorResult {
  error: string;
}

// Hook signature
__E2E_INVOKE_SYNC_BATCH__?: (size?: number) => Promise<SyncResult | ErrorResult>
```

### Security Notes

- This hook is **only available in development environments** (`isDev: true`)
- Production builds will not expose this functionality
- The hook uses dynamic imports to avoid bundling test code in production
- SSR-safe: only runs in browser environments

### Debugging

If the hook is not available, check:

1. Development environment is enabled (`getAppConfig().isDev === true`)
2. Page has loaded the audit system
3. No JavaScript errors preventing hook registration
4. Browser developer tools console shows no TypeScript errors

```typescript
// Debug hook availability
test('debug hook availability', async ({ page }) => {
  await page.goto('/dashboard');

  const hookStatus = await page.evaluate(() => ({
    isDefined: typeof window.__E2E_INVOKE_SYNC_BATCH__ !== 'undefined',
    windowKeys: Object.keys(window).filter(k => k.startsWith('__E2E_')),
    config: window.APP_CONFIG || 'not available'
  }));

  console.log('Hook status:', hookStatus);
});
```
