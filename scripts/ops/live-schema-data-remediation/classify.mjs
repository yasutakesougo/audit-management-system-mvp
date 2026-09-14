/**
 * LIVE-SCHEMA-DATA-REMEDIATION-V1 — classify GET-only duplicate investigation dumps.
 * Never selects a winner. Never mutates SharePoint.
 *
 * Correction-2: Evidence Collection — structured contentSignificance, stable TD IDs,
 * mechanical CASE_*_CANDIDATE labels (not Human-authorized Cases).
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

/**
 * Correction-2 — Evidence Collection (additive; does not unlock mutation).
 *
 * - One-shot evidence fields + structured contentSignificance { value, basis, evidence }
 * - Frozen TD register (stable groupId by parent ID set)
 * - Mechanical CASE_*_CANDIDATE only — Human Disposition still required
 * - Case C lane = SCHEMA_CONTRACT_REASSESSMENT (never data remediation)
 */
export const LIVE_SCHEMA_DATA_REMEDIATION_CORRECTION_2 = {
  id: 'LIVE-SCHEMA-DATA-REMEDIATION-V1-Correction-2',
  phaseScope: 'Phase0_Baseline_Phase1_Evidence_Phase2_Candidates',
  structuredContentSignificance: true,
  frozenTdRegisterRequired: true,
  mechanicalCandidatesOnly: true,
  candidateDoesNotAuthorizeCase: true,
  caseACandidateIsNotDelete: true,
  caseCLane: 'SCHEMA_CONTRACT_REASSESSMENT',
  factsAreNotAuthority: true,
  sharePointMutation: 'NONE',
  deploy: 'NOT_AUTHORIZED',
};

/**
 * Correction-3 — Evidence ↔ Baseline identity binding (additive).
 *
 * P1: EVIDENCE_BASELINE_IDENTITY_NOT_MECHANICALLY_BOUND
 * - Classifier must load BASELINE.json
 * - Evidence dump.baselineHead is required and must exactly equal baseline.head
 * - Captured listIds bind into baseline identity; known listId mismatch → HOLD
 * - Stale Evidence reuse across HEAD drift is prohibited
 */
