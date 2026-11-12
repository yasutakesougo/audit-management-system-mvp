import { describe, expect, it } from 'vitest';
import {
  assignmentRecoveryEligibility,
  classifyReconciledTarget,
  describeAssignmentLedger,
  describeAssignmentSaveFeedback,
  describeBlockedAssignmentSave,
  isAssignmentRetryClosed,
  isAssignmentSaveBlocked,
  didAssignmentEtagAdvance,
  isUsableAssignmentEtag,
  judgeRecoveredAssignmentTarget,
  provenRecoveryRequestIds,
  loadUnresolvedAssignmentSaves,
  nextUnresolvedAssignmentSave,
  persistUnresolvedAssignmentSaves,
  readAssignmentLedger,
  sealAssignmentFields,
  settleUnresolvedRecovery,
  sha256Hex,
  shouldReplaceTransportDraft,
  UNRESOLVED_ASSIGNMENT_SAVE_STORAGE_KEY,
  type AssignmentSaveReport,
  type UnresolvedAssignmentSave,
} from '../assignmentSaveReport';

const fields = { vehicleId: '車両1', driverId: 'S001', notes: '' };

describe('assignment save report', () => {
  it('classifies a refetched row against the intent and the previous row', () => {
    expect(classifyReconciledTarget({
      before: { ...fields, vehicleId: '' },
      intent: fields,
      after: fields,
      identityMatches: true,
    }).outcome).toBe('CONFIRMED_APPLIED');
    expect(classifyReconciledTarget({
      before: { ...fields, vehicleId: '' },
      intent: fields,
      after: { ...fields, vehicleId: '' },
      identityMatches: true,
    })).toMatchObject({ outcome: 'CONFIRMED_NOT_APPLIED', conflict: false });
    expect(classifyReconciledTarget({
      before: { ...fields, vehicleId: '' },
      intent: fields,
      after: { ...fields, driverId: 'OTHER' },
      identityMatches: true,
    })).toMatchObject({ outcome: 'CONFIRMED_NOT_APPLIED', conflict: true });
    expect(classifyReconciledTarget({
      before: fields,
      intent: fields,
      after: null,
      identityMatches: false,
    }).outcome).toBe('UNKNOWN');
  });

  it('closes retry while a conflict or an unknown result remains', () => {
    const open: AssignmentSaveReport = {
      reconciliation: 'complete',
      targets: [
        {
          dateKey: '2026-11-11',
          direction: 'to',
          userId: 'U001',
          scheduleRowId: 'row-1',
          outcome: 'CONFIRMED_NOT_APPLIED',
          conflict: false,
          writeStarted: false,
        },
      ],
    };
    expect(isAssignmentRetryClosed(open)).toBe(false);
    expect(isAssignmentRetryClosed({
      ...open,
      targets: [{ ...open.targets[0], conflict: true }],
    })).toBe(true);
    expect(isAssignmentRetryClosed({ ...open, reconciliation: 'incomplete' })).toBe(true);
  });

  it('keeps an edited draft when a refresh arrives for the same day', () => {
    expect(shouldReplaceTransportDraft({ scopeChanged: false, dirty: true })).toBe(false);
    expect(shouldReplaceTransportDraft({ scopeChanged: true, dirty: true })).toBe(true);
    expect(shouldReplaceTransportDraft({ scopeChanged: false, dirty: false })).toBe(true);
  });

  it('uses different copy for full success, partial failure, and an unreadable result', () => {
    expect(describeAssignmentSaveFeedback('success', null)?.message).toBe('配車設定を保存しました。');
    expect(describeAssignmentSaveFeedback('reconciling', null)?.testId).toBe('transport-assignment-save-reconciling');
    const partial = describeAssignmentSaveFeedback('partial', {
      saveReport: {
        reconciliation: 'complete',
        targets: [
          {
            dateKey: '2026-11-11',
            direction: 'to',
            userId: 'U001',
            scheduleRowId: 'row-1',
            outcome: 'CONFIRMED_APPLIED',
            conflict: false,
            writeStarted: true,
          },
          {
            dateKey: '2026-11-11',
            direction: 'to',
            userId: 'U002',
            scheduleRowId: 'row-2',
            outcome: 'UNKNOWN',
            conflict: false,
            writeStarted: true,
          },
        ],
      },
    });
    expect(partial?.message).toContain('一部の配車設定が保存された可能性があります。最新の記録を確認するまで、同じ内容を再保存しないでください。');
    expect(partial?.message).toContain('確認できた保存 1件');
    expect(partial?.message).toContain('結果不明 1件');
    expect(partial?.message).not.toContain('結果不明 0件');
    const unreadable = describeAssignmentSaveFeedback('reconcile_failed', null);
    expect(unreadable?.message).toContain('結果不明の件数は確定できません');
    expect(unreadable?.message).not.toContain('0件');
    expect(describeAssignmentSaveFeedback('error', null)?.message).toContain('書き込みは開始していません');
  });

  it('keeps a week of unresolved targets and does not block a disjoint day', () => {
    const held: UnresolvedAssignmentSave = {
      requestId: 'week-1',
      reconciliation: 'incomplete',
      targets: [
        {
          dateKey: '2026-11-11',
          direction: 'to',
          userId: 'U002',
          scheduleRowId: 'row-1',
          outcome: 'UNKNOWN',
          conflict: false,
          writeStarted: true,
        },
        {
          dateKey: '2026-11-12',
          direction: 'to',
          userId: 'U001',
          scheduleRowId: 'row-2',
          outcome: 'NOT_ATTEMPTED',
          conflict: false,
          writeStarted: false,
        },
      ],
    };
    expect(isAssignmentSaveBlocked([held], [{ dateKey: '2026-11-12', direction: 'to', userId: 'U001', scheduleRowId: null }])).toBe(true);
    expect(isAssignmentSaveBlocked([held], [{ dateKey: '2026-11-11', direction: 'from', userId: 'U002', scheduleRowId: null }])).toBe(false);
    expect(isAssignmentSaveBlocked([held], [{ dateKey: '2026-11-13', direction: 'to', userId: 'U009', scheduleRowId: 'row-9' }])).toBe(false);
    expect(isAssignmentSaveBlocked([held], [{ dateKey: '2026-11-18', direction: 'to', userId: 'U009', scheduleRowId: 'row-1' }])).toBe(true);
    expect(nextUnresolvedAssignmentSave('week-1', held.targets, {
      reconciliation: 'complete',
      targets: held.targets.map((target) => ({ ...target, outcome: 'CONFIRMED_NOT_APPLIED', conflict: true })),
    })).not.toBeNull();
    const feedback = describeBlockedAssignmentSave([held], held.targets);
    expect(feedback?.message).toContain('結果不明の件数は確定できません');
    expect(feedback?.message).not.toContain('0件');
  });

  it('stores only the save-control fields', () => {
    persistUnresolvedAssignmentSaves([{
      requestId: 'req-1',
      reconciliation: 'pending',
      targets: [{
        dateKey: '2026-11-11',
        direction: 'to',
        userId: 'U002',
        scheduleRowId: 'row-1',
        outcome: 'IN_FLIGHT',
        conflict: false,
        writeStarted: false,
      }],
    }]);
    const raw = localStorage.getItem('iceberg.transportAssignment.unresolvedSave.v1') ?? '';
    expect(raw).not.toContain('notes');
    expect(raw).not.toContain('FullName');
    expect(loadUnresolvedAssignmentSaves()[0]?.targets[0]).toMatchObject({
      userId: 'U002',
      scheduleRowId: 'row-1',
      outcome: 'IN_FLIGHT',
    });
  });
});

