/* eslint-disable no-console, no-undef, no-restricted-globals */
/**
 * LIVE-SCHEMA-DATA-REMEDIATION-V1 — Browser REST GET-only duplicate investigation.
 *
 * Usage (signed in on /sites/welfare):
 *   Paste into DevTools Console, copy JSON output.
 *
 * HTTP: GET only. No item/field writes.
 * Captures parent duplicate groups + child ParentID reference counts.
 */
(async () => {
  const siteUrl = (typeof _spPageContextInfo !== 'undefined' && _spPageContextInfo.webAbsoluteUrl)
    || 'https://isogokatudouhome.sharepoint.com/sites/welfare';
  const headers = { Accept: 'application/json;odata=nometadata' };

  async function getJson(endpoint) {
    const res = await fetch(`${siteUrl}/_api/${endpoint}`, { method: 'GET', headers });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    return { ok: res.ok, status: res.status, json, text };
  }

  async function getAll(endpointBase) {
    const items = [];
    let next = endpointBase;
    while (next) {
      const r = await getJson(next.replace(/^\//, ''));
      if (!r.ok) {
        return { ok: false, status: r.status, items, error: `HTTP ${r.status}: ${String(r.text).slice(0, 300)}` };
      }
      items.push(...(r.json.value || []));
      const raw = r.json['odata.nextLink'] || r.json['@odata.nextLink'] || null;
      if (!raw) { next = null; break; }
      const marker = '/_api/';
      const idx = raw.indexOf(marker);
      next = idx >= 0 ? raw.slice(idx + marker.length) : null;
    }
    return { ok: true, status: 200, items, error: null };
  }

  // Discover usable parent fields from schema (GET fields)
  const parentFieldsRes = await getJson(
    "web/lists/getbytitle('SupportRecord_Daily')/fields?$select=InternalName,TypeAsString&$top=5000",
  );
  const parentFieldNames = new Set(
    ((parentFieldsRes.json && parentFieldsRes.json.value) || []).map((f) => f.InternalName),
  );
  const parentSelectCandidates = [
    'Id', 'Title', 'Created', 'Modified',
    'RecordDate', 'Date', 'cr013_date', 'cr013_recorddate', 'recordDate',
    'UserId', 'UserID', 'UserCode', 'cr013_usercode', 'cr013_personId',
    // P1-1 content-significance evidence (boolean flags only in output — no payload)
    'UserRowsJSON', 'User_x0020_Rows_x0020_JSON', 'cr013_userRowsJSON',
    'UserCount', 'cr013_userCount',
    'LatestVersion', 'cr013_latestVersion',
  ];
  const contentSignificanceFieldCandidates = [
    'UserRowsJSON', 'User_x0020_Rows_x0020_JSON', 'cr013_userRowsJSON',
    'UserCount', 'cr013_userCount',
    'LatestVersion', 'cr013_latestVersion',
  ];
  const contentSignificanceFieldsInSchema = contentSignificanceFieldCandidates.filter((n) => parentFieldNames.has(n));
  const parentSelect = parentSelectCandidates.filter((n) => parentFieldNames.has(n) || ['Id', 'Title', 'Created', 'Modified'].includes(n));

  function extractContentSignificance(item) {
    const userRowsRaw = item.UserRowsJSON ?? item.User_x0020_Rows_x0020_JSON ?? item.cr013_userRowsJSON ?? null;
    const userCountRaw = item.UserCount ?? item.cr013_userCount ?? null;
    const latestVersionRaw = item.LatestVersion ?? item.cr013_latestVersion ?? null;
    const userRowsTrimmed = userRowsRaw == null ? '' : String(userRowsRaw).trim();
    const userRowsJSONPresent = userRowsTrimmed !== '' && userRowsTrimmed !== '[]';
    const userCount = userCountRaw == null ? null : Number(userCountRaw);
    const latestVersion = latestVersionRaw == null ? null : Number(latestVersionRaw);
    return {
      contentSignificanceVerified: contentSignificanceFieldsInSchema.length > 0,
      userRowsJSONPresent,
      userCount,
      userCountPositive: Number.isFinite(userCount) && userCount > 0,
      latestVersion,
      latestVersionPositive: Number.isFinite(latestVersion) && latestVersion > 0,
    };
  }

  const parentMeta = await getJson("web/lists/getbytitle('SupportRecord_Daily')?$select=Title,ItemCount,Id");
  const parentsRes = await getAll(
    `web/lists/getbytitle('SupportRecord_Daily')/items?$select=${parentSelect.join(',')}&$top=5000`,
  );

  const childFieldsRes = await getJson(
    "web/lists/getbytitle('DailyRecordRows')/fields?$select=InternalName,TypeAsString&$top=5000",
  );
  const childFieldNames = new Set(
    ((childFieldsRes.json && childFieldsRes.json.value) || []).map((f) => f.InternalName),
  );
  const parentIdField = ['ParentID', 'Parent_x0020_ID', 'cr013_parentid'].find((n) => childFieldNames.has(n)) || null;
  const childMeta = await getJson("web/lists/getbytitle('DailyRecordRows')?$select=Title,ItemCount,Id");

  let childRefs = { ok: false, error: 'ParentID field not found', byParentId: {} };
  if (parentIdField) {
    const childRes = await getAll(
      `web/lists/getbytitle('DailyRecordRows')/items?$select=Id,${parentIdField}&$top=5000`,
    );
    const byParentId = {};
    if (childRes.ok) {
      for (const row of childRes.items) {
        const raw = row[parentIdField];
        if (raw == null || String(raw).trim() === '') continue;
        const key = String(raw);
        byParentId[key] = (byParentId[key] || 0) + 1;
      }
      childRefs = {
        ok: true,
        error: null,
        parentIdField,
        rowsRead: childRes.items.length,
        itemCountReported: childMeta.json?.ItemCount ?? null,
        enumerationComplete:
          childMeta.json?.ItemCount != null && childRes.items.length === childMeta.json.ItemCount,
        byParentId,
      };
    } else {
      childRefs = { ok: false, error: childRes.error, parentIdField, byParentId: {} };
    }
  }

  // Build duplicate groups by exact Title string (blank titles excluded from groups; counted separately)
  const byTitle = new Map();
  let nullOrBlank = 0;
  for (const item of parentsRes.items || []) {
    const title = item.Title;
    if (title == null || String(title).trim() === '') {
      nullOrBlank += 1;
      continue;
    }
    const key = String(title);
    if (!byTitle.has(key)) byTitle.set(key, []);
    byTitle.get(key).push(item);
  }
  const duplicateGroups = [...byTitle.entries()]
    .filter(([, items]) => items.length > 1)
    .sort((a, b) => b[1].length - a[1].length || String(a[0]).localeCompare(String(b[0])))
    .map(([title, items], index) => {
      const ids = items.map((it) => it.Id).sort((a, b) => a - b);
      const childCounts = {};
      for (const id of ids) {
        childCounts[String(id)] = childRefs.byParentId?.[String(id)] || 0;
      }
      return {
        groupId: `TD-${String(index + 1).padStart(3, '0')}`,
        title,
        groupSize: items.length,
        parentItemIds: ids,
        items: items.map((it) => {
          const content = extractContentSignificance(it);
          return {
            Id: it.Id,
            Title: it.Title,
            RecordDate: it.RecordDate ?? it.cr013_recorddate ?? it.cr013_date ?? it.Date ?? null,
            UserId: it.UserId ?? it.UserID ?? it.UserCode ?? it.cr013_usercode ?? it.cr013_personId ?? null,
            Created: it.Created ?? null,
            Modified: it.Modified ?? null,
            childCount: childCounts[String(it.Id)] || 0,
            ...content,
          };
        }),
      };
    });

  const dump = {
    schemaVersion: 1,
    id: 'LIVE-SCHEMA-DATA-REMEDIATION-V1',
    phase: 'DefinitionInvestigation',
    mode: 'browser-rest',
    siteUrl,
    httpMethods: ['GET'],
    mutation: false,
    dataMutationAuthority: 'NOT_YET_AUTHORIZED',
    schemaMutation: 'PROHIBITED',
    deploy: 'NOT_AUTHORIZED',
    generatedAt: new Date().toISOString(),
    parentSelect,
    parentIdFieldUsed: parentIdField,
    lists: {
      SupportRecord_Daily: {
        found: parentMeta.ok,
        itemCount: parentMeta.json?.ItemCount ?? null,
        rowsRead: parentsRes.ok ? parentsRes.items.length : null,
        enumerationComplete:
          parentMeta.ok
          && parentMeta.json?.ItemCount != null
          && parentsRes.ok
          && parentsRes.items.length === parentMeta.json.ItemCount,
        error: parentsRes.ok ? null : parentsRes.error,
      },
      DailyRecordRows: {
        found: childMeta.ok,
        itemCount: childMeta.json?.ItemCount ?? null,
        rowsRead: childRefs.rowsRead ?? null,
        enumerationComplete: childRefs.enumerationComplete ?? null,
        error: childRefs.error,
      },
    },
    titleStats: {
      nullOrBlankTitleCount: nullOrBlank,
      duplicateGroupCount: duplicateGroups.length,
      duplicateItemCount: duplicateGroups.reduce((sum, g) => sum + g.groupSize, 0),
    },
    childRefsSummary: {
      ok: childRefs.ok,
      parentIdField,
      rowsRead: childRefs.rowsRead ?? null,
      enumerationComplete: childRefs.enumerationComplete ?? null,
      error: childRefs.error ?? null,
    },
    contentSignificanceCapture: {
      verified: contentSignificanceFieldsInSchema.length > 0,
      fieldsInSchema: contentSignificanceFieldsInSchema,
    },
    duplicateGroups,
  };

  console.log('%c[LIVE-SCHEMA-DATA-REMEDIATION-V1] Copy JSON below (keep local; redact before chat)', 'color: cyan');
  console.log(JSON.stringify(dump, null, 2));
  return dump;
})();