export const LIVE_SCHEMA_DATA_REMEDIATION_CORRECTION_3 = {
  id: 'LIVE-SCHEMA-DATA-REMEDIATION-V1-Correction-3',
  holdId: 'EVIDENCE_BASELINE_IDENTITY_NOT_MECHANICALLY_BOUND',
  baselineHeadExactMatchRequired: true,
  baselineHeadNullHolds: true,
  listIdBindOnCapture: true,
  knownListIdMismatchHolds: true,
  staleEvidenceReuse: 'PROHIBITED',
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
 * Normalize SharePoint list GUID / id for exact string compare.
 * @param {unknown} value
 * @returns {string | null}
 */
export function normalizeListId(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (s === '' || s === 'null' || s === 'undefined') return null;
  return s.replace(/^\{/, '').replace(/\}$/, '').toLowerCase();
}

/**
 * Correction-3 — verify dump is mechanically bound to Phase 0 BASELINE.json.
 *
 * @param {Record<string, unknown> | null | undefined} baseline
 * @param {Record<string, unknown> | null | undefined} dump
 */
export function verifyBaselineIdentity(baseline, dump) {
  /** @type {Array<{ id: string, detail: string }>} */
  const holds = [];
  const expectedHead = baseline && !isBlank(baseline.head) ? String(baseline.head).trim() : null;
  const observedHead = dump && !isBlank(dump.baselineHead) ? String(dump.baselineHead).trim() : null;

  let headResult = 'PASS';
  if (!baseline || typeof baseline !== 'object') {
    headResult = 'HOLD';
    holds.push({
      id: 'BASELINE_MISSING',
      detail: 'BASELINE.json not loaded — Evidence cannot bind to Phase 0 identity.',
    });
  } else if (expectedHead == null) {
    headResult = 'HOLD';
    holds.push({
      id: 'BASELINE_HEAD_MISSING',
      detail: 'BASELINE.json head is null/blank — Phase 0 baseline incomplete.',
    });
  } else if (observedHead == null) {
    headResult = 'HOLD';
    holds.push({
      id: LIVE_SCHEMA_DATA_REMEDIATION_CORRECTION_3.holdId,
      detail:
        'Evidence dump.baselineHead is null/absent — cannot prove binding to BASELINE.json head. Stale Evidence reuse prohibited.',
    });
  } else if (observedHead !== expectedHead) {
    headResult = 'HOLD';
    holds.push({
      id: 'BASELINE_HEAD_MISMATCH',
      detail:
        `Evidence baselineHead=${observedHead} does not exactly match BASELINE.head=${expectedHead}. Stale Evidence reuse prohibited.`,
    });
  }

  const baselineLists = (baseline && baseline.lists && typeof baseline.lists === 'object')
    ? /** @type {Record<string, any>} */ (baseline.lists)
    : {};
  const dumpLists = (dump && dump.lists && typeof dump.lists === 'object')
    ? /** @type {Record<string, any>} */ (dump.lists)
    : {};

  /** @type {Record<string, object>} */
  const listDetails = {};
  let listIdentityResult = 'PASS';
  const listNames = Object.keys(baselineLists).length > 0
    ? Object.keys(baselineLists)
    : ['SupportRecord_Daily', 'DailyRecordRows'];

  for (const name of listNames) {
    const expected = baselineLists[name] || {};
    const observed = dumpLists[name] || {};
    const expectedListId = normalizeListId(expected.listId);
    const observedListId = normalizeListId(observed.listId ?? observed.Id);

    if (expectedListId == null) {
      if (observedListId != null) {
        listDetails[name] = {
          title: expected.title ?? name,
          expectedListId: null,
          observedListId,
          result: 'CAPTURED',
          detail: 'Initial listId capture — bind into baseline identity for subsequent runs.',
        };
      } else {
        listDetails[name] = {
          title: expected.title ?? name,
          expectedListId: null,
          observedListId: null,
          result: 'PENDING_CAPTURE',
          detail: 'Baseline listId not yet bound; dump also lacks listId.',
        };
      }
      continue;
    }

    if (observedListId == null) {
      listIdentityResult = 'HOLD';
      listDetails[name] = {
        title: expected.title ?? name,
        expectedListId,
        observedListId: null,
        result: 'HOLD',
        detail: 'Known baseline listId present but Evidence dump listId missing.',
      };
      holds.push({
        id: 'BASELINE_LIST_ID_MISSING_IN_EVIDENCE',
        detail: `${name}: expected listId=${expectedListId} but dump listId is null.`,
      });
    } else if (observedListId !== expectedListId) {
      listIdentityResult = 'HOLD';
      listDetails[name] = {
        title: expected.title ?? name,
        expectedListId,
        observedListId,
        result: 'HOLD',
        detail: 'Known listId mismatch — Evidence targets a different list identity.',
      };
      holds.push({
        id: 'BASELINE_LIST_ID_MISMATCH',
        detail: `${name}: expected listId=${expectedListId} observed=${observedListId}.`,
      });
    } else {
      listDetails[name] = {
        title: expected.title ?? name,
        expectedListId,
        observedListId,
        result: 'PASS',
        detail: 'listId exact match.',
      };
    }
  }

  const result = headResult === 'PASS' && listIdentityResult !== 'HOLD' ? 'PASS' : 'HOLD';

  return {
    correction: LIVE_SCHEMA_DATA_REMEDIATION_CORRECTION_3,
    expectedHead,
    observedHead,
    result: headResult === 'HOLD' ? 'HOLD' : result,
    headResult,
    listIdentityResult,
    lists: listDetails,
    holds,
    staleEvidenceReuse: result === 'HOLD' ? 'PROHIBITED_HOLD' : 'NOT_APPLICABLE',
  };
}

/**
 * Apply first-capture listIds into a baseline object (in-memory bind).
 * @param {Record<string, any>} baseline
 * @param {ReturnType<typeof verifyBaselineIdentity>} verification
 * @returns {{ baseline: Record<string, any>, changed: boolean }}
 */
export function bindCapturedListIdsToBaseline(baseline, verification) {
  const next = JSON.parse(JSON.stringify(baseline));
  let changed = false;
  if (!next.lists || typeof next.lists !== 'object') next.lists = {};
  for (const [name, detail] of Object.entries(verification.lists || {})) {
    if (detail.result !== 'CAPTURED' || !detail.observedListId) continue;
    if (!next.lists[name] || typeof next.lists[name] !== 'object') {
      next.lists[name] = { title: name };
    }
    next.lists[name].listId = detail.observedListId;
    next.lists[name].listIdStatus = 'BOUND';
    changed = true;
  }
  if (changed) {
    next.correction3Status = 'BASELINE_LIST_IDS_BOUND';
  }
  return { baseline: next, changed };
}

/**
 * Frozen TD register from Definition (#2557) — parent ID sets.
 * Re-runs must not reshuffle TD labels when the same ID sets appear.
 */
export const FROZEN_TD_REGISTER = Object.freeze({
  'TD-001': Object.freeze([7, 12, 15]),
  'TD-002': Object.freeze([3, 4, 5]),
  'TD-003': Object.freeze([2060, 2063]),
  'TD-004': Object.freeze([2084, 2085]),
  'TD-005': Object.freeze([21, 22]),
  'TD-006': Object.freeze([6, 11]),
  'TD-007': Object.freeze([13, 14]),
  'TD-008': Object.freeze([1, 2]),
});

/**
 * @param {Iterable<number|string>} ids
 */
export function idsKey(ids) {
  return [...ids].map(Number).sort((a, b) => a - b).join(',');
}

const FROZEN_BY_KEY = new Map(
  Object.entries(FROZEN_TD_REGISTER).map(([td, ids]) => [idsKey(ids), td]),
);

/**
 * Resolve stable TD id from parent item ID set.
 * @param {Array<number|string>} ids
 * @param {string|null|undefined} fallbackGroupId
 */
export function resolveStableGroupId(ids, fallbackGroupId) {
  const hit = FROZEN_BY_KEY.get(idsKey(ids || []));
  if (hit) return hit;
  if (fallbackGroupId && /^TD-\d{3}$/.test(String(fallbackGroupId))) return String(fallbackGroupId);
  return `TD-UNREGISTERED-${idsKey(ids || []) || 'empty'}`;
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
 * Normalize structured + legacy content-significance on one item.
 * @param {Record<string, unknown>} item
 */
export function assessItemContentSignificance(item) {
  const structured = item.contentSignificance && typeof item.contentSignificance === 'object'
    ? /** @type {Record<string, unknown>} */ (item.contentSignificance)
    : null;

  const verified = item.contentSignificanceVerified === true
    || structured?.value === 'TRUE'
    || structured?.value === 'FALSE';

  const userRowsJSONPresent = item.userRowsJSONPresent === true
    || structured?.evidence?.userRowsJSONPresent === true;
  const userCountPositive = item.userCountPositive === true
    || (item.userCount != null && Number(item.userCount) > 0)
    || structured?.evidence?.userCountPositive === true;
  const latestVersionPositive = item.latestVersionPositive === true
    || (item.latestVersion != null && Number(item.latestVersion) > 0)
    || structured?.evidence?.latestVersionPositive === true;
  const recordDatePresent = !isBlank(item.RecordDate);
  const userIdPresent = !isBlank(item.UserId);

  const hasSignificantContent = userRowsJSONPresent || userCountPositive || latestVersionPositive;

  let structuredValue = 'UNKNOWN';
  if (structured && typeof structured.value === 'string') {
    structuredValue = structured.value;
  } else if (verified) {
    structuredValue = hasSignificantContent ? 'TRUE' : 'FALSE';
  }

  const basis = Array.isArray(structured?.basis)
    ? structured.basis.map(String)
    : [];
  if (basis.length === 0) {
    if (!verified) basis.push('content-significance fields not verified');
    else {
      basis.push(userRowsJSONPresent ? 'UserRowsJSON contains business content' : 'UserRowsJSON is empty');
      basis.push(userCountPositive ? 'UserCount positive' : 'UserCount empty or zero');
      basis.push(latestVersionPositive ? 'LatestVersion positive' : 'LatestVersion empty or zero');
    }
  }

  const evidence = structured?.evidence && typeof structured.evidence === 'object'
    ? structured.evidence
    : {
      itemId: item.Id ?? null,
      userRowsJSONPresent,
      userCount: item.userCount ?? null,
      userCountPositive,
      latestVersion: item.latestVersion ?? null,
      latestVersionPositive,
    };

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
    contentSignificance: {
      value: structuredValue,
      basis,
      evidence,
    },
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

  let groupValue = 'UNKNOWN';
  if (allVerified) groupValue = anySignificant ? 'TRUE' : 'FALSE';

  return {
    perItem,
    allVerified,
    anySignificant,
    allInsignificant,
    groupValue,
  };
}

/**
 * Map legacy classification → mechanical candidate (Correction-2).
 * @param {string} classification
 * @param {string | null} remediationRoute
 */
export function toMechanicalCandidate(classification, remediationRoute) {
  if (remediationRoute === 'SCHEMA_CONTRACT_REASSESSMENT'
    || classification === 'SCHEMA_CONTRACT_CONFLICT') {
    return 'CASE_C_CANDIDATE';
  }
  if (classification === 'EMPTY_DUPLICATE_CANDIDATE') return 'CASE_A_CANDIDATE';
  if (classification === 'ACTIVE_DUPLICATE') return 'CASE_B_CANDIDATE';
  return 'AMBIGUOUS';
}

/**
 * Suggested disposition text — not authority.
 * @param {string} candidate
 */
export function suggestedDispositionForCandidate(candidate) {
  switch (candidate) {
    case 'CASE_A_CANDIDATE':
      return 'DELETE GO or PRESERVE candidate (Human GO required; not authorized)';
    case 'CASE_B_CANDIDATE':
      return 'PRESERVE / MERGE GO / HOLD (Human GO required; child Gate if needed)';
    case 'CASE_C_CANDIDATE':
      return 'SCHEMA RE-EVALUATION only (no delete/merge)';
    default:
      return 'HOLD pending evidence / human review';
  }
}

/**
 * Phase 4 Human actions allowed in Decision Pack form only.
 * Presence in this set does NOT grant mutation authority.
 */
export const PHASE4_HUMAN_ACTIONS = Object.freeze([
  'PRESERVE',
  'DELETE GO',
  'MERGE GO',
  'SCHEMA RE-EVALUATION',
  'HOLD',
]);

/**
 * @param {string} candidate
 * @returns {string[]}
 */
export function allowedHumanActionsForCandidate(candidate) {
  if (candidate === 'CASE_C_CANDIDATE') {
    return ['SCHEMA RE-EVALUATION', 'HOLD'];
  }
  if (candidate === 'CASE_A_CANDIDATE' || candidate === 'CASE_B_CANDIDATE') {
    return ['PRESERVE', 'DELETE GO', 'MERGE GO', 'HOLD'];
  }
  return ['HOLD'];
}

/**
 * Recommended disposition token for Decision Pack (not authority).
 * @param {string} candidate
 */
export function recommendedDispositionToken(candidate) {
  switch (candidate) {
    case 'CASE_A_CANDIDATE':
      return 'DELETE GO';
    case 'CASE_B_CANDIDATE':
      return 'PRESERVE';
    case 'CASE_C_CANDIDATE':
      return 'SCHEMA RE-EVALUATION';
    default:
      return 'HOLD';
  }
}

/**
 * @param {string} candidate
 */
export function laneForCandidate(candidate) {
  if (candidate === 'CASE_C_CANDIDATE') return 'SCHEMA_CONTRACT_REASSESSMENT';
  if (candidate === 'CASE_A_CANDIDATE' || candidate === 'CASE_B_CANDIDATE') {
    return 'DATA_REMEDIATION';
  }
  return 'HOLD_REVIEW';
}

/**
 * @param {object} group
 */
export function classifyDuplicateGroup(group) {
  const items = Array.isArray(group.items) ? group.items : [];
  const parentItemIds = group.parentItemIds || items.map((item) => item.Id);
  const groupId = resolveStableGroupId(parentItemIds, group.groupId);

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

  const candidate = toMechanicalCandidate(classification, remediationRoute);
  const lane = laneForCandidate(candidate);

  return {
    groupId,
    parentItemIds,
    groupSize: group.groupSize || items.length,
    titleDisplay: redactTitle(group.title),
    recordDateComparison,
    userIdComparison,
    contentSignificance: {
      verified: content.allVerified,
      anySignificant: content.anySignificant,
      allInsignificant: content.allInsignificant,
      value: content.groupValue,
      perItem: content.perItem.map((p, i) => ({
        Id: items[i]?.Id ?? null,
        ...p.contentSignificance,
      })),
    },
    childReferences: Object.fromEntries(
      items.map((item) => [String(item.Id), Number(item.childCount) || 0]),
    ),
    createdModified: items.map((item) => ({
      Id: item.Id,
      Created: item.Created ?? null,
      Modified: item.Modified ?? null,
      AuthorId: item.AuthorId ?? null,
      AuthorTitlePresent: item.AuthorTitlePresent === true,
      EditorId: item.EditorId ?? null,
      EditorTitlePresent: item.EditorTitlePresent === true,
      lifecycle: item.lifecycle ?? { status: 'UNKNOWN' },
      archival: item.archival ?? { status: 'NOT_PROBED' },
    })),
    // Legacy labels (Definition Correction-1 compatibility)
    classification,
    remediationCase,
    remediationRoute,
    // Correction-2 mechanical candidates
    candidate,
    lane,
    suggestedDisposition: suggestedDispositionForCandidate(candidate),
    recommendedDisposition: recommendedDispositionToken(candidate),
    allowedHumanActions: allowedHumanActionsForCandidate(candidate),
    dataRemediationEligible: remediationRoute !== 'SCHEMA_CONTRACT_REASSESSMENT',
    automaticRemediation: 'PROHIBITED',
    humanDecisionRequired: true,
    humanDecision: null,
    requestedHumanAction: null,
    targetItemIds: null,
    expectedPostState: null,
    rollback: null,
    mutationAuthorityStatus: 'NOT_AUTHORIZED',
    reviewerDecision: null,
    decisionRationale: null,
    holdReasons,
  };
}

/**
 * @param {{ lists?: any, duplicateGroups?: any[], titleStats?: any, childRefsSummary?: any, contentSignificanceCapture?: any, baselineHead?: string | null }} dump
 * @param {{ baseline?: Record<string, unknown> | null }} [options]
 */
export function classifyDataRemediationInvestigation(dump, options = {}) {
  const lists = dump?.lists || {};
  const holds = [];
  const notes = [];

  const parent = lists.SupportRecord_Daily;
  const child = lists.DailyRecordRows;

  let readCompleteness = 'PASS';

  // Correction-3: Baseline ↔ Evidence identity binding (required)
  const baseline = options.baseline ?? null;
  const baselineVerification = verifyBaselineIdentity(baseline, dump);
  holds.push(...baselineVerification.holds);

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
  // Stable sort by TD id for Decision Pack readability
  classified.sort((a, b) => String(a.groupId).localeCompare(String(b.groupId)));

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

  // Frozen TD coverage — warn/HOLD if registered sets missing when count==8
  const classifiedKeys = new Set(classified.map((g) => idsKey(g.parentItemIds)));
  for (const [td, ids] of Object.entries(FROZEN_TD_REGISTER)) {
    if (!classifiedKeys.has(idsKey(ids))) {
      holds.push({
        id: 'FROZEN_TD_REGISTER_MISS',
        detail: `${td} parent ID set ${JSON.stringify(ids)} not present in this dump.`,
      });
    }
  }

  for (const group of classified) {
    if (group.remediationRoute === 'SCHEMA_CONTRACT_REASSESSMENT') {
      holds.push({
        id: 'SCHEMA_CONTRACT_REASSESSMENT_REQUIRED',
        detail: `${group.groupId}: Case C candidate — schema contract reassessment; data remediation delete/merge prohibited.`,
      });
    }
    if (group.candidate === 'AMBIGUOUS' || group.classification === 'AMBIGUOUS') {
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

  const emptyCandidates = classified.filter((g) => g.candidate === 'CASE_A_CANDIDATE').length;
  const activeDuplicates = classified.filter((g) => g.candidate === 'CASE_B_CANDIDATE').length;
  const ambiguousGroups = classified.filter((g) => g.candidate === 'AMBIGUOUS').length;
  const schemaConflicts = classified.filter((g) => g.candidate === 'CASE_C_CANDIDATE').length;

  let definition = 'PASS';
  if (readCompleteness !== 'PASS') definition = 'HOLD';
  if (classified.length === 0) definition = 'HOLD';
  if (classified.length !== EXPECTED_DUPLICATE_GROUP_BASELINE) definition = 'HOLD';
  if (!titleStatsValid) definition = 'HOLD';
  if (baselineVerification.result === 'HOLD') definition = 'HOLD';

  const childEvidenceComplete =
    isEvidenceTrue(childRefsSummary?.ok)
    && isEvidenceTrue(childRefsSummary?.enumerationComplete)
    && Boolean(parentIdField)
    && isEvidenceTrue(child?.enumerationComplete);

  notes.push('Automatic winner selection is PROHIBITED.');
  notes.push('CASE_A_CANDIDATE / EMPTY_DUPLICATE_CANDIDATE is not permission to delete.');
  notes.push('CASE_C_CANDIDATE routes to schema reassessment — not delete/merge.');
  notes.push('Mechanical candidates are not Human-authorized Cases.');
  notes.push('Data mutation requires a separate Human Data Remediation GO (Phase 4).');
  notes.push('Correction-3: Evidence must bind baselineHead + list identity to BASELINE.json.');

  return {
    id: LIVE_SCHEMA_DATA_REMEDIATION_ID,
    phase: 'Phase2_MechanicalCandidates',
    correction: LIVE_SCHEMA_DATA_REMEDIATION_CORRECTION_1,
    correction2: LIVE_SCHEMA_DATA_REMEDIATION_CORRECTION_2,
    correction3: LIVE_SCHEMA_DATA_REMEDIATION_CORRECTION_3,
    ...LIVE_SCHEMA_DATA_REMEDIATION_CORRECTION_BASELINE,
    baselineVerification,
    readCompleteness,
    definition,
    expectedDuplicateGroups: EXPECTED_DUPLICATE_GROUP_BASELINE,
    duplicateGroupsAccounted: classified.length,
    affectedParentItems: classified.reduce((sum, g) => sum + g.groupSize, 0),
    childReferences: childEvidenceComplete ? 'COMPLETE' : 'INCOMPLETE',
    contentSignificanceCapture: contentCaptureVerified ? 'VERIFIED' : 'NOT_CAPTURED',
    emptyDuplicateCandidates: emptyCandidates,
    caseACandidates: emptyCandidates,
    activeDuplicates,
    caseBCandidates: activeDuplicates,
    ambiguousGroups,
    schemaContractConflictCandidates: schemaConflicts,
    caseCCandidates: schemaConflicts,
    holds,
    groups: classified,
    notes,
    dataMutation: 'NONE',
    schemaMutation: 'NONE',
    deploy: 'NOT_AUTHORIZED',
  };
}

/**
 * Build redacted Evidence Pack (observations + candidates; no raw Titles / display names).
 * @param {Record<string, unknown>} dump
 * @param {ReturnType<typeof classifyDataRemediationInvestigation>} classified
 */
export function buildEvidencePack(dump, classified) {
  const byId = new Map(
    (dump.duplicateGroups || []).map((g) => {
      const ids = g.parentItemIds || (g.items || []).map((it) => it.Id);
      return [resolveStableGroupId(ids, g.groupId), g];
    }),
  );

  const groups = classified.groups.map((c) => {
    const raw = byId.get(c.groupId) || {};
    const rawItems = Array.isArray(raw.items) ? raw.items : [];
    return {
      groupId: c.groupId,
      parentItemIds: c.parentItemIds,
      groupSize: c.groupSize,
      titleDisplay: c.titleDisplay,
      recordDateComparison: c.recordDateComparison,
      userIdComparison: c.userIdComparison,
      candidate: c.candidate,
      lane: c.lane,
      classification: c.classification,
      contentSignificance: c.contentSignificance,
      childReferences: c.childReferences,
      items: rawItems.map((item) => {
        const sig = assessItemContentSignificance(item);
        return {
          Id: item.Id,
          RecordDate: item.RecordDate ?? null,
          UserIdPresent: item.UserId != null && String(item.UserId).trim() !== '',
          businessKey: item.businessKey ?? {
            titlePresent: true,
            recordDate: item.RecordDate ?? null,
            userIdPresent: item.UserId != null && String(item.UserId).trim() !== '',
          },
          Created: item.Created ?? null,
          Modified: item.Modified ?? null,
          AuthorId: item.AuthorId ?? null,
          AuthorTitlePresent: item.AuthorTitlePresent === true,
          EditorId: item.EditorId ?? null,
          EditorTitlePresent: item.EditorTitlePresent === true,
          lifecycle: item.lifecycle ?? { status: 'UNKNOWN' },
          archival: item.archival ?? { status: 'NOT_PROBED' },
          schemaRelevant: item.schemaRelevant ?? {},
          childCount: item.childCount ?? 0,
          contentSignificanceVerified: sig.verified,
          userRowsJSONPresent: sig.userRowsJSONPresent,
          userCountPositive: sig.userCountPositive,
          latestVersionPositive: sig.latestVersionPositive,
          contentSignificance: sig.contentSignificance,
        };
      }),
      holdReasons: c.holdReasons,
      humanDecisionRequired: true,
      humanDecision: null,
      automaticRemediation: 'PROHIBITED',
      dataRemediationEligible: c.dataRemediationEligible,
    };
  });

  return {
    schemaVersion: 2,
    id: LIVE_SCHEMA_DATA_REMEDIATION_ID,
    phase: 'Phase1_EvidencePack',
    correction2: LIVE_SCHEMA_DATA_REMEDIATION_CORRECTION_2,
    correction3: LIVE_SCHEMA_DATA_REMEDIATION_CORRECTION_3,
    generatedAt: new Date().toISOString(),
    sourceGeneratedAt: dump.generatedAt ?? null,
    sourceInvestigationGeneratedAt: dump.sourceInvestigationGeneratedAt ?? null,
    baselineHead: dump.baselineHead ?? null,
    baselineVerification: classified.baselineVerification ?? null,
    siteUrl: dump.siteUrl ?? null,
    mode: dump.mode ?? 'file',
    httpMethods: dump.httpMethods ?? ['GET'],
    mutation: false,
    dataMutationAuthority: 'NOT_YET_AUTHORIZED',
    schemaMutation: 'NONE',
    deploy: 'NOT_AUTHORIZED',
    liveCaptureStatus: dump.liveCaptureStatus ?? (dump.mode === 'browser-rest' ? 'CAPTURED' : 'UNKNOWN'),
    liveCaptureHoldReason: dump.liveCaptureHoldReason ?? null,
    frozenTdRegister: FROZEN_TD_REGISTER,
    lists: dump.lists ?? null,
    titleStats: dump.titleStats ?? null,
    childRefsSummary: {
      ok: dump.childRefsSummary?.ok ?? null,
      parentIdField: dump.childRefsSummary?.parentIdField ?? dump.parentIdFieldUsed ?? null,
      rowsRead: dump.childRefsSummary?.rowsRead ?? null,
      enumerationComplete: dump.childRefsSummary?.enumerationComplete ?? null,
    },
    contentSignificanceCapture: dump.contentSignificanceCapture ?? null,
    fieldInventory: dump.fieldInventory ?? null,
    readCompleteness: classified.readCompleteness,
    definition: classified.definition,
    observationsOnly: true,
    factsAreNotAuthority: true,
    groups,
    holds: classified.holds,
    notes: [
      ...(classified.notes || []),
      'Evidence Pack contains observations and mechanical candidates only.',
      'Human Decision columns remain blank until Phase 4.',
      dump.liveCaptureStatus === 'HOLD'
        ? 'LIVE CAPTURE HOLD — re-run investigate.browser.js on signed-in /sites/welfare before Phase 4.'
        : null,
      classified.baselineVerification?.result === 'HOLD'
        ? 'Correction-3 HOLD — baselineHead/list identity not mechanically bound; stale Evidence reuse prohibited.'
        : null,
    ].filter(Boolean),
  };
}

/**
 * @param {ReturnType<typeof classifyDataRemediationInvestigation>} classified
 */
export function buildCandidateClassification(classified) {
  return {
    schemaVersion: 3,
    id: LIVE_SCHEMA_DATA_REMEDIATION_ID,
    phase: 'Phase2_MechanicalCandidates',
    correction2: LIVE_SCHEMA_DATA_REMEDIATION_CORRECTION_2,
    generatedAt: new Date().toISOString(),
    readCompleteness: classified.readCompleteness,
    definition: classified.definition,
    authority: {
      itemMutation: 'NOT_AUTHORIZED',
      schemaMutation: 'NOT_AUTHORIZED',
      humanDisposition: 'PENDING',
    },
    counts: {
      CASE_A_CANDIDATE: classified.caseACandidates,
      CASE_B_CANDIDATE: classified.caseBCandidates,
      CASE_C_CANDIDATE: classified.caseCCandidates,
      AMBIGUOUS: classified.ambiguousGroups,
    },
    phase4HumanActions: PHASE4_HUMAN_ACTIONS,
    rules: {
      CASE_A_CANDIDATE: '!= DELETE; Human GO required',
      CASE_C_CANDIDATE: 'lane = SCHEMA_CONTRACT_REASSESSMENT; no delete/merge',
      mechanicalCandidate: '!= authorized Case',
      decisionPackActions: 'PRESERVE|DELETE GO|MERGE GO|SCHEMA RE-EVALUATION|HOLD — form only; not authority',
    },
    groups: classified.groups.map((g) => ({
      groupId: g.groupId,
      parentItemIds: g.parentItemIds,
      candidate: g.candidate,
      lane: g.lane,
      significance: g.contentSignificance?.value ?? 'UNKNOWN',
      significanceVerified: g.contentSignificance?.verified === true,
      contentSignificance: g.contentSignificance,
      classification: g.classification,
      suggestedDisposition: g.suggestedDisposition,
      recommendedDisposition: g.recommendedDisposition,
      allowedHumanActions: g.allowedHumanActions,
      dataRemediationEligible: g.dataRemediationEligible,
      humanDecision: null,
      requestedHumanAction: null,
      targetItemIds: null,
      expectedPostState: null,
      rollback: null,
      mutationAuthorityStatus: 'NOT_AUTHORIZED',
      reviewerDecision: null,
      decisionRationale: null,
      holdReasons: g.holdReasons,
    })),
    notes: classified.notes,
  };
}

/**
 * Build structured Decision Pack rows (Phase 4 form; values blank / NOT_AUTHORIZED).
 * @param {ReturnType<typeof classifyDataRemediationInvestigation>} classified
 * @param {{ evidencePackPath?: string, candidatesPath?: string, sourceGeneratedAt?: string|null }} [refs]
 */
export function buildDecisionPack(classified, refs = {}) {
  const rows = classified.groups.map((g) => ({
    tdId: g.groupId,
    observedItemIds: g.parentItemIds,
    candidateClassification: g.candidate,
    contentSignificance: {
      value: g.contentSignificance?.value ?? 'UNKNOWN',
      verified: g.contentSignificance?.verified === true,
      perItem: g.contentSignificance?.perItem ?? [],
    },
    evidenceRefs: {
      evidencePack: refs.evidencePackPath ?? 'docs/evidence/live-schema-data-remediation-v1/EVIDENCE_PACK.json',
      candidates: refs.candidatesPath ?? 'docs/evidence/live-schema-data-remediation-v1/CANDIDATE_CLASSIFICATION.json',
      groupId: g.groupId,
      sourceGeneratedAt: refs.sourceGeneratedAt ?? null,
    },
    recommendedDisposition: g.recommendedDisposition,
    requestedHumanAction: null,
    targetItemIds: null,
    allowedHumanActions: g.allowedHumanActions,
    expectedPostState: null,
    rollback: null,
    mutationAuthorityStatus: 'NOT_AUTHORIZED',
    reviewerDecision: null,
    decisionRationale: null,
    lane: g.lane,
    dataRemediationEligible: g.dataRemediationEligible,
    holdReasons: g.holdReasons,
  }));

  return {
    schemaVersion: 3,
    id: LIVE_SCHEMA_DATA_REMEDIATION_ID,
    phase: 'Phase3_DecisionPack_Phase4_Form',
    generatedAt: new Date().toISOString(),
    bulkGo: 'PROHIBITED',
    mutationAuthorityStatus: 'NOT_AUTHORIZED',
    phase4HumanActions: PHASE4_HUMAN_ACTIONS,
    rules: {
      caseCActionsOnly: ['SCHEMA RE-EVALUATION', 'HOLD'],
      deleteOrMergeGo: 'Decision Pack form only — does NOT authorize SharePoint mutation',
      agentMustNotInventGo: true,
    },
    counts: {
      CASE_A_CANDIDATE: classified.caseACandidates,
      CASE_B_CANDIDATE: classified.caseBCandidates,
      CASE_C_CANDIDATE: classified.caseCCandidates,
      AMBIGUOUS: classified.ambiguousGroups,
    },
    rows,
  };
}

/**
 * Markdown Decision Pack for Human Review (Phase 3/4).
 * @param {ReturnType<typeof buildDecisionPack>} decisionPack
 * @param {{ phase3Exit?: ReturnType<typeof evaluatePhase3Exit> | null }} [opts]
 */
export function buildDecisionPackMarkdown(decisionPack, opts = {}) {
  const phase3 = opts.phase3Exit;
  const lines = [
    '# LIVE-SCHEMA-DATA-REMEDIATION-V1 — Decision Pack',
    '',
    '```text',
    'Phase: 3 Independent Evidence Review → 4 Human Disposition',
    'Bulk GO: PROHIBITED',
    'Mutation authority: NOT_AUTHORIZED (DELETE GO / MERGE GO are form labels only)',
    'CASE_*_CANDIDATE != authorized Case',
    'CASE_A_CANDIDATE != DELETE',
    `Phase3Exit: ${phase3?.result ?? 'PENDING'}`,
    '```',
    '',
    'Fill **Requested human action** + **TargetItemIds** + **Expected post-state** + **Rollback** + **Reviewer decision** per TD after Phase 3 PASS.',
    'Allowed actions: `PRESERVE` | `DELETE GO` | `MERGE GO` | `SCHEMA RE-EVALUATION` | `HOLD`.',
    'Case C rows may only use `SCHEMA RE-EVALUATION` or `HOLD` (never DELETE / PRESERVE-as-delete).',
    '',
    '| TD | Observed Item IDs | Candidate | Significance | Recommended | Allowed actions | Requested action | TargetItemIds | Expected post-state | Rollback | Mutation authority | Reviewer decision | Rationale |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ];

  for (const row of decisionPack.rows) {
    const ids = Array.isArray(row.observedItemIds) ? row.observedItemIds.join(',') : '';
    const allowed = (row.allowedHumanActions || []).join(' / ');
    const sig = row.contentSignificance?.value ?? 'UNKNOWN';
    lines.push(
      `| ${row.tdId} | ${ids} | ${row.candidateClassification} | ${sig} | ${row.recommendedDisposition} | ${allowed} | _blank_ | _blank_ | _blank_ | _blank_ | NOT_AUTHORIZED | _blank_ | _blank_ |`,
    );
  }

  lines.push(
    '',
    '## Lane split',
    '',
    '- **DATA_REMEDIATION** (A/B after Human Case authorization): TD+action GO only',
    '- **SCHEMA_CONTRACT_REASSESSMENT** (C): `SCHEMA RE-EVALUATION` / `HOLD` only — no delete/merge',
    '- **HOLD_REVIEW**: evidence gap — do not mutate',
    '',
    '## Phase 4 action semantics (form only)',
    '',
    '```text',
    'PRESERVE              — keep item(s); no delete',
    'DELETE GO             — authorize delete of named TargetItemIds only (not yet granted)',
    'MERGE GO              — authorize merge of named targets only (not yet granted)',
    'SCHEMA RE-EVALUATION  — Case C lane; never delete/merge to coerce Unique',
    'HOLD                  — no action',
    '```',
    '',
    '## Counts',
    '',
    '```json',
    JSON.stringify(decisionPack.counts, null, 2),
    '```',
    '',
  );

  if (phase3) {
    lines.push(
      '## Phase 3 Exit',
      '',
      '```json',
      JSON.stringify({
        result: phase3.result,
        unresolvedAmbiguityCount: phase3.unresolvedAmbiguityCount,
        checks: phase3.checks,
      }, null, 2),
      '```',
      '',
    );
  }

  return `${lines.join('\n')}\n`;
}

/**
 * Phase 3 Independent Evidence Review exit gate.
 * Pack existence alone is insufficient — all criteria must PASS.
 *
 * @param {Record<string, unknown>} dump
 * @param {ReturnType<typeof classifyDataRemediationInvestigation>} classified
 * @param {{ baseline?: Record<string, unknown> | null, evidencePack?: Record<string, unknown> | null }} [options]
 */
export function evaluatePhase3Exit(dump, classified, options = {}) {
  const baseline = options.baseline ?? null;
  const bv = classified.baselineVerification
    || verifyBaselineIdentity(baseline, dump);

  /** @type {Record<string, { result: string, detail: string }>} */
  const checks = {};

  // baselineHead fixed
  const headOk = bv.headResult === 'PASS'
    && bv.expectedHead != null
    && bv.observedHead != null
    && bv.expectedHead === bv.observedHead;
  checks.baselineHeadFixed = {
    result: headOk ? 'PASS' : 'HOLD',
    detail: headOk
      ? `baselineHead bound: ${bv.observedHead}`
      : `baselineHead not fixed (expected=${bv.expectedHead} observed=${bv.observedHead})`,
  };

  // listIds captured / bound (not PENDING)
  const listDetails = bv.lists || {};
  const listNames = ['SupportRecord_Daily', 'DailyRecordRows'];
  const listResults = listNames.map((n) => listDetails[n]?.result ?? 'MISSING');
  const listIdsCaptured = listResults.every((r) => r === 'PASS' || r === 'CAPTURED');
  const listIdsPending = listResults.some((r) => r === 'PENDING_CAPTURE' || r === 'MISSING' || r === 'HOLD');
  checks.listIdsCaptured = {
    result: listIdsCaptured && !listResults.includes('HOLD') ? 'PASS' : 'HOLD',
    detail: listIdsPending
      ? `list identity incomplete: ${JSON.stringify(listResults)}`
      : `list identity ok: ${JSON.stringify(Object.fromEntries(listNames.map((n) => [n, listDetails[n]?.result])))}`,
  };

  // TD-001...008 complete
  const present = new Set((classified.groups || []).map((g) => g.groupId));
  const missingTd = Object.keys(FROZEN_TD_REGISTER).filter((td) => !present.has(td));
  checks.tdRegisterComplete = {
    result: missingTd.length === 0 && (classified.groups || []).length === EXPECTED_DUPLICATE_GROUP_BASELINE
      ? 'PASS'
      : 'HOLD',
    detail: missingTd.length === 0
      ? 'TD-001...008 all present'
      : `missing TD: ${missingTd.join(', ')}`,
  };

  // contentSignificance.value ∈ TRUE/FALSE/UNKNOWN + basis/evidence present
  const sigIssues = [];
  for (const g of classified.groups || []) {
    const perItem = g.contentSignificance?.perItem || [];
    if (perItem.length === 0) {
      sigIssues.push(`${g.groupId}: no per-item contentSignificance`);
      continue;
    }
    for (const item of perItem) {
      const value = item?.value;
      if (value !== 'TRUE' && value !== 'FALSE' && value !== 'UNKNOWN') {
        sigIssues.push(`${g.groupId}/item ${item?.Id}: invalid value ${value}`);
      }
      if (!Array.isArray(item?.basis) || item.basis.length === 0) {
        sigIssues.push(`${g.groupId}/item ${item?.Id}: basis missing`);
      }
      if (!item?.evidence || typeof item.evidence !== 'object') {
        sigIssues.push(`${g.groupId}/item ${item?.Id}: evidence missing`);
      }
    }
  }
  // Case A path: UNKNOWN not allowed unless explicitly schema-absent documented
  for (const g of classified.groups || []) {
    if (g.candidate !== 'CASE_A_CANDIDATE') continue;
    const perItem = g.contentSignificance?.perItem || [];
    for (const item of perItem) {
      if (item?.value === 'UNKNOWN') {
        const schemaAbsent = item?.evidence?.schemaAbsent === true
          || item?.basis?.some?.((b) => /schema.?absent|field.?absent|not in schema/i.test(String(b)));
        if (!schemaAbsent) {
          sigIssues.push(
            `${g.groupId}/item ${item?.Id}: CASE_A_CANDIDATE cannot remain UNKNOWN without schema-absent evidence`,
          );
        }
      }
    }
  }

  checks.contentSignificanceComplete = {
    result: sigIssues.length === 0 ? 'PASS' : 'HOLD',
    detail: sigIssues.length === 0
      ? 'all parents have value∈{TRUE,FALSE,UNKNOWN} with basis+evidence; Case A not UNKNOWN (unless schema-absent)'
      : sigIssues.slice(0, 8).join('; '),
  };

  // classification traceable
  const untraceable = (classified.groups || []).filter(
    (g) => !g.candidate || !g.lane || !Array.isArray(g.holdReasons),
  );
  checks.classificationTraceable = {
    result: untraceable.length === 0 ? 'PASS' : 'HOLD',
    detail: untraceable.length === 0
      ? 'each TD has candidate+lane+holdReasons'
      : `untraceable: ${untraceable.map((g) => g.groupId).join(', ')}`,
  };

  // Case C separated
  const caseCBad = (classified.groups || []).filter(
    (g) => g.candidate === 'CASE_C_CANDIDATE'
      && (g.dataRemediationEligible !== false || g.lane !== 'SCHEMA_CONTRACT_REASSESSMENT'),
  );
  checks.caseCSeparated = {
    result: caseCBad.length === 0 ? 'PASS' : 'HOLD',
    detail: caseCBad.length === 0
      ? 'all CASE_C_CANDIDATE on SCHEMA_CONTRACT_REASSESSMENT with dataRemediationEligible=false'
      : `Case C misrouted: ${caseCBad.map((g) => g.groupId).join(', ')}`,
  };

  // unresolved ambiguity count
  const unresolvedAmbiguityCount = classified.ambiguousGroups ?? 0;
  checks.unresolvedAmbiguity = {
    result: unresolvedAmbiguityCount === 0 ? 'PASS' : 'HOLD',
    detail: `unresolvedAmbiguityCount=${unresolvedAmbiguityCount}`,
  };

  // source capture identity fixed
  const liveCapture = dump?.liveCaptureStatus;
  const mode = dump?.mode;
  const sourceFixed = Boolean(dump?.baselineHead)
    && (mode === 'browser-rest' || liveCapture === 'CAPTURED')
    && liveCapture !== 'HOLD';
  checks.sourceCaptureIdentityFixed = {
    result: sourceFixed ? 'PASS' : 'HOLD',
    detail: sourceFixed
      ? `source capture fixed (mode=${mode}, liveCaptureStatus=${liveCapture})`
      : `source capture not fixed (mode=${mode}, liveCaptureStatus=${liveCapture}) — operator signed-in GET required`,
  };

  const failed = Object.entries(checks)
    .filter(([, c]) => c.result !== 'PASS')
    .map(([id, c]) => ({ id, detail: c.detail }));

  const result = failed.length === 0 ? 'PASS' : 'HOLD';

  return {
    schemaVersion: 1,
    id: LIVE_SCHEMA_DATA_REMEDIATION_ID,
    phase: 'Phase3_IndependentEvidenceReview_Exit',
    generatedAt: new Date().toISOString(),
    result,
    unresolvedAmbiguityCount,
    checks,
    failed,
    notes: [
      'Phase 3 PASS is required before Human fills Phase 4 TD+action GO/HOLD.',
      'DELETE GO / MERGE GO in Decision Pack are form labels only — mutationAuthorityStatus remains NOT_AUTHORIZED until Human grants.',
      'Operator signed-in GET is the primary capture path; Cloud Agent login is fallback only.',
    ],
    authority: {
      itemMutation: 'NOT_AUTHORIZED',
      schemaMutation: 'NOT_AUTHORIZED',
      humanDisposition: result === 'PASS' ? 'READY_FOR_HUMAN' : 'BLOCKED_BY_PHASE3_HOLD',
    },
  };
}

