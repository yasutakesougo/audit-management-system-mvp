/**
 * useComplianceForm — ISP コンプライアンスメタデータの状態管理フック
 *
 * A-2: ISP 同意・交付 UI のための専用フック。
 * SupportPlanForm の外部で compliance データを管理し、
 * 保存時にドラフトに合流させる。
 *
 * 設計判断:
 *   - SupportPlanForm (string[] ベース) とは独立した structured data として管理
 *   - ドラフトの `data` 内に `compliance` プロパティとして保存
 *   - 既存の auto-save 機構と連動するため setDrafts 経由で更新
 */
import React from 'react';

import type {
  IspApproval,
  IspComplianceMetadata,
  IspConsentDetail,
  IspDeliveryDetail,
  IspMeetingDetail,
  IspConsultationSupport,
} from '@/domain/isp/schema';
import {
  ispComplianceMetadataSchema,
} from '@/domain/isp/schema';
import type { SupportPlanDraft, SupportPlanForm } from '../types';

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

export type ComplianceFormState = IspComplianceMetadata;

export type UseComplianceFormParams = {
  /** 現在のアクティブドラフト */
  activeDraft: SupportPlanDraft | undefined;
  /** アクティブドラフトID */
  activeDraftId: string;
  /** 管理者権限フラグ */
  isAdmin: boolean;
  /** ドラフト一覧のセッター（auto-save連動） */
  setDrafts: React.Dispatch<React.SetStateAction<Record<string, SupportPlanDraft>>>;
};

/** 承認状態の派生情報 */
export type ApprovalState = {
  /** 承認済みか */
  isApproved: boolean;
  /** 承認者 UPN */
  approvedBy: string | null;
  /** 承認日時 (ISO 8601) */
  approvedAt: string | null;
  /** 承認ステータス */
  approvalStatus: IspApproval['approvalStatus'];
};

export type UseComplianceFormReturn = {
  /** 現在のコンプライアンスデータ */
  compliance: ComplianceFormState;
  /** 同意詳細の部分更新 */
  updateConsent: (updates: Partial<IspConsentDetail>) => void;
  /** 交付詳細の部分更新 */
  updateDelivery: (updates: Partial<IspDeliveryDetail>) => void;
  /** 会議詳細の部分更新 */
  updateMeeting: (updates: Partial<IspMeetingDetail>) => void;
  /** 相談支援詳細の部分更新 */
  updateConsultation: (updates: Partial<IspConsultationSupport>) => void;
  /** 標準的提供時間の更新 */
  updateServiceHours: (hours: number | null) => void;
  /** 未入力警告の件数 */
  missingFieldCount: number;
  /** 未入力フィールド一覧 */
  missingFields: string[];
  /** 承認状態 */
  approvalState: ApprovalState;
  /** 承認を実行する（管理者のみ） */
  performApproval: (approverUpn: string) => void;
};

// ────────────────────────────────────────────
// Default
// ────────────────────────────────────────────

const DEFAULT_COMPLIANCE = ispComplianceMetadataSchema.parse({});

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

/**
 * ドラフトからコンプライアンスデータを取得する。
 * 未設定の場合はデフォルト値を返す。
 */
function extractCompliance(draft: SupportPlanDraft | undefined): ComplianceFormState {
  const raw = draft?.data?.compliance;
  if (!raw) return { ...DEFAULT_COMPLIANCE };
  try {
    return ispComplianceMetadataSchema.parse(raw);
  } catch {
    return { ...DEFAULT_COMPLIANCE };
  }
}

/**
 * 監査上重要な未入力フィールドや不整合を検出する
 */
function detectMissingFields(compliance: ComplianceFormState, formData?: Partial<SupportPlanForm>): string[] {
  const missing: string[] = [];
  const { consent, delivery, meeting, consultationSupport, standardServiceHours } = compliance;

  // 同意・交付（最重要）
  if (!consent.explainedAt) missing.push('説明実施日');
  if (!consent.consentedAt) missing.push('同意取得日');
  if (!consent.consentedBy) missing.push('同意者名');
  if (!delivery.deliveredAt) missing.push('交付日');
  if (!delivery.deliveredToUser) missing.push('本人への交付');

  // 代理同意時の理由（監査指摘対策）
  if ((consent.proxyName || consent.proxyRelation) && !consent.proxyReason) {
    missing.push('代理同意の理由');
  }

  // 会議・連携（制度要件）
  if (!meeting.meetingDate) missing.push('会議実施日');
  if (!consultationSupport.agencyName) missing.push('相談支援事業所名');
  if (!consultationSupport.officerName) missing.push('相談支援専門員名');
  if (!consultationSupport.serviceUsePlanReceivedAt) {
    missing.push('相談支援からのサービス等利用計画の受領日');
  }

  // 提供時間
  if (standardServiceHours === null) missing.push('標準的な支援提供時間');

  // B-1項目: サービス開始日と初回提供日の不整合チェック
  if (formData?.serviceStartDate && formData?.firstServiceDate) {
    // 文字列のまま比較可能（YYYY-MM-DD形式想定）
    if (formData.serviceStartDate > formData.firstServiceDate) {
      missing.push('⚠️ 契約開始日より前に初回提供日が設定されています');
    }
  }

  return missing;
}

