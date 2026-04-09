/**
 * useMonitoringTabState — MonitoringTab オーケストレーション hook
 *
 * MonitoringTab.tsx から全ての hook 呼び出しとコールバック定義を集約。
 * MonitoringTab は本 hook から返される state/actions を各 Section に配るだけ。
 *
 * ## 責務マップ
 * - fieldState        → FieldCard の追記ヘルパー
 * - dashboardState    → MonitoringDailyDashboard + ISP 判断 + ドラフト保存
 * - evidenceState     → 日次記録・Iceberg PDCA エビデンス引用
 * - meetingDraftState → 会議ドラフト自動引用
 * - feedbackState     → Snackbar 状態管理
 */
import React from 'react';

import { useAuth } from '@/auth/useAuth';
import { useMonitoringDailyAnalytics } from '@/features/monitoring/hooks/useMonitoringDailyAnalytics';
import { useIspRecommendationDecisions } from '@/features/monitoring/hooks/useIspRecommendationDecisions';
import { useSupportPlanningSheet } from '@/features/monitoring/hooks/useSupportPlanningSheet';
import { useMeetingEvidenceDraft } from '@/features/monitoring/hooks/useMeetingEvidenceDraft';
import type { GoalLike } from '@/features/monitoring/domain/goalProgressTypes';
import type { SaveSupportPlanningSheetInput } from '@/features/monitoring/domain/supportPlanningSheetTypes';
import type { DraftBatch } from '@/features/monitoring/components/DraftHistoryPanel';
import type { SupportPlanStringFieldKey, ToastState } from '../types';
import type { SectionTabProps } from '../components/tabs/tabProps';

// ── 定数 ────────────────────────────────────────────────
const DEFAULT_LOOKBACK_DAYS = 60;

// ── 内部ヘルパー hook ──────────────────────────────────

/** form.goals → GoalLike[] を安定参照で返す */
function useGoalLikes(goals: { id: string; domains?: string[]; overrideCategories?: string[] }[]): GoalLike[] {
  return React.useMemo(
    () => goals.map(g => ({ id: g.id, domains: g.domains, overrideCategories: g.overrideCategories })),
    // JSON.stringify for stable comparison of deep goal array
    [JSON.stringify(goals.map(g => g.id + (g.domains?.join(',') ?? '') + (g.overrideCategories?.join(',') ?? '')))],
  );
}

/** form.goals → Record<goalId, label> */
function useGoalNames(goals: { id: string; label: string }[]): Record<string, string> {
  return React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const g of goals) {
      if (g.id && g.label) map[g.id] = g.label;
    }
    return map;
    // JSON.stringify for stable comparison of deep goal array
  }, [JSON.stringify(goals.map(g => `${g.id}:${g.label}`))]);
}

/** 集計期間（lookbackDays から算出） */
function useMonitoringPeriod(lookbackDays = DEFAULT_LOOKBACK_DAYS) {
  return React.useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - lookbackDays);
    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    };
  }, [lookbackDays]);
}

// ── Snackbar 状態 ──────────────────────────────────────

export type SnackbarState = {
  open: boolean;
  message: string;
  severity: 'success' | 'error';
};

function useSnackbar() {
  const [state, setState] = React.useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
  });

  const show = React.useCallback((message: string, severity: 'success' | 'error') => {
    setState({ open: true, message, severity });
  }, []);

  const close = React.useCallback(() => {
    setState(prev => ({ ...prev, open: false }));
  }, []);

  return { state, show, close };
}

// ── メイン hook ────────────────────────────────────────

export type UseMonitoringTabStateInput = {
  userId: string | number | null | undefined;
  /** 利用者名（会議ドラフトヘッダー用） */
  userName: string;
  form: SectionTabProps['form'];
  isAdmin: SectionTabProps['isAdmin'];
  onFieldChange: SectionTabProps['onFieldChange'];
  setToast: (toast: ToastState) => void;
};

