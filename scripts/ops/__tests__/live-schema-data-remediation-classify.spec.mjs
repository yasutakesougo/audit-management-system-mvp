// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  LIVE_SCHEMA_DATA_REMEDIATION_CORRECTION_1,
  LIVE_SCHEMA_DATA_REMEDIATION_CORRECTION_2,
  LIVE_SCHEMA_DATA_REMEDIATION_CORRECTION_3,
  PHASE4_HUMAN_ACTIONS,
  allowedHumanActionsForCandidate,
  assessItemContentSignificance,
  bindCapturedListIdsToBaseline,
  buildCandidateClassification,
  buildDecisionPack,
  buildDecisionPackMarkdown,
  buildEvidencePack,
  classifyDataRemediationInvestigation,
  classifyDuplicateGroup,
  evaluatePhase3Exit,
  isEvidenceTrue,
  redactTitle,
  resolveStableGroupId,
  toMechanicalCandidate,
  verifyBaselineIdentity,
} from '../live-schema-data-remediation/classify.mjs';

const PINNED_HEAD = 'acb5ec3f97f7a1d7ee27c3ba0cf0a61f92894ee6';

function makeBaseline(overrides = {}) {
  return {
    head: PINNED_HEAD,
    originMain: PINNED_HEAD,
    lists: {
      SupportRecord_Daily: { title: 'SupportRecord_Daily', listId: null, listIdStatus: 'CAPTURE_AT_EVIDENCE' },
      DailyRecordRows: { title: 'DailyRecordRows', listId: null, listIdStatus: 'CAPTURE_AT_EVIDENCE' },
    },
    ...overrides,
  };
}

