/* eslint-disable no-console, no-undef, no-restricted-globals */
/**
 * LIVE-SCHEMA-DATA-REMEDIATION-V1 — Browser REST GET-only one-shot evidence dump.
 * Correction-2 Evidence Collection (Phase 1).
 *
 * Usage (signed in on /sites/welfare):
 *   Paste into DevTools Console, copy JSON output.
 *
 * HTTP: GET only. No item/field writes.
 * Captures parent duplicate groups + child ParentID reference counts +
 * structured contentSignificance { value, basis, evidence }.
 *
 * Frozen TD register (parent ID sets) — keep stable across re-runs.
 */
(async () => {
  const FROZEN_TD_REGISTER = {
    'TD-001': [7, 12, 15],
    'TD-002': [3, 4, 5],
    'TD-003': [2060, 2063],
    'TD-004': [2084, 2085],
    'TD-005': [21, 22],
    'TD-006': [6, 11],
    'TD-007': [13, 14],
    'TD-008': [1, 2],
  };

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

  function idsKey(ids) {
    return [...ids].map(Number).sort((a, b) => a - b).join(',');
  }

  const frozenByKey = new Map();
  for (const [td, ids] of Object.entries(FROZEN_TD_REGISTER)) {
    frozenByKey.set(idsKey(ids), td);
  }

  function resolveGroupId(ids, fallbackIndex) {
    const hit = frozenByKey.get(idsKey(ids));
    if (hit) return hit;
    return `TD-UNREGISTERED-${String(fallbackIndex + 1).padStart(3, '0')}`;
  }

  // Discover usable parent fields from schema (GET fields)
  const parentFieldsRes = await getJson(
    "web/lists/getbytitle('SupportRecord_Daily')/fields?$select=InternalName,TypeAsString&$top=5000",
  );
  const parentFieldDefs = (parentFieldsRes.json && parentFieldsRes.json.value) || [];
  const parentFieldNames = new Set(parentFieldDefs.map((f) => f.InternalName));

  const lifecycleFieldCandidates = [
    'Lifecycle', 'LifecycleStatus', 'Active', 'IsActive', 'Status', 'RecordStatus',
    'cr013_lifecycle', 'cr013_status',
  ];
  const archivalFieldCandidates = [
    'Archived', 'IsArchived', 'ArchiveFlag', 'Deleted', 'IsDeleted', 'FSObjType',
  ];
  const schemaRelevantCandidates = [
    'LatestVersion', 'cr013_latestVersion',
    'LatestCommitId', 'cr013_latestCommitId', 'CommitId',
  ];

  const parentSelectCandidates = [
    'Id', 'Title', 'Created', 'Modified',
    'AuthorId', 'EditorId',
    'RecordDate', 'Date', 'cr013_date', 'cr013_recorddate', 'recordDate',
    'UserId', 'UserID', 'UserCode', 'cr013_usercode', 'cr013_personId',
    'UserRowsJSON', 'User_x0020_Rows_x0020_JSON', 'cr013_userRowsJSON',
    'UserCount', 'cr013_userCount',
    ...schemaRelevantCandidates,
    ...lifecycleFieldCandidates,
    ...archivalFieldCandidates,
  ];

  const contentSignificanceFieldCandidates = [
    'UserRowsJSON', 'User_x0020_Rows_x0020_JSON', 'cr013_userRowsJSON',
    'UserCount', 'cr013_userCount',
    'LatestVersion', 'cr013_latestVersion',
  ];
  const contentSignificanceFieldsInSchema = contentSignificanceFieldCandidates.filter((n) => parentFieldNames.has(n));
  const lifecycleFieldsInSchema = lifecycleFieldCandidates.filter((n) => parentFieldNames.has(n));
  const archivalFieldsInSchema = archivalFieldCandidates.filter((n) => parentFieldNames.has(n));
  const schemaRelevantInSchema = schemaRelevantCandidates.filter((n) => parentFieldNames.has(n));

  const parentSelect = parentSelectCandidates.filter(
    (n) => parentFieldNames.has(n) || ['Id', 'Title', 'Created', 'Modified'].includes(n),
  );

  const canExpandAuthor = parentFieldNames.has('Author');
  const canExpandEditor = parentFieldNames.has('Editor');
  const expandParts = [];
  if (canExpandAuthor) expandParts.push('Author/Id', 'Author/Title');
  if (canExpandEditor) expandParts.push('Editor/Id', 'Editor/Title');
  const expandQuery = expandParts.length
    ? `&$expand=${[canExpandAuthor ? 'Author' : null, canExpandEditor ? 'Editor' : null].filter(Boolean).join(',')}`
    : '';
  // When expanding, also select nested fields SharePoint needs
  const selectWithExpand = expandParts.length
    ? [...new Set([...parentSelect, ...expandParts])]
    : parentSelect;

  function pickFirst(item, names) {
    for (const n of names) {
      if (Object.prototype.hasOwnProperty.call(item, n) && item[n] != null) return { name: n, value: item[n] };
    }
    return { name: null, value: null };
  }

  function extractContentSignificance(item) {
    const userRowsField = pickFirst(item, ['UserRowsJSON', 'User_x0020_Rows_x0020_JSON', 'cr013_userRowsJSON']);
    const userCountField = pickFirst(item, ['UserCount', 'cr013_userCount']);
    const latestVersionField = pickFirst(item, ['LatestVersion', 'cr013_latestVersion']);

    const userRowsRaw = userRowsField.value;
    const userCountRaw = userCountField.value;
    const latestVersionRaw = latestVersionField.value;

    const userRowsTrimmed = userRowsRaw == null ? '' : String(userRowsRaw).trim();
    const userRowsJSONPresent = userRowsTrimmed !== '' && userRowsTrimmed !== '[]';
    const userCount = userCountRaw == null ? null : Number(userCountRaw);
    const latestVersion = latestVersionRaw == null ? null : Number(latestVersionRaw);
    const userCountPositive = Number.isFinite(userCount) && userCount > 0;
    const latestVersionPositive = Number.isFinite(latestVersion) && latestVersion > 0;

    const verified = contentSignificanceFieldsInSchema.length > 0;
    const basis = [];
    if (!verified) {
      basis.push('content-significance fields not in list schema');
    } else {
      if (contentSignificanceFieldsInSchema.includes('UserRowsJSON')
        || contentSignificanceFieldsInSchema.includes('User_x0020_Rows_x0020_JSON')
        || contentSignificanceFieldsInSchema.includes('cr013_userRowsJSON')) {
        basis.push(userRowsJSONPresent
          ? 'UserRowsJSON contains business content'
          : 'UserRowsJSON is empty');
      }
      if (contentSignificanceFieldsInSchema.some((n) => n === 'UserCount' || n === 'cr013_userCount')) {
        basis.push(userCountPositive
          ? `UserCount positive (${userCount})`
          : `UserCount empty or zero (${userCountRaw == null ? 'null' : userCount})`);
      }
      if (contentSignificanceFieldsInSchema.some((n) => n === 'LatestVersion' || n === 'cr013_latestVersion')) {
        basis.push(latestVersionPositive
          ? `LatestVersion positive (${latestVersion})`
          : `LatestVersion empty or zero (${latestVersionRaw == null ? 'null' : latestVersion})`);
      }
    }

    const hasSignificant = userRowsJSONPresent || userCountPositive || latestVersionPositive;
    let value = 'UNKNOWN';
    if (verified) value = hasSignificant ? 'TRUE' : 'FALSE';

    return {
      // Legacy booleans for Correction-1 compatibility
      contentSignificanceVerified: verified,
      userRowsJSONPresent,
      userCount,
      userCountPositive,
      latestVersion,
      latestVersionPositive,
      // Correction-2 structured shape
      contentSignificance: {
        value,
        basis,
        evidence: {
          itemId: item.Id ?? null,
          fieldsInSchema: contentSignificanceFieldsInSchema,
          userRowsJSONPresent,
          userCount,
          userCountPositive,
          latestVersion,
          latestVersionPositive,
        },
      },
    };
  }

  function extractLifecycle(item) {
    if (lifecycleFieldsInSchema.length === 0) {
      return { status: 'UNKNOWN', field: null, value: null, reason: 'not-in-schema' };
    }
    const hit = pickFirst(item, lifecycleFieldsInSchema);
    return {
      status: hit.value == null || String(hit.value).trim() === '' ? 'UNKNOWN' : 'OBSERVED',
      field: hit.name,
      value: hit.value == null ? null : String(hit.value),
    };
  }

  function extractArchival(item) {
    if (archivalFieldsInSchema.length === 0) {
      return {
        status: 'NOT_PROBED',
        reason: 'no archival/delete indicator fields in schema; recycle bin not probed (GET-only safety)',
        fields: {},
      };
    }
    const fields = {};
    for (const n of archivalFieldsInSchema) {
      fields[n] = item[n] ?? null;
    }
    return { status: 'OBSERVED', fields };
  }

  function extractAuthorEditor(item) {
    const author = item.Author || null;
    const editor = item.Editor || null;
    return {
      AuthorId: item.AuthorId ?? author?.Id ?? null,
      AuthorTitlePresent: Boolean(author?.Title && String(author.Title).trim()),
      EditorId: item.EditorId ?? editor?.Id ?? null,
      EditorTitlePresent: Boolean(editor?.Title && String(editor.Title).trim()),
      authorExpand: canExpandAuthor ? 'USED' : 'NOT_IN_SCHEMA_OR_SKIPPED',
      editorExpand: canExpandEditor ? 'USED' : 'NOT_IN_SCHEMA_OR_SKIPPED',
    };
  }

  function extractSchemaRelevant(item) {
    const out = {};
    for (const n of schemaRelevantCandidates) {
      if (parentFieldNames.has(n)) out[n] = item[n] ?? null;
      else out[n] = 'NOT_IN_SCHEMA';
    }
    return out;
  }

  const parentMeta = await getJson("web/lists/getbytitle('SupportRecord_Daily')?$select=Title,ItemCount,Id");
  const parentsRes = await getAll(
    `web/lists/getbytitle('SupportRecord_Daily')/items?$select=${selectWithExpand.join(',')}${expandQuery}&$top=5000`,
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
    .sort((a, b) => {
      const aIds = a[1].map((it) => it.Id).sort((x, y) => x - y);
      const bIds = b[1].map((it) => it.Id).sort((x, y) => x - y);
      const aTd = frozenByKey.get(idsKey(aIds)) || '';
      const bTd = frozenByKey.get(idsKey(bIds)) || '';
      if (aTd && bTd) return aTd.localeCompare(bTd);
      if (aTd) return -1;
      if (bTd) return 1;
      return b[1].length - a[1].length || String(a[0]).localeCompare(String(b[0]));
    })
    .map(([title, items], index) => {
      const ids = items.map((it) => it.Id).sort((a, b) => a - b);
      const childCounts = {};
      for (const id of ids) {
        childCounts[String(id)] = childRefs.byParentId?.[String(id)] || 0;
      }
      const groupId = resolveGroupId(ids, index);
      return {
        groupId,
        title,
        groupSize: items.length,
        parentItemIds: ids,
        items: items.map((it) => {
          const content = extractContentSignificance(it);
          const recordDate = it.RecordDate ?? it.cr013_recorddate ?? it.cr013_date ?? it.Date ?? null;
          const userId = it.UserId ?? it.UserID ?? it.UserCode ?? it.cr013_usercode ?? it.cr013_personId ?? null;
          const people = extractAuthorEditor(it);
          return {
            Id: it.Id,
            Title: it.Title,
            RecordDate: recordDate,
            UserId: userId,
            businessKey: {
              titlePresent: it.Title != null && String(it.Title).trim() !== '',
              recordDate,
              userIdPresent: userId != null && String(userId).trim() !== '',
            },
            Created: it.Created ?? null,
            Modified: it.Modified ?? null,
            ...people,
            lifecycle: extractLifecycle(it),
            archival: extractArchival(it),
            schemaRelevant: extractSchemaRelevant(it),
            childCount: childCounts[String(it.Id)] || 0,
            ...content,
          };
        }),
      };
    });

  const dump = {
    schemaVersion: 2,
    id: 'LIVE-SCHEMA-DATA-REMEDIATION-V1',
    phase: 'Phase1_EvidenceCollection',
    correction: 'Correction-2',
    mode: 'browser-rest',
    siteUrl,
    httpMethods: ['GET'],
    mutation: false,
    dataMutationAuthority: 'NOT_YET_AUTHORIZED',
    schemaMutation: 'PROHIBITED',
    deploy: 'NOT_AUTHORIZED',
    generatedAt: new Date().toISOString(),
    frozenTdRegister: FROZEN_TD_REGISTER,
    parentSelect: selectWithExpand,
    expand: expandParts,
    parentIdFieldUsed: parentIdField,
    fieldInventory: {
      contentSignificanceFieldsInSchema,
      lifecycleFieldsInSchema,
      archivalFieldsInSchema,
      schemaRelevantInSchema,
      authorExpand: canExpandAuthor,
      editorExpand: canExpandEditor,
    },
    lists: {
      SupportRecord_Daily: {
        found: parentMeta.ok,
        listId: parentMeta.json?.Id ?? null,
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
        listId: childMeta.json?.Id ?? null,
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
      shape: 'value_basis_evidence',
    },
    duplicateGroups,
  };

  console.log('%c[LIVE-SCHEMA-DATA-REMEDIATION-V1] Copy JSON below (keep local; redact before chat)', 'color: cyan');
  console.log(JSON.stringify(dump, null, 2));
  return dump;
})();
