/**
 * useComplianceForm — ユニットテスト
 *
 * A-2: ISP 同意・交付 UI のフックテスト。
 * extractCompliance, detectMissingFields, updateConsent, updateDelivery, updateServiceHours
 * の動作を確認する。
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import type { IspComplianceMetadata } from '@/domain/isp/schema';
import type { SupportPlanDraft, SupportPlanForm } from '@/features/support-plan-guide/types';
import { useComplianceForm } from '../useComplianceForm';
import { defaultFormState } from '@/features/support-plan-guide/types';

// ────────────────────────────────────────────
// Test-only type helper
// ────────────────────────────────────────────

/** テスト用: draft.data に compliance が含まれている前提の型 */
type DataWithCompliance = SupportPlanForm & { compliance?: IspComplianceMetadata };

/** テスト用: draft.data から compliance を取得 */
const getCompliance = (draft: SupportPlanDraft) =>
  (draft.data as DataWithCompliance).compliance;

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

const makeDraft = (compliance?: unknown): SupportPlanDraft => ({
  id: 'draft-1',
  name: 'テスト利用者',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  userId: null,
  userCode: null,
  data: {
    ...defaultFormState,
    serviceUserName: 'テスト',
    ...(compliance !== undefined ? { compliance } : {}),
  } as DataWithCompliance,
});

const createSetDrafts = () => {
  let current: Record<string, SupportPlanDraft> = {};
  const setDrafts: React.Dispatch<React.SetStateAction<Record<string, SupportPlanDraft>>> = (
    action,
  ) => {
    current = typeof action === 'function' ? action(current) : action;
  };
  return {
    setDrafts,
    getCurrent: () => current,
    init: (drafts: Record<string, SupportPlanDraft>) => {
      current = drafts;
    },
  };
};

// ────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────