describe('LIVE-SCHEMA-DATA-REMEDIATION-V1 classify', () => {
  it('redacts titles safely', () => {
    expect(redactTitle('2026-05-12')).toBe('DATE(2026-05-12)');
    expect(redactTitle('2026-05-15-10')).toBe('DATE_LIKE(len=13)');
    expect(redactTitle('probe-min')).toBe('TEST_LIKE(len=9)');
    expect(redactTitle('s')).toBe('SHORT(len=1)');
    expect(redactTitle('person-name')).toBe('REDACTED(len=11)');
  });

  it('Correction-1 documents content significance, child fail-closed, 8-group baseline, Case C route', () => {
    expect(LIVE_SCHEMA_DATA_REMEDIATION_CORRECTION_1.id).toBe(
      'LIVE-SCHEMA-DATA-REMEDIATION-V1-Correction-1',
    );
    expect(LIVE_SCHEMA_DATA_REMEDIATION_CORRECTION_1.caseAContentSignificanceRequired).toBe(true);
    expect(LIVE_SCHEMA_DATA_REMEDIATION_CORRECTION_1.childEvidenceStrictFailClosed).toBe(true);
    expect(LIVE_SCHEMA_DATA_REMEDIATION_CORRECTION_1.childEvidenceTrueOnly).toBe(true);
    expect(LIVE_SCHEMA_DATA_REMEDIATION_CORRECTION_1.titleStatsPresenceRequired).toBe(true);
    expect(LIVE_SCHEMA_DATA_REMEDIATION_CORRECTION_1.titleStatsStrictBaseline).toBe(8);
    expect(LIVE_SCHEMA_DATA_REMEDIATION_CORRECTION_1.caseCRoute).toMatch(/SCHEMA_CONTRACT_REASSESSMENT/);
  });

  it('Correction-2 locks evidence-collection process flags', () => {
    expect(LIVE_SCHEMA_DATA_REMEDIATION_CORRECTION_2.mechanicalCandidatesOnly).toBe(true);
    expect(LIVE_SCHEMA_DATA_REMEDIATION_CORRECTION_2.caseACandidateIsNotDelete).toBe(true);
    expect(LIVE_SCHEMA_DATA_REMEDIATION_CORRECTION_2.caseCLane).toBe('SCHEMA_CONTRACT_REASSESSMENT');
    expect(LIVE_SCHEMA_DATA_REMEDIATION_CORRECTION_2.sharePointMutation).toBe('NONE');
  });

  it('Correction-3 locks baseline identity binding flags', () => {
    expect(LIVE_SCHEMA_DATA_REMEDIATION_CORRECTION_3.holdId).toBe(
      'EVIDENCE_BASELINE_IDENTITY_NOT_MECHANICALLY_BOUND',
    );
    expect(LIVE_SCHEMA_DATA_REMEDIATION_CORRECTION_3.baselineHeadExactMatchRequired).toBe(true);
    expect(LIVE_SCHEMA_DATA_REMEDIATION_CORRECTION_3.staleEvidenceReuse).toBe('PROHIBITED');
  });

  it('stabilizes TD ids from frozen parent ID sets regardless of dump order', () => {
    expect(resolveStableGroupId([15, 7, 12], 'TD-999')).toBe('TD-001');
    expect(resolveStableGroupId([2063, 2060], 'TD-000')).toBe('TD-003');
    expect(resolveStableGroupId([99, 100], 'TD-099')).toBe('TD-099');
  });

  it('P1-1: blocks Case A when content significance is unverified', () => {
    const group = classifyDuplicateGroup({
      groupId: 'TD-001',
      title: 'probe-min',
      groupSize: 2,
      parentItemIds: [7, 12, 15],
      items: [
        { Id: 7, RecordDate: null, UserId: null, Created: 'a', Modified: 'a', childCount: 0 },
        { Id: 12, RecordDate: null, UserId: null, Created: 'b', Modified: 'b', childCount: 0 },
        { Id: 15, RecordDate: null, UserId: null, Created: 'c', Modified: 'c', childCount: 0 },
      ],
    });
    expect(group.groupId).toBe('TD-001');
    expect(group.classification).toBe('AMBIGUOUS');
    expect(group.candidate).toBe('AMBIGUOUS');
    expect(group.remediationCase).not.toBe('A_EMPTY_ACCIDENTAL_CANDIDATE');
    expect(group.holdReasons.some((r) => r.includes('CONTENT_SIGNIFICANCE_UNVERIFIED'))).toBe(true);
  });

  it('P1-1: allows Case A candidate only when content significance verified empty on all parents', () => {
    const group = classifyDuplicateGroup({
      groupId: 'TD-008',
      title: 'test',
      groupSize: 2,
      parentItemIds: [1, 2],
      items: [
        {
          Id: 1,
          RecordDate: null,
          UserId: null,
          Created: 'a',
          Modified: 'a',
          childCount: 0,
          contentSignificanceVerified: true,
          userRowsJSONPresent: false,
          userCountPositive: false,
          latestVersionPositive: false,
          contentSignificance: {
            value: 'FALSE',
            basis: ['UserRowsJSON is empty'],
            evidence: { itemId: 1, userRowsJSONPresent: false },
          },
        },
        {
          Id: 2,
          RecordDate: null,
          UserId: null,
          Created: 'b',
          Modified: 'b',
          childCount: 0,
          contentSignificanceVerified: true,
          userRowsJSONPresent: false,
          userCountPositive: false,
          latestVersionPositive: false,
          contentSignificance: {
            value: 'FALSE',
            basis: ['UserRowsJSON is empty'],
            evidence: { itemId: 2, userRowsJSONPresent: false },
          },
        },
      ],
    });
    expect(group.classification).toBe('EMPTY_DUPLICATE_CANDIDATE');
    expect(group.candidate).toBe('CASE_A_CANDIDATE');
    expect(group.lane).toBe('DATA_REMEDIATION');
    expect(group.remediationCase).toBe('A_EMPTY_ACCIDENTAL_CANDIDATE');
    expect(group.automaticRemediation).toBe('PROHIBITED');
    expect(group.humanDecisionRequired).toBe(true);
    expect(group.humanDecision).toBeNull();
  });

  it('accepts structured contentSignificance shape in assessItemContentSignificance', () => {
    const assessed = assessItemContentSignificance({
      Id: 1,
      contentSignificance: {
        value: 'TRUE',
        basis: ['UserRowsJSON contains business content'],
        evidence: { itemId: 1, userRowsJSONPresent: true, userCountPositive: false },
      },
    });
    expect(assessed.verified).toBe(true);
    expect(assessed.hasSignificantContent).toBe(true);
    expect(assessed.contentSignificance.value).toBe('TRUE');
    expect(assessed.contentSignificance.basis[0]).toMatch(/UserRowsJSON/);
  });

  it('marks multi-parent children as CASE_B_CANDIDATE', () => {
    const group = classifyDuplicateGroup({
      groupId: 'TD-003',
      title: '2026-05-12',
      groupSize: 2,
      parentItemIds: [2060, 2063],
      items: [
        { Id: 2060, RecordDate: '2026-05-12', UserId: null, childCount: 38 },
        { Id: 2063, RecordDate: '2026-05-12', UserId: null, childCount: 16 },
      ],
    });
    expect(group.groupId).toBe('TD-003');
    expect(group.classification).toBe('ACTIVE_DUPLICATE');
    expect(group.candidate).toBe('CASE_B_CANDIDATE');
    expect(group.lane).toBe('DATA_REMEDIATION');
  });

  it('P2-1: routes differing RecordDate to CASE_C_CANDIDATE schema lane (not delete/merge)', () => {
    const group = classifyDuplicateGroup({
      groupId: 'TD-005',
      title: 's',
      groupSize: 2,
      parentItemIds: [21, 22],
      items: [
        { Id: 21, RecordDate: '2026-01-01', UserId: null, childCount: 0 },
        { Id: 22, RecordDate: '2026-02-02', UserId: null, childCount: 0 },
      ],
    });
    expect(group.classification).toBe('SCHEMA_CONTRACT_CONFLICT');
    expect(group.candidate).toBe('CASE_C_CANDIDATE');
    expect(group.lane).toBe('SCHEMA_CONTRACT_REASSESSMENT');
    expect(group.remediationRoute).toBe('SCHEMA_CONTRACT_REASSESSMENT');
    expect(group.dataRemediationEligible).toBe(false);
    expect(toMechanicalCandidate(group.classification, group.remediationRoute)).toBe('CASE_C_CANDIDATE');
  });

  it('P1-2: HOLDs definition when parent enumeration incomplete', () => {
    const result = classifyDataRemediationInvestigation({
      baselineHead: PINNED_HEAD,
      lists: {
        SupportRecord_Daily: { enumerationComplete: false, itemCount: 10, rowsRead: 5 },
        DailyRecordRows: { enumerationComplete: true },
      },
      childRefsSummary: { ok: true, parentIdField: 'ParentID', enumerationComplete: true },
      titleStats: { duplicateGroupCount: 0 },
      duplicateGroups: [],
    }, { baseline: makeBaseline() });
    expect(result.readCompleteness).toBe('HOLD');
    expect(result.definition).toBe('HOLD');
    expect(result.dataMutation).toBe('NONE');
  });

  it('isEvidenceTrue accepts only literal true', () => {
    expect(isEvidenceTrue(true)).toBe(true);
    expect(isEvidenceTrue(false)).toBe(false);
    expect(isEvidenceTrue(undefined)).toBe(false);
    expect(isEvidenceTrue('true')).toBe(false);
    expect(isEvidenceTrue(1)).toBe(false);
  });

  it('P1-2: HOLDs when childRefsSummary.ok is truthy but not literal true', () => {
    const result = classifyDataRemediationInvestigation({
      baselineHead: PINNED_HEAD,
      lists: {
        SupportRecord_Daily: { enumerationComplete: true },
        DailyRecordRows: { enumerationComplete: true },
      },
      childRefsSummary: {
        ok: 'true',
        parentIdField: 'ParentID',
        enumerationComplete: true,
      },
      titleStats: { duplicateGroupCount: 8 },
      duplicateGroups: Array.from({ length: 8 }, (_, i) => ({
        groupId: `TD-${String(i + 1).padStart(3, '0')}`,
        title: `t-${i}`,
        groupSize: 2,
        items: [
          { Id: i * 2, childCount: 0, contentSignificanceVerified: true },
          { Id: i * 2 + 1, childCount: 0, contentSignificanceVerified: true },
        ],
      })),
    }, { baseline: makeBaseline() });
    expect(result.readCompleteness).toBe('HOLD');
    expect(result.childReferences).toBe('INCOMPLETE');
    expect(result.holds.some((h) => h.id === 'CHILD_REFERENCE_EVIDENCE_INCOMPLETE')).toBe(true);
  });

  it('P1-2: HOLDs when child refs evidence missing (strict fail-closed)', () => {
    const result = classifyDataRemediationInvestigation({
      baselineHead: PINNED_HEAD,
      lists: {
        SupportRecord_Daily: { enumerationComplete: true },
        DailyRecordRows: { enumerationComplete: true },
      },
      titleStats: { duplicateGroupCount: 8 },
      duplicateGroups: Array.from({ length: 8 }, (_, i) => ({
        groupId: `TD-${String(i + 1).padStart(3, '0')}`,
        title: `t-${i}`,
        groupSize: 2,
        items: [
          { Id: i * 2, childCount: 0, contentSignificanceVerified: true, userRowsJSONPresent: false, userCountPositive: false },
          { Id: i * 2 + 1, childCount: 0, contentSignificanceVerified: true, userRowsJSONPresent: false, userCountPositive: false },
        ],
      })),
      contentSignificanceCapture: { verified: true },
    }, { baseline: makeBaseline() });
    expect(result.readCompleteness).toBe('HOLD');
    expect(result.childReferences).toBe('INCOMPLETE');
    expect(result.holds.some((h) => h.id === 'CHILD_REFERENCE_EVIDENCE_MISSING')).toBe(true);
  });

  it('titleStats: HOLDs when titleStats missing or duplicateGroupCount != 8', () => {
    const base = {
      baselineHead: PINNED_HEAD,
      lists: {
        SupportRecord_Daily: { enumerationComplete: true },
        DailyRecordRows: { enumerationComplete: true },
      },
      childRefsSummary: { ok: true, parentIdField: 'ParentID', enumerationComplete: true },
      duplicateGroups: Array.from({ length: 8 }, (_, i) => ({
        groupId: `TD-${String(i + 1).padStart(3, '0')}`,
        title: `t-${i}`,
        groupSize: 2,
        items: [
          { Id: i * 2, childCount: 0, contentSignificanceVerified: true },
          { Id: i * 2 + 1, childCount: 0, contentSignificanceVerified: true },
        ],
      })),
    };

    const missing = classifyDataRemediationInvestigation(base, { baseline: makeBaseline() });
    expect(missing.definition).toBe('HOLD');
    expect(missing.holds.some((h) => h.id === 'TITLE_STATS_MISSING')).toBe(true);

    const drift = classifyDataRemediationInvestigation({
      ...base,
      titleStats: { duplicateGroupCount: 9 },
    }, { baseline: makeBaseline() });
    expect(drift.definition).toBe('HOLD');
    expect(drift.holds.some((h) => h.id === 'TITLE_STATS_BASELINE_MISMATCH')).toBe(true);
  });

  it('P1-3: HOLDs definition when duplicate group count != 8', () => {
    const result = classifyDataRemediationInvestigation({
      baselineHead: PINNED_HEAD,
      lists: {
        SupportRecord_Daily: { enumerationComplete: true },
        DailyRecordRows: { enumerationComplete: true },
      },
      childRefsSummary: { ok: true, parentIdField: 'ParentID', enumerationComplete: true },
      contentSignificanceCapture: { verified: true },
      titleStats: { duplicateGroupCount: 7 },
      duplicateGroups: Array.from({ length: 7 }, (_, i) => ({
        groupId: `TD-${String(i + 1).padStart(3, '0')}`,
        title: `t-${i}`,
        groupSize: 2,
        items: [
          { Id: i * 2, childCount: 0, contentSignificanceVerified: true },
          { Id: i * 2 + 1, childCount: 0, contentSignificanceVerified: true },
        ],
      })),
    }, { baseline: makeBaseline() });
    expect(result.definition).toBe('HOLD');
    expect(result.holds.some((h) => h.id === 'DUPLICATE_GROUP_COUNT_BASELINE_MISMATCH')).toBe(true);
  });

  it('builds Evidence Pack + Decision Pack without raw titles or Human GO', () => {
    const frozenGroups = [
      { groupId: 'TD-001', title: 'probe-min', parentItemIds: [7, 12, 15], items: [
        { Id: 7, RecordDate: null, UserId: null, childCount: 0, contentSignificanceVerified: true, userRowsJSONPresent: false, userCountPositive: false, latestVersionPositive: false,
          contentSignificance: { value: 'FALSE', basis: ['empty'], evidence: { itemId: 7 } } },
        { Id: 12, RecordDate: null, UserId: null, childCount: 0, contentSignificanceVerified: true, userRowsJSONPresent: false, userCountPositive: false, latestVersionPositive: false,
          contentSignificance: { value: 'FALSE', basis: ['empty'], evidence: { itemId: 12 } } },
        { Id: 15, RecordDate: null, UserId: null, childCount: 0, contentSignificanceVerified: true, userRowsJSONPresent: false, userCountPositive: false, latestVersionPositive: false,
          contentSignificance: { value: 'FALSE', basis: ['empty'], evidence: { itemId: 15 } } },
      ] },
      { groupId: 'TD-002', title: 'test', parentItemIds: [3, 4, 5], items: [
        { Id: 3, RecordDate: null, UserId: null, childCount: 0, contentSignificanceVerified: true, userRowsJSONPresent: false, userCountPositive: false, latestVersionPositive: false },
        { Id: 4, RecordDate: null, UserId: null, childCount: 0, contentSignificanceVerified: true, userRowsJSONPresent: false, userCountPositive: false, latestVersionPositive: false },
        { Id: 5, RecordDate: null, UserId: null, childCount: 0, contentSignificanceVerified: true, userRowsJSONPresent: false, userCountPositive: false, latestVersionPositive: false },
      ] },
      { groupId: 'TD-003', title: '2026-05-12', parentItemIds: [2060, 2063], items: [
        { Id: 2060, RecordDate: '2026-05-12', UserId: null, childCount: 38 },
        { Id: 2063, RecordDate: '2026-05-12', UserId: null, childCount: 16 },
      ] },
      { groupId: 'TD-004', title: '2026-05-15-10', parentItemIds: [2084, 2085], items: [
        { Id: 2084, RecordDate: '2026-05-15', UserId: null, childCount: 14 },
        { Id: 2085, RecordDate: '2026-05-15', UserId: null, childCount: 1 },
      ] },
      { groupId: 'TD-005', title: 's', parentItemIds: [21, 22], items: [
        { Id: 21, RecordDate: '2026-01-01', UserId: null, childCount: 0 },
        { Id: 22, RecordDate: '2026-02-02', UserId: null, childCount: 0 },
      ] },
      { groupId: 'TD-006', title: 'test-dup', parentItemIds: [6, 11], items: [
        { Id: 6, RecordDate: '2026-03-01', UserId: null, childCount: 0 },
        { Id: 11, RecordDate: '2026-04-01', UserId: null, childCount: 0 },
      ] },
      { groupId: 'TD-007', title: 'probe-other', parentItemIds: [13, 14], items: [
        { Id: 13, RecordDate: null, UserId: null, childCount: 0, contentSignificanceVerified: true, userRowsJSONPresent: false, userCountPositive: false, latestVersionPositive: false },
        { Id: 14, RecordDate: null, UserId: null, childCount: 0, contentSignificanceVerified: true, userRowsJSONPresent: false, userCountPositive: false, latestVersionPositive: false },
      ] },
      { groupId: 'TD-008', title: 'test', parentItemIds: [1, 2], items: [
        { Id: 1, RecordDate: null, UserId: null, childCount: 0, contentSignificanceVerified: true, userRowsJSONPresent: false, userCountPositive: false, latestVersionPositive: false },
        { Id: 2, RecordDate: null, UserId: null, childCount: 0, contentSignificanceVerified: true, userRowsJSONPresent: false, userCountPositive: false, latestVersionPositive: false },
      ] },
    ];

    const dump = {
      generatedAt: '2026-08-29T00:00:00.000Z',
      baselineHead: PINNED_HEAD,
      siteUrl: 'https://isogokatudouhome.sharepoint.com/sites/welfare',
      mode: 'browser-rest',
      httpMethods: ['GET'],
      lists: {
        SupportRecord_Daily: { enumerationComplete: true, itemCount: 359, rowsRead: 359, listId: 'guid-p' },
        DailyRecordRows: { enumerationComplete: true, itemCount: 3868, rowsRead: 3868, listId: 'guid-c' },
      },
      childRefsSummary: { ok: true, parentIdField: 'ParentID', enumerationComplete: true, rowsRead: 3868 },
      titleStats: { duplicateGroupCount: 8, duplicateItemCount: 18, nullOrBlankTitleCount: 0 },
      contentSignificanceCapture: { verified: true, shape: 'value_basis_evidence' },
      duplicateGroups: frozenGroups,
    };

    const baseline = makeBaseline();
    const classified = classifyDataRemediationInvestigation(dump, { baseline });
    expect(classified.definition).toBe('PASS');
    expect(classified.baselineVerification.result).toBe('PASS');
    expect(classified.caseCCandidates).toBe(2);
    expect(classified.caseBCandidates).toBe(2);
    expect(classified.caseACandidates).toBeGreaterThanOrEqual(1);

    const pack = buildEvidencePack(dump, classified);
    expect(pack.observationsOnly).toBe(true);
    expect(pack.groups).toHaveLength(8);
    expect(JSON.stringify(pack)).not.toMatch(/probe-min/);
    expect(pack.groups.every((g) => g.humanDecision === null)).toBe(true);
    expect(pack.baselineVerification.expectedHead).toBe(PINNED_HEAD);
    expect(pack.baselineVerification.observedHead).toBe(PINNED_HEAD);
    expect(pack.baselineVerification.result).toBe('PASS');

    const candidates = buildCandidateClassification(classified);
    expect(candidates.authority.itemMutation).toBe('NOT_AUTHORIZED');
    expect(candidates.groups.find((g) => g.groupId === 'TD-005').candidate).toBe('CASE_C_CANDIDATE');
    expect(candidates.groups.find((g) => g.groupId === 'TD-005').lane).toBe('SCHEMA_CONTRACT_REASSESSMENT');

    const decisionPack = buildDecisionPack(classified, { sourceGeneratedAt: dump.generatedAt });
    expect(decisionPack.mutationAuthorityStatus).toBe('NOT_AUTHORIZED');
    expect(decisionPack.rows).toHaveLength(8);
    expect(decisionPack.rows.find((r) => r.tdId === 'TD-005').allowedHumanActions).toEqual([
      'SCHEMA RE-EVALUATION',
      'HOLD',
    ]);
    expect(decisionPack.rows.every((r) => r.requestedHumanAction === null)).toBe(true);
    expect(decisionPack.rows.every((r) => r.reviewerDecision === null)).toBe(true);

    const md = buildDecisionPackMarkdown(decisionPack);
    expect(md).toMatch(/TD-001/);
    expect(md).toMatch(/DELETE GO/);
    expect(md).toMatch(/NOT_AUTHORIZED/);
    expect(md).toMatch(/Bulk GO: PROHIBITED/);
  });
});

