import type { SpFetchFn } from '@/lib/sp/spLists';
import type { SpRequestInit } from '@/lib/sp/types';

type LooseSpResponse = {
  ok?: boolean;
  status?: number;
  statusText?: string;
  headers?: HeadersInit;
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
};

function isLooseSpResponse(value: unknown): value is LooseSpResponse {
  return typeof value === 'object' && value !== null;
}

async function toResponse(result: unknown): Promise<Response> {
  if (result instanceof Response) return result;
  if (!isLooseSpResponse(result)) {
    throw new Error('SharePoint test fetch returned a value that is not a Response');
  }
  const status = result.status ?? (result.ok === false ? 500 : 200);
  const statusText = result.statusText ?? '';
  const headers = new Headers(result.headers);
  if (result.text) {
    return new Response(await result.text(), { status, statusText, headers });
  }
  if (!result.json || status === 204 || status === 205) {
    return new Response(null, { status, statusText, headers });
  }
  try {
    const payload = await result.json();
    if (payload === undefined) return new Response(null, { status, statusText, headers });
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    return new Response(JSON.stringify(payload), { status, statusText, headers });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return new Response('not-json', { status, statusText, headers });
    }
    throw error;
  }
}

/**
 * Adapts a test fetch double that returns a partial response object
 * to the SpFetchFn contract, which requires a real Response.
 * Call inspection stays on the original mock.
 */
export function asSpFetch(
  fetchMock: (path: string, init?: SpRequestInit) => Promise<unknown>,
): SpFetchFn {
  return async (path, init) => toResponse(await fetchMock(path, init));
}
