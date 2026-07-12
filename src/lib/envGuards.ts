import {
  getAppConfig,
  isDemo,
  isDemoModeEnabled,
  isE2E,
  isE2eMsalMockEnabled,
  shouldSkipSharePoint,
} from '@/lib/env';

const isProductionLike = (isDevMode: boolean): boolean => !isDevMode;

const shouldSkipMsalValidation = (): boolean => (
  isE2E() ||
  isE2eMsalMockEnabled() ||
  isDemo() ||
  isDemoModeEnabled()
);

const isValidUrl = (value: string): boolean => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const msalValidationFailureMessage = (missing: string[]): string => {
  const lines = [
    '[config] MSAL startup configuration is invalid.',
    '',
    `Missing or invalid: ${missing.join(', ')}`,
    '',
    'Please check and set:',
    '  - VITE_MSAL_CLIENT_ID (or VITE_AAD_CLIENT_ID)',
    '  - VITE_MSAL_TENANT_ID (or VITE_AAD_TENANT_ID)',
    '  - VITE_MSAL_REDIRECT_URI (absolute URL, required in production-like mode)',
    '',
    'Reference: .env.example',
  ];
  return lines.join('\n');
};

const validateMsalSettings = (config: ReturnType<typeof getAppConfig>): void => {
  const missing: string[] = [];
  const msalRedirectUri = (config as { VITE_MSAL_REDIRECT_URI?: string }).VITE_MSAL_REDIRECT_URI;

  if (!config.VITE_MSAL_CLIENT_ID) {
    missing.push('VITE_MSAL_CLIENT_ID');
  }
  if (!config.VITE_MSAL_TENANT_ID) {
    missing.push('VITE_MSAL_TENANT_ID');
  }

  const redirectUri = msalRedirectUri?.trim();
  if (!redirectUri) {
    missing.push('VITE_MSAL_REDIRECT_URI');
  } else if (!isValidUrl(redirectUri)) {
    throw new Error(msalValidationFailureMessage([
      `VITE_MSAL_REDIRECT_URI (${redirectUri}) is invalid URL`,
    ]));
  }

  if (missing.length > 0) {
    throw new Error(msalValidationFailureMessage(missing));
  }
};

// Guard against misconfigurations that would blank data in production
export const guardProdMisconfig = (): void => {
  const appConfig = getAppConfig();
  const isProduction = isProductionLike(appConfig.isDev);

  if (isProduction && !shouldSkipMsalValidation() && !shouldSkipSharePoint()) {
    validateMsalSettings(appConfig);
  }

  // PRODでSKIPが立っているのは「空データ運用」の事故なので即停止（E2EはVITE_E2Eで免除）
  if (isProduction && !isE2E() && shouldSkipSharePoint()) {
    throw new Error('[config] VITE_SKIP_SHAREPOINT=1 is not allowed in PROD. Check environment configuration.');
  }
};

// Optional softer guard for cases where hard-fail is not desired
export const warnProdMisconfig = (): void => {
  const appConfig = getAppConfig();
  if (isProductionLike(appConfig.isDev) && !shouldSkipMsalValidation() && shouldSkipSharePoint()) {
    // eslint-disable-next-line no-console
    console.error('[config][FATAL] PROD is running with VITE_SKIP_SHAREPOINT=1. Data will not load.');
  }
};
