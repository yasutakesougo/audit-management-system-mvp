import { acquireSpAccessToken } from '@/lib/msal';
import { createSpClient, ensureConfig } from '@/lib/spClient';
import { BILLING_ORDERS_LIST_ID } from '@/sharepoint/fields';
import type { BillingOrderRepository } from './repository';


import { mapToBillingOrder } from './domain/billingLogic';

/**
 * List3 は /sites/2/ にあるため、メインサイト (/sites/welfare/) とは
 * 別の spClient インスタンスを作成する。
 */
export function createSharePointBillingOrderRepository(): BillingOrderRepository {
  // メインの設定から resource (テナントURL) を取得
  const mainConfig = ensureConfig();
  // /sites/2/ 用の baseUrl を組み立てる
  const resource = mainConfig.resource; // e.g. https://isogokatudouhome.sharepoint.com
  const billingBaseUrl = `${resource}/sites/2/_api/web`;

  const sp = createSpClient(acquireSpAccessToken, billingBaseUrl);
  const listId = BILLING_ORDERS_LIST_ID;

  return {
    async list() {
      const url = `/lists/GetById('${listId}')/items?$top=500`;

      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('[Billing] fetching via spClient:', billingBaseUrl + url);
      }
      try {
        const res = await sp.spFetch(url, { method: 'GET' });
        const json = (await res.json().catch(() => ({ value: [] }))) as { value?: Record<string, unknown>[] };
        const items = json.value ?? [];

        if (import.meta.env.DEV && items.length > 0) {
          // eslint-disable-next-line no-console
          console.log('[Billing] Sample item keys:', Object.keys(items[0]));
          // eslint-disable-next-line no-console
          console.log('[Billing] First item:', items[0]);
        } else if (items.length === 0) {
          console.warn('[Billing] No items returned from List3');
        }

        return items.map(mapToBillingOrder);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const status = (err as Record<string, unknown>)?.['status'];
        console.error('[Billing] Fetch error:', message);
        console.error('[Billing] Status:', status, 'URL:', billingBaseUrl + url);
        throw err;
      }
    },
  };
}
