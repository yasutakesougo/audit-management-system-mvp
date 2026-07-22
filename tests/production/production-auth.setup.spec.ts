import { mkdir, writeFile } from 'node:fs/promises';
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
  lastLocationState: SafeAuthLocation;
  pollIterationCount: number;
  authTimedOut: boolean;
  signInScreenVisible: boolean;
  accountCount: number;
  activeAccountPresent: boolean;
  webdriver: boolean;
  playwrightHintPresent: boolean;
  kioskAppShellVisible: boolean;
  kioskLayoutEnabled: boolean;
  kioskHomeHeadingVisible: boolean;
  executeStepsActionVisible: boolean;
  interactiveLoginTriggered: boolean;
  authNavigationCount: number;
  callbackNavigationEventCount: number;
  callbackEntryCount: number;
  callbackLoopDetected: boolean;
  finalPathIsCallback: boolean;
};

type AuthReplayDiagnostics = {
  storageStateCreated: boolean;
  freshContextCreated: boolean;
  initial: AuthContextDiagnostics;
  replay: AuthContextDiagnostics;
};

type SafeAuthLocation =
  | 'production-kiosk'
  | 'production-callback'
  | 'production-other'
  | 'external-auth'
  | 'unparseable';

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

function classifySafeAuthLocation(
  rawURL: string,
  productionOrigin: string,
): SafeAuthLocation {
  try {
    const url = new URL(rawURL);

    if (url.origin !== productionOrigin) return 'external-auth';
    if (isProductionCallback(rawURL, productionOrigin)) return 'production-callback';
    if (url.pathname === '/kiosk') return 'production-kiosk';
    return 'production-other';
  } catch {
    return 'unparseable';
  }
}

type CallbackTracker = {
  callbackNavigationEventCount: number;
  callbackEntryCount: number;
  callbackLoopDetected: boolean;
  previousWasCallback: boolean;
  returnedToKioskAfterCallback: boolean;
};

function createCallbackTracker(): CallbackTracker {
  return {
    callbackNavigationEventCount: 0,
    callbackEntryCount: 0,
    callbackLoopDetected: false,
    previousWasCallback: false,
    returnedToKioskAfterCallback: false,
  };
}

function observeMainFrameNavigation(
  tracker: CallbackTracker,
  rawURL: string,
  productionOrigin: string,
): void {
  const callback = isProductionCallback(rawURL, productionOrigin);

  if (callback) {
    tracker.callbackNavigationEventCount += 1;

    if (!tracker.previousWasCallback) {
      tracker.callbackEntryCount += 1;

      if (tracker.returnedToKioskAfterCallback) {
        tracker.callbackLoopDetected = true;
      }
    }
  } else {
    try {
      const url = new URL(rawURL);

      if (
        tracker.callbackEntryCount > 0 &&
        url.origin === productionOrigin &&
        url.pathname === '/kiosk'
      ) {
        tracker.returnedToKioskAfterCallback = true;
      }
    } catch {
      // Keep diagnostics scalar-only; do not retain malformed URLs.
    }
  }

  tracker.previousWasCallback = callback;
}

