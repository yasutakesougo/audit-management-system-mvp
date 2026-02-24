import { z } from 'zod';
import { icebergSnapshotSchema, type IcebergSnapshot } from '../domain/icebergTypes';
import { createSpClient } from '@/lib/spClient';
import { getAppConfig } from '@/lib/env';

// ===== Error Classes =====

/** Conflict status code (412 Precondition Failed) - ETag mismatch */
export class ConflictError extends Error {
  constructor(message = 'Conflict: ETag mismatch (412)') {
    super(message);
    this.name = 'ConflictError';
  }
}

export class SharePointListNotFoundError extends Error {
  constructor(message = 'List not found') {
    super(message);
    this.name = 'SharePointListNotFoundError';
  }
}

// ===== Constants & Field Names =====

const LIST_TITLE = 'Iceberg_Analysis';

/** Map SharePoint field names (avoid internal name leak) */
const F = {
  entryHash: 'EntryHash',
  sessionId: 'SessionId',
  userId: 'UserId',
  payloadJson: 'PayloadJson',
  schemaVersion: 'SchemaVersion',
  updatedAt: 'UpdatedAt',
} as const;

// ===== Types =====

type SharePointItem = {
  Id?: number;
  Title?: string;
  EntryHash?: string;
  SessionId?: string;
  UserId?: string;
  PayloadJson?: string;
  SchemaVersion?: number;
  UpdatedAt?: string;
};

export type UpsertResult = {
  itemId: number;
  etag?: string;
};

// ===== Utilities =====

function toPayloadJson(snapshot: IcebergSnapshot): string {
  // Domain層で正規化してから JSON 化（余計な値を落とせる）
  const validated = icebergSnapshotSchema.parse(snapshot);
  return JSON.stringify(validated);
}

function fromPayloadJson(payloadJson: string): IcebergSnapshot {
  const parsed = JSON.parse(payloadJson);
  return icebergSnapshotSchema.parse(parsed);
}

// ===== HTTP Helper =====

async function raiseHttpError(response: Response, _context: { url: string; method: string }): Promise<never> {
  const body = await response.text().catch(() => '(no body)');
  let msg = `SharePoint API error: ${response.status} ${response.statusText}`;
  try {
    const json = JSON.parse(body);
    const oDataMsg = json['odata.error']?.message?.value || json?.error?.message;
    if (oDataMsg) msg += ` - ${oDataMsg}`;
  } catch {
    // ignore parse error
  }
  const err = new Error(msg);
  (err as unknown as Record<string, unknown>).status = response.status;
  throw err;
}

// ===== Repository =====

