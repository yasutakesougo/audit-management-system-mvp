# Route Hydration Testing Guide

## Overview

The `RouteHydrationListener` and `RouteHydrationErrorBoundary` components provide comprehensive tracking and error handling for route-based hydration scenarios. This guide covers testing strategies for these complex components.

## Key Testing Scenarios

### 1. Router Context Validation

```typescript
// tests/unit/hydration/RouteHydrationListener.spec.tsx
import { render } from '@testing-library/react';
import { RouteHydrationListener } from '@/hydration/RouteHydrationListener';
import * as env from '@/env';

describe('RouteHydrationListener', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw clear error when used outside Router context in dev mode', () => {
    vi.spyOn(env, 'isDev', 'get').mockReturnValue(true);
    vi.spyOn(env, 'getFlag').mockReturnValue(false);

    expect(() => {
      render(<RouteHydrationListener />);
    }).toThrow('RouteHydrationListener requires a React Router context');
  });

  it('should throw original error in production mode', () => {
    vi.spyOn(env, 'isDev', 'get').mockReturnValue(false);
    vi.spyOn(env, 'getFlag').mockReturnValue(false);

    expect(() => {
      render(<RouteHydrationListener />);
    }).toThrow(); // Original router context error
  });
});
```

### 2. ActiveSpan Lifecycle Testing

```typescript
// Mock hydration HUD functions
const mockBeginHydrationSpan = vi.fn();
const mockFinalizeHydrationSpan = vi.fn();
const mockUpdateHydrationSpanMeta = vi.fn();

vi.mock('@/lib/hydrationHud', () => ({
  beginHydrationSpan: mockBeginHydrationSpan,
  finalizeHydrationSpan: mockFinalizeHydrationSpan,
  updateHydrationSpanMeta: mockUpdateHydrationSpanMeta,
}));

describe('ActiveSpan lifecycle', () => {
  it('should begin span on navigation start', () => {
    // Mock navigation state = 'loading'
    const mockUseNavigation = vi.fn(() => ({
      state: 'loading',
      location: { pathname: '/test', search: '?q=1' }
    }));

    // Test span creation
    expect(mockBeginHydrationSpan).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        group: 'hydration:route',
        meta: expect.objectContaining({
          status: 'pending',
          source: 'navigation',
        })
      })
    );
  });

  it('should finalize span with correct status on completion', () => {
    // Simulate navigation completion
    // Verify finalizeHydrationSpan called with 'completed' status
  });

  it('should handle superseded navigation correctly', () => {
    // Start navigation to /page1
    // Start navigation to /page2 before /page1 completes
    // Verify /page1 span finalized with 'superseded' status
  });
});
```

### 3. History Navigation Detection

```typescript
describe('History navigation', () => {
  it('should detect browser back/forward navigation', async () => {
    const { container } = render(
      <Router>
        <RouteHydrationListener />
      </Router>
    );

    // Simulate popstate event
    window.dispatchEvent(new PopStateEvent('popstate'));

    // Verify historyNavigationRef.current = true
    // Check that subsequent span uses source: 'history'
  });

  it('should cancel passive completion on popstate', () => {
    // Start passive span with timer
    // Trigger popstate
    // Verify timer was cancelled
  });
});
```

### 4. Search Query Delta Optimization

```typescript
describe('Search query optimization', () => {
  it('should update existing span for same route + different search', () => {
    // Navigate to /page?q=1
    // Change to /page?q=2 (same route, different search)

    expect(mockUpdateHydrationSpanMeta).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        searchUpdated: true,
        reason: 'search'
      })
    );
  });

  it('should schedule passive completion for search updates', () => {
    vi.useFakeTimers();

    // Trigger search update
    // Advance timers by PASSIVE_COMPLETE_DELAY
    vi.advanceTimersByTime(120);

    expect(mockFinalizeHydrationSpan).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
      expect.objectContaining({ status: 'completed' })
    );

    vi.useRealTimers();
  });
});
```

### 5. Error Boundary Testing

```typescript
describe('RouteHydrationErrorBoundary', () => {
  const ThrowingComponent = () => {
    throw new Error('Test error');
  };

  it('should display fallback UI in production mode', () => {
    vi.spyOn(env, 'getFlag').mockReturnValue(false);

    const { getByRole } = render(
      <RouteHydrationErrorBoundary>
        <ThrowingComponent />
      </RouteHydrationErrorBoundary>
    );

    expect(getByRole('alert')).toHaveTextContent('コンテンツの読み込みに失敗しました。');
  });

  it('should bypass errors in E2E mode', () => {
    vi.spyOn(env, 'getFlag').mockImplementation((flag) =>
      flag === 'VITE_E2E' ? true : false
    );

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(
      <RouteHydrationErrorBoundary>
        <ThrowingComponent />
      </RouteHydrationErrorBoundary>
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[E2E] RouteHydrationErrorBoundary: Bypassing error')
    );
  });

  it('should reset error boundary on route change', () => {
    const { rerender } = render(
      <Router initialEntries={['/page1']}>
        <Routes>
          <Route path="/page1" element={
            <RouteHydrationErrorBoundary>
              <ThrowingComponent />
            </RouteHydrationErrorBoundary>
          } />
        </Routes>
      </Router>
    );

    // Error state established
    expect(getByRole('alert')).toBeInTheDocument();

    // Navigate to different route
    rerender(
      <Router initialEntries={['/page2']}>
        {/* ... */}
      </Router>
    );

    // Error boundary should reset due to key change
  });
});
```

