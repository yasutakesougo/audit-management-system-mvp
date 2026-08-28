/**
 * LIVE-SCHEMA-DATA-REMEDIATION-V1 — classify GET-only duplicate investigation dumps.
 * Never selects a winner. Never mutates SharePoint.
 */

export const LIVE_SCHEMA_DATA_REMEDIATION_ID = 'LIVE-SCHEMA-DATA-REMEDIATION-V1';

export const LIVE_SCHEMA_DATA_REMEDIATION_CORRECTION_BASELINE = {
  dataMutationAuthority: 'NOT_YET_AUTHORIZED',
  schemaMutation: 'PROHIBITED',
  deploy: 'NOT AUTHORIZED',
  automaticWinnerSelection: 'PROHIBITED',
  automaticDuplicateRepair: 'PROHIBITED',
};

/**
 * Correction-1 — Definition fail-closed / routing fixes (no SharePoint mutation).
 *
 * P1-1: Case A (EMPTY_DUPLICATE_CANDIDATE) requires content-significance evidence
 *       on every parent — childCount=0 alone is insufficient.
 * P1-2: Child-reference evidence must be complete and readable — else HOLD.
 * P1-3: Expected duplicate-group baseline is exactly 8 — count drift → definition HOLD.
 * P2-1: Case C routes to SCHEMA CONTRACT REASSESSMENT — not data remediation delete/merge.
 */
export const LIVE_SCHEMA_DATA_REMEDIATION_CORRECTION_1 = {
  id: 'LIVE-SCHEMA-DATA-REMEDIATION-V1-Correction-1',
  caseAContentSignificanceRequired: true,
  childEvidenceStrictFailClosed: true,
  childEvidenceTrueOnly: true,
  titleStatsPresenceRequired: true,
  titleStatsStrictBaseline: 8,
  expectedDuplicateGroupsStrictBaseline: 8,
  caseCRoute:
    'SCHEMA_CONTRACT_REASSESSMENT — do not route Case C to data remediation delete/merge.',
  sharePointMutation: 'NONE',
  deploy: 'NOT_AUTHORIZED',
};

/** Strict preflight baseline — drift fails definition (P1-3). */
export const EXPECTED_DUPLICATE_GROUP_BASELINE = 8;

/**
 * True-only evidence gate — literal `true` passes; truthy non-boolean fails closed.
 * @param {unknown} value
 */
export function isEvidenceTrue(value) {
  return value === true;
}

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
 * Content significance booleans — no payload (P1-1).
 * @param {Record<string, unknown>} item
 */
export function assessItemContentSignificance(item) {
  const verified = item.contentSignificanceVerified === true;
  const userRowsJSONPresent = item.userRowsJSONPresent === true;
  const userCountPositive = item.userCountPositive === true
    || (item.userCount != null && Number(item.userCount) > 0);
  const latestVersionPositive = item.latestVersionPositive === true
    || (item.latestVersion != null && Number(item.latestVersion) > 0);
  const recordDatePresent = !isBlank(item.RecordDate);
  const userIdPresent = !isBlank(item.UserId);

  const hasSignificantContent = userRowsJSONPresent || userCountPositive || latestVersionPositive;

  return {
    verified,
    userRowsJSONPresent,
    userCountPositive,
    latestVersionPositive,
    recordDatePresent,
    userIdPresent,
    hasSignificantContent,
    allInsignificant:
      verified
      && !hasSignificantContent
      && !recordDatePresent
      && !userIdPresent,
  };
}

/**
 * @param {Array<Record<string, unknown>>} items
 */
