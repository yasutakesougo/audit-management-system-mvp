/**
 * useRegulatorySummary — 制度サマリー帯のためのデータ解決 hook
 *
 * SupportPlanGuidePage の既存データ（SupportPlanDraft）から
 * RegulatorySummaryBand が必要とする SupportPlanBundle 相当の情報を
 * 組み立てる。
 *
 * 現段階では ISP Repository への直結はせず、
 * draft のフォームデータから推定可能な情報を提供する。
 * 将来 ISP Repository が結合されたら、ここを差し替えるだけで済む。
 */
import { useMemo } from 'react';
import type { SupportPlanBundle, IndividualSupportPlan, IspStatus } from '@/domain/isp/schema';
import type { SupportPlanDraft, SupportPlanForm } from '@/features/support-plan-guide/types';

/** ISP ステータスをフォームデータから推定する */
function deriveIspStatus(form: SupportPlanForm): IspStatus {
  const requiredFields = [
    form.serviceUserName,
    form.supportLevel,
    form.assessmentSummary,
    form.decisionSupport,
    form.monitoringPlan,
  ];
  const filled = requiredFields.filter((v) => v.trim().length > 0).length;

  if (filled === 0) return 'assessment';
  if (filled < requiredFields.length) return 'assessment';
  return 'active';
}

/** 次回見直し日を reviewTiming から抽出する */
function deriveNextReviewAt(form: SupportPlanForm): string | null {
  const match = form.reviewTiming.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
  if (match) return match[1].replace(/\//g, '-');
  return null;
}

export type RegulatorySummaryData = {
  bundle: SupportPlanBundle;
  userId: string | null;
  isAvailable: boolean;
};

/**
 * SupportPlanDraft → IndividualSupportPlan スタブを組み立てる。
 *
 * ISP スキーマのフル型に合わせたダミー値で埋める。
 * 将来 ISP Repository 統合時にここを差し替えるだけで済む。
 */
function buildIspStub(draft: SupportPlanDraft, form: SupportPlanForm): IndividualSupportPlan {
  const now = new Date().toISOString().slice(0, 10);
  return {
    id: draft.id,
    userId: draft.userId != null ? String(draft.userId) : '',
    title: form.serviceUserName || '支援計画',

    planStartDate: now,
    planEndDate: form.planPeriod || now,

    userIntent: '',
    familyIntent: '',
    overallSupportPolicy: form.decisionSupport || '',
    qolIssues: '',

    longTermGoals: [],
    shortTermGoals: [],

    supportSummary: '',
    precautions: '',

    consentAt: null,
    deliveredAt: null,

    monitoringSummary: '',
    lastMonitoringAt: form.lastMonitoringDate || null,
    nextReviewAt: deriveNextReviewAt(form),

    status: deriveIspStatus(form),
    isCurrent: true,

    // AuditTrail fields
    createdBy: 'system',
    createdAt: draft.createdAt || now,
    updatedBy: 'system',
    updatedAt: draft.updatedAt || now,
    version: 1,
  };
}

const EMPTY_ISP_STUB: IndividualSupportPlan = {
  id: '',
  userId: '',
  title: '',
  planStartDate: '2026-01-01',
  planEndDate: '2026-01-01',
  userIntent: '',
  familyIntent: '',
  overallSupportPolicy: '',
  qolIssues: '',
  longTermGoals: [],
  shortTermGoals: [],
  supportSummary: '',
  precautions: '',
  consentAt: null,
  deliveredAt: null,
  monitoringSummary: '',
  lastMonitoringAt: null,
  nextReviewAt: null,
  status: 'assessment',
  isCurrent: true,
  createdBy: '',
  createdAt: '2026-01-01',
  updatedBy: '',
  updatedAt: '2026-01-01',
  version: 1,
};

/**
 * @param activeDraft - 現在選択中のドラフト（フォールバック用）
 * @param realBundle - 本番 Repository から取得した SupportPlanBundle（優先）
 */
export function useRegulatorySummary(
  activeDraft: SupportPlanDraft | undefined,
  realBundle?: SupportPlanBundle | null,
): RegulatorySummaryData {
  return useMemo(() => {
    // ── 本番データがあればそれを優先 ──
    if (realBundle) {
      const userId = realBundle.isp.userId || null;
      return {
        bundle: realBundle,
        userId,
        isAvailable: true,
      };
    }

    // ── フォールバック: SupportPlanDraft から推定 ──
    if (!activeDraft) {
      return {
        bundle: {
          isp: EMPTY_ISP_STUB,
          planningSheets: [],
          recentProcedureRecords: [],
          icebergCountBySheet: {},
          latestMonitoring: null,
          procedureRecordCountBySheet: {},
          planningSheetCount: 0,
          lastProcedureRecordDate: null,
        },
        userId: null,
        isAvailable: false,
      };
    }

    const form = activeDraft.data;
    const userId = activeDraft.userId != null ? String(activeDraft.userId) : null;
    const ispStub = buildIspStub(activeDraft, form);

    const bundle: SupportPlanBundle = {
      isp: ispStub,
      planningSheets: [],
      recentProcedureRecords: [],
      icebergCountBySheet: {},
      latestMonitoring: form.lastMonitoringDate
        ? { date: form.lastMonitoringDate, planChangeRequired: false }
        : null,
      procedureRecordCountBySheet: {},
      planningSheetCount: 0,
      lastProcedureRecordDate: null,
    };

    return {
      bundle,
      userId,
      isAvailable: true,
    };
  }, [activeDraft, realBundle]);
}