describe('assignment ledger recovery', () => {
  const seal = sealAssignmentFields(fields);
  const other = sealAssignmentFields({ ...fields, vehicleId: '' });

  it('hashes the schedule mark without storing the source text', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('distinguishes an empty ledger from a readable unresolved ledger', () => {
    localStorage.removeItem(UNRESOLVED_ASSIGNMENT_SAVE_STORAGE_KEY);
    expect(readAssignmentLedger()).toEqual({ kind: 'empty' });
    persistUnresolvedAssignmentSaves([{
      requestId: 'req-1',
      reconciliation: 'pending',
      targets: [{
        dateKey: '2026-11-11',
        direction: 'to',
        userId: 'U002',
        scheduleRowId: 'row-1',
        outcome: 'IN_FLIGHT',
        conflict: false,
        writeStarted: false,
        before: other,
        intent: seal,
      }],
    }]);
    const ledger = readAssignmentLedger();
    expect(ledger.kind).toBe('records');
    if (ledger.kind !== 'records') return;
    expect(ledger.scopeClosed).toBe(false);
    expect(ledger.records[0]?.schemaVersion).toBe(2);
  });

  it('keeps a damaged ledger closed and does not rewrite it', () => {
    localStorage.setItem(UNRESOLVED_ASSIGNMENT_SAVE_STORAGE_KEY, '{');
    expect(readAssignmentLedger()).toEqual({ kind: 'corrupt', reason: 'json' });
    localStorage.setItem(UNRESOLVED_ASSIGNMENT_SAVE_STORAGE_KEY, '{"schemaVersion":9}');
    expect(readAssignmentLedger()).toEqual({ kind: 'corrupt', reason: 'schema' });
    localStorage.setItem(UNRESOLVED_ASSIGNMENT_SAVE_STORAGE_KEY, JSON.stringify([{
      requestId: 'bad',
      reconciliation: 'pending',
      targets: [{ direction: 'to', outcome: 'IN_FLIGHT', conflict: false, writeStarted: false }],
    }]));
    expect(readAssignmentLedger()).toEqual({ kind: 'corrupt', reason: 'invalid-record' });
    expect(() => persistUnresolvedAssignmentSaves([])).toThrow(/Refusing to replace/);
    expect(localStorage.getItem(UNRESOLVED_ASSIGNMENT_SAVE_STORAGE_KEY)).toContain('bad');
    expect(describeAssignmentLedger({ kind: 'corrupt', reason: 'json' })?.testId).toBe('transport-assignment-ledger-corrupt');
    const emptyString = {
      getItem: () => '',
      setItem: () => {
        throw new Error('empty ledger must not be overwritten');
      },
    };
    expect(readAssignmentLedger(emptyString)).toEqual({ kind: 'corrupt', reason: 'json' });
    expect(() => persistUnresolvedAssignmentSaves([], emptyString)).toThrow(/Refusing to replace/);
  });

  it('reports a storage read failure without treating it as an empty ledger', () => {
    const storage = {
      getItem() {
        throw new Error('denied');
      },
    };
    expect(readAssignmentLedger(storage)).toEqual({ kind: 'corrupt', reason: 'read-failed' });
  });

  it('reports a storage write failure without clearing the previous ledger', () => {
    const kept = JSON.stringify([]);
    const storage = {
      getItem: () => kept,
      setItem() {
        throw new Error('quota');
      },
    };
    expect(() => persistUnresolvedAssignmentSaves([], storage)).toThrow(/quota/);
    expect(storage.getItem()).toBe(kept);
  });

  it('keeps an old unresolved record and a sealed record together', () => {
    const legacy = {
      requestId: 'old',
      reconciliation: 'incomplete',
      targets: [{
        dateKey: '2026-11-11',
        direction: 'to',
        userId: 'U002',
        scheduleRowId: 'row-1',
        outcome: 'UNKNOWN',
        conflict: false,
        writeStarted: true,
      }],
    };
    const sealed = {
      schemaVersion: 2,
      requestId: 'new',
      reconciliation: 'pending',
      targets: [{
        dateKey: '2026-11-12',
        direction: 'from',
        userId: 'U009',
        scheduleRowId: 'row-9',
        outcome: 'IN_FLIGHT',
        conflict: false,
        writeStarted: false,
        before: other,
        intent: seal,
      }],
    };
    localStorage.setItem(UNRESOLVED_ASSIGNMENT_SAVE_STORAGE_KEY, JSON.stringify([legacy, sealed]));
    const ledger = readAssignmentLedger();
    expect(ledger.kind).toBe('records');
    if (ledger.kind !== 'records') return;
    expect(ledger.records.map((record) => record.requestId)).toEqual(['old', 'new']);
    expect(ledger.scopeClosed).toBe(false);
    expect(isAssignmentSaveBlocked(ledger.records, [{ dateKey: '2026-11-13', direction: 'to', userId: 'U008', scheduleRowId: 'row-8' }])).toBe(false);
    expect(settleUnresolvedRecovery(ledger.records[0])).not.toBeNull();
  });

  it('does not turn an in-flight row into a success just because it was read back', () => {
    expect(judgeRecoveredAssignmentTarget({
      before: other,
      intent: seal,
      after: fields,
      identityMatches: true,
      readable: true,
    })).toMatchObject({ outcome: 'UNKNOWN', conflict: true, reason: 'write_still_possible' });
    expect(judgeRecoveredAssignmentTarget({
      before: other,
      intent: seal,
      after: { ...fields, vehicleId: '' },
      identityMatches: true,
      readable: true,
    })).toMatchObject({ outcome: 'UNKNOWN', conflict: true, reason: 'write_still_possible' });
    const stillPossible = judgeRecoveredAssignmentTarget({
      before: other,
      intent: seal,
      after: fields,
      identityMatches: true,
      readable: true,
    });
    expect(settleUnresolvedRecovery({
      schemaVersion: 2,
      requestId: 'req',
      reconciliation: 'pending',
      targets: [{
        dateKey: '2026-11-11',
        direction: 'to',
        userId: 'U002',
        scheduleRowId: 'row-1',
        outcome: stillPossible.outcome,
        conflict: stillPossible.conflict,
        writeStarted: false,
        reason: stillPossible.reason,
        before: other,
        intent: seal,
      }],
    })).not.toBeNull();
    expect(judgeRecoveredAssignmentTarget({
      before: other,
      intent: seal,
      after: { ...fields, driverId: 'OTHER' },
      identityMatches: true,
      readable: true,
    })).toMatchObject({ outcome: 'CONFIRMED_NOT_APPLIED', conflict: true, reason: 'external_change' });
    expect(judgeRecoveredAssignmentTarget({
      before: other,
      intent: seal,
      after: null,
      identityMatches: true,
      readable: false,
    })).toMatchObject({ outcome: 'UNKNOWN', reason: 'reconcile_failed' });
    expect(judgeRecoveredAssignmentTarget({
      before: other,
      intent: seal,
      after: null,
      identityMatches: true,
      readable: true,
    })).toMatchObject({ outcome: 'CONFIRMED_NOT_APPLIED', conflict: true, reason: 'item_gone' });
    expect(judgeRecoveredAssignmentTarget({
      before: other,
      intent: seal,
      after: fields,
      identityMatches: false,
      readable: true,
    })).toMatchObject({ outcome: 'UNKNOWN', conflict: true, reason: 'target_mismatch' });
    expect(judgeRecoveredAssignmentTarget({
      before: null,
      intent: null,
      after: fields,
      identityMatches: true,
      readable: true,
    })).toMatchObject({ outcome: 'UNKNOWN', reason: 'missing_snapshot' });
    const classifiedOnly = settleUnresolvedRecovery({
      schemaVersion: 2,
      requestId: 'req',
      reconciliation: 'pending',
      targets: [{
        dateKey: '2026-11-11',
        direction: 'to',
        userId: 'U002',
        scheduleRowId: 'row-1',
        outcome: 'CONFIRMED_NOT_APPLIED',
        conflict: false,
        writeStarted: false,
        before: other,
        intent: seal,
      }],
    });
    expect(classifiedOnly).not.toBeNull();
    const request = [{
      dateKey: '2026-11-11',
      direction: 'to' as const,
      userId: 'U002',
      scheduleRowId: 'row-1',
    }];
    expect(nextUnresolvedAssignmentSave('sent-before', request, {
      reconciliation: 'complete',
      targets: [{
        ...request[0],
        outcome: 'CONFIRMED_NOT_APPLIED',
        conflict: false,
        writeStarted: true,
      }],
    })).not.toBeNull();
    expect(nextUnresolvedAssignmentSave('sent-intent', request, {
      reconciliation: 'complete',
      targets: [{
        ...request[0],
        outcome: 'CONFIRMED_APPLIED',
        conflict: false,
        writeStarted: true,
      }],
    })).not.toBeNull();
    expect(nextUnresolvedAssignmentSave('partial-row', [
      request[0],
      { dateKey: '2026-11-12', direction: 'to', userId: 'U001', scheduleRowId: 'row-2' },
    ], {
      reconciliation: 'complete',
      targets: [
        { ...request[0], outcome: 'CONFIRMED_APPLIED', conflict: false, writeStarted: true },
        {
          dateKey: '2026-11-12',
          direction: 'to',
          userId: 'U001',
          scheduleRowId: 'row-2',
          outcome: 'CONFIRMED_NOT_APPLIED',
          conflict: false,
          writeStarted: true,
        },
      ],
    })).not.toBeNull();
    expect(nextUnresolvedAssignmentSave('unsent', request, {
      reconciliation: 'complete',
      targets: [{
        ...request[0],
        scheduleRowId: null,
        outcome: 'NOT_ATTEMPTED',
        conflict: false,
        writeStarted: false,
      }],
    })).toBeNull();
    expect(nextUnresolvedAssignmentSave('false-default', request, {
      reconciliation: 'complete',
      targets: [{
        ...request[0],
        outcome: 'CONFIRMED_NOT_APPLIED',
        conflict: false,
        writeStarted: false,
      }],
    })).not.toBeNull();
    persistUnresolvedAssignmentSaves([{
      schemaVersion: 2,
      requestId: 'kept-reason',
      reconciliation: 'incomplete',
      targets: [{
        dateKey: '2026-11-11',
        direction: 'to',
        userId: 'U002',
        scheduleRowId: 'row-1',
        outcome: 'UNKNOWN',
        conflict: true,
        writeStarted: false,
        reason: 'write_still_possible',
        before: other,
        intent: seal,
      }],
    }]);
    expect(localStorage.getItem(UNRESOLVED_ASSIGNMENT_SAVE_STORAGE_KEY)).toContain('write_still_possible');
    expect(loadUnresolvedAssignmentSaves()[0]?.targets[0]?.reason).toBe('write_still_possible');
  });

  it('blocks every save when an unresolved target has no schedule row id', () => {
    const held: UnresolvedAssignmentSave = {
      requestId: 'open',
      reconciliation: 'pending',
      targets: [{
        dateKey: '2026-11-11',
        direction: 'to',
        userId: 'U002',
        scheduleRowId: null,
        outcome: 'IN_FLIGHT',
        conflict: false,
        writeStarted: false,
      }],
    };
    expect(isAssignmentSaveBlocked([held], [{ dateKey: '2026-11-18', direction: 'from', userId: 'U009', scheduleRowId: 'row-9' }])).toBe(true);
  });
});

describe('assignment recovery contract', () => {
  const request = [{ dateKey: '2026-11-11', direction: 'to' as const, userId: 'U002', scheduleRowId: 'row-2' }];
  const record = {
    schemaVersion: 2 as const,
    saveContractVersion: 1 as const,
    requestId: 'old',
    reconciliation: 'pending' as const,
    targets: [{
      dateKey: '2026-11-11',
      direction: 'to' as const,
      userId: 'U002',
      scheduleRowId: 'row-2',
      outcome: 'IN_FLIGHT' as const,
      conflict: true,
      writeStarted: false,
    }],
  };

  it('accepts only a real response ETag', () => {
    expect(isUsableAssignmentEtag('"8,1"', '7')).toBe(true);
    expect(isUsableAssignmentEtag(null, '7')).toBe(false);
    expect(isUsableAssignmentEtag('*', '7')).toBe(false);
    expect(isUsableAssignmentEtag('"sp-7"', '7')).toBe(false);
    expect(isUsableAssignmentEtag('"7"', '7')).toBe(false);
    expect(isUsableAssignmentEtag('sp-other', '7')).toBe(false);
  });

  it('releases a request only after every row ETag advances', () => {
    const second = {
      ...record.targets[0],
      dateKey: '2026-11-12',
      scheduleRowId: 'row-12',
    };
    const week = { ...record, requestId: 'week', targets: [record.targets[0], second] };
    const legacy = { ...record, requestId: 'legacy', saveContractVersion: undefined };
    const merges = [{ scheduleRowId: 'row-2', beforeEtag: '"8,1"', afterEtag: '"9,1"' }];
    expect(didAssignmentEtagAdvance('"8,1"', '"8,1"', 'row-2')).toBe(false);
    expect(didAssignmentEtagAdvance('"8,1"', '"9,1"', 'row-2')).toBe(true);
    expect(provenRecoveryRequestIds([week], ['week'], [])).toEqual([]);
    expect(provenRecoveryRequestIds([week], ['week'], merges)).toEqual([]);
    expect(provenRecoveryRequestIds([week], ['week'], [
      ...merges,
      { scheduleRowId: 'row-12', beforeEtag: '"1,1"', afterEtag: '"2,1"' },
    ])).toEqual(['week']);
    expect(provenRecoveryRequestIds([record, legacy], ['old', 'legacy'], merges)).toEqual(['old']);
  });

  it('offers recovery only for the new contract and leaves an old record untouched', () => {
    expect(assignmentRecoveryEligibility({ kind: 'records', records: [record] }, request)).toBe('available');
    const legacy = { ...record, saveContractVersion: undefined };
    expect(assignmentRecoveryEligibility({ kind: 'records', records: [legacy] }, request)).toBe('legacy');
    expect(assignmentRecoveryEligibility({ kind: 'corrupt', reason: 'json' }, request)).toBe('corrupt');
    expect(assignmentRecoveryEligibility({ kind: 'empty' }, request)).toBe('none');
  });
});