export async function createIcebergRepository(acquireToken: () => Promise<string | null>, baseUrl: string) {
  const config = getAppConfig();
  const debugEnabled = config.VITE_AUDIT_DEBUG === '1' || config.VITE_AUDIT_DEBUG === 'true';
  const dbg = (...args: unknown[]) => {
    if (debugEnabled) console.debug('[IcebergRepository]', ...args);
  };

  // spClient による spFetch 取得
  const client = createSpClient(acquireToken, baseUrl);

  /**
   * List items 取得（OData クエリ）
   */
  async function getListItems(query: string): Promise<SharePointItem[]> {
    const url = `/${LIST_TITLE}/items?${query}`;
    dbg('[getListItems]', { url });

    const res = await client.spFetch(url);
    if (!res.ok) {
      await raiseHttpError(res, { url, method: 'GET' });
    }

    const json = (await res.json()) as unknown;
    const listResponseSchema = z.object({
      value: z.array(z.record(z.string(), z.unknown())).optional(),
    });
    const parsed = listResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error('SharePoint response structure changed (list items).');
    }

    return (parsed.data.value ?? []) as SharePointItem[];
  }

  /**
   * List item 作成
   */
  async function postListItem(body: Record<string, unknown>): Promise<SharePointItem> {
    const url = `/${LIST_TITLE}/items`;
    dbg('[postListItem]', { url, keys: Object.keys(body) });

    const res = await client.spFetch(url, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      await raiseHttpError(res, { url, method: 'POST' });
    }

    const json = await res.json();
    return json as SharePointItem;
  }

  /**
   * List item 更新（MERGE + If-Match）
   */
  async function patchListItem(
    id: number,
    body: Record<string, unknown>,
    etag?: string
  ): Promise<void> {
    const url = `/${LIST_TITLE}/items(${id})`;
    dbg('[patchListItem]', { url, etag: etag ? 'present' : 'absent' });

    const headers: Record<string, string> = {
      'If-Match': etag ?? '*',
    };

    const res = await client.spFetch(url, {
      method: 'MERGE',
      body: JSON.stringify(body),
      headers,
    });

    // 412 は ConflictError として特別扱い
    if (res.status === 412) {
      throw new ConflictError();
    }

    if (!res.ok) {
      await raiseHttpError(res, { url, method: 'MERGE' });
    }
  }

  return {
    /**
     * 冪等 upsert: entryHash をキーに新規作成 or 既存更新
     */
    async upsertSnapshot(params: {
      entryHash: string;
      snapshot: IcebergSnapshot;
      etag?: string;
    }): Promise<UpsertResult> {
      const { entryHash, snapshot, etag } = params;

      // Domain検問
      const validated = icebergSnapshotSchema.parse(snapshot);
      const payloadJson = toPayloadJson(validated);

      dbg('[upsertSnapshot] start', { entryHash, sessionId: validated.sessionId });

      // 既存確認
      const existingItems = await getListItems(
        `$select=Id,${F.entryHash}` +
        `&$filter=${F.entryHash} eq '${encodeURIComponent(entryHash)}'` +
        `&$top=1`
      );

      const existing = existingItems[0];

      const body = {
        Title: validated.title ?? `Iceberg Session ${validated.sessionId}`,
        [F.entryHash]: entryHash,
        [F.sessionId]: validated.sessionId,
        [F.userId]: validated.userId,
        [F.payloadJson]: payloadJson,
        [F.schemaVersion]: validated.schemaVersion,
        [F.updatedAt]: validated.updatedAt,
      };

      try {
        if (!existing) {
          // 新規作成
          dbg('[upsertSnapshot] creating new item');
          const created = await postListItem(body);
          const itemId = created.Id;
          if (!itemId) {
            throw new Error('SharePoint did not return Item ID');
          }
          dbg('[upsertSnapshot] created itemId=', itemId);
          return { itemId };
        }

        // 既存更新
        dbg('[upsertSnapshot] updating existing itemId=', existing.Id);
        await patchListItem(existing.Id!, body, etag);
        return { itemId: existing.Id! };
      } catch (e: unknown) {
        // 412 is already ConflictError from patchListItem
        if (e instanceof ConflictError) {
          dbg('[upsertSnapshot] conflict detected');
          throw e;
        }
        const err = e as Record<string, unknown> | { message?: string };
        dbg('[upsertSnapshot] error', err?.message ?? e);
        throw e;
      }
    },

    /**
     * ユーザーの最新スナップショット取得
     */
    async getLatestByUser(userId: string): Promise<IcebergSnapshot | null> {
      dbg('[getLatestByUser]', { userId });

      const items = await getListItems(
        `$select=Id,${F.payloadJson},${F.userId},${F.updatedAt}` +
        `&$filter=${F.userId} eq '${encodeURIComponent(userId)}'` +
        `&$orderby=${F.updatedAt} desc` +
        `&$top=1`
      );

      const item = items[0];
      if (!item) {
        dbg('[getLatestByUser] no snapshot found');
        return null;
      }

      if (!item.PayloadJson) {
        throw new Error('SharePoint item missing PayloadJson field');
      }

      try {
        const snapshot = fromPayloadJson(item.PayloadJson);
        dbg('[getLatestByUser] loaded sessionId=', snapshot.sessionId);
        return snapshot;
      } catch (e) {
        dbg('[getLatestByUser] parse error', e);
        throw e;
      }
    },

    /**
     * Session 削除（任意：不要ならスキップ）
     */
    async deleteByEntryHash(entryHash: string): Promise<void> {
      dbg('[deleteByEntryHash]', { entryHash });

      const items = await getListItems(
        `$select=Id` +
        `&$filter=${F.entryHash} eq '${encodeURIComponent(entryHash)}'` +
        `&$top=1`
      );

      const item = items[0];
      if (!item || !item.Id) {
        dbg('[deleteByEntryHash] item not found');
        return;
      }

      const url = `/${LIST_TITLE}/items(${item.Id})`;
      const res = await client.spFetch(url, {
        method: 'DELETE',
        headers: { 'If-Match': '*' },
      });

      if (!res.ok) {
        await raiseHttpError(res, { url, method: 'DELETE' });
      }

      dbg('[deleteByEntryHash] deleted itemId=', item.Id);
    },
  };
}

export type IcebergRepository = Awaited<ReturnType<typeof createIcebergRepository>>;
