/* eslint-disable no-console, no-undef, no-restricted-globals */
/**
 * LIVE-SCHEMA-GATE-V1 — browser console GET-only fields inventory.
 *
 * Usage (on https://isogokatudouhome.sharepoint.com/sites/welfare):
 *   1. Open the site while signed in
 *   2. F12 → Console
 *   3. Paste this file and press Enter
 *   4. Copy the printed JSON
 *   5. node scripts/ops/live-schema-gate-inventory.mjs --mode file --input dump.json
 *
 * HTTP: GET only. No item writes. No field creates.
 */
(async () => {
  const siteUrl = (typeof _spPageContextInfo !== 'undefined' && _spPageContextInfo.webAbsoluteUrl)
    || 'https://isogokatudouhome.sharepoint.com/sites/welfare';
  const titles = ['SupportRecord_Daily', 'DailyRecordRows'];
  const select = 'InternalName,Title,TypeAsString,Indexed,EnforceUniqueValues,Hidden,ReadOnlyField';
  const headers = {
    Accept: 'application/json;odata=nometadata',
  };

  async function getJson(endpoint) {
    const res = await fetch(`${siteUrl}/_api/${endpoint}`, { method: 'GET', headers });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    return { ok: res.ok, status: res.status, json, text };
  }

  const lists = {};
  for (const title of titles) {
    const encoded = title.replace(/'/g, "''");
    const { ok, status, json, text } = await getJson(
      `web/lists/getbytitle('${encoded}')/fields?$select=${select}&$top=5000`,
    );
    if (status === 404) {
      lists[title] = { found: false, uniqueConstraintReadable: true, fields: [], error: `HTTP 404` };
      continue;
    }
    if (!ok) {
      lists[title] = {
        found: null,
        uniqueConstraintReadable: true,
        fields: null,
        error: `HTTP ${status}: ${String(text).slice(0, 300)}`,
      };
      continue;
    }
    lists[title] = {
      found: true,
      uniqueConstraintReadable: true,
      fields: (json.value || []).map((field) => ({
        InternalName: field.InternalName,
        Title: field.Title,
        TypeAsString: field.TypeAsString,
        Indexed: field.Indexed,
        EnforceUniqueValues: field.EnforceUniqueValues,
        Hidden: field.Hidden,
        ReadOnlyField: field.ReadOnlyField,
      })),
      error: null,
    };
  }

  const dump = {
    schemaVersion: 1,
    id: 'LIVE-SCHEMA-GATE-V1',
    mode: 'browser-rest',
    siteUrl,
    httpMethods: ['GET'],
    mutation: false,
    deploy: 'NOT_AUTHORIZED',
    generatedAt: new Date().toISOString(),
    lists,
  };

  console.log('%c[LIVE-SCHEMA-GATE-V1] Copy the JSON below', 'color: cyan');
  console.log(JSON.stringify(dump, null, 2));
  return dump;
})();