describe('Correction-3 baseline identity binding', () => {
  it('baselineHead exact match → PASS', () => {
    const v = verifyBaselineIdentity(makeBaseline(), {
      baselineHead: PINNED_HEAD,
      lists: {
        SupportRecord_Daily: { listId: null },
        DailyRecordRows: { listId: null },
      },
    });
    expect(v.result).toBe('PASS');
    expect(v.headResult).toBe('PASS');
    expect(v.expectedHead).toBe(PINNED_HEAD);
    expect(v.observedHead).toBe(PINNED_HEAD);
  });

  it('baselineHead null → HOLD (EVIDENCE_BASELINE_IDENTITY_NOT_MECHANICALLY_BOUND)', () => {
    const v = verifyBaselineIdentity(makeBaseline(), { baselineHead: null, lists: {} });
    expect(v.result).toBe('HOLD');
    expect(v.holds.some((h) => h.id === 'EVIDENCE_BASELINE_IDENTITY_NOT_MECHANICALLY_BOUND')).toBe(true);
  });

  it('baselineHead mismatch → HOLD (stale Evidence reuse prohibited)', () => {
    const v = verifyBaselineIdentity(makeBaseline(), {
      baselineHead: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
      lists: {},
    });
    expect(v.result).toBe('HOLD');
    expect(v.holds.some((h) => h.id === 'BASELINE_HEAD_MISMATCH')).toBe(true);
    expect(v.staleEvidenceReuse).toBe('PROHIBITED_HOLD');
  });

  it('listId initial capture → CAPTURED', () => {
    const v = verifyBaselineIdentity(makeBaseline(), {
      baselineHead: PINNED_HEAD,
      lists: {
        SupportRecord_Daily: { listId: '{AAA-BBB}' },
        DailyRecordRows: { listId: '{CCC-DDD}' },
      },
    });
    expect(v.result).toBe('PASS');
    expect(v.lists.SupportRecord_Daily.result).toBe('CAPTURED');
    expect(v.lists.DailyRecordRows.result).toBe('CAPTURED');
    expect(v.lists.SupportRecord_Daily.observedListId).toBe('aaa-bbb');
  });

  it('known listId mismatch → HOLD', () => {
    const baseline = makeBaseline({
      lists: {
        SupportRecord_Daily: { title: 'SupportRecord_Daily', listId: 'aaa-bbb', listIdStatus: 'BOUND' },
        DailyRecordRows: { title: 'DailyRecordRows', listId: 'ccc-ddd', listIdStatus: 'BOUND' },
      },
    });
    const v = verifyBaselineIdentity(baseline, {
      baselineHead: PINNED_HEAD,
      lists: {
        SupportRecord_Daily: { listId: 'aaa-bbb' },
        DailyRecordRows: { listId: 'zzz-wrong' },
      },
    });
    expect(v.result).toBe('HOLD');
    expect(v.listIdentityResult).toBe('HOLD');
    expect(v.holds.some((h) => h.id === 'BASELINE_LIST_ID_MISMATCH')).toBe(true);
  });

  it('Evidence Pack baseline binding → preserved', () => {
    const dump = {
      baselineHead: PINNED_HEAD,
      lists: {
        SupportRecord_Daily: { enumerationComplete: true, listId: 'guid-p' },
        DailyRecordRows: { enumerationComplete: true, listId: 'guid-c' },
      },
      childRefsSummary: { ok: true, parentIdField: 'ParentID', enumerationComplete: true },
      titleStats: { duplicateGroupCount: 8 },
      contentSignificanceCapture: { verified: true },
      duplicateGroups: Array.from({ length: 8 }, (_, i) => {
        const ids = [
          [7, 12, 15], [3, 4, 5], [2060, 2063], [2084, 2085],
          [21, 22], [6, 11], [13, 14], [1, 2],
        ][i];
        return {
          groupId: `TD-${String(i + 1).padStart(3, '0')}`,
          title: `t-${i}`,
          parentItemIds: ids,
          items: ids.map((Id, j) => ({
            Id,
            childCount: i === 2 || i === 3 ? 1 : 0,
            RecordDate: i === 4
              ? (j === 0 ? '2026-01-01' : '2026-02-02')
              : i === 5
                ? (j === 0 ? '2026-03-01' : '2026-04-02')
                : null,
            contentSignificanceVerified: true,
            userRowsJSONPresent: false,
            userCountPositive: false,
            latestVersionPositive: false,
          })),
        };
      }),
    };

    const classified = classifyDataRemediationInvestigation(dump, { baseline: makeBaseline() });
    const pack = buildEvidencePack(dump, classified);
    expect(pack.baselineHead).toBe(PINNED_HEAD);
    expect(pack.baselineVerification.expectedHead).toBe(PINNED_HEAD);
    expect(pack.baselineVerification.observedHead).toBe(PINNED_HEAD);
    expect(pack.baselineVerification.result).toBe('PASS');
    expect(pack.baselineVerification.listIdentityResult).toBe('PASS');
    expect(pack.baselineVerification.lists.SupportRecord_Daily.result).toBe('CAPTURED');
  });

  it('stale Evidence reuse → prohibited (classify HOLD)', () => {
    const dump = {
      baselineHead: '1111111111111111111111111111111111111111',
      lists: {
        SupportRecord_Daily: { enumerationComplete: true },
        DailyRecordRows: { enumerationComplete: true },
      },
      childRefsSummary: { ok: true, parentIdField: 'ParentID', enumerationComplete: true },
      titleStats: { duplicateGroupCount: 8 },
      duplicateGroups: Array.from({ length: 8 }, (_, i) => ({
        groupId: `TD-${String(i + 1).padStart(3, '0')}`,
        title: `t-${i}`,
        parentItemIds: [
          [7, 12, 15], [3, 4, 5], [2060, 2063], [2084, 2085],
          [21, 22], [6, 11], [13, 14], [1, 2],
        ][i],
        items: [
          { Id: i * 10, childCount: 0, contentSignificanceVerified: true },
          { Id: i * 10 + 1, childCount: 0, contentSignificanceVerified: true },
        ],
      })),
    };
    const classified = classifyDataRemediationInvestigation(dump, { baseline: makeBaseline() });
    expect(classified.definition).toBe('HOLD');
    expect(classified.baselineVerification.result).toBe('HOLD');
    expect(classified.holds.some((h) => h.id === 'BASELINE_HEAD_MISMATCH')).toBe(true);
  });

  it('bindCapturedListIdsToBaseline writes CAPTURED ids into baseline', () => {
    const baseline = makeBaseline();
    const v = verifyBaselineIdentity(baseline, {
      baselineHead: PINNED_HEAD,
      lists: {
        SupportRecord_Daily: { listId: 'GUID-PARENT' },
        DailyRecordRows: { listId: 'GUID-CHILD' },
      },
    });
    const { baseline: bound, changed } = bindCapturedListIdsToBaseline(baseline, v);
    expect(changed).toBe(true);
    expect(bound.lists.SupportRecord_Daily.listId).toBe('guid-parent');
    expect(bound.lists.SupportRecord_Daily.listIdStatus).toBe('BOUND');
    expect(bound.lists.DailyRecordRows.listId).toBe('guid-child');

    const rematch = verifyBaselineIdentity(bound, {
      baselineHead: PINNED_HEAD,
      lists: {
        SupportRecord_Daily: { listId: 'guid-parent' },
        DailyRecordRows: { listId: 'guid-child' },
      },
    });
    expect(rematch.result).toBe('PASS');
    expect(rematch.lists.SupportRecord_Daily.result).toBe('PASS');
  });
});

