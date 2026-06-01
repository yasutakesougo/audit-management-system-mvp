import { readEnv, readOptionalEnv, type EnvRecord } from '@/lib/env';

export const BILLING_ORDERS_REGISTRY_KEY = 'billing_orders';

const normalizeSiteRelative = (value?: string): string | undefined => {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, '').toLowerCase();
};

export const shouldExcludeBillingOrdersFromDefaultSiteDrift = (
  envOverride?: EnvRecord,
): boolean => {
  const defaultSite = normalizeSiteRelative(readEnv('VITE_SP_SITE_RELATIVE', '', envOverride));
  const billingSite = normalizeSiteRelative(
    readOptionalEnv('VITE_SP_LIST_BILLING_ORDERS_SITE_RELATIVE', envOverride),
  );

  return Boolean(defaultSite && billingSite && billingSite !== defaultSite);
};
