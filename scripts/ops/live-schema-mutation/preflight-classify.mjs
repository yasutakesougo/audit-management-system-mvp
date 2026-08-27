/**
 * LIVE-SCHEMA-MUTATION-V1 — read-only preflight classification (no SharePoint I/O).
 *
 * Fail-closed rules for Title uniqueness Apply. Never infers live MISSING from repo.
 */

import {
  LIVE_SCHEMA_GATE_CHECKS,
  classifyLiveSchemaInventory,
  findFieldByCandidates,
  normalizeInventoryField,
} from '../live-schema-gate/classify.mjs';

export const LIVE_SCHEMA_MUTATION_ID = 'LIVE-SCHEMA-MUTATION-V1';

export const LIVE_SCHEMA_MUTATION_REQUIRED_CHANGES = [
  {
    id: 'SupportRecord_Daily.LatestVersion',
    listTitle: 'SupportRecord_Daily',
    action: 'AddField',
    internalName: 'LatestVersion',
    type: 'Number',
  },
  {
    id: 'SupportRecord_Daily.LatestCommitId',
    listTitle: 'SupportRecord_Daily',
    action: 'AddField',
    internalName: 'LatestCommitId',
    type: 'Text',
  },
  {
    id: 'DailyRecordRows.CommitId',
    listTitle: 'DailyRecordRows',
    action: 'AddField',
    internalName: 'CommitId',
    type: 'Text',
  },
  {
    id: 'SupportRecord_Daily.Title.indexedUnique',
    listTitle: 'SupportRecord_Daily',
    action: 'SetFieldFlags',
    internalName: 'Title',
    indexed: true,
    enforceUniqueValues: true,
  },
];

/**
 * @param {unknown} typeAsString
 * @param {string} expected
 */
function typesCompatible(typeAsString, expected) {
  if (typeAsString == null || String(typeAsString).trim() === '') return null;
  return String(typeAsString).trim().toLowerCase() === expected.toLowerCase();
}

/**
 * @param {{ lists?: Record<string, any> }} dump
 */