export function useMonitoringTabState({
  userId,
  userName,
  form,
  isAdmin,
  onFieldChange,
  setToast,
}: UseMonitoringTabStateInput) {
  const { account } = useAuth();
  const userIdStr = userId ? String(userId) : '';

  // ── goals 派生データ ─────────────────────────────────
  const goalLikes = useGoalLikes(form.goals);
  const goalNames = useGoalNames(form.goals);

  // ── モニタリング集計 ─────────────────────────────────
  const { summary, insightLines, recordCount } = useMonitoringDailyAnalytics(
    userIdStr,
    DEFAULT_LOOKBACK_DAYS,
    goalLikes.length > 0 ? goalLikes : undefined,
    Object.keys(goalNames).length > 0 ? goalNames : undefined,
  );

  // ── ISP 判断記録 ─────────────────────────────────────
  const monitoringPeriod = useMonitoringPeriod(DEFAULT_LOOKBACK_DAYS);

  const {
    decisionStatuses,
    decisionNotes,
    handleDecision,
    isSaving: isDecisionSaving,
    error: decisionError,
    decisions,
  } = useIspRecommendationDecisions(
    userIdStr,
    userIdStr ? monitoringPeriod : undefined,
    summary?.ispRecommendations ?? null,
    account?.username ?? 'unknown',
  );

  // ── ISP ドラフト保存 ─────────────────────────────────
  const {
    records: savedRecords,
    saveDraft,
    isSaving: isSavingDraft,
    hasSaved: hasSavedDraft,
    error: draftError,
  } = useSupportPlanningSheet(userIdStr);

  // ── 会議ドラフト自動引用 ─────────────────────────────
  const meetingEvidence = useMeetingEvidenceDraft(userIdStr, userName);

  // ── Snackbar ─────────────────────────────────────────
  const snackbar = useSnackbar();

  // ── コールバック: ドラフト保存 ───────────────────────
  const handleSaveDraft = React.useCallback(async () => {
    if (!decisions || decisions.length === 0) {
      snackbar.show('保存する判断レコードがありません', 'error');
      return;
    }

    const inputs: SaveSupportPlanningSheetInput[] = decisions.map(d => ({
      userId: userIdStr,
      goalId: d.goalId,
      goalLabel: goalNames[d.goalId] ?? d.goalId,
      decisionStatus: d.status,
      decisionNote: d.note,
      decisionBy: d.decidedBy,
      decisionAt: d.decidedAt,
      recommendationLevel: d.snapshot?.level ?? 'pending',
      snapshot: d.snapshot ?? {
        goalId: d.goalId,
        level: 'pending',
        reason: '',
        suggestion: '',
        capturedAt: d.decidedAt,
      },
    }));

    let successCount = 0;
    for (const input of inputs) {
      const result = await saveDraft(input);
      if (result) successCount++;
    }

    if (successCount === inputs.length) {
      snackbar.show(`${successCount}件の個別支援計画下書きを保存しました`, 'success');
    } else if (draftError) {
      snackbar.show('個別支援計画下書きの保存に失敗しました', 'error');
    } else {
      snackbar.show(`${successCount}/${inputs.length}件を保存しました`, 'success');
    }
  }, [decisions, userIdStr, goalNames, saveDraft, draftError, snackbar]);

  // ── コールバック: 判断 with フィードバック ───────────
  const handleDecisionWithFeedback = React.useCallback(
    async (input: Parameters<typeof handleDecision>[0]) => {
      await handleDecision(input);
      if (!decisionError) {
        snackbar.show('判断を記録しました', 'success');
      } else {
        snackbar.show('判断の保存に失敗しました', 'error');
      }
    },
    [handleDecision, decisionError, snackbar],
  );

  // ── コールバック: monitoringPlan への追記 ────────────
  const appendToMonitoringPlan = React.useCallback(
    (text: string, duplicateMsg: string, successMsg: string) => {
      const currentVal = form.monitoringPlan || '';
      const headerLine = text.split('\n')[0];
      if (currentVal.includes(headerLine)) {
        setToast({ open: true, message: duplicateMsg, severity: 'info' });
        return;
      }
      onFieldChange('monitoringPlan', (currentVal ? currentVal + '\n\n' : '') + text);
      setToast({ open: true, message: successMsg, severity: 'success' });
    },
    [form.monitoringPlan, onFieldChange, setToast],
  );

  // ── コールバック: ドラフト → エディタ転記 ───────────
  const handleApplyToEditor = React.useCallback(
    (fieldKey: SupportPlanStringFieldKey, text: string) => {
      if (!isAdmin) return;
      const currentVal = form[fieldKey] || '';
      const newVal = currentVal
        ? `${currentVal}\n\n--- ドラフト反映 ---\n${text}`
        : text;
      onFieldChange(fieldKey, newVal);
      setToast({
        open: true,
        message: `「${fieldKey}」フィールドへ反映しました`,
        severity: 'success',
      });
    },
    [form, isAdmin, onFieldChange, setToast],
  );

  // ── コールバック: 過去バッチ再反映 ──────────────────
  const handleReapplyBatch = React.useCallback(
    (batch: DraftBatch) => {
      if (!isAdmin) return;

      const lines: string[] = [];
      for (const r of batch.records) {
        const statusLabel =
          r.decisionStatus === 'accepted' ? '採用' :
          r.decisionStatus === 'dismissed' ? '見送り' :
          r.decisionStatus === 'deferred' ? '保留' : '未判断';
        lines.push(`【${r.goalLabel}】 ${statusLabel}`);
        if (r.decisionNote) lines.push(`  判断メモ: ${r.decisionNote}`);
        if (r.snapshot.reason) lines.push(`  理由: ${r.snapshot.reason}`);
      }
      const text = lines.join('\n');

      const currentVal = form.conferenceNotes || '';
      const newVal = currentVal
        ? `${currentVal}\n\n--- 過去ドラフト反映 ---\n${text}`
        : text;
      onFieldChange('conferenceNotes', newVal);

      setToast({
        open: true,
        message: `${batch.records.length}件の判断レコードを「会議・同意の記録」へ反映しました`,
        severity: 'success',
      });
    },
    [form.conferenceNotes, isAdmin, onFieldChange, setToast],
  );

  // ── 戻り値: 3 セクション + feedback に分割 ──────────
  return {
    userIdStr,

    /** MonitoringDashboardSection 用 */
    dashboardState: {
      summary,
      insightLines,
      recordCount,
      goalNames,
      decisionStatuses,
      decisionNotes,
      decisions,
      isDecisionSaving,
      isSavingDraft,
      hasSavedDraft,
      savedRecords,
      onDecision: handleDecisionWithFeedback,
      onSaveDraft: handleSaveDraft,
      onApplyToEditor: handleApplyToEditor,
      onReapplyBatch: handleReapplyBatch,
      onAppendInsight: (text: string) =>
        appendToMonitoringPlan(
          text,
          'この期間の所見は既に引用されています。',
          '所見ドラフトを引用しました。内容を調整してください。',
        ),
    },

    /** MonitoringEvidenceSection 用 */
    evidenceState: {
      onAppendDailyEvidence: (text: string) =>
        appendToMonitoringPlan(
          text,
          'この期間のエビデンスは既に引用されています。',
          'エビデンスを引用しました。内容を調整してください。',
        ),
      onAppendIcebergEvidence: (text: string) =>
        appendToMonitoringPlan(
          text,
          'Iceberg分析結果は既に引用されています。',
          'Iceberg分析結果を引用しました。内容を調整してください。',
        ),
    },

    /** MeetingEvidenceDraftPanel 用 */
    meetingDraftState: {
      evidence: meetingEvidence,
      onAppendToField: (text: string) =>
        appendToMonitoringPlan(
          text,
          '会議ドラフトは既に引用されています。',
          '会議ドラフトを引用しました。内容を調整してください。',
        ),
    },

    /** Snackbar 制御 */
    feedbackState: snackbar,
  };
}
