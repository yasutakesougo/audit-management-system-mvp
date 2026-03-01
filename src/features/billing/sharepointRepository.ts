import { acquireSpAccessToken } from '@/lib/msal';
import { createSpClient, ensureConfig } from '@/lib/spClient';
import {
    BILLING_ORDERS_LIST_ID,
    FIELD_MAP_BILLING_ORDERS as F,
} from '@/sharepoint/fields';
import type { BillingOrderRepository } from './repository';
import type { BillingOrder } from './types';

type SpItem = Record<string, unknown>;

const asString = (v: unknown): string =>
  typeof v === 'string' ? v : String(v ?? '');

const asNumber = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function mapItem(item: SpItem): BillingOrder {
  return {
    id: asNumber(item[F.id] ?? item['Id'] ?? item['ID']),
    orderDate: asString(item[F.orderDate] ?? item['Title'] ?? ''),
    ordererCode: asString(item[F.ordererCode] ?? ''),
    ordererName: asString(item[F.ordererName] ?? ''),
    orderCount: asNumber(item[F.orderCount] ?? 0),
    served: asString(item[F.served] ?? ''),
    item: asString(item[F.item] ?? ''),
    sugar: asString(item[F.sugar] ?? ''),
    milk: asString(item[F.milk] ?? ''),
    drinkPrice: asNumber(item[F.drinkPrice] ?? 0),
  };
}

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

      console.log('[Billing] fetching via spClient:', billingBaseUrl + url);
      try {
        const res = await sp.spFetch(url, { method: 'GET' });
        const json = (await res.json().catch(() => ({ value: [] }))) as { value?: SpItem[] };
        const items = json.value ?? [];

        if (items.length > 0) {
          console.log('[Billing] Sample item keys:', Object.keys(items[0]));
          console.log('[Billing] First item:', items[0]);
        } else {
          console.warn('[Billing] No items returned from List3');
        }

        return items.map(mapItem);
      } catch (err: any) {
        console.error('[Billing] Fetch error:', err?.message ?? err);
        console.error('[Billing] Status:', err?.status, 'URL:', billingBaseUrl + url);
        throw err;
      }
    },
  };
}
