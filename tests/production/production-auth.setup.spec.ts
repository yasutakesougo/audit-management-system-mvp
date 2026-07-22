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
  webdriver: boolean;
  playwrightHintPresent: boolean;
  kioskAppShellVisible: boolean;
  kioskLayoutEnabled: boolean;
  usersHeadingVisible: boolean;
  interactiveLoginTriggered: boolean;
  authNavigationCount: number;
  callbackEntryCount: number;
  finalPathIsCallback: boolean;
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

function isProductionCallback(rawURL: string, productionOrigin: string): boolean {
  try {
    const url = new URL(rawURL);
    return (
      url.origin === productionOrigin &&
      ['/auth/callback', '/callback'].includes(url.pathname)
    );
  } catch {
    return true;
  }
}

async function installProductionRealAuthMode(
  context: BrowserContext,
  productionOrigin: string,
): Promise<void> {
  await context.addInitScript(
    ({ origin }) => {
      if (window.location.origin !== origin) return;

      Object.defineProperty(Navigator.prototype, 'webdriver', {
        configurable: true,
        get: () => false,
      });
    },
    { origin: productionOrigin },
  );
}

async function readAutomationState(page: Page): Promise<{
  webdriver: boolean;
  playwrightHintPresent: boolean;
}> {
  return page.evaluate(() => {
    const automationHints = window as Window & { __PLAYWRIGHT__?: unknown };
    return {
      webdriver: navigator.webdriver,
      playwrightHintPresent: Boolean(automationHints.__PLAYWRIGHT__),
    };
  });
}

