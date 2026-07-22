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
  readSafeMsalSnapshot,
  type ProductionReadOnlyGuardDiagnostics,
} from './_helpers/productionReadOnlyGuard';

const productionBaseURL =
  process.env.PRODUCTION_BASE_URL ??
  'https://audit-management-system-mvp.momosantanuki.workers.dev';
const productionStorageState = 'tests/.auth/production-storageState.json';
const authWaitTimeout = Number(process.env.PRODUCTION_AUTH_TIMEOUT_MS ?? 180_000);

type AuthContextDiagnostics = {
  accountCount: number;
  activeAccountPresent: boolean;
  signOutVisible: boolean;
  callbackRedirectObserved: boolean;
};

type AuthReplayDiagnostics = {
  storageStateCreated: boolean;
  freshContextCreated: boolean;
  initial: AuthContextDiagnostics;
  replay: AuthContextDiagnostics;
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
  initialGuardDiagnostics: ProductionReadOnlyGuardDiagnostics,
  replayGuardDiagnostics: ProductionReadOnlyGuardDiagnostics,
): Promise<void> {
  await testInfo.attach('production-auth-replay.json', {
    body: JSON.stringify(
      {
        authReplay,
        sharePoint: {
          initial: initialGuardDiagnostics,
          replay: replayGuardDiagnostics,
        },
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
    initial: {
      accountCount: 0,
      activeAccountPresent: false,
      signOutVisible: false,
      callbackRedirectObserved: false,
    },
    replay: {
      accountCount: 0,
      activeAccountPresent: false,
      signOutVisible: false,
      callbackRedirectObserved: false,
    },
  };
  let initialGuard: Awaited<ReturnType<typeof installProductionReadOnlyGuard>> | undefined;
  let replayGuard: Awaited<ReturnType<typeof installProductionReadOnlyGuard>> | undefined;
  let replayContext: BrowserContext | undefined;

  try {
    // The headed page remains available for manual Entra/MFA completion. Root is intentionally excluded.
    initialGuard = await installProductionReadOnlyGuard(context, {
      productionOrigin,
      getPhase: () => 'auth-setup-kiosk',
    });
    let initialCallbackRedirectObserved = false;
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame() && isAuthRedirect(frame.url(), productionOrigin)) {
        initialCallbackRedirectObserved = true;
      }
    });
    const initialResponse = await page.goto(`${productionBaseURL}/kiosk`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    expect(initialResponse?.status()).toBe(200);

    await expect(page.getByRole('button', { name: 'サインアウト' })).toBeVisible({
      timeout: authWaitTimeout,
    });
    authReplay.initial.signOutVisible = true;
    await expect(page.getByRole('heading', { name: 'キオスクモード' })).toBeVisible({
      timeout: authWaitTimeout,
    });

    expect(isAuthRedirect(page.url(), productionOrigin)).toBe(false);
    expect(new URL(page.url()).pathname).toBe('/kiosk');
    const initialSnapshot = await readSafeMsalSnapshot(page);
    authReplay.initial.accountCount = initialSnapshot.accountCount;
    authReplay.initial.activeAccountPresent = initialSnapshot.activeAccountPresent;
    authReplay.initial.callbackRedirectObserved = initialCallbackRedirectObserved;
    expect(initialSnapshot.accountCount).toBeGreaterThanOrEqual(1);
    expect(initialSnapshot.activeAccountPresent).toBe(true);
    expect(initialCallbackRedirectObserved).toBe(false);

    await mkdir(dirname(productionStorageState), { recursive: true });
    await context.storageState({ path: productionStorageState });
    authReplay.storageStateCreated = true;

    replayContext = await browser.newContext({ storageState: productionStorageState });
    authReplay.freshContextCreated = true;
    replayGuard = await installProductionReadOnlyGuard(replayContext, {
      productionOrigin,
      getPhase: () => 'auth-replay-kiosk',
    });
    const replayPage = await replayContext.newPage();
    let replayCallbackRedirectObserved = false;
    replayPage.on('framenavigated', (frame) => {
      if (frame === replayPage.mainFrame() && isAuthRedirect(frame.url(), productionOrigin)) {
        replayCallbackRedirectObserved = true;
      }
    });
    const replayResponse = await replayPage.goto(`${productionBaseURL}/kiosk`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    expect(replayResponse?.status()).toBe(200);
    await expect(replayPage.getByRole('button', { name: 'サインアウト' })).toBeVisible({
      timeout: 30_000,
    });
    authReplay.replay.signOutVisible = true;
    await expect(replayPage.getByRole('heading', { name: 'キオスクモード' })).toBeVisible({
      timeout: 30_000,
    });
    expect(isAuthRedirect(replayPage.url(), productionOrigin)).toBe(false);
    expect(new URL(replayPage.url()).pathname).toBe('/kiosk');
    expect(await isSignInScreenVisible(replayPage)).toBe(false);

    const replaySnapshot = await readSafeMsalSnapshot(replayPage);
    authReplay.replay.accountCount = replaySnapshot.accountCount;
    authReplay.replay.activeAccountPresent = replaySnapshot.activeAccountPresent;
    authReplay.replay.callbackRedirectObserved = replayCallbackRedirectObserved;
    expect(authReplay.replay.accountCount).toBeGreaterThanOrEqual(1);
    expect(authReplay.replay.activeAccountPresent).toBe(true);
    expect(authReplay.replay.callbackRedirectObserved).toBe(false);

    const initialGuardDiagnostics = initialGuard.getDiagnostics();
    const replayGuardDiagnostics = replayGuard.getDiagnostics();
    expect(
      initialGuardDiagnostics.mutationAttempts,
      'production read-only violation: SharePoint mutation request attempted',
    ).toBe(0);
    expect(
      replayGuardDiagnostics.mutationAttempts,
      'production read-only violation: SharePoint mutation request attempted',
    ).toBe(0);
  } finally {
    await attachAuthDiagnostics(
      testInfo,
      authReplay,
      initialGuard?.getDiagnostics() ?? emptyGuardDiagnostics(),
      replayGuard?.getDiagnostics() ?? emptyGuardDiagnostics(),
    );
    await replayContext?.close();
  }
});
