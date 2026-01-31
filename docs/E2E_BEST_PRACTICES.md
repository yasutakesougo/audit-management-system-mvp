# E2E Best Practices

## Two-layer wait strategy (CI-safe)

**Problem:** CIではレンダリングが遅く、要素が「存在しない」状態で安定化待ちをすると失敗する。

**Pattern:**
1. Existence / visibility guarantee  
2. Stability guarantee (layout shift吸収)  
3. Interact / assert

```ts
import { waitForLocator } from '../_helpers/waitForLocator';
import { waitForStableRender } from '../_helpers/waitForStableRender';

await waitForLocator(locator, { timeoutMs: 60_000, requireVisible: true });
await waitForStableRender(page, locator, { timeoutMs: 45_000 });

await locator.click();
```

## Responsive navigation (mobile drawer)

Mobile幅では nav が Drawer 内にあり、閉じていると DOM に存在しないことがある。

```ts
import { openMobileNav } from '../_helpers/openMobileNav';

await openMobileNav(page);
// now nav items exist in DOM
await waitForLocator(page.locator('[data-testid="nav-dashboard"]'));
```

## Troubleshooting checklist

- **Network/Auth**: bypass/fixtures OK?
- **Render started**: route reached?
- **Element exists**: waitForLocator
- **Layout stable**: waitForStableRender
- **Responsive state**: Drawer open?

## Examples

- [tests/e2e/nav-and-status.smoke.spec.ts](../tests/e2e/nav-and-status.smoke.spec.ts) - Mobile nav handling
- [tests/e2e/monthly.summary-smoke.spec.ts](../tests/e2e/monthly.summary-smoke.spec.ts) - Two-layer wait
- [tests/e2e/schedule-smoke.spec.ts](../tests/e2e/schedule-smoke.spec.ts) - Two-layer wait

## Other gates

- Performance tests are gated by default to keep CI deterministic.
- To run locally: `PERF_TEST=1 npm run test -- ruleEngine.spec.ts`

## Related PRs

- PR #259: Fixed network/auth blocking
- PR #260: Added `waitForStableRender` helper
- PR #261: Added `waitForLocator` helper + mobile nav handling
