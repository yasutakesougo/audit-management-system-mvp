# Router Flags Smoke Test - Troubleshooting Guide

## TL;DR
- **Drawer**: Always open → wait visible (MUI keeps hidden elements in DOM)
- **Guards**: Use runtime env functions for mockability (not build-time constants)
- **JSDOM**: Dispatch popstate when route doesn't update (React Router needs events)

## Overview
This runbook documents solutions to common issues encountered in `tests/smoke/router.flags.spec.tsx`, particularly when testing React Router v7 future flags with MUI components and authorization guards.

## Issue 1: MUI Drawer Visibility Timing

### Problem
- MUI Drawer elements remain in DOM even when closed (`display: none`)
- `screen.getByTestId()` finds elements immediately but they're not visible
- Tests fail with "element not visible" or timeout waiting for visibility

### Solution
Always use **two-step approach** for drawer navigation:

```tsx
// 1. Open drawer and wait for aria-expanded
await openDrawerIfPossible();

// 2. Ensure nav item is visible (not just in DOM)
const navItem = await ensureNavItem(TESTIDS.nav.audit);
await user.click(navItem);
```

**Key Pattern:**
```tsx
const ensureNavItem = async (testId: string) => {
  const item = screen.queryByTestId(testId) || await screen.findByTestId(testId);
  await waitFor(() => expect(item).toBeVisible());
  return item;
};
```

### Why This Works
- MUI Drawer uses CSS visibility, not DOM removal
- `queryByTestId` finds hidden elements
- `toBeVisible()` ensures actual user-visible state

---

## Issue 2: Authorization Guards with Build-time Checks

### Problem
- RequireAudience used `import.meta.env.VITE_*` for test bypass
- Build-time constants cannot be mocked in tests
- Tests fail with "権限を確認中..." loading state after navigation

### Solution
**Replace build-time checks with runtime functions:**

```tsx
// ❌ Before: Not mockable
const isTestMode = import.meta.env.VITE_E2E === '1';

if (isTestMode) {
  return <>{children}</>;
}
```

```tsx
// ✅ After: Mockable runtime check
import { shouldSkipLogin as shouldSkipLoginEnv } from '@/lib/env';

if (shouldSkipLoginEnv() || shouldSkipLogin) {
  return <>{children}</>;
}
```

**Test Mock:**
```tsx
vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual('@/lib/env');
  return {
    ...actual,
    shouldSkipLogin: () => true, // Runtime control
  };
});
```

### Why This Works
- `shouldSkipLogin()` is a function that can be mocked
- Production returns `false` (no behavior change)
- Tests can return `true` to bypass guards

---

## Issue 3: JSDOM Router Navigation Instability

### Problem
- Clicking anchor links in JSDOM doesn't always trigger router updates
- `window.location.pathname` doesn't change
- Tests timeout waiting for route to change

### Solution
**Explicitly dispatch popstate after navigation:**

```tsx
await user.click(await ensureNavItem(TESTIDS.nav.audit));

// Ensure router observes location updates in JSDOM
navigateToPath('/audit');

await waitFor(
  () => expect(window.location.pathname).toBe('/audit'),
  { timeout: process.env.CI ? 15_000 : 8_000 },
);
```

**Helper Function:**
```tsx
const navigateToPath = (path: string) => {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
};
```

### Why This Works
- JSDOM doesn't automatically fire `popstate` on anchor clicks
- React Router listens to `popstate` events
- Manual dispatch ensures router sees the navigation

---

## Common Patterns

### Full Navigation Flow
```tsx
// 1. Open drawer if needed
await openDrawerIfPossible();

// 2. Click navigation item
const auditNav = await ensureNavItem(TESTIDS.nav.audit);
await user.click(auditNav);

// 3. Force router update in JSDOM
navigateToPath('/audit');

// 4. Wait for URL change
await waitFor(
  () => expect(window.location.pathname).toBe('/audit'),
  { timeout: CI ? 15_000 : 8_000 },
);

// 5. Verify guard didn't block
expect(screen.queryByText(/権限を確認中/)).not.toBeInTheDocument();

// 6. Verify page content rendered
expect(await screen.findByTestId('audit-heading')).toBeInTheDocument();
```

### Timeout Guidelines
- **Local**: 8 seconds
- **CI**: 15 seconds (slower environment)
- Use `process.env.CI` to adjust dynamically

---

## Related Issues

- **PR #449**: Fixed router smoke tests with proper auth mocks
- **PR #450**: Reverted spec-changing bypass, fixed with runtime checks
- **Commit 9653f606**: Implemented runtime shouldSkipLogin check

---

## Prevention Checklist

Before modifying authorization guards:
- [ ] Can tests mock this check at runtime?
- [ ] Does production behavior remain unchanged?
- [ ] Are build-time constants avoided in bypass logic?

Before modifying drawer navigation tests:
- [ ] Does test wait for `aria-expanded` after open?
- [ ] Does test verify visibility (not just DOM presence)?
- [ ] Does test dispatch popstate in JSDOM?

---

## References

- [React Router Testing Docs](https://reactrouter.com/en/main/start/testing)
- [Testing Library - Appearance Disappearance](https://testing-library.com/docs/guide-disappearance/)
- [Vitest Mocking](https://vitest.dev/guide/mocking.html)
