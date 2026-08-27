/**
 * LIVE-SCHEMA-GATE-V1 — read-only classification (no SharePoint I/O).
 *
 * Candidate names stay aligned with:
 * - src/sharepoint/fields/dailyFields.ts (DAILY_RECORD_CANONICAL_CANDIDATES / ROW_AGGREGATE)
 * - src/sharepoint/fields/dailyFields.ts (DAILY_RECORD_PARENT_STORAGE_UNIQUENESS)
 *
 * Live presence is never inferred from repo provisioning. Missing repo entries
 * are recorded separately as codeGap, not as live MISSING.
 */

export const LIVE_SCHEMA_GATE_ID = 'LIVE-SCHEMA-GATE-V1';

/**
 * Correction-1 (P1-1): PnP is read-only at the cmdlet layer, but CSOM /
 * ClientContext / ExecuteQueryRetry does not guarantee HTTP GET-only transport.
 * Browser REST, Node SharePoint REST, and Microsoft Graph are GET-ONLY.
 */
export const LIVE_SCHEMA_GATE_CORRECTION_1 = {
  id: 'LIVE-SCHEMA-GATE-V1-Correction-1',
  browserRest: 'GET-ONLY',
  nodeSharePointRest: 'GET-ONLY',
  microsoftGraph: 'GET-ONLY',
  pnpPowerShell: 'READ-ONLY',
  pnpTransportMethodGuaranteed: false,
  schemaMutation: 'PROHIBITED',
};

export const LIVE_SCHEMA_GATE_INVENTORY_PATHS = {
  browserRest: {
    transport: 'GET-ONLY',
    transportMethodGuaranteed: true,
    mutation: 'PROHIBITED',
  },
  nodeSharePointRest: {
    transport: 'GET-ONLY',
    transportMethodGuaranteed: true,
    mutation: 'PROHIBITED',
  },
  microsoftGraph: {
    transport: 'GET-ONLY',
    transportMethodGuaranteed: true,
    mutation: 'PROHIBITED',
  },
  pnpPowerShell: {
    transport: 'READ-ONLY',
    transportMethodGuaranteed: false,
    mutation: 'PROHIBITED',
  },
};

export const LIVE_SCHEMA_GATE_CHECKS = [
  {
    id: 'SupportRecord_Daily.LatestVersion',
    listTitle: 'SupportRecord_Daily',
    fieldLabel: 'LatestVersion',
    candidates: ['LatestVersion', 'latestVersion', 'cr013_latestVersion'],
    expectedTypes: ['Number'],
    requireIndexed: false,
    requireUnique: false,
  },
  {
    id: 'SupportRecord_Daily.LatestCommitId',
    listTitle: 'SupportRecord_Daily',
    fieldLabel: 'LatestCommitId',
    candidates: ['LatestCommitId', 'latestCommitId', 'cr013_latestCommitId'],
    expectedTypes: ['Text'],
    requireIndexed: false,
    requireUnique: false,
  },
  {
    id: 'DailyRecordRows.CommitId',
    listTitle: 'DailyRecordRows',
    fieldLabel: 'CommitId',
    candidates: ['CommitId', 'commitId', 'cr013_commitId'],
    expectedTypes: ['Text'],
    requireIndexed: false,
    requireUnique: false,
  },
  {
    id: 'SupportRecord_Daily.Title.indexedUnique',
    listTitle: 'SupportRecord_Daily',
    fieldLabel: 'Title',
    candidates: ['Title'],
    expectedTypes: ['Text'],
    requireIndexed: true,
    requireUnique: true,
  },
];

/**
 * @param {string | undefined | null} typeAsString
 * @param {string[]} expectedTypes
 */
export function typeMatches(typeAsString, expectedTypes) {
  if (typeAsString == null || String(typeAsString).trim() === '') return null;
  const normalized = String(typeAsString).trim();
  return expectedTypes.some((expected) => expected.toLowerCase() === normalized.toLowerCase());
}

