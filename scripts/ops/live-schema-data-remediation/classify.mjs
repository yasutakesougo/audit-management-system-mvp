/**
 * LIVE-SCHEMA-DATA-REMEDIATION-V1 — classify GET-only duplicate investigation dumps.
 * Never selects a winner. Never mutates SharePoint.
 */

export const LIVE_SCHEMA_DATA_REMEDIATION_ID = 'LIVE-SCHEMA-DATA-REMEDIATION-V1';

export const LIVE_SCHEMA_DATA_REMEDIATION_CORRECTION_BASELINE = {
  dataMutationAuthority: 'NOT_YET_AUTHORIZED',
  schemaMutation: 'PROHIBITED',
  deploy: 'NOT_AUTHORIZED',
  automaticWinnerSelection: 'PROHIBITED',
  automaticDuplicateRepair: 'PROHIBITED',
};

/**
 * @param {unknown} value
 */
function isBlank(value) {
  return value == null || String(value).trim() === '';
}

/**
 * Safe display for Title — never emit raw title into committed reports.
 * @param {string} title
 */
export function redactTitle(title) {
  const s = String(title ?? '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `DATE(${s})`; // YYYY-MM-DD contract keys are non-PII
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return `DATE_LIKE(len=${s.length})`;
  if (/^(probe|smoke|test)/i.test(s)) return `TEST_LIKE(len=${s.length})`;
  if (s.length <= 2) return `SHORT(len=${s.length})`;
  return `REDACTED(len=${s.length})`;
}

/**
 * @param {Array<Record<string, unknown>>} items
 * @param {string} field
 */
function compareField(items, field) {
  const values = items.map((item) => item[field]);
  if (values.every((v) => v == null)) return 'UNVERIFIED';
  const norm = values.map((v) => (v == null ? null : String(v)));
  const present = norm.filter((v) => v != null);
  if (present.length !== norm.length) return 'DIFFERENT';
  const uniq = new Set(present);
  return uniq.size === 1 ? 'SAME' : 'DIFFERENT';
}

/**
 * @param {object} group
 */
export function classifyDuplicateGroup(group) {
  const items = Array.isArray(group.items) ? group.items : [];
  const recordDateComparison = compareField(items, 'RecordDate');
  const userIdComparison = compareField(items, 'UserId');
  const childCounts = items.map((item) => Number(item.childCount) || 0);
  const parentsWithChildren = childCounts.filter((n) => n > 0).length;
  const totalChildren = childCounts.reduce((a, b) => a + b, 0);

  let classification = 'AMBIGUOUS';
  let remediationCase = 'B_MEANINGFUL_OR_AMBIGUOUS';
  let holdReasons = [];

  if (recordDateComparison === 'DIFFERENT' || userIdComparison === 'DIFFERENT') {
    classification = 'AMBIGUOUS';
    remediationCase = 'C_SCHEMA_CONTRACT_CONFLICT_CANDIDATE';
    holdReasons.push('Parent identity fields differ within same Title group');
  } else if (parentsWithChildren > 1) {
    classification = 'ACTIVE_DUPLICATE';
    remediationCase = 'B_MEANINGFUL_OR_AMBIGUOUS';
    holdReasons.push('Child rows exist on multiple duplicate parents');
  } else if (totalChildren > 0) {
    classification = 'ACTIVE_DUPLICATE';
    remediationCase = 'B_MEANINGFUL_OR_AMBIGUOUS';
    holdReasons.push('At least one parent has child references');
  } else if (
    items.length >= 2
    && childCounts.every((n) => n === 0)
    && recordDateComparison !== 'DIFFERENT'
  ) {
    // Empty of children — still not auto-deletable
    classification = 'EMPTY_DUPLICATE_CANDIDATE';
    remediationCase = 'A_EMPTY_ACCIDENTAL_CANDIDATE';
    holdReasons.push('No children on any parent — still requires human decision (no auto delete)');
  } else {
    holdReasons.push('Insufficient evidence for safe automatic classification');
  }

  return {
    groupId: group.groupId,
    parentItemIds: group.parentItemIds || items.map((item) => item.Id),
    groupSize: group.groupSize || items.length,
    titleDisplay: redactTitle(group.title),
    recordDateComparison,
    userIdComparison,
    childReferences: Object.fromEntries(
      items.map((item) => [String(item.Id), Number(item.childCount) || 0]),
    ),
    createdModified: items.map((item) => ({
      Id: item.Id,
      Created: item.Created ?? null,
      Modified: item.Modified ?? null,
    })),
    classification,
    remediationCase,
    automaticRemediation: 'PROHIBITED',
    humanDecisionRequired: true,
    holdReasons,
  };
}

/**
 * @param {{ lists?: any, duplicateGroups?: any[], titleStats?: any, childRefsSummary?: any }} dump
 */
export function classifyDataRemediationInvestigation(dump) {
  const lists = dump?.lists || {};
  const holds = [];
  const notes = [];

  const parent = lists.SupportRecord_Daily;
  const child = lists.DailyRecordRows;

  let readCompleteness = 'PASS';
  if (!parent?.enumerationComplete) {
    readCompleteness = 'HOLD';
    holds.push({ id: 'PARENT_ENUMERATION_INCOMPLETE', detail: 'SupportRecord_Daily paging/itemCount mismatch or unread.' });
  }
  if (dump?.childRefsSummary && dump.childRefsSummary.ok === false) {
    readCompleteness = 'HOLD';
    holds.push({ id: 'CHILD_REFERENCE_EVIDENCE_MISSING', detail: dump.childRefsSummary.error || 'Child refs unread.' });
  } else if (child && child.enumerationComplete === false) {
    readCompleteness = 'HOLD';
    holds.push({ id: 'CHILD_ENUMERATION_INCOMPLETE', detail: 'DailyRecordRows paging/itemCount mismatch.' });
  }

  const groups = Array.isArray(dump?.duplicateGroups) ? dump.duplicateGroups : [];
  const classified = groups.map(classifyDuplicateGroup);

  const expected = Number(dump?.titleStats?.duplicateGroupCount ?? groups.length);
  if (classified.length !== 8 && expected === 8) {
    holds.push({
      id: 'DUPLICATE_GROUP_COUNT_DRIFT',
      detail: `Expected 8 groups from prior preflight; investigation found ${classified.length}.`,
    });
  }
  if (classified.length !== expected && Number.isFinite(expected)) {
    holds.push({
      id: 'GROUP_COUNT_INTERNAL_MISMATCH',
      detail: `titleStats.duplicateGroupCount=${expected} but classified=${classified.length}.`,
    });
  }

  for (const group of classified) {
    if (group.remediationCase === 'C_SCHEMA_CONTRACT_CONFLICT_CANDIDATE') {
      holds.push({
        id: 'SCHEMA_CONTRACT_CONFLICT_CANDIDATE',
        detail: `${group.groupId}: same Title but differing parent identity fields.`,
      });
    }
    if (group.classification === 'AMBIGUOUS') {
      holds.push({
        id: 'AMBIGUOUS_GROUP',
        detail: `${group.groupId}: human decision required; no auto winner.`,
      });
    }
  }

  const emptyCandidates = classified.filter((g) => g.classification === 'EMPTY_DUPLICATE_CANDIDATE').length;
  const activeDuplicates = classified.filter((g) => g.classification === 'ACTIVE_DUPLICATE').length;
  const ambiguousGroups = classified.filter((g) => g.classification === 'AMBIGUOUS').length;
  const schemaConflicts = classified.filter((g) => g.remediationCase === 'C_SCHEMA_CONTRACT_CONFLICT_CANDIDATE').length;

  // Definition PASS if all groups accounted and read complete — data mutation still not authorized.
  // HOLD if incomplete evidence.
  let definition = 'PASS';
  if (readCompleteness !== 'PASS') definition = 'HOLD';
  if (classified.length === 0) definition = 'HOLD';

  notes.push('Automatic winner selection is PROHIBITED.');
  notes.push('EMPTY_DUPLICATE_CANDIDATE is not permission to delete.');
  notes.push('Data mutation requires a separate Human Data Remediation GO.');

  return {
    id: LIVE_SCHEMA_DATA_REMEDIATION_ID,
    phase: 'Definition',
    ...LIVE_SCHEMA_DATA_REMEDIATION_CORRECTION_BASELINE,
    readCompleteness,
    definition,
    expectedDuplicateGroups: 8,
    duplicateGroupsAccounted: classified.length,
    affectedParentItems: classified.reduce((sum, g) => sum + g.groupSize, 0),
    childReferences: dump?.childRefsSummary?.ok ? 'COMPLETE' : 'INCOMPLETE',
    emptyDuplicateCandidates: emptyCandidates,
    activeDuplicates,
    ambiguousGroups,
    schemaContractConflictCandidates: schemaConflicts,
    holds,
    groups: classified,
    notes,
    dataMutation: 'NONE',
    schemaMutation: 'NONE',
    deploy: 'NOT_AUTHORIZED',
  };
}