// ────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────

export function useComplianceForm({
  activeDraft,
  activeDraftId,
  isAdmin,
  setDrafts,
}: UseComplianceFormParams): UseComplianceFormReturn {
  // ── Derive current compliance from active draft ──
  const compliance = React.useMemo(
    () => extractCompliance(activeDraft),
    [activeDraft],
  );

  // ── Generic updater that merges into draft.data.compliance ──
  const updateCompliance = React.useCallback(
    (updater: (prev: ComplianceFormState) => ComplianceFormState) => {
      if (!isAdmin || !activeDraftId) return;

      setDrafts((prev) => {
        const draft = prev[activeDraftId];
        if (!draft) return prev;

        const currentCompliance = extractCompliance(draft);
        const nextCompliance = updater(currentCompliance);

        return {
          ...prev,
          [activeDraftId]: {
            ...draft,
            updatedAt: new Date().toISOString(),
            data: {
              ...draft.data,
              compliance: nextCompliance,
            },
          },
        };
      });
    },
    [activeDraftId, isAdmin, setDrafts],
  );

  // ── Consent updater ──
  const updateConsent = React.useCallback(
    (updates: Partial<IspConsentDetail>) => {
      updateCompliance((prev) => ({
        ...prev,
        consent: { ...prev.consent, ...updates },
      }));
    },
    [updateCompliance],
  );

  // ── Delivery updater ──
  const updateDelivery = React.useCallback(
    (updates: Partial<IspDeliveryDetail>) => {
      updateCompliance((prev) => ({
        ...prev,
        delivery: { ...prev.delivery, ...updates },
      }));
    },
    [updateCompliance],
  );

  // ── Meeting updater ──
  const updateMeeting = React.useCallback(
    (updates: Partial<IspMeetingDetail>) => {
      updateCompliance((prev) => ({
        ...prev,
        meeting: { ...prev.meeting, ...updates },
      }));
    },
    [updateCompliance],
  );

  // ── Consultation updater ──
  const updateConsultation = React.useCallback(
    (updates: Partial<IspConsultationSupport>) => {
      updateCompliance((prev) => ({
        ...prev,
        consultationSupport: { ...prev.consultationSupport, ...updates },
      }));
    },
    [updateCompliance],
  );

  // ── Service hours updater ──
  const updateServiceHours = React.useCallback(
    (hours: number | null) => {
      updateCompliance((prev) => ({
        ...prev,
        standardServiceHours: hours,
      }));
    },
    [updateCompliance],
  );

  // ── Missing fields ──
  const missingFields = React.useMemo(
    () => detectMissingFields(compliance, activeDraft?.data),
    [compliance, activeDraft?.data],
  );

  // ── Approval state ──
  const approvalState: ApprovalState = React.useMemo(() => {
    const approval = compliance.approval;
    return {
      isApproved: approval?.approvalStatus === 'approved',
      approvedBy: approval?.approvedBy ?? null,
      approvedAt: approval?.approvedAt ?? null,
      approvalStatus: approval?.approvalStatus ?? 'draft',
    };
  }, [compliance.approval]);

  // ── Perform approval ──
  const performApproval = React.useCallback(
    (approverUpn: string) => {
      if (!isAdmin || !approverUpn) return;

      updateCompliance((prev) => ({
        ...prev,
        approval: {
          approvedBy: approverUpn,
          approvedAt: new Date().toISOString(),
          approvalStatus: 'approved' as const,
        },
      }));
    },
    [isAdmin, updateCompliance],
  );

  return {
    compliance,
    updateConsent,
    updateDelivery,
    updateMeeting,
    updateConsultation,
    updateServiceHours,
    missingFieldCount: missingFields.length,
    missingFields,
    approvalState,
    performApproval,
  };
}
