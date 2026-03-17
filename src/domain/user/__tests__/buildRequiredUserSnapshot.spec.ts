/**
 * buildRequiredUserSnapshot — ユニットテスト
 *
 * 共通の snapshot / ref 必須生成のテスト。
 * 各ドメイン（ISP / Incident / Daily）の create 境界が依存する基盤。
 */

import { describe, it, expect } from 'vitest';
import {
  buildRequiredUserSnapshot,
  buildRequiredUserRef,
  RequiredUserNotResolvedError,
} from '../buildRequiredUserSnapshot';

// ─── テストヘルパー ────────────────────────────

const makeUser = (overrides = {}) => ({
  UserID: 'U001',
  FullName: '田中太郎',
  DisabilitySupportLevel: '4',
  severeFlag: true,
  IsHighIntensitySupportTarget: false,
  RecipientCertNumber: 'RC-001',
  RecipientCertExpiry: '2027-03-31',
  GrantPeriodStart: '2026-04-01',
  GrantPeriodEnd: '2027-03-31',
  GrantedDaysPerMonth: '22',
  UsageStatus: '利用中',
  ...overrides,
});

// ─── buildRequiredUserSnapshot ─────────────────

describe('buildRequiredUserSnapshot', () => {
  it('正常: UserSnapshot を生成する', () => {
    const snapshot = buildRequiredUserSnapshot(makeUser());
    expect(snapshot.userId).toBe('U001');
    expect(snapshot.userName).toBe('田中太郎');
    expect(snapshot.disabilitySupportLevel).toBe('4');
    expect(snapshot.severeFlag).toBe(true);
    expect(snapshot.snapshotAt).toBeDefined();
  });

  it('正常: 最小限のフィールドでも生成できる', () => {
    const minUser = { UserID: 'U002', FullName: '佐藤花子' };
    const snapshot = buildRequiredUserSnapshot(minUser);
    expect(snapshot.userId).toBe('U002');
    expect(snapshot.userName).toBe('佐藤花子');
    expect(snapshot.disabilitySupportLevel).toBeNull();
    expect(snapshot.severeFlag).toBe(false);
  });

  it('エラー: null なら RequiredUserNotResolvedError', () => {
    expect(() => buildRequiredUserSnapshot(null, 'U999')).toThrow(
      RequiredUserNotResolvedError,
    );
  });

  it('エラー: undefined なら RequiredUserNotResolvedError', () => {
    expect(() => buildRequiredUserSnapshot(undefined)).toThrow(
      RequiredUserNotResolvedError,
    );
  });

  it('エラー: userId がメッセージに含まれる', () => {
    try {
      buildRequiredUserSnapshot(null, 'U999');
    } catch (error) {
      expect(error).toBeInstanceOf(RequiredUserNotResolvedError);
      expect((error as RequiredUserNotResolvedError).userId).toBe('U999');
      expect((error as RequiredUserNotResolvedError).code).toBe(
        'REQUIRED_USER_NOT_RESOLVED',
      );
      expect((error as Error).message).toContain('U999');
    }
  });

  it('エラー: userId 省略時もエラーメッセージが出る', () => {
    try {
      buildRequiredUserSnapshot(undefined);
    } catch (error) {
      expect((error as Error).message).toContain('指定されていません');
    }
  });
});

// ─── buildRequiredUserRef ──────────────────────

describe('buildRequiredUserRef', () => {
  it('正常: UserRef を生成する', () => {
    const ref = buildRequiredUserRef(makeUser());
    expect(ref.userId).toBe('U001');
    expect(ref.userName).toBe('田中太郎');
    // UserRef は userId + userName のみ
    expect(ref).toEqual({ userId: 'U001', userName: '田中太郎' });
  });

  it('エラー: null なら RequiredUserNotResolvedError', () => {
    expect(() => buildRequiredUserRef(null, 'U888')).toThrow(
      RequiredUserNotResolvedError,
    );
  });

  it('エラー: undefined なら RequiredUserNotResolvedError', () => {
    expect(() => buildRequiredUserRef(undefined)).toThrow(
      RequiredUserNotResolvedError,
    );
  });
});

// ─── RequiredUserNotResolvedError ──────────────

describe('RequiredUserNotResolvedError', () => {
  it('code が REQUIRED_USER_NOT_RESOLVED', () => {
    const error = new RequiredUserNotResolvedError('U001');
    expect(error.code).toBe('REQUIRED_USER_NOT_RESOLVED');
    expect(error.name).toBe('RequiredUserNotResolvedError');
  });

  it('Error を継承している', () => {
    const error = new RequiredUserNotResolvedError();
    expect(error).toBeInstanceOf(Error);
  });
});
