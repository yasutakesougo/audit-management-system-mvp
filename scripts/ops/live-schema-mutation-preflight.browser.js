/* eslint-disable no-console, no-undef, no-restricted-globals */
/**
 * LIVE-SCHEMA-MUTATION-V1 — browser console GET-only preflight.
 *
 * Usage (signed in on https://isogokatudouhome.sharepoint.com/sites/welfare):
 *   1. F12 → Console
 *   2. Paste this file and Enter
 *   3. Copy printed JSON
 *   4. node scripts/ops/live-schema-mutation-preflight.mjs --mode file --input dump.json
 *
 * HTTP: GET only. No field Add/Set. No item writes.
 * Reads list metadata, field schema, and Title/Id for duplicate counts only.
 */
(async () => {
  const siteUrl = (typeof _spPageContextInfo !== 'undefined' && _spPageContextInfo.webAbsoluteUrl)
    || 'https://isogokatudouhome.sharepoint.com/sites/welfare';
  const fieldSelect = 'InternalName,Title,TypeAsString,Indexed,EnforceUniqueValues,Hidden,ReadOnlyField';
  const headers = { Accept: 'application/json;odata=nometadata' };

  async function getJson(endpoint) {
    const res = await fetch(`${siteUrl}/_api/${endpoint}`, { method: 'GET', headers });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    return { ok: res.ok, status: res.status, json, text };
  }

  async function getAllItems(listTitle, select) {
    const encoded = listTitle.replace(/'/g, "''");
    const items = [];
    let next =
      `web/lists/getbytitle('${encoded}')/items?$select=${select}&$top=5000`;
    while (next) {
      const { ok, status, json, text } = await getJson(next.replace(/^\//, ''));
      if (!ok) {
        return { ok: false, status, items, error: `HTTP ${status}: ${String(text).slice(0, 300)}` };
      }
      items.push(...(json.value || []));
      const rawNext = json['odata.nextLink'] || json['@odata.nextLink'] || null;
      if (!rawNext) {
        next = null;
      } else {
        // nextLink is absolute; strip site/_api/ prefix for getJson helper
        const marker = '/_api/';
        const idx = rawNext.indexOf(marker);
        next = idx >= 0 ? rawNext.slice(idx + marker.length) : null;
        if (!next) break;
      }
    }
    return { ok: true, status: 200, items, error: null };
  }

  function summarizeTitles(items) {
    const counts = new Map();
    let nullOrBlank = 0;
    for (const item of items) {
      const raw = item.Title;
      if (raw == null || String(raw).trim() === '') {
        nullOrBlank += 1;
        continue;
      }
      const key = String(raw);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const duplicateGroups = [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([title, count]) => ({ title, count }))
      .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
    return {
      itemRowsRead: items.length,
      distinctTitleCount: counts.size,
      nullOrBlankTitleCount: nullOrBlank,
      duplicateGroupCount: duplicateGroups.length,
      // Cap reported groups to avoid huge dumps; full count is in duplicateGroupCount
      duplicateGroupsSample: duplicateGroups.slice(0, 50),
    };
  }

  const listTitles = ['SupportRecord_Daily', 'DailyRecordRows'];
  const lists = {};

  for (const title of listTitles) {
    const encoded = title.replace(/'/g, "''");
    const meta = await getJson(
      `web/lists/getbytitle('${encoded}')?$select=Title,ItemCount,Id`,
    );
    if (meta.status === 404) {
      lists[title] = {
        found: false,
        itemCount: null,
        fields: [],
        titleStats: null,
        error: 'HTTP 404',
      };
      continue;
    }
    if (!meta.ok) {
      lists[title] = {
        found: null,
        itemCount: null,
        fields: null,
        titleStats: null,
        error: `HTTP ${meta.status}: ${String(meta.text).slice(0, 300)}`,
      };
      continue;
    }

    const fieldsRes = await getJson(
      `web/lists/getbytitle('${encoded}')/fields?$select=${fieldSelect}&$top=5000`,
    );
    if (!fieldsRes.ok) {
      lists[title] = {
        found: true,
        itemCount: meta.json.ItemCount ?? null,
        listId: meta.json.Id ?? null,
        fields: null,
        titleStats: null,
        error: `fields HTTP ${fieldsRes.status}: ${String(fieldsRes.text).slice(0, 300)}`,
      };
      continue;
    }

    const fields = (fieldsRes.json.value || []).map((field) => ({
      InternalName: field.InternalName,
      Title: field.Title,
      TypeAsString: field.TypeAsString,
      Indexed: field.Indexed,
      EnforceUniqueValues: field.EnforceUniqueValues,
      Hidden: field.Hidden,
      ReadOnlyField: field.ReadOnlyField,
    }));

    let titleStats = null;
    let titleError = null;
    if (title === 'SupportRecord_Daily') {
      const itemsRes = await getAllItems(title, 'Id,Title');
      if (!itemsRes.ok) {
        titleError = itemsRes.error;
      } else {
        titleStats = summarizeTitles(itemsRes.items);
      }
    }

    lists[title] = {
      found: true,
      itemCount: meta.json.ItemCount ?? null,
      listId: meta.json.Id ?? null,
      fields,
      titleStats,
      error: titleError,
    };
  }

  const dump = {
    schemaVersion: 1,
    id: 'LIVE-SCHEMA-MUTATION-V1',
    phase: 'Preflight',
    mode: 'browser-rest',
    siteUrl,
    httpMethods: ['GET'],
    mutation: false,
    mutationAuthority: 'NOT_YET_AUTHORIZED',
    deploy: 'NOT_AUTHORIZED',
    generatedAt: new Date().toISOString(),
    lists,
  };

  console.log('%c[LIVE-SCHEMA-MUTATION-V1 preflight] Copy the JSON below', 'color: cyan');
  console.log(JSON.stringify(dump, null, 2));
  return dump;
})();
