/**
 * buildIspCreateInput — ユニットテスト
 *
 * テスト観点:
 *   - create 時に userSnapshot が正しく注入される
 *   - 利用者マスタの属性がスナップショットに正しく反映される
 *   - 利用者が未解決の場合は UserNotResolvedError
 *   - フォーム値がそのまま透過される
 */
import { describe, it, expect } from 'vitest';
import {
  buildIspCreateInput,
  UserNotResolvedError,
} from '../buildIspCreateInput';
import type { IspFormValues } from '../schema';
import type { IspUserMasterLike } from '../buildIspCreateInput';

// ─────────────────────────────────────────────
// テストデータファクトリ
// ─────────────────────────────────────────────

function makeFormValues(overrides: Partial<IspFormValues> = {}): IspFormValues {
  return {
    userId: 'U001',
    title: '2026年度ISP',
    planStartDate: '2026-04-01',
    planEndDate: '2027-03-31',
    userIntent: '自分のペースで活動したい',
    familyIntent: '穏やかに過ごしてほしい',
    overallSupportPolicy: '本人の意思を尊重した支援',
    qolIssues: '',
    longTermGoals: ['コミュニケーション向上'],
    shortTermGoals: ['PECSカードで要求を伝える'],
    supportSummary: '',
    precautions: '',
    status: 'assessment',
    ...overrides,
  };
}

function makeUser(overrides: Partial<IspUserMasterLike> = {}): IspUserMasterLike {
  return {
    UserID: 'U001',
    FullName: '田中太郎',
    DisabilitySupportLevel: '4',
    severeFlag: true,
    IsHighIntensitySupportTarget: false,
    RecipientCertNumber: 'CERT-123',
    RecipientCertExpiry: '2027-03-31',
    GrantPeriodStart: '2026-04-01',
    GrantPeriodEnd: '2027-03-31',
    GrantedDaysPerMonth: '22',
    UsageStatus: 'active',
    ...overrides,
  };
}

// ═════════════════════════════════════════════
// テスト
// ═════════════════════════════════════════════

describe('buildIspCreateInput', () => {
  // ── 正常系 ──

  it('利用者マスタから UserSnapshot を生成して注入する', () => {
    const input = buildIspCreateInput(makeFormValues(), makeUser());

    expect(input.userSnapshot).toBeDefined();
    expect(input.userSnapshot!.userId).toBe('U001');
    expect(input.userSnapshot!.userName).toBe('田中太郎');
    expect(input.userSnapshot!.disabilitySupportLevel).toBe('4');
    expect(input.userSnapshot!.severeFlag).toBe(true);
    expect(input.userSnapshot!.isHighIntensitySupportTarget).toBe(false);
    expect(input.userSnapshot!.recipientCertNumber).toBe('CERT-123');
  });

  it('snapshotAt が ISO 8601 形式で付与される', () => {
    const input = buildIspCreateInput(makeFormValues(), makeUser());

    expect(input.userSnapshot!.snapshotAt).toBeDefined();
    // ISO 8601 形式チェック
    expect(new Date(input.userSnapshot!.snapshotAt).toISOString()).toBe(
      input.userSnapshot!.snapshotAt,
    );
  });

  it('フォーム値がそのまま IspCreateInput に透過される', () => {
    const form = makeFormValues({
      userIntent: 'テスト用の意向',
      longTermGoals: ['長期A', '長期B'],
    });

    const input = buildIspCreateInput(form, makeUser());

    expect(input.userId).toBe('U001');
    expect(input.userIntent).toBe('テスト用の意向');
    expect(input.longTermGoals).toEqual(['長期A', '長期B']);
    expect(input.planStartDate).toBe('2026-04-01');
  });

  it('最小限の利用者属性でもスナップショットが生成される', () => {
    const minimalUser: IspUserMasterLike = {
      UserID: 'U999',
      FullName: '最小ユーザー',
    };

    const input = buildIspCreateInput(
      makeFormValues({ userId: 'U999' }),
      minimalUser,
    );

    expect(input.userSnapshot!.userId).toBe('U999');
    expect(input.userSnapshot!.userName).toBe('最小ユーザー');
    expect(input.userSnapshot!.disabilitySupportLevel).toBeNull();
    expect(input.userSnapshot!.severeFlag).toBe(false);
    expect(input.userSnapshot!.recipientCertNumber).toBeNull();
  });

  // ── 異常系 ──

  it('利用者が undefined の場合 UserNotResolvedError を throw する', () => {
    expect(() =>
      buildIspCreateInput(makeFormValues(), undefined),
    ).toThrow(UserNotResolvedError);
  });

  it('利用者が null の場合 UserNotResolvedError を throw する', () => {
    expect(() =>
      buildIspCreateInput(makeFormValues(), null),
    ).toThrow(UserNotResolvedError);
  });

  it('UserNotResolvedError に userId が含まれる', () => {
    try {
      buildIspCreateInput(makeFormValues({ userId: 'U999' }), undefined);
      // ここに到達してはいけない
      expect.unreachable('should throw');
    } catch (err) {
      expect(err).toBeInstanceOf(UserNotResolvedError);
      const e = err as UserNotResolvedError;
      expect(e.code).toBe('USER_NOT_RESOLVED');
      expect(e.message).toContain('U999');
    }
  });
});

// ─────────────────────────────────────────────
// UserNotResolvedError 単体テスト
// ─────────────────────────────────────────────

describe('UserNotResolvedError', () => {
  it('userId ありのメッセージ', () => {
    const err = new UserNotResolvedError('U001');
    expect(err.message).toContain('U001');
    expect(err.code).toBe('USER_NOT_RESOLVED');
    expect(err.name).toBe('UserNotResolvedError');
  });

  it('userId なしのメッセージ', () => {
    const err = new UserNotResolvedError();
    expect(err.message).toContain('指定されていません');
  });
});
