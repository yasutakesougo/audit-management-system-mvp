export const hasSpfxContext = (): boolean =>
  Boolean((globalThis as unknown as { __SPFX_CONTEXT__?: unknown }).__SPFX_CONTEXT__);

/**
 * Lightweight heuristic to detect if running on SharePoint.
 * - If SPFx is present, it's definitive.
 * - Otherwise, infer from hostname/referrer; false positives are gated by SPFx checks.
 */
export const isRunningInSharePoint = (): boolean => {
  if (hasSpfxContext()) return true;

  const host = (typeof location !== 'undefined' ? location.hostname : '') || '';
  const ref = (typeof document !== 'undefined' ? document.referrer : '') || '';

  const looksLikeSpo =
    host.includes('.sharepoint.com') ||
    host.includes('.sharepoint-df.com') ||
    host.includes('.sharepoint.cn') ||
    ref.includes('.sharepoint.com') ||
    ref.includes('.sharepoint-df.com') ||
    ref.includes('.sharepoint.cn');

  return looksLikeSpo;
};
