// ---------------------------------------------------------------------------
// buildIncidentCreateInput.spec — Phase 4b: Incident 作成境界テスト
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';

import {
  buildIncidentCreateInput,
  createEmptyIncidentDraft,
  IncidentUserNotResolvedError,
} from '../highRiskIncident';
import type { IncidentUserMasterLike } from '../highRiskIncident';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockUser(overrides: Partial<IncidentUserMasterLike> = {}): IncidentUserMasterLike {
  return {
    UserID: 'U001',
    FullName: '田中太郎',
    DisabilitySupportLevel: '4',
    severeFlag: true,
    IsHighIntensitySupportTarget: true,
    RecipientCertNumber: 'RC-12345',
    RecipientCertExpiry: '2025-03-31',
    GrantPeriodStart: '2024-04-01',
    GrantPeriodEnd: '2025-03-31',
    GrantedDaysPerMonth: '23',
    UsageStatus: '利用中',
    ...overrides,
  };
}

function createTestDraft(personId = 'U001') {
  return createEmptyIncidentDraft(personId, 'plan-001');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildIncidentCreateInput', () => {
  it('Draft + User → UserSnapshot 付き HighRiskIncident を生成する', () => {
    const draft = createTestDraft('U001');
    const user = mockUser();

    const result = buildIncidentCreateInput('inc-001', draft, user);

    expect(result.id).toBe('inc-001');
    expect(result.userId).toBe('U001');
    expect(result.severity).toBe('低'); // schema default
    expect(result.userSnapshot).toBeDefined();
    expect(result.userSnapshot!.userId).toBe('U001');
    expect(result.userSnapshot!.userName).toBe('田中太郎');
  });

  it('UserSnapshot にフル属性（支援区分・重度フラグ等）が含まれる', () => {
    const draft = createTestDraft('U001');
    const user = mockUser({
      DisabilitySupportLevel: '5',
      severeFlag: true,
      IsHighIntensitySupportTarget: true,
    });

    const result = buildIncidentCreateInput('inc-002', draft, user);
    const snapshot = result.userSnapshot!;

    expect(snapshot.disabilitySupportLevel).toBe('5');
    expect(snapshot.severeFlag).toBe(true);
    expect(snapshot.isHighIntensitySupportTarget).toBe(true);
    expect(snapshot.recipientCertNumber).toBe('RC-12345');
    expect(snapshot.recipientCertExpiry).toBe('2025-03-31');
    expect(snapshot.grantPeriodStart).toBe('2024-04-01');
    expect(snapshot.grantPeriodEnd).toBe('2025-03-31');
    expect(snapshot.grantedDaysPerMonth).toBe('23');
    expect(snapshot.usageStatus).toBe('利用中');
  });

  it('snapshotAt が ISO 8601 形式で記録される', () => {
    const draft = createTestDraft('U001');
    const user = mockUser();

    const result = buildIncidentCreateInput('inc-003', draft, user);

    expect(result.userSnapshot!.snapshotAt).toBeDefined();
    // ISO 8601 format check
    expect(() => new Date(result.userSnapshot!.snapshotAt)).not.toThrow();
    expect(new Date(result.userSnapshot!.snapshotAt).toISOString()).toBe(
      result.userSnapshot!.snapshotAt,
    );
  });

  it('Draft のフィールドが正しく HighRiskIncident にマッピングされる', () => {
    const draft = createEmptyIncidentDraft('U002', 'plan-002');
    // Modify some fields
    draft.severity = '高';
    draft.targetBehavior = '物品破壊行動';
    draft.antecedent.relatedIcebergFactors = ['factor1', 'factor2'];
    draft.consequence.consequenceReceived = ['注目を得た'];
    draft.consequence.staffInterventionNotes = '声かけで対応';

    const user = mockUser({ UserID: 'U002', FullName: '鈴木花子' });

    const result = buildIncidentCreateInput('inc-004', draft, user);

    expect(result.severity).toBe('高');
    expect(result.description).toBe('物品破壊行動');
    expect(result.triggers).toEqual(['factor1', 'factor2']);
    expect(result.actions).toEqual(['注目を得た']);
    expect(result.notes).toBe('声かけで対応');
    expect(result.userSnapshot!.userId).toBe('U002');
    expect(result.userSnapshot!.userName).toBe('鈴木花子');
  });

  // ── エラー系 ──

  it('targetUser が null の場合 IncidentUserNotResolvedError を投げる', () => {
    const draft = createTestDraft('U999');

    expect(() => buildIncidentCreateInput('inc-err-1', draft, null)).toThrow(
      IncidentUserNotResolvedError,
    );

    try {
      buildIncidentCreateInput('inc-err-1', draft, null);
    } catch (e) {
      const err = e as IncidentUserNotResolvedError;
      expect(err.code).toBe('INCIDENT_USER_NOT_RESOLVED');
      expect(err.userId).toBe('U999');
      expect(err.message).toContain('U999');
    }
  });

  it('targetUser が undefined の場合 IncidentUserNotResolvedError を投げる', () => {
    const draft = createTestDraft('U888');

    expect(() => buildIncidentCreateInput('inc-err-2', draft, undefined)).toThrow(
      IncidentUserNotResolvedError,
    );
  });

  // ── 不変性 ──

  it('UserSnapshot はマスタ変更の影響を受けない不変コピーである', () => {
    const user = mockUser();
    const draft = createTestDraft('U001');

    const result = buildIncidentCreateInput('inc-imm', draft, user);

    // 元のユーザーオブジェクトのプロパティ変更は snapshot に影響しない
    // (toUserSnapshot は新オブジェクトを生成するため)
    expect(result.userSnapshot!.userName).toBe('田中太郎');
    expect(result.userSnapshot!.severeFlag).toBe(true);
  });

  // ── 最小属性 ──

  it('最小限の属性しかない user でも snapshot が生成される', () => {
    const minimalUser: IncidentUserMasterLike = {
      UserID: 'U-MIN',
      FullName: '最小太郎',
    };
    const draft = createTestDraft('U-MIN');

    const result = buildIncidentCreateInput('inc-min', draft, minimalUser);

    expect(result.userSnapshot!.userId).toBe('U-MIN');
    expect(result.userSnapshot!.userName).toBe('最小太郎');
    expect(result.userSnapshot!.disabilitySupportLevel).toBeNull();
    expect(result.userSnapshot!.severeFlag).toBe(false);
    expect(result.userSnapshot!.isHighIntensitySupportTarget).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// IncidentUserNotResolvedError の構造テスト
// ---------------------------------------------------------------------------

describe('IncidentUserNotResolvedError', () => {
  it('正しいエラー構造を持つ', () => {
    const err = new IncidentUserNotResolvedError('U001');

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(IncidentUserNotResolvedError);
    expect(err.name).toBe('IncidentUserNotResolvedError');
    expect(err.code).toBe('INCIDENT_USER_NOT_RESOLVED');
    expect(err.userId).toBe('U001');
    expect(err.message).toContain('U001');
  });
});
