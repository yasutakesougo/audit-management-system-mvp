import { createSpClient } from "../../../lib/spClient";
import { ensureConfig } from "../../../lib/spClient";

export type SpUser = { id?: number; title?: string; email?: string };

export type SpListInfo = {
  id: string;
  title: string;
};

export type SpFieldInfo = {
  internalName: string;
  typeAsString?: string;
};

export type SpAdapter = {
  // Auth-ish probe
  getCurrentUser: () => Promise<SpUser>;

  // Site probe
  getWebTitle: () => Promise<string>;

  // Lists/schema
  getListByTitle: (listTitle: string) => Promise<SpListInfo>;
  getFields: (listTitle: string) => Promise<SpFieldInfo[]>;

  // CRUD
  getItemsTop1: (listTitle: string) => Promise<unknown[]>;
  createItem: (listTitle: string, body: Record<string, unknown>) => Promise<{ id: number }>;
  updateItem: (listTitle: string, id: number, body: Record<string, unknown>) => Promise<void>;
  deleteItem: (listTitle: string, id: number) => Promise<void>;
};

/**
 * Factory to create SpAdapter backed by your repo's spClient.ts
 * ✅ Uses createSpClient from src/lib/spClient.ts directly
 * ✅ All SharePoint calls are MSAL token-aware
 */
export function createSpAdapterWithAuth(acquireToken: () => Promise<string | null>): SpAdapter {
  const { baseUrl } = ensureConfig();
  const client = createSpClient(acquireToken, baseUrl);

  // Helper to call SharePoint API with proper error handling
  const callSp = async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof Error) throw e;
      throw new Error(String(e));
    }
  };

  return {
    async getCurrentUser() {
      // ✅ SharePoint 標準 /web/currentuser を使用（業務リストとは切り離す）
      const res = await callSp(() =>
        client.spFetch("/web/currentuser?$select=Id,Title,Email")
      );
      const json = (await res.json()) as Record<string, number | string | undefined>;
      return {
        id: typeof json.Id === "number" ? json.Id : undefined,
        title: typeof json.Title === "string" ? json.Title : undefined,
        email: typeof json.Email === "string" ? json.Email : undefined,
      };
    },

    async getWebTitle() {
      // Use spFetch to GET /web with Title select
      const res = await callSp(() =>
        client.spFetch("/web?$select=Title")
      );
      const json = (await res.json()) as Record<string, string | undefined>;
      return typeof json.Title === "string" ? json.Title : "(untitled)";
    },

    async getListByTitle(listTitle: string) {
      // Query list metadata via spFetch
      const res = await callSp(() =>
        client.spFetch(
          `/web/lists/GetByTitle('${encodeURIComponent(listTitle)}')?$select=Id,Title`
        )
      );
      const json = (await res.json()) as Record<string, string>;
      return {
        id: typeof json.Id === "string" ? json.Id : "",
        title: typeof json.Title === "string" ? json.Title : listTitle,
      };
    },

    async getFields(listTitle: string) {
      // Query fields via spFetch
      const res = await callSp(() =>
        client.spFetch(
          `/web/lists/GetByTitle('${encodeURIComponent(listTitle)}')/fields?$select=InternalName,TypeAsString`
        )
      );
      const data = (await res.json()) as Record<string, unknown>;
      const fieldArray = Array.isArray(data?.value) ? (data.value as Array<Record<string, unknown>>) : [];
      return fieldArray.map((f) => ({
        internalName: typeof f.InternalName === "string" ? f.InternalName : "",
        typeAsString: typeof f.TypeAsString === "string" ? f.TypeAsString : undefined,
      }));
    },

    async getItemsTop1(listTitle: string) {
      const items = await callSp(() =>
        client.listItems(listTitle, { top: 1 })
      );
      return items ?? [];
    },

    async createItem(listTitle: string, body: Record<string, unknown>) {
      const result = await callSp(() =>
        client.createItem(listTitle, body)
      );
      const id = typeof result === "object" && result !== null && "Id" in result
        ? (result as Record<string, unknown>).Id
        : typeof result === "object" && result !== null && "id" in result
        ? (result as Record<string, unknown>).id
        : undefined;
      if (!id) throw new Error(`CreateItem response missing Id: ${JSON.stringify(result)}`);
      return { id: Number(id) };
    },

    async updateItem(listTitle: string, id: number, body: Record<string, unknown>) {
      await callSp(() => client.updateItem(listTitle, id, body));
    },

    async deleteItem(listTitle: string, id: number) {
      await callSp(() => client.deleteItem(listTitle, id));
    },
  };
}
