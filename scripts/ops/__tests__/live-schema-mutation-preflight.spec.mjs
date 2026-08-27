// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  LIVE_SCHEMA_MUTATION_CORRECTION_1,
  LIVE_SCHEMA_MUTATION_ID,
  LIVE_SCHEMA_MUTATION_REQUIRED_CHANGES,
  classifyMutationPreflight,
} from '../live-schema-mutation/preflight-classify.mjs';

const parentFields = (extra = []) => [
  { InternalName: 'Title', Title: 'タイトル', TypeAsString: 'Text', Indexed: false, EnforceUniqueValues: false },
  ...extra,
];

const rowFields = (extra = []) => [
  { InternalName: 'ParentID', TypeAsString: 'Number', Indexed: true, EnforceUniqueValues: false },
  ...extra,
];

const completeTitleStats = (overrides = {}) => ({
  itemRowsRead: 3,
  distinctTitleCount: 3,
  nullOrBlankTitleCount: 0,
  duplicateGroupCount: 0,
  duplicateGroupsSample: [],
  ...overrides,
});

describe('LIVE-SCHEMA-MUTATION-V1 preflight classify', () => {
  it('defines exactly four required changes', () => {
    expect(LIVE_SCHEMA_MUTATION_REQUIRED_CHANGES.map((change) => change.id)).toEqual([
      'SupportRecord_Daily.LatestVersion',
      'SupportRecord_Daily.LatestCommitId',
      'DailyRecordRows.CommitId',
      'SupportRecord_Daily.Title.indexedUnique',
    ]);
    expect(LIVE_SCHEMA_MUTATION_ID).toBe('LIVE-SCHEMA-MUTATION-V1');
  });

  it('Correction-1 documents blank/enumeration fail-closed and index-before-unique', () => {
    expect(LIVE_SCHEMA_MUTATION_CORRECTION_1).toEqual({
      id: 'LIVE-SCHEMA-MUTATION-V1-Correction-1',
      blankTitleFailClosed: true,
      enumerationCompletenessFailClosed: true,
      indexBeforeUnique:
        'Confirm Title.Indexed=true before setting Title.EnforceUniqueValues=true. Never enable unique while Indexed is false.',
      sharePointMutation: 'NONE',
      duplicateRemediation: 'NONE',
      deploy: 'NOT_AUTHORIZED',
    });
  });

  it('is READY when gaps match Gate, enumeration is complete, and Title has zero duplicates/blanks', () => {
    const result = classifyMutationPreflight({
      lists: {
        SupportRecord_Daily: {
          found: true,
          itemCount: 3,
          fields: parentFields(),
          titleStats: completeTitleStats(),
        },
        DailyRecordRows: {
          found: true,
          itemCount: 10,
          fields: rowFields(),
          titleStats: null,
        },
      },
    });
    expect(result.preflightGate).toBe('READY');
    expect(result.mutationAuthority).toBe('NOT_YET_AUTHORIZED');
    expect(result.deploy).toBe('NOT_AUTHORIZED');
    expect(result.holds).toEqual([]);
    expect(result.titleStats.enumerationComplete).toBe(true);
    expect(result.fieldPlans.find((p) => p.id === 'SupportRecord_Daily.LatestVersion')).toMatchObject({
      liveStatus: 'MISSING',
      applyEligible: true,
    });
    expect(result.fieldPlans.find((p) => p.id === 'SupportRecord_Daily.Title.indexedUnique')).toMatchObject({
      liveStatus: 'PRESENT_MISMATCH',
      applyEligible: true,
    });
  });

  it('HOLDs when Title duplicates exist (no auto-repair)', () => {
    const result = classifyMutationPreflight({
      lists: {
        SupportRecord_Daily: {
          found: true,
          itemCount: 4,
          fields: parentFields(),
          titleStats: completeTitleStats({
            itemRowsRead: 4,
            distinctTitleCount: 3,
            duplicateGroupCount: 1,
            duplicateGroupsSample: [{ title: '2026-08-01', count: 2 }],
          }),
        },
        DailyRecordRows: { found: true, itemCount: 0, fields: rowFields(), titleStats: null },
      },
    });
    expect(result.preflightGate).toBe('HOLD');
    expect(result.holds.some((hold) => hold.id === 'TITLE_DUPLICATES')).toBe(true);
  });

  it('HOLDs when Title null/blank count > 0 (P1-1)', () => {
    const result = classifyMutationPreflight({
      lists: {
        SupportRecord_Daily: {
          found: true,
          itemCount: 2,
          fields: parentFields(),
          titleStats: completeTitleStats({
            itemRowsRead: 2,
            distinctTitleCount: 1,
            nullOrBlankTitleCount: 1,
          }),
        },
        DailyRecordRows: { found: true, itemCount: 0, fields: rowFields(), titleStats: null },
      },
    });
    expect(result.preflightGate).toBe('HOLD');
    expect(result.holds.some((hold) => hold.id === 'TITLE_BLANK')).toBe(true);
  });

  it('HOLDs when Title enumeration is incomplete (P1-2)', () => {
    const result = classifyMutationPreflight({
      lists: {
        SupportRecord_Daily: {
          found: true,
          itemCount: 10,
          fields: parentFields(),
          titleStats: completeTitleStats({
            itemRowsRead: 5,
            distinctTitleCount: 5,
          }),
        },
        DailyRecordRows: { found: true, itemCount: 0, fields: rowFields(), titleStats: null },
      },
    });
    expect(result.preflightGate).toBe('HOLD');
    expect(result.holds.some((hold) => hold.id === 'TITLE_ENUMERATION_INCOMPLETE')).toBe(true);
    expect(result.titleStats.enumerationComplete).toBe(false);
  });

  it('HOLDs when Title stats were not read', () => {
    const result = classifyMutationPreflight({
      lists: {
        SupportRecord_Daily: {
          found: true,
          itemCount: 1,
          fields: parentFields(),
          titleStats: null,
        },
        DailyRecordRows: { found: true, itemCount: 0, fields: rowFields(), titleStats: null },
      },
    });
    expect(result.preflightGate).toBe('HOLD');
    expect(result.holds.some((hold) => hold.id === 'TITLE_STATS_UNREAD')).toBe(true);
  });

  it('HOLDs on incompatible existing field type', () => {
    const result = classifyMutationPreflight({
      lists: {
        SupportRecord_Daily: {
          found: true,
          itemCount: 0,
          fields: parentFields([
            { InternalName: 'LatestVersion', TypeAsString: 'Text', Indexed: false, EnforceUniqueValues: false },
          ]),
          titleStats: completeTitleStats({
            itemRowsRead: 0,
            distinctTitleCount: 0,
          }),
        },
        DailyRecordRows: { found: true, itemCount: 0, fields: rowFields(), titleStats: null },
      },
    });
    expect(result.preflightGate).toBe('HOLD');
    expect(result.holds.some((hold) => hold.id === 'INCOMPATIBLE_EXISTING_FIELD')).toBe(true);
  });

  it('HOLDs when lists were not read (do not invent READY)', () => {
    const result = classifyMutationPreflight({ lists: {} });
    expect(result.preflightGate).toBe('HOLD');
    expect(result.mutationAuthority).toBe('NOT_YET_AUTHORIZED');
  });
});
