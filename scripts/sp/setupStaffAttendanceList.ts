import { execFileSync } from 'node:child_process';

const SITE_URL = process.env.SITE_URL?.trim() ?? '';
const LIST_TITLE = process.env.LIST_TITLE?.trim() || 'StaffAttendance';
const DRY_RUN = parseBoolean(process.env.DRY_RUN ?? '1');

if (!SITE_URL) {
  console.error('[sp-setup] SITE_URL is required. Example: https://contoso.sharepoint.com/sites/app-test');
  process.exit(1);
}

const siteOrigin = (() => {
  try {
    return new URL(SITE_URL).origin;
  } catch {
    return '';
  }
})();

if (!siteOrigin) {
  console.error(`[sp-setup] Invalid SITE_URL: ${SITE_URL}`);
  process.exit(1);
}

const MAIN_HEADERS = {
  Accept: 'application/json;odata=verbose',
};

const run = async () => {
  const token = await resolveToken(siteOrigin);
  const listExists = await checkListExists(token, LIST_TITLE);

  if (listExists) {
    console.log(`[sp-setup] ✅ List exists: ${LIST_TITLE}`);
    return;
  }

  if (DRY_RUN) {
    console.log(`[sp-setup] 📝 DRY_RUN: List missing → would create list "${LIST_TITLE}"`);
    return;
  }

  console.log(`[sp-setup] 🛠️ Creating list: ${LIST_TITLE}`);
  const digest = await getRequestDigest(token);
  await createList(token, digest, LIST_TITLE);
  console.log(`[sp-setup] ✅ List created: ${LIST_TITLE}`);
};

async function resolveToken(origin: string): Promise<string> {
  const envToken = process.env.SP_TOKEN?.trim();
  if (envToken) return envToken;

  try {
    const token = execFileSync('az', [
      'account',
      'get-access-token',
      '--resource',
      origin,
      '--query',
      'accessToken',
      '-o',
      'tsv',
    ], { encoding: 'utf-8' }).trim();

    if (!token) {
      throw new Error('Empty token from az');
    }
    return token;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[sp-setup] SP_TOKEN not set and failed to read token via az CLI.');
    console.error(`[sp-setup] Error: ${message}`);
    console.error('[sp-setup] Provide SP_TOKEN env or login with az and retry.');
    process.exit(1);
  }
}

async function checkListExists(token: string, listTitle: string): Promise<boolean> {
  const encodedTitle = encodeURIComponent(listTitle);
  const res = await spFetch(`/web/lists/getbytitle('${encodedTitle}')?$select=Title,Id`, token, { method: 'GET' });
  if (res.ok) return true;
  if (res.status === 404) return false;

  const text = await res.text().catch(() => '');
  throw new Error(`[sp-setup] Failed to check list. status=${res.status} ${text}`);
}

async function getRequestDigest(token: string): Promise<string> {
  const res = await spFetch('/contextinfo', token, { method: 'POST' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[sp-setup] Failed to get request digest. status=${res.status} ${text}`);
  }
  const json = (await res.json()) as { d?: { GetContextWebInformation?: { FormDigestValue?: string } } };
  const digest = json?.d?.GetContextWebInformation?.FormDigestValue;
  if (!digest) {
    throw new Error('[sp-setup] Missing FormDigestValue in contextinfo response.');
  }
  return digest;
}

async function createList(token: string, digest: string, listTitle: string): Promise<void> {
  const body = {
    __metadata: { type: 'SP.List' },
    BaseTemplate: 100,
    Title: listTitle,
    Description: 'Staff attendance list (auto-provisioned)',
  };

  const res = await spFetch('/web/lists', token, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;odata=verbose',
      'X-RequestDigest': digest,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[sp-setup] Failed to create list. status=${res.status} ${text}`);
  }
}

async function spFetch(path: string, token: string, init: RequestInit): Promise<Response> {
  const url = `${SITE_URL}/_api${path}`;
  const headers = {
    ...MAIN_HEADERS,
    Authorization: `Bearer ${token}`,
    ...(init.headers ?? {}),
  };

  return fetch(url, { ...init, headers });
}

function parseBoolean(input: string): boolean {
  const value = input.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'y';
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
