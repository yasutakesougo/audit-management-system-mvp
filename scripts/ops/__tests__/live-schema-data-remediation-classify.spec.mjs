// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  LIVE_SCHEMA_DATA_REMEDIATION_CORRECTION_1,
  classifyDataRemediationInvestigation,
  classifyDuplicateGroup,
  isEvidenceTrue,
  redactTitle,
} from '../live-schema-data-remediation/classify.mjs';

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

  it('P1-1: blocks Case A when content significance is unverified', () => {
    const group = classifyDuplicateGroup({
      groupId: 'TD-001',
      title: 'probe-min',
      groupSize: 2,
      parentItemIds: [1, 2],
      items: [
        { Id: 1, RecordDate: null, UserId: null, Created: 'a', Modified: 'a', childCount: 0 },
        { Id: 2, RecordDate: null, UserId: null, Created: 'b', Modified: 'b', childCount: 0 },
      ],
    });
    expect(group.classification).toBe('AMBIGUOUS');
    expect(group.remediationCase).not.toBe('A_EMPTY_ACCIDENTAL_CANDIDATE');
    expect(group.holdReasons.some((r) => r.includes('CONTENT_SIGNIFICANCE_UNVERIFIED'))).toBe(true);
  });

  it('P1-1: allows Case A only when content significance verified empty on all parents', () => {
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
        },
      ],
    });
    expect(group.classification).toBe('EMPTY_DUPLICATE_CANDIDATE');
    expect(group.remediationCase).toBe('A_EMPTY_ACCIDENTAL_CANDIDATE');
    expect(group.automaticRemediation).toBe('PROHIBITED');
    expect(group.humanDecisionRequired).toBe(true);
  });

  it('marks multi-parent children as ACTIVE_DUPLICATE', () => {
    const group = classifyDuplicateGroup({
      groupId: 'TD-003',
      title: '2026-05-12',
      groupSize: 2,
      parentItemIds: [10, 11],
      items: [
        { Id: 10, RecordDate: '2026-05-12', UserId: null, childCount: 38 },
        { Id: 11, RecordDate: '2026-05-12', UserId: null, childCount: 16 },
      ],
    });
    expect(group.classification).toBe('ACTIVE_DUPLICATE');
    expect(group.remediationCase).toBe('B_MEANINGFUL_OR_AMBIGUOUS');
  });

  it('P2-1: routes differing RecordDate to SCHEMA CONTRACT REASSESSMENT (not delete/merge)', () => {
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
    expect(group.remediationCase).toBe('C_SCHEMA_CONTRACT_CONFLICT');
    expect(group.remediationRoute).toBe('SCHEMA_CONTRACT_REASSESSMENT');
    expect(group.dataRemediationEligible).toBe(false);
    expect(group.holdReasons.some((r) => r.includes('not data remediation delete/merge'))).toBe(true);
  });

  it('P1-2: HOLDs definition when parent enumeration incomplete', () => {
    const result = classifyDataRemediationInvestigation({
      lists: {
        SupportRecord_Daily: { enumerationComplete: false, itemCount: 10, rowsRead: 5 },
        DailyRecordRows: { enumerationComplete: true },
      },
      childRefsSummary: { ok: true, parentIdField: 'ParentID', enumerationComplete: true },
      titleStats: { duplicateGroupCount: 0 },
      duplicateGroups: [],
    });
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
    });
    expect(result.readCompleteness).toBe('HOLD');
    expect(result.childReferences).toBe('INCOMPLETE');
    expect(result.holds.some((h) => h.id === 'CHILD_REFERENCE_EVIDENCE_INCOMPLETE')).toBe(true);
  });

  it('P1-2: HOLDs when child refs evidence missing (strict fail-closed)', () => {
    const result = classifyDataRemediationInvestigation({
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
    });
    expect(result.readCompleteness).toBe('HOLD');
    expect(result.childReferences).toBe('INCOMPLETE');
    expect(result.holds.some((h) => h.id === 'CHILD_REFERENCE_EVIDENCE_MISSING')).toBe(true);
  });

  it('titleStats: HOLDs when titleStats missing or duplicateGroupCount != 8', () => {
    const base = {
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

    const missing = classifyDataRemediationInvestigation(base);
    expect(missing.definition).toBe('HOLD');
    expect(missing.holds.some((h) => h.id === 'TITLE_STATS_MISSING')).toBe(true);

    const drift = classifyDataRemediationInvestigation({
      ...base,
      titleStats: { duplicateGroupCount: 9 },
    });
    expect(drift.definition).toBe('HOLD');
    expect(drift.holds.some((h) => h.id === 'TITLE_STATS_BASELINE_MISMATCH')).toBe(true);
  });

  it('P1-3: HOLDs definition when duplicate group count != 8', () => {
    const result = classifyDataRemediationInvestigation({
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
    });
    expect(result.definition).toBe('HOLD');
    expect(result.holds.some((h) => h.id === 'DUPLICATE_GROUP_COUNT_BASELINE_MISMATCH')).toBe(true);
  });
});