function syncCallbackDiagnostics(
  tracker: CallbackTracker,
  diagnostics: AuthContextDiagnostics,
): void {
  diagnostics.callbackNavigationEventCount = tracker.callbackNavigationEventCount;
  diagnostics.callbackEntryCount = tracker.callbackEntryCount;
  diagnostics.callbackLoopDetected = tracker.callbackLoopDetected;
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

async function assertKioskHomeSurface(page: Page, timeout: number): Promise<{
  kioskAppShellVisible: boolean;
  kioskLayoutEnabled: boolean;
  kioskHomeHeadingVisible: boolean;
  executeStepsActionVisible: boolean;
}> {
  const appShell = page.getByTestId('app-shell');
  await expect(appShell).toBeVisible({ timeout });
  const kioskLayoutEnabled = (await appShell.getAttribute('data-kiosk')) === 'true';
  expect(kioskLayoutEnabled).toBe(true);

  await expect(
    page.getByRole('heading', { name: 'キオスクモード' }),
  ).toBeVisible({ timeout });
  await expect(
    page.getByTestId('kiosk-action-execute-steps'),
  ).toBeVisible({ timeout });

  return {
    kioskAppShellVisible: true,
    kioskLayoutEnabled,
    kioskHomeHeadingVisible: true,
    executeStepsActionVisible: true,
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
  const payload = {
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
  };
  const body = JSON.stringify(payload, null, 2);

  await testInfo.attach('production-auth-replay.json', {
    body,
    contentType: 'application/json',
  });

  const diagnosticPath = testInfo.outputPath('production-auth-replay.json');
  await mkdir(dirname(diagnosticPath), { recursive: true });
  await writeFile(diagnosticPath, body, 'utf8');
}

test('create production Workers Entra storage state', async ({ page, context, browser }, testInfo) => {
  const productionOrigin = new URL(productionBaseURL).origin;
  const authReplay: AuthReplayDiagnostics = {
    storageStateCreated: false,
    freshContextCreated: false,
    initial: {
      lastLocationState: 'unparseable',
      pollIterationCount: 0,
      authTimedOut: false,
      signInScreenVisible: false,
      accountCount: 0,
      activeAccountPresent: false,
      webdriver: false,
      playwrightHintPresent: false,
      kioskAppShellVisible: false,
      kioskLayoutEnabled: false,
      kioskHomeHeadingVisible: false,
      executeStepsActionVisible: false,
      interactiveLoginTriggered: false,
      authNavigationCount: 0,
      callbackNavigationEventCount: 0,
      callbackEntryCount: 0,
      callbackLoopDetected: false,
      finalPathIsCallback: false,
    },
    replay: {
      lastLocationState: 'unparseable',
      pollIterationCount: 0,
      authTimedOut: false,
      signInScreenVisible: false,
      accountCount: 0,
      activeAccountPresent: false,
      webdriver: false,
      playwrightHintPresent: false,
      kioskAppShellVisible: false,
      kioskLayoutEnabled: false,
      kioskHomeHeadingVisible: false,
      executeStepsActionVisible: false,
      interactiveLoginTriggered: false,
      authNavigationCount: 0,
      callbackNavigationEventCount: 0,
      callbackEntryCount: 0,
      callbackLoopDetected: false,
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
    const initialCallbackTracker = createCallbackTracker();
    page.on('framenavigated', (frame) => {
      if (frame !== page.mainFrame()) return;
      if (isAuthRedirect(frame.url(), productionOrigin)) {
        initialAuth.authNavigationCount += 1;
      }
      observeMainFrameNavigation(initialCallbackTracker, frame.url(), productionOrigin);
      syncCallbackDiagnostics(initialCallbackTracker, initialAuth);
    });
    const initialResponse = await page.goto(`${productionBaseURL}/kiosk`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    expect(initialResponse?.status()).toBe(200);

    expect(isAuthRedirect(page.url(), productionOrigin)).toBe(false);
    expect(new URL(page.url()).pathname).toBe('/kiosk');
    initialAuth.lastLocationState = classifySafeAuthLocation(page.url(), productionOrigin);
    initialAuth.signInScreenVisible = await isSignInScreenVisible(page);
    expect(initialAuth.signInScreenVisible).toBe(false);
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

    try {
      await expect
        .poll(
          async () => {
            initialAuth.pollIterationCount += 1;
            const rawURL = page.url();
            const currentURL = new URL(rawURL);
            const snapshot = await readSafeMsalSnapshot(page).catch(() => ({
              accountCount: 0,
              activeAccountPresent: false,
            }));
            initialAuth.accountCount = snapshot.accountCount;
            initialAuth.activeAccountPresent = snapshot.activeAccountPresent;
            initialAuth.finalPathIsCallback = isProductionCallback(
              rawURL,
              productionOrigin,
            );
            initialAuth.lastLocationState = classifySafeAuthLocation(
              rawURL,
              productionOrigin,
            );
            initialAuth.signInScreenVisible = await isSignInScreenVisible(page);
            syncCallbackDiagnostics(initialCallbackTracker, initialAuth);
            if (currentURL.origin !== productionOrigin) return false;
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
    } catch (error) {
      initialAuth.authTimedOut = true;
      const finalSnapshot = await readSafeMsalSnapshot(page).catch(() => ({
        accountCount: 0,
        activeAccountPresent: false,
      }));
      initialAuth.accountCount = finalSnapshot.accountCount;
      initialAuth.activeAccountPresent = finalSnapshot.activeAccountPresent;
      initialAuth.finalPathIsCallback = isProductionCallback(
        page.url(),
        productionOrigin,
      );
      initialAuth.signInScreenVisible = await isSignInScreenVisible(page);
      initialAuth.lastLocationState = classifySafeAuthLocation(
        page.url(),
        productionOrigin,
      );
      syncCallbackDiagnostics(initialCallbackTracker, initialAuth);
      throw error;
    }

    const authenticatedInitialSnapshot = await readSafeMsalSnapshot(page);
    initialAuth.accountCount = authenticatedInitialSnapshot.accountCount;
    initialAuth.activeAccountPresent = authenticatedInitialSnapshot.activeAccountPresent;
    initialAuth.finalPathIsCallback = isProductionCallback(page.url(), productionOrigin);
    initialAuth.lastLocationState = classifySafeAuthLocation(page.url(), productionOrigin);
    initialAuth.signInScreenVisible = await isSignInScreenVisible(page);
    syncCallbackDiagnostics(initialCallbackTracker, initialAuth);
    expect(initialAuth.accountCount).toBeGreaterThanOrEqual(1);
    expect(initialAuth.activeAccountPresent).toBe(true);
    expect(initialAuth.callbackEntryCount).toBeLessThanOrEqual(1);
    if (initialAuth.interactiveLoginTriggered) {
      expect(initialAuth.callbackEntryCount).toBe(1);
    }
    expect(initialAuth.callbackLoopDetected).toBe(false);
    expect(initialAuth.finalPathIsCallback).toBe(false);
    expect(new URL(page.url()).origin).toBe(productionOrigin);
    expect(new URL(page.url()).pathname).toBe('/kiosk');
    expect(await isSignInScreenVisible(page)).toBe(false);
    Object.assign(
      authReplay.initial,
      await assertKioskHomeSurface(page, authWaitTimeout),
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
    const replayCallbackTracker = createCallbackTracker();
    replayPage.on('framenavigated', (frame) => {
      if (frame !== replayPage.mainFrame()) return;
      if (isAuthRedirect(frame.url(), productionOrigin)) {
        replayAuth.authNavigationCount += 1;
      }
      observeMainFrameNavigation(replayCallbackTracker, frame.url(), productionOrigin);
      syncCallbackDiagnostics(replayCallbackTracker, replayAuth);
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
    replayAuth.lastLocationState = classifySafeAuthLocation(replayPage.url(), productionOrigin);
    replayAuth.signInScreenVisible = await isSignInScreenVisible(replayPage);
    syncCallbackDiagnostics(replayCallbackTracker, replayAuth);
    expect(replayAuth.accountCount).toBeGreaterThanOrEqual(1);
    expect(replayAuth.activeAccountPresent).toBe(true);
    expect(replayAuth.callbackEntryCount).toBe(0);
    expect(replayAuth.callbackLoopDetected).toBe(false);
    expect(replayAuth.finalPathIsCallback).toBe(false);
    expect(new URL(replayPage.url()).origin).toBe(productionOrigin);
    expect(new URL(replayPage.url()).pathname).toBe('/kiosk');
    Object.assign(
      authReplay.replay,
      await assertKioskHomeSurface(replayPage, 30_000),
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