/**
 * @param {Array<{ InternalName?: string, Title?: string, name?: string, displayName?: string }>} fields
 * @param {string[]} candidates
 */
export function findFieldByCandidates(fields, candidates) {
  const wanted = new Set(candidates.map((name) => name.toLowerCase()));
  return fields.find((field) => {
    const names = [field.InternalName, field.Title, field.name, field.displayName]
      .filter((value) => typeof value === 'string' && value.length > 0)
      .map((value) => value.toLowerCase());
    return names.some((name) => wanted.has(name));
  }) ?? null;
}

/**
 * Normalize REST / PnP / Graph column shapes into one inventory field.
 * Graph v1.0 columnDefinition does not expose EnforceUniqueValues — leave it null.
 *
 * @param {Record<string, unknown>} raw
 */
export function normalizeInventoryField(raw) {
  const internalName =
    (typeof raw.InternalName === 'string' && raw.InternalName) ||
    (typeof raw.name === 'string' && raw.name) ||
    (typeof raw.StaticName === 'string' && raw.StaticName) ||
    '';

  const title =
    (typeof raw.Title === 'string' && raw.Title) ||
    (typeof raw.displayName === 'string' && raw.displayName) ||
    internalName;

  let typeAsString =
    (typeof raw.TypeAsString === 'string' && raw.TypeAsString) ||
    (typeof raw.Type === 'string' && raw.Type) ||
    null;

  if (!typeAsString) {
    if (raw.number) typeAsString = 'Number';
    else if (raw.text && typeof raw.text === 'object' && raw.text.allowMultipleLines) typeAsString = 'Note';
    else if (raw.text) typeAsString = 'Text';
    else if (raw.dateTime) typeAsString = 'DateTime';
    else if (raw.boolean) typeAsString = 'Boolean';
    else if (raw.choice) typeAsString = 'Choice';
  }

  const indexed = typeof raw.Indexed === 'boolean'
    ? raw.Indexed
    : typeof raw.indexed === 'boolean'
      ? raw.indexed
      : null;

  const unique = typeof raw.EnforceUniqueValues === 'boolean'
    ? raw.EnforceUniqueValues
    : typeof raw.enforceUniqueValues === 'boolean'
      ? raw.enforceUniqueValues
      : null;

  return {
    InternalName: internalName,
    Title: title,
    TypeAsString: typeAsString,
    Indexed: indexed,
    EnforceUniqueValues: unique,
    Hidden: typeof raw.Hidden === 'boolean' ? raw.Hidden : typeof raw.hidden === 'boolean' ? raw.hidden : null,
    ReadOnlyField: typeof raw.ReadOnlyField === 'boolean' ? raw.ReadOnlyField : typeof raw.readOnly === 'boolean' ? raw.readOnly : null,
  };
}

/**
 * @param {{
 *   lists?: Record<string, {
 *     found?: boolean | null,
 *     error?: string | null,
 *     uniqueConstraintReadable?: boolean,
 *     fields?: Array<Record<string, unknown>> | null,
 *   }>,
 *   uniqueConstraintReadable?: boolean,
 * }} snapshot
 */