function assessGroupContentSignificance(items) {
  const perItem = items.map(assessItemContentSignificance);
  const allVerified = perItem.length > 0 && perItem.every((s) => s.verified);
  const anySignificant = perItem.some((s) => s.hasSignificantContent);
  const allInsignificant = allVerified && perItem.every((s) => s.allInsignificant);

  return {
    perItem,
    allVerified,
    anySignificant,
    allInsignificant,
  };
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
  const content = assessGroupContentSignificance(items);

  let classification = 'AMBIGUOUS';
  let remediationCase = 'B_MEANINGFUL_OR_AMBIGUOUS';
  /** @type {string | null} */
  let remediationRoute = null;
  const holdReasons = [];

  // P2-1: Case C — schema contract conflict, not data remediation delete/merge
  if (recordDateComparison === 'DIFFERENT' || userIdComparison === 'DIFFERENT') {
    classification = 'SCHEMA_CONTRACT_CONFLICT';
    remediationCase = 'C_SCHEMA_CONTRACT_CONFLICT';
    remediationRoute = 'SCHEMA_CONTRACT_REASSESSMENT';
    holdReasons.push(
      'Same Title but distinct logical parents — route to SCHEMA CONTRACT REASSESSMENT (not data remediation delete/merge)',
    );
  } else if (parentsWithChildren > 1) {
    classification = 'ACTIVE_DUPLICATE';
    remediationCase = 'B_MEANINGFUL_OR_AMBIGUOUS';
    holdReasons.push('Child rows exist on multiple duplicate parents');
  } else if (totalChildren > 0) {
    classification = 'ACTIVE_DUPLICATE';
    remediationCase = 'B_MEANINGFUL_OR_AMBIGUOUS';
    holdReasons.push('At least one parent has child references');
  } else if (content.anySignificant) {
    classification = 'ACTIVE_DUPLICATE';
    remediationCase = 'B_MEANINGFUL_OR_AMBIGUOUS';
    holdReasons.push('Parent content-significance evidence present despite zero child refs');
  } else if (
    items.length >= 2
    && childCounts.every((n) => n === 0)
    && recordDateComparison !== 'DIFFERENT'
    && userIdComparison !== 'DIFFERENT'
  ) {
    // P1-1: Case A requires verified insignificant content on every parent
    if (!content.allVerified) {
      classification = 'AMBIGUOUS';
      remediationCase = 'B_MEANINGFUL_OR_AMBIGUOUS';
      holdReasons.push(
        'CONTENT_SIGNIFICANCE_UNVERIFIED — cannot label EMPTY_DUPLICATE_CANDIDATE without content evidence',
      );
    } else if (content.allInsignificant) {
      classification = 'EMPTY_DUPLICATE_CANDIDATE';
      remediationCase = 'A_EMPTY_ACCIDENTAL_CANDIDATE';
      holdReasons.push(
        'Content-significance verified empty on all parents — still requires human decision (no auto delete)',
      );
    } else {
      classification = 'AMBIGUOUS';
      remediationCase = 'B_MEANINGFUL_OR_AMBIGUOUS';
      holdReasons.push('Mixed or unverified parent content — no safe Case A labeling');
    }
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
    contentSignificance: {
      verified: content.allVerified,
      anySignificant: content.anySignificant,
      allInsignificant: content.allInsignificant,
    },
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
    remediationRoute,
    dataRemediationEligible: remediationRoute !== 'SCHEMA_CONTRACT_REASSESSMENT',
    automaticRemediation: 'PROHIBITED',
    humanDecisionRequired: true,
    holdReasons,
  };
}

/**
 * @param {{ lists?: any, duplicateGroups?: any[], titleStats?: any, childRefsSummary?: any, contentSignificanceCapture?: any }} dump
 */