### 6. __suppressRouteReset__ Testing

```typescript
describe('Route reset suppression', () => {
  beforeEach(() => {
    delete window.__suppressRouteReset__;
  });

  it('should use normal reset key by default', () => {
    const TestComponent = () => {
      const { children, fallback } = {};
      return (
        <RouteHydrationErrorBoundary fallback={fallback}>
          {children}
        </RouteHydrationErrorBoundary>
      );
    };

    render(
      <Router initialEntries={['/test?q=1#section']}>
        <Routes>
          <Route path="/test" element={<TestComponent />} />
        </Routes>
      </Router>
    );

    // Verify resetKey includes pathname, search, and hash
  });

  it('should exclude search from reset key when __suppressRouteReset__ is true', () => {
    window.__suppressRouteReset__ = true;

    const TestComponent = () => (
      <RouteHydrationErrorBoundary>
        <div>content</div>
      </RouteHydrationErrorBoundary>
    );

    render(
      <Router initialEntries={['/test?q=1#section']}>
        <Routes>
          <Route path="/test" element={<TestComponent />} />
        </Routes>
      </Router>
    );

    // Verify resetKey only includes pathname and hash
    // Verify __suppressRouteReset__ is reset to false
    expect(window.__suppressRouteReset__).toBe(false);
  });
});
```

## E2E Testing Patterns

### 1. Route Hydration Metrics Collection

```typescript
// tests/e2e/route-hydration.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Route Hydration Performance', () => {
  test('should track hydration timings for navigation', async ({ page }) => {
    await page.goto('/dashboard');

    // Navigate to another route
    await page.click('a[href="/reports"]');

    // Wait for navigation to complete
    await page.waitForURL('/reports');

    // Check if hydration span was recorded
    const hydrationMetrics = await page.evaluate(() => {
      return window.__AUDIT_BATCH_METRICS__ || null;
    });

    if (hydrationMetrics) {
      expect(hydrationMetrics.durationMs).toBeGreaterThan(0);
      expect(hydrationMetrics.total).toBeGreaterThanOrEqual(0);
    }
  });

  test('should handle lazy import failures gracefully', async ({ page }) => {
    // Mock network to fail chunk loading
    await page.route('**/*.js', route => {
      if (route.request().url().includes('chunk')) {
        route.abort();
      } else {
        route.continue();
      }
    });

    await page.goto('/dashboard');

    // Try to navigate to lazy-loaded route
    await page.click('a[href="/admin/settings"]');

    // Should show error boundary fallback
    await expect(page.locator('[role="alert"]')).toBeVisible();
  });
});
```

### 2. Error Boundary E2E Testing

```typescript
test.describe('Error Boundary in E2E', () => {
  test('should bypass errors when VITE_E2E flag is set', async ({ page }) => {
    // Set E2E flag
    await page.addInitScript(() => {
      window.__ENV__ = { VITE_E2E: '1' };
    });

    // Navigate to page that would normally error
    await page.goto('/error-prone-page');

    // Verify page loads despite errors
    await expect(page.locator('main')).toBeVisible();

    // Check console for E2E bypass warning
    const consoleLogs = [];
    page.on('console', msg => {
      if (msg.type() === 'warn' && msg.text().includes('[E2E]')) {
        consoleLogs.push(msg.text());
      }
    });

    // Should see bypass warning
    expect(consoleLogs.some(log =>
      log.includes('RouteHydrationErrorBoundary: Bypassing error')
    )).toBeTruthy();
  });
});
```

## Performance Testing

### 1. Passive Completion Timing

```typescript
test('should complete passive spans within expected timeframe', async () => {
  vi.useFakeTimers();

  // Start passive navigation
  // Advance timers by PASSIVE_COMPLETE_DELAY - 1
  vi.advanceTimersByTime(119);
  expect(mockFinalizeHydrationSpan).not.toHaveBeenCalled();

  // Advance by 1 more ms
  vi.advanceTimersByTime(1);
  expect(mockFinalizeHydrationSpan).toHaveBeenCalledWith(
    expect.anything(),
    undefined,
    expect.objectContaining({ status: 'completed' })
  );
});
```

### 2. Memory Leak Prevention

```typescript
test('should clean up timers on unmount', () => {
  const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');

  const { unmount } = render(
    <Router>
      <RouteHydrationListener />
    </Router>
  );

  // Start passive span (creates timer)
  // Unmount component
  unmount();

  // Verify timer was cleared
  expect(clearTimeoutSpy).toHaveBeenCalled();
});
```

## Best Practices

1. __Mock HUD Functions__: Always mock `@/lib/hydrationHud` functions to isolate component logic
2. __Use Fake Timers__: For testing passive completion timing and cleanup
3. __Test Error Paths__: Verify both error display and E2E bypass modes
4. __Route Context__: Always provide proper Router context in tests
5. __Cleanup__: Reset window properties and mocks between tests
6. __Performance__: Monitor span creation/finalization patterns for memory leaks
