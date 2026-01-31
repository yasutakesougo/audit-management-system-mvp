import { execFileSync } from 'node:child_process';

type FieldType = 'Text' | 'Note' | 'Choice' | 'DateTime' | 'Number';

type FieldDef = {
  internalName: string;
  displayName: string;
  type: FieldType;
  required?: boolean;
  choices?: string[];
  format?: 'DateOnly' | 'DateTime';
  addToDefaultView?: boolean;
};

type ExistingField = {
  InternalName?: string;
  Title?: string;
  TypeAsString?: string;
  Hidden?: boolean;
  ReadOnlyField?: boolean;
};

const SITE_URL = process.env.SITE_URL?.trim() ?? '';
const LIST_TITLE = process.env.LIST_TITLE?.trim() || 'Staff_Attendance';
const DRY_RUN = parseBoolean(process.env.DRY_RUN ?? '1');

const FIELD_DEFS: FieldDef[] = [
  { internalName: 'Title', displayName: 'Title', type: 'Text', required: true },
  { internalName: 'StaffId', displayName: 'StaffId', type: 'Text', required: true },
  { internalName: 'RecordDate', displayName: 'RecordDate', type: 'DateTime', required: true, format: 'DateOnly' },
  { internalName: 'Status', displayName: 'Status', type: 'Choice', required: true, choices: ['出勤', '欠勤', '外出中'] },
  { internalName: 'CheckInAt', displayName: 'CheckInAt', type: 'DateTime', format: 'DateTime' },
  { internalName: 'CheckOutAt', displayName: 'CheckOutAt', type: 'DateTime', format: 'DateTime' },
  { internalName: 'LateMinutes', displayName: 'LateMinutes', type: 'Number' },
  { internalName: 'Note', displayName: 'Note', type: 'Note' },
];

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

  if (!listExists) {
    if (DRY_RUN) {
      console.log(`[sp-setup] 📝 DRY_RUN: List missing → would create list "${LIST_TITLE}"`);
      return;
    }

    console.log(`[sp-setup] 🛠️ Creating list: ${LIST_TITLE}`);
    const digest = await getRequestDigest(token);
    await createList(token, digest, LIST_TITLE);
    console.log(`[sp-setup] ✅ List created: ${LIST_TITLE}`);
  } else {
    console.log(`[sp-setup] ✅ List exists: ${LIST_TITLE}`);
  }

  await ensureFields(token, LIST_TITLE, FIELD_DEFS, { dryRun: DRY_RUN });
};

async function resolveToken(origin: string): Promise<string> {
  const envToken = process.env.SP_TOKEN?.trim();
  if (envToken) return envToken;

  try {
    const token = execFileSync(
      'az',
      ['account', 'get-access-token', '--resource', origin, '--query', 'accessToken', '-o', 'tsv'],
      { encoding: 'utf-8' }
    ).trim();

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

async function ensureFields(
  token: string,
  listTitle: string,
  defs: FieldDef[],
  options: { dryRun: boolean }
): Promise<void> {
  const existing = await fetchExistingFields(token, listTitle);
  const missing: FieldDef[] = [];

  for (const def of defs) {
    const current = existing.get(def.internalName);
    if (!current) {
      missing.push(def);
      continue;
    }

    if (!isCompatibleType(def, current)) {
      const actual = current.TypeAsString ?? 'unknown';
      console.warn(`[sp-setup] ⚠️ Field type mismatch: ${def.internalName} (expected=${def.type}, actual=${actual}). Skipping.`);
    }
  }

  if (!missing.length) {
    console.log('[sp-setup] ✅ All fields already exist.');
    return;
  }

  if (options.dryRun) {
    console.log('[sp-setup] 📝 DRY_RUN: Missing fields → would add:');
    for (const def of missing) {
      console.log(`  - ${def.internalName} (${def.type})`);
    }
    return;
  }

  const digest = await getRequestDigest(token);
  for (const def of missing) {
    console.log(`[sp-setup] ➕ Adding field: ${def.internalName} (${def.type})`);
    await createField(token, digest, listTitle, def);
  }
  console.log('[sp-setup] ✅ Missing fields added.');
}

async function fetchExistingFields(token: string, listTitle: string): Promise<Map<string, ExistingField>> {
  const encodedTitle = encodeURIComponent(listTitle);
  const res = await spFetch(
    `/web/lists/getbytitle('${encodedTitle}')/fields?$select=InternalName,Title,TypeAsString,Hidden,ReadOnlyField`,
    token,
    { method: 'GET' }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[sp-setup] Failed to read fields. status=${res.status} ${text}`);
  }

  const json = (await res.json()) as { d?: { results?: ExistingField[] } };
  const fields = json?.d?.results ?? [];
  const map = new Map<string, ExistingField>();

  for (const field of fields) {
    if (!field.InternalName) continue;
    if (field.Hidden) continue;
    if (field.ReadOnlyField) continue;
    map.set(field.InternalName, field);
  }

  return map;
}

async function createField(token: string, digest: string, listTitle: string, def: FieldDef): Promise<void> {
  const encodedTitle = encodeURIComponent(listTitle);
  const schema = buildFieldSchema(def);
  const body = {
    parameters: {
      SchemaXml: schema,
      AddToDefaultView: def.addToDefaultView ?? false,
    },
  };

  const res = await spFetch(`/web/lists/getbytitle('${encodedTitle}')/fields/createfieldasxml`, token, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;odata=verbose',
      'X-RequestDigest': digest,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[sp-setup] Failed to add field ${def.internalName}. status=${res.status} ${text}`);
  }
}

function isCompatibleType(def: FieldDef, existing: ExistingField): boolean {
  const actual = (existing.TypeAsString ?? '').toLowerCase();
  const expected = def.type.toLowerCase();
  if (!actual) return false;
  if (actual === expected) return true;
  if (expected === 'text' && actual === 'string') return true;
  return false;
}

function buildFieldSchema(def: FieldDef): string {
  const required = def.required ? ' Required="TRUE"' : '';
  const base = `Name="${def.internalName}" DisplayName="${def.displayName}" Type="${def.type}"${required}`;

  if (def.type === 'Choice') {
    const choices = (def.choices ?? []).map((choice) => `<CHOICE>${escapeXml(choice)}</CHOICE>`).join('');
    return `<Field ${base} Format="Dropdown"><CHOICES>${choices}</CHOICES></Field>`;
  }

  if (def.type === 'DateTime') {
    const format = def.format ?? 'DateTime';
    return `<Field ${base} Format="${format}" />`;
  }

  if (def.type === 'Note') {
    return `<Field ${base} NumLines="6" RichText="FALSE" />`;
  }

  return `<Field ${base} />`;
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (ch) => {
    switch (ch) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case '"':
        return '&quot;';
      case "'":
        return '&apos;';
      default:
        return ch;
    }
  });
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
