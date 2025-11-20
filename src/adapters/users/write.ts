import { readOptionalEnv } from '@/lib/env';
import { spWriteResilient, type SpWriteResult, type WithStatusError } from "../../lib/spWrite";

type FailedResult<T> = Extract<SpWriteResult<T>, { ok: false }>;

type CreateUserInput = {
  Title: string;
  Email?: string;
  StaffID?: string;
};
type UpdateUserInput = Partial<CreateUserInput>;

/**
 * SharePoint user item structure returned from REST API
 */
export type UserItem = {
  Id: number;
  Title: string;
  Email?: string;
  StaffID?: string;
  Created: string;
  Modified: string;
  [key: string]: unknown;
};

// Environment-driven site configuration
const SITE = `${readOptionalEnv('VITE_SP_SITE_URL') ?? 'https://contoso.sharepoint.com/sites/wf'}/_api/web`;
const USERS_LIST = "lists/getbytitle('Users')/items";

// TODO: Consider migrating to spClient integration for consistent auth handling
const fetcher = (path: string, init?: RequestInit) => fetch(path, init);

const buildUsersUrl = (_list: string, itemId?: number) =>
  typeof itemId === "number" ? `${SITE}/${USERS_LIST}(${itemId})` : `${SITE}/${USERS_LIST}`;

const isFailure = <T>(result: SpWriteResult<T>): result is FailedResult<T> => !result.ok;

function assertOk<T>(result: SpWriteResult<T>): T {
  if (isFailure(result)) {
    const status = result.status ?? result.error.status;
    const error: WithStatusError = Object.assign(
      result.error ?? new Error(`Write failed${status ? ` (${status})` : ""}`),
      {
        status,
        code: result.error.code ?? (status ? String(status) : undefined),
        response: result.raw,
      },
    );
    throw error;
  }

  return result.data as T;
}

/**
 * Create a new user in SharePoint Users list.
 * @param input User data to create
 * @returns Created user item with SharePoint metadata
 */
export async function createUser(input: CreateUserInput): Promise<UserItem> {
  const result = await spWriteResilient<UserItem>({
    list: USERS_LIST,
    method: "POST",
    body: input,
    fetcher,
    urlBuilder: buildUsersUrl,
    retries: 1,
  });
  return assertOk(result);
}

/**
 * Update an existing user in SharePoint Users list.
 * @param id SharePoint item ID
 * @param input Partial user data to update
 * @param etag Optional ETag for optimistic concurrency
 * @returns Updated user item with SharePoint metadata
 */
export async function updateUser(id: number, input: UpdateUserInput, etag?: string): Promise<UserItem> {
  const result = await spWriteResilient<UserItem>({
    list: USERS_LIST,
    itemId: id,
    method: "PATCH",
    body: input,
    ifMatch: etag,
    fetcher,
    urlBuilder: buildUsersUrl,
    retries: 1,
  });
  return assertOk(result);
}

/**
 * Delete a user from SharePoint Users list.
 * @param id SharePoint item ID
 * @param etag ETag for optimistic concurrency (defaults to "*" for force delete)
 */
export async function deleteUser(id: number, etag: string = "*"): Promise<void> {
  const result = await spWriteResilient<void>({
    list: USERS_LIST,
    itemId: id,
    method: "DELETE",
    ifMatch: etag,
    fetcher,
    urlBuilder: buildUsersUrl,
    retries: 0, // No retries for DELETE to avoid accidental double deletion
  });
  return assertOk(result);
}

/**
 * Factory function for creating Users adapter with custom spFetch.
 * Useful for dependency injection and testing with authenticated clients.
 *
 * @example
 * ```typescript
 * const sp = useSP();
 * const usersApi = createUsersClient(sp.spFetch);
 * const newUser = await usersApi.createUser({ Title: 'John Doe' });
 * ```
 */
export function createUsersClient(spFetch: typeof fetch) {
  const clientFetcher = (path: string, init?: RequestInit) => spFetch(path, init);

  return {
    async createUser(input: CreateUserInput): Promise<UserItem> {
      const result = await spWriteResilient<UserItem>({
        list: USERS_LIST,
        method: "POST",
        body: input,
        fetcher: clientFetcher,
        urlBuilder: buildUsersUrl,
        retries: 1,
      });
      return assertOk(result);
    },

    async updateUser(id: number, input: UpdateUserInput, etag?: string): Promise<UserItem> {
      const result = await spWriteResilient<UserItem>({
        list: USERS_LIST,
        itemId: id,
        method: "PATCH",
        body: input,
        ifMatch: etag,
        fetcher: clientFetcher,
        urlBuilder: buildUsersUrl,
        retries: 1,
      });
      return assertOk(result);
    },

    async deleteUser(id: number, etag: string = "*"): Promise<void> {
      const result = await spWriteResilient<void>({
        list: USERS_LIST,
        itemId: id,
        method: "DELETE",
        ifMatch: etag,
        fetcher: clientFetcher,
        urlBuilder: buildUsersUrl,
        retries: 0,
      });
      return assertOk(result);
    },
  };
}
