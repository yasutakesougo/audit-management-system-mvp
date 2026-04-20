/**
 * useIspCreate — ユニットテスト
 *
 * テスト観点:
 *   - draftToIspFormValues の変換正確性
 *   - buildUserLookup の O(1) ルックアップ
 *   - useIspCreate hook の create/error フロー
 */
import { describe, it, expect } from 'vitest';
import { draftToIspFormValues, buildUserLookup } from '../useIspCreate';
import { defaultFormState } from '../../types';
import type { SupportPlanForm } from '../../types';
import type { IUserMaster } from '@/features/users/types';

// ─────────────────────────────────────────────
// テストデータファクトリ
// ─────────────────────────────────────────────

function makeForm(overrides: Partial<SupportPlanForm> = {}): SupportPlanForm {
  return {
    ...defaultFormState,
    serviceUserName: '田中太郎',
    supportLevel: '区分4',
    planPeriod: '2026-04-01〜2027-03-31',
    assessmentSummary: '自分のペースで活動したい',
    strengths: '手先が器用',
    decisionSupport: '本人の意思を尊重した支援',
    conferenceNotes: '会議メモ',
    monitoringPlan: 'モニタリング計画',
    reviewTiming: '6ヶ月ごと',
    riskManagement: 'てんかん発作に注意',
    complianceControls: '基準省令適合',
    improvementIdeas: '改善提案',
    lastMonitoringDate: '2026/02/01',
    goals: [
      { id: 'g1', type: 'long', label: 'コミュニケーション向上', text: '', domains: [] },
      { id: 'g2', type: 'short', label: 'PECSカードで要求を伝える', text: '', domains: [] },
      { id: 'g3', type: 'support', label: '行動支援プラン', text: '', domains: [] },
    ],
    ...overrides,
  };
}

function makeUser(overrides: Partial<IUserMaster> = {}): IUserMaster {
  return {
    Id: 1,
    UserID: 'U001',
    FullName: '田中太郎',
    IsActive: true,
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
  } as IUserMaster;
}

// ═════════════════════════════════════════════
// draftToIspFormValues
// ═════════════════════════════════════════════

describe('draftToIspFormValues', () => {
  it('ドラフトのフォーム値を IspFormValues に正しくマッピングする', () => {
    const result = draftToIspFormValues(makeForm(), 'U001');

    expect(result.userId).toBe('U001');
    expect(result.title).toBe('田中太郎 個別支援計画');
    expect(result.planStartDate).toBe('2026-04-01');
    expect(result.planEndDate).toBe('2027-03-31');
    expect(result.userIntent).toBe('自分のペースで活動したい');
    expect(result.overallSupportPolicy).toBe('本人の意思を尊重した支援');
    expect(result.qolIssues).toBe('手先が器用');
    expect(result.supportSummary).toBe('会議メモ');
    expect(result.precautions).toBe('てんかん発作に注意');
    expect(result.status).toBe('assessment');
  });

  it('goals から longTermGoals / shortTermGoals を正しく分離する', () => {
    const result = draftToIspFormValues(makeForm(), 'U001');

    expect(result.longTermGoals).toEqual(['コミュニケーション向上']);
    expect(result.shortTermGoals).toEqual(['PECSカードで要求を伝える']);
  });

  it('goals が空の場合はデフォルト値を使用する', () => {
    const result = draftToIspFormValues(makeForm({ goals: [] }), 'U001');

    expect(result.longTermGoals).toEqual(['（長期目標未設定）']);
    expect(result.shortTermGoals).toEqual(['（短期目標未設定）']);
  });

  it('空ラベルの goal はフィルタされる', () => {
    const form = makeForm({
      goals: [
        { id: 'g1', type: 'long', label: '有効な目標', text: '', domains: [] },
        { id: 'g2', type: 'long', label: '  ', text: '', domains: [] },
        { id: 'g3', type: 'long', label: '', text: '', domains: [] },
      ],
    });
    const result = draftToIspFormValues(form, 'U001');

    expect(result.longTermGoals).toEqual(['有効な目標']);
  });

  it('planPeriod に「〜」がない場合は ISO 日付のフォールバック', () => {
    const result = draftToIspFormValues(makeForm({ planPeriod: '' }), 'U001');

    // 空文字列なので今日の日付がフォールバック
    expect(result.planStartDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.planEndDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ═════════════════════════════════════════════
// buildUserLookup
// ═════════════════════════════════════════════

describe('buildUserLookup', () => {
  it('UserID → IUserMaster の Map を構築する', () => {
    const users = [makeUser({ UserID: 'U001' }), makeUser({ UserID: 'U002', FullName: '佐藤花子' })];
    const lookup = buildUserLookup(users);

    expect(lookup.size).toBe(2);
    expect(lookup.get('U001')?.FullName).toBe('田中太郎');
    expect(lookup.get('U002')?.FullName).toBe('佐藤花子');
  });

  it('UserID が空のユーザーはスキップする', () => {
    const users = [makeUser({ UserID: '' }), makeUser({ UserID: 'U001' })];
    const lookup = buildUserLookup(users);

    expect(lookup.size).toBe(1);
    expect(lookup.has('')).toBe(false);
  });

  it('空配列では空の Map を返す', () => {
    const lookup = buildUserLookup([]);
    expect(lookup.size).toBe(0);
  });
});
