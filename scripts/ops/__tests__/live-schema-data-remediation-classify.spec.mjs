// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  classifyDataRemediationInvestigation,
  classifyDuplicateGroup,
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

  it('never auto-selects a winner and marks empty candidates', () => {
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
    expect(group.classification).toBe('EMPTY_DUPLICATE_CANDIDATE');
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

  it('flags differing RecordDate as schema-contract conflict candidate', () => {
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
    expect(group.classification).toBe('AMBIGUOUS');
    expect(group.remediationCase).toBe('C_SCHEMA_CONTRACT_CONFLICT_CANDIDATE');
  });

  it('HOLDs definition when parent enumeration incomplete', () => {
    const result = classifyDataRemediationInvestigation({
      lists: {
        SupportRecord_Daily: { enumerationComplete: false, itemCount: 10, rowsRead: 5 },
        DailyRecordRows: { enumerationComplete: true },
      },
      childRefsSummary: { ok: true },
      titleStats: { duplicateGroupCount: 0 },
      duplicateGroups: [],
    });
    expect(result.readCompleteness).toBe('HOLD');
    expect(result.definition).toBe('HOLD');
    expect(result.dataMutation).toBe('NONE');
  });
});
