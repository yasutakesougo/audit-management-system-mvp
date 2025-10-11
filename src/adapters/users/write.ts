import { spWriteResilient, type SpWriteResult, type WithStatusError } from "../../lib/spWrite";

type FailedResult<T> = Extract<SpWriteResult<T>, { ok: false }>;

type CreateUserInput = {
  Title: string;
  Email?: string;
  StaffID?: string;
};
type UpdateUserInput = Partial<CreateUserInput>;

const SITE = "https://contoso.sharepoint.com/sites/wf/_api/web";
const USERS_LIST = "lists/getbytitle('Users')/items";
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

export async function createUser(input: CreateUserInput) {
  const result = await spWriteResilient({
    list: USERS_LIST,
    method: "POST",
    body: input,
    fetcher,
    urlBuilder: buildUsersUrl,
    retries: 1,
  });
  return assertOk(result);
}

export async function updateUser(id: number, input: UpdateUserInput, etag?: string) {
  const result = await spWriteResilient({
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

export async function deleteUser(id: number, etag: string = "*") {
  const result = await spWriteResilient({
    list: USERS_LIST,
    itemId: id,
    method: "DELETE",
    ifMatch: etag,
    fetcher,
    urlBuilder: buildUsersUrl,
    retries: 0,
  });
  return assertOk(result);
}