export function classifyLiveSchemaInventory(snapshot) {
  const lists = snapshot?.lists ?? {};
  const defaultUniqueReadable = snapshot.uniqueConstraintReadable !== false;

  return LIVE_SCHEMA_GATE_CHECKS.map((check) => {
    const listState = lists[check.listTitle];
    if (!listState || listState.found == null && (listState.fields == null || listState.fields === undefined)) {
      return {
        id: check.id,
        listTitle: check.listTitle,
        fieldLabel: check.fieldLabel,
        status: 'UNVERIFIED',
        reason: 'List schema was not read. Do not infer presence or absence.',
        matchedField: null,
        mismatches: [],
      };
    }

    if (listState.found === false) {
      return {
        id: check.id,
        listTitle: check.listTitle,
        fieldLabel: check.fieldLabel,
        status: 'LIST_MISSING',
        reason: listState.error ?? `List "${check.listTitle}" was not found.`,
        matchedField: null,
        mismatches: [],
      };
    }

    if (!Array.isArray(listState.fields)) {
      return {
        id: check.id,
        listTitle: check.listTitle,
        fieldLabel: check.fieldLabel,
        status: 'UNVERIFIED',
        reason: listState.error ?? `Fields for "${check.listTitle}" were not returned.`,
        matchedField: null,
        mismatches: [],
      };
    }

    const normalized = listState.fields.map(normalizeInventoryField);
    const matched = findFieldByCandidates(normalized, check.candidates);
    if (!matched) {
      return {
        id: check.id,
        listTitle: check.listTitle,
        fieldLabel: check.fieldLabel,
        status: 'MISSING',
        reason: `No candidate matched (${check.candidates.join(', ')}).`,
        matchedField: null,
        mismatches: [],
      };
    }

    const mismatches = [];
    const typeOk = typeMatches(matched.TypeAsString, check.expectedTypes);
    if (typeOk === false) {
      mismatches.push(`type ${matched.TypeAsString} !== ${check.expectedTypes.join('|')}`);
    }

    if (check.requireIndexed) {
      if (matched.Indexed == null) {
        mismatches.push('Indexed not returned by this API');
      } else if (matched.Indexed !== true) {
        mismatches.push('Indexed=false');
      }
    }

    const uniqueReadable = listState.uniqueConstraintReadable ?? defaultUniqueReadable;
    if (check.requireUnique) {
      if (!uniqueReadable || matched.EnforceUniqueValues == null) {
        return {
          id: check.id,
          listTitle: check.listTitle,
          fieldLabel: check.fieldLabel,
          status: 'UNVERIFIED',
          reason: 'Field exists but EnforceUniqueValues is not readable on this API (use PnP or SharePoint REST fields GET).',
          matchedField: matched,
          mismatches,
        };
      }
      if (matched.EnforceUniqueValues !== true) {
        mismatches.push('EnforceUniqueValues=false');
      }
    }

    if (mismatches.length > 0) {
      return {
        id: check.id,
        listTitle: check.listTitle,
        fieldLabel: check.fieldLabel,
        status: 'PRESENT_MISMATCH',
        reason: mismatches.join('; '),
        matchedField: matched,
        mismatches,
      };
    }

    return {
      id: check.id,
      listTitle: check.listTitle,
      fieldLabel: check.fieldLabel,
      status: 'PRESENT_MATCH',
      reason: typeOk == null
        ? `Matched ${matched.InternalName} (type not supplied; existence only).`
        : `Matched ${matched.InternalName} (${matched.TypeAsString}).`,
      matchedField: matched,
      mismatches: [],
    };
  });
}

/**
 * @param {Array<{ status: string }>} checks
 */
export function summarizeLiveSchemaGate(checks) {
  const statuses = checks.map((check) => check.status);
  if (statuses.some((status) => status === 'UNVERIFIED')) {
    return {
      gate: 'HOLD',
      liveSchema: 'UNVERIFIED',
      mutation: 'NONE',
      next: 'Run PnP / SharePoint REST fields GET / admin UI inventory. Do not mutate schema.',
    };
  }
  if (statuses.every((status) => status === 'PRESENT_MATCH')) {
    return {
      gate: 'VERIFIED_MATCH',
      liveSchema: 'MATCH',
      mutation: 'NONE',
      next: 'These four contracts already exist live. Schema mutation Gate is not required for them.',
    };
  }
  return {
    gate: 'VERIFIED_GAPS',
    liveSchema: 'GAPS',
    mutation: 'NONE',
    next: 'Live inventory is complete. Decide schema mutation in a separate Gate. Do not apply from this Gate.',
  };
}
