import { acquireSpAccessToken } from '@/lib/msal';
import { createSpClient, ensureConfig } from '@/lib/spClient';
import { BILLING_ORDERS_LIST_ID, BILLING_ORDERS_CANDIDATES } from '@/sharepoint/fields';
import type { BillingOrderRepository } from './repository';
import { resolveInternalNamesDetailed } from '@/lib/sp/helpers';
import { isDev } from '@/env';
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
      // 1. 動的な列名解決
      try {
        const schemaUrl = `/lists/GetById('${listId}')/fields?$select=InternalName`;
        const schemaRes = await sp.spFetch(schemaUrl, { method: 'GET' });
        const schemaJson = await schemaRes.json();
        const availableFields = new Set<string>((schemaJson.value || []).map((f: { InternalName: string }) => f.InternalName));

        const { resolved } = resolveInternalNamesDetailed(
          availableFields,
          BILLING_ORDERS_CANDIDATES as unknown as Record<string, string[]>
        );
        const mapping = resolved as Record<string, string | undefined>;

        // 2. クエリの構築 (ドリフトした列名を反映)
        const selectFields = Object.values(mapping).filter(Boolean).join(',');
        const query = selectFields ? `&$select=${selectFields}` : '';
        const url = `/lists/GetById('${listId}')/items?$top=500${query}`;

        if (isDev) {
          // eslint-disable-next-line no-console
          console.log('[Billing] fetching via spClient:', billingBaseUrl + url);
        }

        const res = await sp.spFetch(url, { method: 'GET' });
        const json = (await res.json().catch(() => ({ value: [] }))) as { value?: Record<string, unknown>[] };
        const items = json.value ?? [];

        if (import.meta.env.DEV && items.length > 0) {
          // eslint-disable-next-line no-console
          console.log('[Billing] Sample item keys:', Object.keys(items[0]));
        }

        // 3. マッピング
        return items.map(item => mapToBillingOrder(item, mapping));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[Billing] Fetch error:', message);
        throw err;
      }
    },
  };
}