async function assertKioskAuthSurface(page: Page, timeout: number): Promise<{
  kioskAppShellVisible: boolean;
  kioskLayoutEnabled: boolean;
  usersHeadingVisible: boolean;
}> {
  const appShell = page.getByTestId('app-shell');
  await expect(appShell).toBeVisible({ timeout });
  const kioskLayoutEnabled = (await appShell.getAttribute('data-kiosk')) === 'true';
  expect(kioskLayoutEnabled).toBe(true);

  const usersHeading = page.getByRole('heading', { name: '利用者を選択してください' });
  await expect(usersHeading).toBeVisible({ timeout });

  return {
    kioskAppShellVisible: true,
    kioskLayoutEnabled,
    usersHeadingVisible: true,
  };
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
      webdriver: false,
      playwrightHintPresent: false,
      kioskAppShellVisible: false,
      kioskLayoutEnabled: false,
      usersHeadingVisible: false,
      interactiveLoginTriggered: false,
      authNavigationCount: 0,
      callbackEntryCount: 0,
      finalPathIsCallback: false,
    },
    replay: {
      accountCount: 0,
      activeAccountPresent: false,
      webdriver: false,
      playwrightHintPresent: false,
      kioskAppShellVisible: false,
      kioskLayoutEnabled: false,
      usersHeadingVisible: false,
      interactiveLoginTriggered: false,
      authNavigationCount: 0,
      callbackEntryCount: 0,
      finalPathIsCallback: false,
    },
  };
  let initialGuard: Awaited<ReturnType<typeof installProductionReadOnlyGuard>> | undefined;
  let replayGuard: Awaited<ReturnType<typeof installProductionReadOnlyGuard>> | undefined;
  let replayContext: BrowserContext | undefined;

  try {
    // The headed page remains available for manual Entra/MFA completion. Root is intentionally excluded.
    await installProductionRealAuthMode(context, productionOrigin);
    initialGuard = await installProductionReadOnlyGuard(context, {
      productionOrigin,
      getPhase: () => 'auth-setup-kiosk',
    });
    const initialAuth = authReplay.initial;
    page.on('framenavigated', (frame) => {
      if (frame !== page.mainFrame()) return;
      if (isAuthRedirect(frame.url(), productionOrigin)) {
        initialAuth.authNavigationCount += 1;
      }
      if (isProductionCallback(frame.url(), productionOrigin)) {
        initialAuth.callbackEntryCount += 1;
      }
    });
    const initialResponse = await page.goto(`${productionBaseURL}/kiosk`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    expect(initialResponse?.status()).toBe(200);

    expect(isAuthRedirect(page.url(), productionOrigin)).toBe(false);
    expect(new URL(page.url()).pathname).toBe('/kiosk');
    expect(await isSignInScreenVisible(page)).toBe(false);
    const initialAutomationState = await readAutomationState(page);
    authReplay.initial.webdriver = initialAutomationState.webdriver;
    authReplay.initial.playwrightHintPresent = initialAutomationState.playwrightHintPresent;
    expect(initialAutomationState.webdriver).toBe(false);
    expect(initialAutomationState.playwrightHintPresent).toBe(false);
    const initialSnapshot = await readSafeMsalSnapshot(page);
    if (initialSnapshot.accountCount === 0) {
      const signInButton = page.getByRole('button', { name: '強制再ログイン' });
      await expect(signInButton).toBeVisible({ timeout: authWaitTimeout });
      initialAuth.interactiveLoginTriggered = true;
      await signInButton.click();
    }

    await expect
      .poll(
        async () => {
          const currentURL = new URL(page.url());
          if (currentURL.origin !== productionOrigin) return false;
          const snapshot = await readSafeMsalSnapshot(page);
          return (
            snapshot.accountCount >= 1 &&
            snapshot.activeAccountPresent &&
            currentURL.pathname === '/kiosk'
          );
        },
        {
          timeout: authWaitTimeout,
          intervals: [500, 1_000, 2_000],
        },
      )
      .toBe(true);

    const authenticatedInitialSnapshot = await readSafeMsalSnapshot(page);
    initialAuth.accountCount = authenticatedInitialSnapshot.accountCount;
    initialAuth.activeAccountPresent = authenticatedInitialSnapshot.activeAccountPresent;
    initialAuth.finalPathIsCallback = isProductionCallback(page.url(), productionOrigin);
    expect(initialAuth.accountCount).toBeGreaterThanOrEqual(1);
    expect(initialAuth.activeAccountPresent).toBe(true);
    expect(initialAuth.callbackEntryCount).toBeLessThanOrEqual(1);
    expect(initialAuth.finalPathIsCallback).toBe(false);
    expect(new URL(page.url()).origin).toBe(productionOrigin);
    expect(new URL(page.url()).pathname).toBe('/kiosk');
    expect(await isSignInScreenVisible(page)).toBe(false);
    Object.assign(
      authReplay.initial,
      await assertKioskAuthSurface(page, authWaitTimeout),
    );

    await mkdir(dirname(productionStorageState), { recursive: true });
    await context.storageState({ path: productionStorageState });
    authReplay.storageStateCreated = true;

    replayContext = await browser.newContext({ storageState: productionStorageState });
    authReplay.freshContextCreated = true;
    await installProductionRealAuthMode(replayContext, productionOrigin);
    replayGuard = await installProductionReadOnlyGuard(replayContext, {
      productionOrigin,
      getPhase: () => 'auth-replay-kiosk',
    });
    const replayPage = await replayContext.newPage();
    const replayAuth = authReplay.replay;
    replayPage.on('framenavigated', (frame) => {
      if (frame !== replayPage.mainFrame()) return;
      if (isAuthRedirect(frame.url(), productionOrigin)) {
        replayAuth.authNavigationCount += 1;
      }
      if (isProductionCallback(frame.url(), productionOrigin)) {
        replayAuth.callbackEntryCount += 1;
      }
    });
    const replayResponse = await replayPage.goto(`${productionBaseURL}/kiosk`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    expect(replayResponse?.status()).toBe(200);
    expect(isAuthRedirect(replayPage.url(), productionOrigin)).toBe(false);
    expect(new URL(replayPage.url()).pathname).toBe('/kiosk');
    expect(await isSignInScreenVisible(replayPage)).toBe(false);
    const replayAutomationState = await readAutomationState(replayPage);
    authReplay.replay.webdriver = replayAutomationState.webdriver;
    authReplay.replay.playwrightHintPresent = replayAutomationState.playwrightHintPresent;
    expect(replayAutomationState.webdriver).toBe(false);
    expect(replayAutomationState.playwrightHintPresent).toBe(false);

    const replaySnapshot = await readSafeMsalSnapshot(replayPage);
    replayAuth.accountCount = replaySnapshot.accountCount;
    replayAuth.activeAccountPresent = replaySnapshot.activeAccountPresent;
    replayAuth.finalPathIsCallback = isProductionCallback(replayPage.url(), productionOrigin);
    expect(replayAuth.accountCount).toBeGreaterThanOrEqual(1);
    expect(replayAuth.activeAccountPresent).toBe(true);
    expect(replayAuth.callbackEntryCount).toBe(0);
    expect(replayAuth.finalPathIsCallback).toBe(false);
    expect(new URL(replayPage.url()).origin).toBe(productionOrigin);
    expect(new URL(replayPage.url()).pathname).toBe('/kiosk');
    Object.assign(
      authReplay.replay,
      await assertKioskAuthSurface(replayPage, 30_000),
    );

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
