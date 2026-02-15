/* eslint-disable no-console */
import process from 'node:process';

const REQUIRED_ENV = ['SP_TENANT_ID', 'SP_CLIENT_ID', 'SP_CLIENT_SECRET', 'SP_SITE_URL'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[contract-nightly] Missing env: ${key}`);
    process.exit(2);
  }
}

const TENANT_ID = process.env.SP_TENANT_ID;
const CLIENT_ID = process.env.SP_CLIENT_ID;
const CLIENT_SECRET = process.env.SP_CLIENT_SECRET;
const SITE_URL = process.env.SP_SITE_URL.replace(/\/$/, '');

const REQUIRED_FIELDS = ['Title', 'EventDate', 'EndDate', 'Category', 'Location'];
const REQUIRED_CHOICES = ['User', 'Staff', 'Org', 'Facility', 'Other'];

const summarizeMissing = ({ missingFields, missingChoices }) => {
  const parts = [];
  if (missingFields.length) parts.push(`missingFields=${missingFields.join(', ')}`);
  if (missingChoices.length) parts.push(`missingChoices=${missingChoices.join(', ')}`);
  return parts.join(' | ') || 'OK';
};

const getAccessToken = async () => {
  const tokenUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
  const scope = `${new URL(SITE_URL).origin}/.default`;

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: 'client_credentials',
    scope,
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`token request failed: ${res.status} ${res.statusText}\n${text}`);
  }

  const json = await res.json();
  return json.access_token;
};

const fetchFieldsMeta = async (accessToken, listTitle = 'ScheduleEvents') => {
  const resolvedListTitle =
    process.env.VITE_SCHEDULES_LIST_TITLE ||
    process.env.VITE_SP_LIST_SCHEDULES ||
    listTitle;

  const url =
    `${SITE_URL}/_api/web/lists/GetByTitle('${encodeURIComponent(resolvedListTitle)}')/fields` +
    '?$select=InternalName,Title,TypeAsString,Choices&$top=5000';

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json;odata=nometadata',
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`fields fetch failed: ${res.status} ${res.statusText}\n${text}`);
  }

  const json = await res.json();
  const rows = json.value ?? [];
  return { resolvedListTitle, rows };
};

const validateContract = (fieldsMetaRows) => {
  const internalNames = new Set(fieldsMetaRows.map((field) => field.InternalName).filter(Boolean));
  const missingFields = REQUIRED_FIELDS.filter((field) => !internalNames.has(field));

  const categoryField =
    fieldsMetaRows.find((field) => field.InternalName === 'Category') ??
    fieldsMetaRows.find((field) => field.Title === 'Category');

  const choices = Array.isArray(categoryField?.Choices) ? categoryField.Choices : [];
  const choiceSet = new Set(choices);
  const missingChoices = REQUIRED_CHOICES.filter((choice) => !choiceSet.has(choice));

  return { missingFields, missingChoices };
};

const main = async () => {
  console.log('[contract-nightly] start');
  console.log(`[contract-nightly] site=${SITE_URL}`);

  const token = await getAccessToken();
  const { resolvedListTitle, rows } = await fetchFieldsMeta(token);

  console.log(`[contract-nightly] list=${resolvedListTitle}`);
  console.log(`[contract-nightly] fields=${rows.length}`);

  const result = validateContract(rows);
  const summary = summarizeMissing(result);

  if (result.missingFields.length || result.missingChoices.length) {
    console.error(`[contract-nightly] CONTRACT_MISMATCH: ${summary}`);
    console.error(JSON.stringify({ list: resolvedListTitle, ...result }, null, 2));
    process.exit(1);
  }

  console.log(`[contract-nightly] OK: ${summary}`);
  process.exit(0);
};

main().catch((err) => {
  console.error('[contract-nightly] ERROR');
  console.error(err?.stack || String(err));
  process.exit(1);
});
