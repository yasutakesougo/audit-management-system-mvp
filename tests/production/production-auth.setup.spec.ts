import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type TestInfo,
} from '@playwright/test';
import {
  installProductionReadOnlyGuard,
  isAuthRedirect,
  mergeProductionReadOnlyGuardDiagnostics,
  readSafeMsalSnapshot,
  type ProductionReadOnlyGuardDiagnostics,
} from './_helpers/productionReadOnlyGuard';

const productionBaseURL =
  process.env.PRODUCTION_BASE_URL ??
  'https://audit-management-system-mvp.momosantanuki.workers.dev';
const productionStorageState = 'tests/.auth/production-storageState.json';
const authWaitTimeout = Number(process.env.PRODUCTION_AUTH_TIMEOUT_MS ?? 180_000);

type AuthReplayDiagnostics = {
  storageStateCreated: boolean;
  freshContextCreated: boolean;
  accountCount: number;
  activeAccountPresent: boolean;
  signOutVisible: boolean;
  callbackRedirectObserved: boolean;
};

async function isSignInScreenVisible(page: Page): Promise<boolean> {
  return page
    .locator('input[name="loginfmt"], input[type="email"]')
    .first()
    .isVisible()
    .catch(() => false);
}

function emptyGuardDiagnostics(): ProductionReadOnlyGuardDiagnostics {
  return {
    readRequests: 0,
    mutationAttempts: 0,
    mutationAttemptsBlocked: 0,
    mutationAttemptSummaries: [],
  };
}

async function attachAuthDiagnostics(
  testInfo: TestInfo,
  authReplay: AuthReplayDiagnostics,
  guardDiagnostics: ProductionReadOnlyGuardDiagnostics,
): Promise<void> {
  await testInfo.attach('production-auth-replay.json', {
    body: JSON.stringify(
      {
        authReplay,
        sharePoint: guardDiagnostics,
        policy: {
          accountAttributes: 'not-recorded',
          credentials: 'not-recorded',
          storageState: 'not-recorded',
          requestBody: 'not-recorded',
          queryString: 'not-recorded',
          fragment: 'not-recorded',
        },
      },
      null,
      2,
    ),
    contentType: 'application/json',
  });
}

test('create production Workers Entra storage state', async ({ page, context, browser }, testInfo) => {
  const productionOrigin = new URL(productionBaseURL).origin;
  const authReplay: AuthReplayDiagnostics = {
    storageStateCreated: false,
    freshContextCreated: false,
    accountCount: 0,
    activeAccountPresent: false,
    signOutVisible: false,
    callbackRedirectObserved: false,
  };
  let initialGuard: Awaited<ReturnType<typeof installProductionReadOnlyGuard>> | undefined;
  let replayGuard: Awaited<ReturnType<typeof installProductionReadOnlyGuard>> | undefined;
  let replayContext: BrowserContext | undefined;

  try {
    // The headed page remains available for manual Entra/MFA completion. Root is intentionally excluded.
    initialGuard = await installProductionReadOnlyGuard(page, {
      productionOrigin,
      getPhase: () => 'auth-setup-kiosk',
    });
    const initialResponse = await page.goto(`${productionBaseURL}/kiosk`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    expect(initialResponse?.status()).toBe(200);

    await expect(page.getByRole('button', { name: 'サインアウト' })).toBeVisible({
      timeout: authWaitTimeout,
    });
    authReplay.signOutVisible = true;
    await expect(page.getByRole('heading', { name: 'キオスクモード' })).toBeVisible({
      timeout: authWaitTimeout,
    });

    expect(isAuthRedirect(page.url(), productionOrigin)).toBe(false);
    expect(new URL(page.url()).pathname).toBe('/kiosk');
    const initialSnapshot = await readSafeMsalSnapshot(page);
    expect(initialSnapshot.accountCount).toBeGreaterThanOrEqual(1);
    expect(initialSnapshot.activeAccountPresent).toBe(true);

    await mkdir(dirname(productionStorageState), { recursive: true });
    await context.storageState({ path: productionStorageState });
    authReplay.storageStateCreated = true;

    replayContext = await browser.newContext({ storageState: productionStorageState });
    authReplay.freshContextCreated = true;
    const replayPage = await replayContext.newPage();
    let replayCallbackRedirectObserved = false;
    replayPage.on('framenavigated', (frame) => {
      if (frame === replayPage.mainFrame() && isAuthRedirect(frame.url(), productionOrigin)) {
        replayCallbackRedirectObserved = true;
      }
    });
    replayGuard = await installProductionReadOnlyGuard(replayPage, {
      productionOrigin,
      getPhase: () => 'auth-replay-kiosk',
    });

    const replayResponse = await replayPage.goto(`${productionBaseURL}/kiosk`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    expect(replayResponse?.status()).toBe(200);
    await expect(replayPage.getByRole('button', { name: 'サインアウト' })).toBeVisible({
      timeout: 30_000,
    });
    authReplay.signOutVisible = true;
    await expect(replayPage.getByRole('heading', { name: 'キオスクモード' })).toBeVisible({
      timeout: 30_000,
    });
    expect(isAuthRedirect(replayPage.url(), productionOrigin)).toBe(false);
    expect(new URL(replayPage.url()).pathname).toBe('/kiosk');
    expect(await isSignInScreenVisible(replayPage)).toBe(false);

    const replaySnapshot = await readSafeMsalSnapshot(replayPage);
    authReplay.accountCount = replaySnapshot.accountCount;
    authReplay.activeAccountPresent = replaySnapshot.activeAccountPresent;
    authReplay.callbackRedirectObserved = replayCallbackRedirectObserved;
    expect(authReplay.accountCount).toBeGreaterThanOrEqual(1);
    expect(authReplay.activeAccountPresent).toBe(true);
    expect(authReplay.callbackRedirectObserved).toBe(false);
  } finally {
    const guardDiagnostics = mergeProductionReadOnlyGuardDiagnostics(
      initialGuard?.getDiagnostics() ?? emptyGuardDiagnostics(),
      replayGuard?.getDiagnostics() ?? emptyGuardDiagnostics(),
    );
    expect(
      guardDiagnostics.mutationAttempts,
      'production read-only violation: SharePoint mutation request attempted',
    ).toBe(0);
    await attachAuthDiagnostics(testInfo, authReplay, guardDiagnostics);
    await replayContext?.close();
  }
});