export function classifyDataRemediationInvestigation(dump) {
  const lists = dump?.lists || {};
  const holds = [];
  const notes = [];

  const parent = lists.SupportRecord_Daily;
  const child = lists.DailyRecordRows;

  let readCompleteness = 'PASS';

  // P1-2: parent enumeration true-only fail-closed
  if (!isEvidenceTrue(parent?.enumerationComplete)) {
    readCompleteness = 'HOLD';
    holds.push({
      id: 'PARENT_ENUMERATION_INCOMPLETE',
      detail: 'SupportRecord_Daily enumerationComplete must be true (true-only fail-closed).',
    });
  }

  // P1-2: child evidence true-only fail-closed — every flag must be literal true
  const childRefsSummary = dump?.childRefsSummary;
  const parentIdField = childRefsSummary?.parentIdField ?? dump?.parentIdFieldUsed ?? null;

  if (!childRefsSummary) {
    readCompleteness = 'HOLD';
    holds.push({
      id: 'CHILD_REFERENCE_EVIDENCE_MISSING',
      detail: 'childRefsSummary absent — child evidence unread (true-only fail-closed).',
    });
  } else {
    if (!isEvidenceTrue(childRefsSummary.ok)) {
      readCompleteness = 'HOLD';
      holds.push({
        id: 'CHILD_REFERENCE_EVIDENCE_INCOMPLETE',
        detail: childRefsSummary.error || 'childRefsSummary.ok must be true (true-only fail-closed).',
      });
    }
    if (!isEvidenceTrue(childRefsSummary.enumerationComplete)) {
      readCompleteness = 'HOLD';
      holds.push({
        id: 'CHILD_REFERENCE_ENUMERATION_INCOMPLETE',
        detail: 'childRefsSummary.enumerationComplete must be true (true-only fail-closed).',
      });
    }
  }

  if (!parentIdField) {
    readCompleteness = 'HOLD';
    holds.push({
      id: 'CHILD_PARENT_ID_FIELD_MISSING',
      detail: 'ParentID field not resolved on DailyRecordRows.',
    });
  }

  if (!child) {
    readCompleteness = 'HOLD';
    holds.push({
      id: 'CHILD_LIST_EVIDENCE_MISSING',
      detail: 'DailyRecordRows list evidence absent from investigation dump.',
    });
  } else if (!isEvidenceTrue(child.enumerationComplete)) {
    readCompleteness = 'HOLD';
    holds.push({
      id: 'CHILD_ENUMERATION_INCOMPLETE',
      detail: 'DailyRecordRows enumerationComplete must be true (true-only fail-closed).',
    });
  }

  const groups = Array.isArray(dump?.duplicateGroups) ? dump.duplicateGroups : [];
  const classified = groups.map(classifyDuplicateGroup);

  // P1-3 + titleStats: strict 8-group baseline with titleStats presence requirement
  const titleStats = dump?.titleStats;
  let titleStatsValid = false;

  if (!titleStats || typeof titleStats !== 'object') {
    readCompleteness = 'HOLD';
    holds.push({
      id: 'TITLE_STATS_MISSING',
      detail: 'titleStats absent — duplicateGroupCount baseline unread (strict fail-closed).',
    });
  } else if (titleStats.duplicateGroupCount !== EXPECTED_DUPLICATE_GROUP_BASELINE) {
    readCompleteness = 'HOLD';
    holds.push({
      id: 'TITLE_STATS_BASELINE_MISMATCH',
      detail:
        `titleStats.duplicateGroupCount must be exactly ${EXPECTED_DUPLICATE_GROUP_BASELINE}; got ${titleStats.duplicateGroupCount}.`,
    });
  } else {
    titleStatsValid = true;
  }

  if (classified.length !== EXPECTED_DUPLICATE_GROUP_BASELINE) {
    holds.push({
      id: 'DUPLICATE_GROUP_COUNT_BASELINE_MISMATCH',
      detail:
        `Strict baseline requires exactly ${EXPECTED_DUPLICATE_GROUP_BASELINE} groups; found ${classified.length}.`,
    });
  }

  if (
    titleStatsValid
    && titleStats.duplicateGroupCount !== classified.length
  ) {
    holds.push({
      id: 'GROUP_COUNT_INTERNAL_MISMATCH',
      detail: `titleStats.duplicateGroupCount=${titleStats.duplicateGroupCount} but classified=${classified.length}.`,
    });
  }

  for (const group of classified) {
    if (group.remediationRoute === 'SCHEMA_CONTRACT_REASSESSMENT') {
      holds.push({
        id: 'SCHEMA_CONTRACT_REASSESSMENT_REQUIRED',
        detail: `${group.groupId}: Case C — schema contract reassessment; data remediation delete/merge prohibited.`,
      });
    }
    if (group.classification === 'AMBIGUOUS') {
      holds.push({
        id: 'AMBIGUOUS_GROUP',
        detail: `${group.groupId}: human decision required; no auto winner.`,
      });
    }
    if (group.holdReasons.some((r) => r.includes('CONTENT_SIGNIFICANCE_UNVERIFIED'))) {
      holds.push({
        id: 'CONTENT_SIGNIFICANCE_UNVERIFIED',
        detail: `${group.groupId}: Case A blocked — content significance evidence not captured or incomplete.`,
      });
    }
  }

  const contentCaptureVerified = dump?.contentSignificanceCapture?.verified === true;
  if (!contentCaptureVerified) {
    notes.push(
      'P1-1: content-significance fields not captured in investigation — Case A labeling blocked.',
    );
  }

  const emptyCandidates = classified.filter((g) => g.classification === 'EMPTY_DUPLICATE_CANDIDATE').length;
  const activeDuplicates = classified.filter((g) => g.classification === 'ACTIVE_DUPLICATE').length;
  const ambiguousGroups = classified.filter((g) => g.classification === 'AMBIGUOUS').length;
  const schemaConflicts = classified.filter((g) => g.remediationRoute === 'SCHEMA_CONTRACT_REASSESSMENT').length;

  let definition = 'PASS';
  if (readCompleteness !== 'PASS') definition = 'HOLD';
  if (classified.length === 0) definition = 'HOLD';
  if (classified.length !== EXPECTED_DUPLICATE_GROUP_BASELINE) definition = 'HOLD';
  if (!titleStatsValid) definition = 'HOLD';

  const childEvidenceComplete =
    isEvidenceTrue(childRefsSummary?.ok)
    && isEvidenceTrue(childRefsSummary?.enumerationComplete)
    && Boolean(parentIdField)
    && isEvidenceTrue(child?.enumerationComplete);

  notes.push('Automatic winner selection is PROHIBITED.');
  notes.push('EMPTY_DUPLICATE_CANDIDATE is not permission to delete.');
  notes.push('Case C (SCHEMA_CONTRACT_CONFLICT) routes to schema reassessment — not delete/merge.');
  notes.push('Data mutation requires a separate Human Data Remediation GO.');

  return {
    id: LIVE_SCHEMA_DATA_REMEDIATION_ID,
    phase: 'Definition',
    correction: LIVE_SCHEMA_DATA_REMEDIATION_CORRECTION_1,
    ...LIVE_SCHEMA_DATA_REMEDIATION_CORRECTION_BASELINE,
    readCompleteness,
    definition,
    expectedDuplicateGroups: EXPECTED_DUPLICATE_GROUP_BASELINE,
    duplicateGroupsAccounted: classified.length,
    affectedParentItems: classified.reduce((sum, g) => sum + g.groupSize, 0),
    childReferences: childEvidenceComplete ? 'COMPLETE' : 'INCOMPLETE',
    contentSignificanceCapture: contentCaptureVerified ? 'VERIFIED' : 'NOT_CAPTURED',
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
