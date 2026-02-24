import { IS_E2E, SHOULD_SKIP_SHAREPOINT } from '@/lib/env';

// Guard against misconfigurations that would blank data in production
export const guardProdMisconfig = (): void => {
  // PRODでSKIPが立っているのは「空データ運用」の事故なので即停止（E2EはVITE_E2Eで免除）
  if (import.meta.env.PROD && !IS_E2E && SHOULD_SKIP_SHAREPOINT) {
    throw new Error('[config] VITE_SKIP_SHAREPOINT=1 is not allowed in PROD. Check environment configuration.');
  }
};

// Optional softer guard for cases where hard-fail is not desired
export const warnProdMisconfig = (): void => {
  if (import.meta.env.PROD && !IS_E2E && SHOULD_SKIP_SHAREPOINT) {
    // eslint-disable-next-line no-console
    console.error('[config][FATAL] PROD is running with VITE_SKIP_SHAREPOINT=1. Data will not load.');
  }
};