describe('Phase 3 Exit + Decision Pack TD+action schema', () => {
  it('exposes Phase 4 action vocabulary and Case C restrictions', () => {
    expect(PHASE4_HUMAN_ACTIONS).toEqual([
      'PRESERVE',
      'DELETE GO',
      'MERGE GO',
      'SCHEMA RE-EVALUATION',
      'HOLD',
    ]);
    expect(allowedHumanActionsForCandidate('CASE_C_CANDIDATE')).toEqual([
      'SCHEMA RE-EVALUATION',
      'HOLD',
    ]);
    expect(allowedHumanActionsForCandidate('CASE_A_CANDIDATE')).toContain('DELETE GO');
    expect(allowedHumanActionsForCandidate('AMBIGUOUS')).toEqual(['HOLD']);
  });

  it('Phase 3 HOLDs when listIds pending, ambiguity > 0, or source capture HOLD', () => {
    const dump = {
      baselineHead: PINNED_HEAD,
      mode: 'rehydrate-from-definition-investigation',
      liveCaptureStatus: 'HOLD',
      lists: {
        SupportRecord_Daily: { enumerationComplete: true, listId: null },
        DailyRecordRows: { enumerationComplete: true, listId: null },
      },
      childRefsSummary: { ok: true, parentIdField: 'ParentID', enumerationComplete: true },
      titleStats: { duplicateGroupCount: 8 },
      contentSignificanceCapture: { verified: false },
      duplicateGroups: Array.from({ length: 8 }, (_, i) => {
        const ids = [
          [7, 12, 15], [3, 4, 5], [2060, 2063], [2084, 2085],
          [21, 22], [6, 11], [13, 14], [1, 2],
        ][i];
        return {
          groupId: `TD-${String(i + 1).padStart(3, '0')}`,
          title: `t-${i}`,
          parentItemIds: ids,
          items: ids.map((Id, j) => ({
            Id,
            childCount: i === 2 || i === 3 ? 1 : 0,
            RecordDate: i === 4
              ? (j === 0 ? '2026-01-01' : '2026-02-02')
              : i === 5
                ? (j === 0 ? '2026-03-01' : '2026-04-02')
                : null,
            contentSignificance: {
              value: 'UNKNOWN',
              basis: ['not captured'],
              evidence: { itemId: Id },
            },
          })),
        };
      }),
    };
    const classified = classifyDataRemediationInvestigation(dump, { baseline: makeBaseline() });
    const exit = evaluatePhase3Exit(dump, classified, { baseline: makeBaseline() });
    expect(exit.result).toBe('HOLD');
    expect(exit.unresolvedAmbiguityCount).toBeGreaterThan(0);
    expect(exit.checks.listIdsCaptured.result).toBe('HOLD');
    expect(exit.checks.sourceCaptureIdentityFixed.result).toBe('HOLD');
    expect(exit.authority.itemMutation).toBe('NOT_AUTHORIZED');
  });

  it('Phase 3 PASS when live capture, listIds, significance, ambiguity=0, Case C separated', () => {
    const dump = {
      baselineHead: PINNED_HEAD,
      mode: 'browser-rest',
      liveCaptureStatus: 'CAPTURED',
      generatedAt: '2026-08-29T03:00:00.000Z',
      lists: {
        SupportRecord_Daily: { enumerationComplete: true, listId: 'guid-p', rowsRead: 359, itemCount: 359 },
        DailyRecordRows: { enumerationComplete: true, listId: 'guid-c', rowsRead: 3868, itemCount: 3868 },
      },
      childRefsSummary: { ok: true, parentIdField: 'ParentID', enumerationComplete: true, rowsRead: 3868 },
      titleStats: { duplicateGroupCount: 8, duplicateItemCount: 18, nullOrBlankTitleCount: 0 },
      contentSignificanceCapture: { verified: true, shape: 'value_basis_evidence' },
      duplicateGroups: Array.from({ length: 8 }, (_, i) => {
        const ids = [
          [7, 12, 15], [3, 4, 5], [2060, 2063], [2084, 2085],
          [21, 22], [6, 11], [13, 14], [1, 2],
        ][i];
        const isC = i === 4 || i === 5;
        const isB = i === 2 || i === 3;
        return {
          groupId: `TD-${String(i + 1).padStart(3, '0')}`,
          title: isC ? 's' : isB ? `2026-05-${10 + i}` : `probe-${i}`,
          parentItemIds: ids,
          items: ids.map((Id, j) => ({
            Id,
            childCount: isB ? (j === 0 ? 2 : 1) : 0,
            RecordDate: isC
              ? (j === 0 ? '2026-01-01' : '2026-02-02')
              : isB
                ? `2026-05-${10 + i}`
                : null,
            UserId: null,
            contentSignificanceVerified: true,
            userRowsJSONPresent: false,
            userCountPositive: false,
            latestVersionPositive: false,
            contentSignificance: {
              value: 'FALSE',
              basis: ['UserRowsJSON is empty', 'UserCount empty or zero', 'LatestVersion empty or zero'],
              evidence: { itemId: Id, userRowsJSONPresent: false },
            },
          })),
        };
      }),
    };

    const baseline = makeBaseline();
    const classified = classifyDataRemediationInvestigation(dump, { baseline });
    expect(classified.ambiguousGroups).toBe(0);
    expect(classified.caseCCandidates).toBe(2);
    expect(classified.caseACandidates).toBeGreaterThanOrEqual(1);

    const exit = evaluatePhase3Exit(dump, classified, { baseline });
    expect(exit.checks.baselineHeadFixed.result).toBe('PASS');
    expect(exit.checks.listIdsCaptured.result).toBe('PASS');
    expect(exit.checks.tdRegisterComplete.result).toBe('PASS');
    expect(exit.checks.contentSignificanceComplete.result).toBe('PASS');
    expect(exit.checks.classificationTraceable.result).toBe('PASS');
    expect(exit.checks.caseCSeparated.result).toBe('PASS');
    expect(exit.checks.unresolvedAmbiguity.result).toBe('PASS');
    expect(exit.checks.sourceCaptureIdentityFixed.result).toBe('PASS');
    expect(exit.result).toBe('PASS');
    expect(exit.unresolvedAmbiguityCount).toBe(0);

    const pack = buildDecisionPack(classified);
    expect(pack.rows.find((r) => r.tdId === 'TD-001').recommendedDisposition).toBe('DELETE GO');
    expect(pack.rows.find((r) => r.tdId === 'TD-005').recommendedDisposition).toBe('SCHEMA RE-EVALUATION');
    expect(pack.rows.every((r) => r.mutationAuthorityStatus === 'NOT_AUTHORIZED')).toBe(true);

    const md = buildDecisionPackMarkdown(pack, { phase3Exit: exit });
    expect(md).toMatch(/Phase3Exit: PASS/);
    expect(md).toMatch(/SCHEMA RE-EVALUATION/);
  });
});