describe('useComplianceForm', () => {
  describe('初期状態', () => {
    it('ドラフトが undefined の場合、デフォルト値を返す', () => {
      const { setDrafts } = createSetDrafts();
      const { result } = renderHook(() =>
        useComplianceForm({
          activeDraft: undefined,
          activeDraftId: '',
          isAdmin: true,
          setDrafts,
        }),
      );

      expect(result.current.compliance.consent.explainedAt).toBeNull();
      expect(result.current.compliance.consent.consentedAt).toBeNull();
      expect(result.current.compliance.consent.consentedBy).toBe('');
      expect(result.current.compliance.delivery.deliveredAt).toBeNull();
      expect(result.current.compliance.delivery.deliveredToUser).toBe(false);
      expect(result.current.compliance.standardServiceHours).toBeNull();
    });

    it('ドラフトに compliance が無い場合、デフォルト値を返す', () => {
      const draft = makeDraft();
      const { setDrafts } = createSetDrafts();
      const { result } = renderHook(() =>
        useComplianceForm({
          activeDraft: draft,
          activeDraftId: draft.id,
          isAdmin: true,
          setDrafts,
        }),
      );

      expect(result.current.compliance.consent.explainedAt).toBeNull();
      expect(result.current.compliance.serviceType).toBe('other');
    });

    it('ドラフトに compliance がある場合、その値を返す', () => {
      const draft = makeDraft({
        serviceType: 'daily_life_care',
        standardServiceHours: 6.5,
        consent: {
          explainedAt: '2025-03-01',
          explainedBy: '山田花子',
          consentedAt: '2025-03-02',
          consentedBy: '鈴木太郎',
          proxyName: '',
          proxyRelation: '',
          notes: '',
        },
        delivery: {
          deliveredAt: '2025-03-03',
          deliveredToUser: true,
          deliveredToConsultationSupport: true,
          deliveryMethod: '手渡し',
          notes: '',
        },
        reviewControl: {
          reviewCycleDays: 180,
          lastReviewedAt: null,
          nextReviewDueAt: null,
          reviewReason: '',
        },
      });
      const { setDrafts } = createSetDrafts();
      const { result } = renderHook(() =>
        useComplianceForm({
          activeDraft: draft,
          activeDraftId: draft.id,
          isAdmin: true,
          setDrafts,
        }),
      );

      expect(result.current.compliance.serviceType).toBe('daily_life_care');
      expect(result.current.compliance.standardServiceHours).toBe(6.5);
      expect(result.current.compliance.consent.explainedAt).toBe('2025-03-01');
      expect(result.current.compliance.consent.consentedBy).toBe('鈴木太郎');
      expect(result.current.compliance.delivery.deliveredToUser).toBe(true);
      expect(result.current.compliance.delivery.deliveryMethod).toBe('手渡し');
    });
  });

  describe('missingFields', () => {
    it('デフォルト状態では10件の未入力項目がある', () => {
      const draft = makeDraft();
      const { setDrafts } = createSetDrafts();
      const { result } = renderHook(() =>
        useComplianceForm({
          activeDraft: draft,
          activeDraftId: draft.id,
          isAdmin: true,
          setDrafts,
        }),
      );

      expect(result.current.missingFieldCount).toBe(10);
      expect(result.current.missingFields).toContain('説明実施日');
      expect(result.current.missingFields).toContain('同意取得日');
      expect(result.current.missingFields).toContain('同意者名');
      expect(result.current.missingFields).toContain('交付日');
      expect(result.current.missingFields).toContain('本人への交付');
      expect(result.current.missingFields).toContain('会議実施日');
      expect(result.current.missingFields).toContain('相談支援事業所名');
      expect(result.current.missingFields).toContain('相談支援専門員名');
      expect(result.current.missingFields).toContain('相談支援からのサービス等利用計画の受領日');
      expect(result.current.missingFields).toContain('標準的な支援提供時間');
    });

    it('全て入力すると未入力が0件になる', () => {
      const draft = makeDraft({
        serviceType: 'daily_life_care',
        standardServiceHours: 6,
        consent: {
          explainedAt: '2025-03-01',
          explainedBy: '山田',
          consentedAt: '2025-03-02',
          consentedBy: '鈴木',
          proxyName: '',
          proxyRelation: '',
          notes: '',
        },
        delivery: {
          deliveredAt: '2025-03-03',
          deliveredToUser: true,
          deliveredToConsultationSupport: false,
          deliveryMethod: '手渡し',
          notes: '',
        },
        reviewControl: {
          reviewCycleDays: 180,
          lastReviewedAt: null,
          nextReviewDueAt: null,
          reviewReason: '',
        },
        meeting: {
          meetingDate: '2025-03-01',
          meetingMinutes: '要旨',
          attendees: ['A', 'B'],
        },
        consultationSupport: {
          agencyName: '事業所',
          officerName: '専門員',
          serviceUsePlanReceivedAt: '2025-02-28',
          gapNotes: '',
        },
      });
      const { setDrafts } = createSetDrafts();
      const { result } = renderHook(() =>
        useComplianceForm({
          activeDraft: draft,
          activeDraftId: draft.id,
          isAdmin: true,
          setDrafts,
        }),
      );

      expect(result.current.missingFieldCount).toBe(0);
      expect(result.current.missingFields).toEqual([]);
    });
  });

  describe('updateConsent', () => {
    it('同意データを部分更新する', () => {
      const draft = makeDraft();
      const { setDrafts, getCurrent, init } = createSetDrafts();
      init({ [draft.id]: draft });

      const { result } = renderHook(() =>
        useComplianceForm({
          activeDraft: draft,
          activeDraftId: draft.id,
          isAdmin: true,
          setDrafts,
        }),
      );

      act(() => {
        result.current.updateConsent({ explainedAt: '2025-04-01', explainedBy: '田中' });
      });

      const updated = getCurrent()[draft.id];
      expect(updated).toBeDefined();
      const updatedCompliance = getCompliance(updated)!;
      expect(updatedCompliance.consent.explainedAt).toBe('2025-04-01');
      expect(updatedCompliance.consent.explainedBy).toBe('田中');
      // other fields remain default
      expect(updatedCompliance.consent.consentedAt).toBeNull();
    });

    it('isAdmin が false の場合は更新しない', () => {
      const draft = makeDraft();
      const { setDrafts, getCurrent, init } = createSetDrafts();
      init({ [draft.id]: draft });

      const { result } = renderHook(() =>
        useComplianceForm({
          activeDraft: draft,
          activeDraftId: draft.id,
          isAdmin: false,
          setDrafts,
        }),
      );

      act(() => {
        result.current.updateConsent({ explainedAt: '2025-04-01' });
      });

      // Should remain unchanged
      expect(getCompliance(getCurrent()[draft.id])).toBeUndefined();
    });
  });

  describe('updateDelivery', () => {
    it('交付データを部分更新する', () => {
      const draft = makeDraft();
      const { setDrafts, getCurrent, init } = createSetDrafts();
      init({ [draft.id]: draft });

      const { result } = renderHook(() =>
        useComplianceForm({
          activeDraft: draft,
          activeDraftId: draft.id,
          isAdmin: true,
          setDrafts,
        }),
      );

      act(() => {
        result.current.updateDelivery({
          deliveredAt: '2025-04-15',
          deliveredToUser: true,
          deliveryMethod: '郵送',
        });
      });

      const updatedCompliance = getCompliance(getCurrent()[draft.id])!;
      expect(updatedCompliance.delivery.deliveredAt).toBe('2025-04-15');
      expect(updatedCompliance.delivery.deliveredToUser).toBe(true);
      expect(updatedCompliance.delivery.deliveryMethod).toBe('郵送');
      expect(updatedCompliance.delivery.deliveredToConsultationSupport).toBe(false);
    });
  });

  describe('updateServiceHours', () => {
    it('提供時間を更新する', () => {
      const draft = makeDraft();
      const { setDrafts, getCurrent, init } = createSetDrafts();
      init({ [draft.id]: draft });

      const { result } = renderHook(() =>
        useComplianceForm({
          activeDraft: draft,
          activeDraftId: draft.id,
          isAdmin: true,
          setDrafts,
        }),
      );

      act(() => {
        result.current.updateServiceHours(7.5);
      });

      const updatedCompliance = getCompliance(getCurrent()[draft.id])!;
      expect(updatedCompliance.standardServiceHours).toBe(7.5);
    });

    it('null で提供時間をクリアできる', () => {
      const draft = makeDraft({
        serviceType: 'other',
        standardServiceHours: 6,
        consent: { explainedAt: null, explainedBy: '', consentedAt: null, consentedBy: '', proxyName: '', proxyRelation: '', notes: '' },
        delivery: { deliveredAt: null, deliveredToUser: false, deliveredToConsultationSupport: false, deliveryMethod: '', notes: '' },
        reviewControl: { reviewCycleDays: 180, lastReviewedAt: null, nextReviewDueAt: null, reviewReason: '' },
      });
      const { setDrafts, getCurrent, init } = createSetDrafts();
      init({ [draft.id]: draft });

      const { result } = renderHook(() =>
        useComplianceForm({
          activeDraft: draft,
          activeDraftId: draft.id,
          isAdmin: true,
          setDrafts,
        }),
      );

      act(() => {
        result.current.updateServiceHours(null);
      });

      const updatedCompliance = getCompliance(getCurrent()[draft.id])!;
      expect(updatedCompliance.standardServiceHours).toBeNull();
    });
  });

  describe('不正データ耐性', () => {
    it('compliance が不正なオブジェクトでもデフォルトにフォールバックする', () => {
      const draft = makeDraft({ invalid: true, broken: 'data' });
      const { setDrafts } = createSetDrafts();
      const { result } = renderHook(() =>
        useComplianceForm({
          activeDraft: draft,
          activeDraftId: draft.id,
          isAdmin: true,
          setDrafts,
        }),
      );

      // Should not throw, should return defaults
      expect(result.current.compliance.consent.explainedAt).toBeNull();
      expect(result.current.compliance.serviceType).toBe('other');
    });
  });

  describe('approvalState', () => {
    it('デフォルト状態では未承認', () => {
      const draft = makeDraft();
      const { setDrafts } = createSetDrafts();
      const { result } = renderHook(() =>
        useComplianceForm({
          activeDraft: draft,
          activeDraftId: draft.id,
          isAdmin: true,
          setDrafts,
        }),
      );

      expect(result.current.approvalState.isApproved).toBe(false);
      expect(result.current.approvalState.approvedBy).toBeNull();
      expect(result.current.approvalState.approvedAt).toBeNull();
      expect(result.current.approvalState.approvalStatus).toBe('draft');
    });

    it('承認済みのドラフトでは isApproved = true', () => {
      const draft = makeDraft({
        serviceType: 'other',
        standardServiceHours: null,
        consent: { explainedAt: null, explainedBy: '', consentedAt: null, consentedBy: '', proxyName: '', proxyRelation: '', notes: '' },
        delivery: { deliveredAt: null, deliveredToUser: false, deliveredToConsultationSupport: false, deliveryMethod: '', notes: '' },
        reviewControl: { reviewCycleDays: 180, lastReviewedAt: null, nextReviewDueAt: null, reviewReason: '' },
        approval: {
          approvedBy: 'admin@example.com',
          approvedAt: '2025-04-01T09:30:00.000Z',
          approvalStatus: 'approved',
        },
      });
      const { setDrafts } = createSetDrafts();
      const { result } = renderHook(() =>
        useComplianceForm({
          activeDraft: draft,
          activeDraftId: draft.id,
          isAdmin: true,
          setDrafts,
        }),
      );

      expect(result.current.approvalState.isApproved).toBe(true);
      expect(result.current.approvalState.approvedBy).toBe('admin@example.com');
      expect(result.current.approvalState.approvedAt).toBe('2025-04-01T09:30:00.000Z');
    });
  });

  describe('performApproval', () => {
    it('管理者が承認を実行するとドラフトに反映される', () => {
      const draft = makeDraft();
      const { setDrafts, getCurrent, init } = createSetDrafts();
      init({ [draft.id]: draft });

      const { result } = renderHook(() =>
        useComplianceForm({
          activeDraft: draft,
          activeDraftId: draft.id,
          isAdmin: true,
          setDrafts,
        }),
      );

      act(() => {
        result.current.performApproval('admin@example.com');
      });

      const updated = getCurrent()[draft.id];
      expect(updated).toBeDefined();
      const updatedCompliance = getCompliance(updated)!;
      expect(updatedCompliance.approval).toBeDefined();
      expect(updatedCompliance.approval!.approvedBy).toBe('admin@example.com');
      expect(updatedCompliance.approval!.approvalStatus).toBe('approved');
      expect(updatedCompliance.approval!.approvedAt).toBeTruthy();
    });

    it('isAdmin が false の場合は承認されない', () => {
      const draft = makeDraft();
      const { setDrafts, getCurrent, init } = createSetDrafts();
      init({ [draft.id]: draft });

      const { result } = renderHook(() =>
        useComplianceForm({
          activeDraft: draft,
          activeDraftId: draft.id,
          isAdmin: false,
          setDrafts,
        }),
      );

      act(() => {
        result.current.performApproval('admin@example.com');
      });

      // Should remain unchanged
      expect(getCompliance(getCurrent()[draft.id])).toBeUndefined();
    });

    it('空の UPN では承認されない', () => {
      const draft = makeDraft();
      const { setDrafts, getCurrent, init } = createSetDrafts();
      init({ [draft.id]: draft });

      const { result } = renderHook(() =>
        useComplianceForm({
          activeDraft: draft,
          activeDraftId: draft.id,
          isAdmin: true,
          setDrafts,
        }),
      );

      act(() => {
        result.current.performApproval('');
      });

      // Should remain unchanged
      expect(getCompliance(getCurrent()[draft.id])).toBeUndefined();
    });
  });
});
