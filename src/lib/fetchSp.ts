import { acquireSpAccessToken, getSharePointScopes } from '@/lib/msal';

const DEFAULT_ACCEPT = 'application/json;odata=nometadata';
const SHAREPOINT_SCOPES = getSharePointScopes();

const applyHeaders = (init: RequestInit): RequestInit => {
  const headers = new Headers(init.headers ?? {});
  if (!headers.has('Accept')) {
    headers.set('Accept', DEFAULT_ACCEPT);
  }
  return { ...init, headers };
};

export const fetchSp = async (url: string, init: RequestInit = {}): Promise<Response> => {
  if (typeof window === 'undefined') {
    return fetch(url, init);
  }

  const scopes = SHAREPOINT_SCOPES.length ? SHAREPOINT_SCOPES : getSharePointScopes();
  try {
    const accessToken = await acquireSpAccessToken(scopes);
    const requestInit = applyHeaders(init);
    const headers = new Headers(requestInit.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);

    return fetch(url, { ...requestInit, headers });
  } catch (error) {
    console.error('[fetchSp] SharePoint request failed', error);
    throw error;
  }
};