export function classifyMutationPreflight(dump) {
  const lists = dump?.lists || {};
  const holds = [];
  const notes = [];

  for (const title of ['SupportRecord_Daily', 'DailyRecordRows']) {
    const state = lists[title];
    if (!state || state.found == null) {
      holds.push({ id: 'PERMISSION_OR_UNREAD', listTitle: title, detail: state?.error || 'List schema was not read.' });
    } else if (state.found === false) {
      holds.push({ id: 'LIST_AMBIGUITY', listTitle: title, detail: 'List not found (HTTP 404 or equivalent).' });
    } else if (!Array.isArray(state.fields)) {
      holds.push({ id: 'PERMISSION_OR_UNREAD', listTitle: title, detail: state.error || 'Fields were not readable.' });
    }
  }

  const schemaChecks = classifyLiveSchemaInventory({ lists });
  const fieldPlans = [];

  for (const change of LIVE_SCHEMA_MUTATION_REQUIRED_CHANGES) {
    const state = lists[change.listTitle];
    const fields = Array.isArray(state?.fields) ? state.fields.map(normalizeInventoryField) : null;
    const gateCheck = LIVE_SCHEMA_GATE_CHECKS.find((check) => check.id === change.id || (
      change.action === 'SetFieldFlags' && check.id === 'SupportRecord_Daily.Title.indexedUnique'
    ));
    const candidates = gateCheck?.candidates || [change.internalName];
    const expectedTypes = gateCheck?.expectedTypes || (change.type ? [change.type] : ['Text']);

    if (!fields) {
      fieldPlans.push({
        ...change,
        liveStatus: 'UNVERIFIED',
        matchedField: null,
        applyEligible: false,
      });
      continue;
    }

    const matched = findFieldByCandidates(fields, candidates);
    if (change.action === 'AddField') {
      if (!matched) {
        fieldPlans.push({
          ...change,
          liveStatus: 'MISSING',
          matchedField: null,
          applyEligible: true,
        });
      } else {
        const ok = typesCompatible(matched.TypeAsString, change.type);
        if (ok === true) {
          fieldPlans.push({
            ...change,
            liveStatus: 'PRESENT_MATCH',
            matchedField: matched,
            applyEligible: false,
            detail: 'Already present with expected type; AddField not required.',
          });
        } else {
          holds.push({
            id: 'INCOMPATIBLE_EXISTING_FIELD',
            listTitle: change.listTitle,
            detail: `${change.internalName} exists as ${matched.TypeAsString}; expected ${change.type}.`,
          });
          fieldPlans.push({
            ...change,
            liveStatus: 'PRESENT_MISMATCH',
            matchedField: matched,
            applyEligible: false,
          });
        }
      }
      continue;
    }

    // Title flags
    if (!matched) {
      holds.push({
        id: 'SCHEMA_DRIFT',
        listTitle: change.listTitle,
        detail: 'Title field missing — unexpected for SharePoint lists.',
      });
      fieldPlans.push({
        ...change,
        liveStatus: 'MISSING',
        matchedField: null,
        applyEligible: false,
      });
      continue;
    }
    const indexedOk = matched.Indexed === true;
    const uniqueOk = matched.EnforceUniqueValues === true;
    const liveStatus = indexedOk && uniqueOk ? 'PRESENT_MATCH' : 'PRESENT_MISMATCH';
    fieldPlans.push({
      ...change,
      liveStatus,
      matchedField: matched,
      applyEligible: liveStatus === 'PRESENT_MISMATCH',
      expectedTypes,
    });
  }

  const parent = lists.SupportRecord_Daily;
  const titleStats = parent?.titleStats || null;
  let titleDuplicateGroupCount = null;
  let titleNullOrBlankCount = null;
  let titleRowsRead = null;

  if (titleStats && typeof titleStats === 'object') {
    titleDuplicateGroupCount = Number(titleStats.duplicateGroupCount);
    titleNullOrBlankCount = Number(titleStats.nullOrBlankTitleCount);
    titleRowsRead = Number(titleStats.itemRowsRead);
    if (Number.isFinite(titleDuplicateGroupCount) && titleDuplicateGroupCount > 0) {
      holds.push({
        id: 'TITLE_DUPLICATES',
        listTitle: 'SupportRecord_Daily',
        detail: `Title duplicate groups = ${titleDuplicateGroupCount}. Automatic repair is prohibited.`,
      });
    }
  } else if (parent?.found === true) {
    holds.push({
      id: 'TITLE_STATS_UNREAD',
      listTitle: 'SupportRecord_Daily',
      detail: 'Title duplicate/null stats were not read. Cannot authorize unique constraint.',
    });
  }

  // Drift: Gate said MISSING for three adds; if live now PRESENT_MATCH for all and Title already unique, mutation may be unnecessary
  const schemaSummary = {
    checks: schemaChecks.map((check) => ({ id: check.id, status: check.status })),
  };

  const preflightGate = holds.length > 0 ? 'HOLD' : 'READY';
  if (preflightGate === 'READY') {
    notes.push('Preflight READY: lists readable, no Title duplicates, no incompatible fields.');
    notes.push('Mutation Authority remains NOT_YET_AUTHORIZED until Human GO.');
  } else {
    notes.push('Preflight HOLD: do not Apply. Resolve fail-closed conditions first.');
  }

  return {
    id: LIVE_SCHEMA_MUTATION_ID,
    phase: 'Preflight',
    preflightGate,
    mutation: false,
    mutationAuthority: 'NOT_YET_AUTHORIZED',
    deploy: 'NOT_AUTHORIZED',
    holds,
    fieldPlans,
    titleStats: {
      duplicateGroupCount: titleDuplicateGroupCount,
      nullOrBlankTitleCount: titleNullOrBlankCount,
      itemRowsRead: titleRowsRead,
      itemCountReported: parent?.itemCount ?? null,
    },
    listSummaries: Object.fromEntries(
      Object.entries(lists).map(([title, state]) => [
        title,
        {
          found: state?.found ?? null,
          itemCount: state?.itemCount ?? null,
          fieldCount: Array.isArray(state?.fields) ? state.fields.length : null,
          error: state?.error ?? null,
        },
      ]),
    ),
    schemaSummary,
    notes,
  };
}
