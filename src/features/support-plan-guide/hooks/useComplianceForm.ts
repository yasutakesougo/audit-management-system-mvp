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
  IspComplianceMetadata,
  IspConsentDetail,
  IspDeliveryDetail,
} from '@/domain/isp/schema';
import {
  ispComplianceMetadataSchema,
} from '@/domain/isp/schema';
import type { SupportPlanDraft } from '../types';

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

export type UseComplianceFormReturn = {
  /** 現在のコンプライアンスデータ */
  compliance: ComplianceFormState;
  /** 同意詳細の部分更新 */
  updateConsent: (updates: Partial<IspConsentDetail>) => void;
  /** 交付詳細の部分更新 */
  updateDelivery: (updates: Partial<IspDeliveryDetail>) => void;
  /** 標準的提供時間の更新 */
  updateServiceHours: (hours: number | null) => void;
  /** 未入力警告の件数 */
  missingFieldCount: number;
  /** 未入力フィールド一覧 */
  missingFields: string[];
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (draft?.data as any)?.compliance;
  if (!raw) return { ...DEFAULT_COMPLIANCE };
  try {
    return ispComplianceMetadataSchema.parse(raw);
  } catch {
    return { ...DEFAULT_COMPLIANCE };
  }
}

/**
 * 監査上重要な未入力フィールドを検出する
 */
function detectMissingFields(compliance: ComplianceFormState): string[] {
  const missing: string[] = [];
  const { consent, delivery } = compliance;

  if (!consent.explainedAt) missing.push('説明実施日');
  if (!consent.consentedAt) missing.push('同意取得日');
  if (!consent.consentedBy) missing.push('同意者名');
  if (!delivery.deliveredAt) missing.push('交付日');
  if (!delivery.deliveredToUser) missing.push('本人への交付');

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
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              compliance: nextCompliance as any,
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
    () => detectMissingFields(compliance),
    [compliance],
  );

  return {
    compliance,
    updateConsent,
    updateDelivery,
    updateServiceHours,
    missingFieldCount: missingFields.length,
    missingFields,
  };
}
