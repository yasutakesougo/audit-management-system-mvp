import { shouldSkipSharePoint } from './env';
import { getFlag } from '@/env';

// Guard against misconfigurations that would blank data in production
export const guardProdMisconfig = (): void => {
  // PRODでSKIPが立っているのは「空データ運用」の事故なので即停止（E2EはVITE_E2Eで免除）
  // NOTE: Use getFlag for runtime E2E value instead of import.meta.env.VITE_E2E (which is build-time)
  if (import.meta.env.PROD && !getFlag('VITE_E2E', false) && shouldSkipSharePoint()) {
    throw new Error('[config] VITE_SKIP_SHAREPOINT=1 is not allowed in PROD. Check environment configuration.');
  }
};

// Optional softer guard for cases where hard-fail is not desired
export const warnProdMisconfig = (): void => {
  if (import.meta.env.PROD && !import.meta.env.VITE_E2E && shouldSkipSharePoint()) {
    // eslint-disable-next-line no-console
    console.error('[config][FATAL] PROD is running with VITE_SKIP_SHAREPOINT=1. Data will not load.');
  }
};
