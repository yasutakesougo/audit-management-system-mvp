/**
 * MonitoringTab — モニタリングタブ
 *
 * SectionKey: 'monitoring'
 *
 * 他のセクションタブと異なり、MonitoringEvidenceSection を条件付きで描画する。
 * Phase 1: MonitoringDailyDashboard を前段に配置し、客観指標を可視化する。
 * Phase 4-C4: ISP 判断記録のフルスタック接続。
 *   - form.goals → goalNames / GoalLike
 *   - useIspRecommendationDecisions → decisionStatuses / onDecision
 *   - MonitoringDailyDashboard へ透過
 */
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import BubbleChartIcon from '@mui/icons-material/BubbleChart';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/auth/useAuth';
import { buildIcebergPdcaUrl } from '@/app/links/navigationLinks';

import { buildIcebergEvidence } from '@/features/ibd/analysis/pdca/icebergEvidenceAdapter';
import { useIcebergPdcaList } from '@/features/ibd/analysis/pdca/queries';
import { buildMonitoringEvidence } from '@/features/ibd/plans/support-plan/monitoringEvidenceAdapter';
import MonitoringDailyDashboard from '@/features/monitoring/components/MonitoringDailyDashboard';
import type { DraftBatch } from '@/features/monitoring/components/DraftHistoryPanel';
import { useMonitoringDailyAnalytics } from '@/features/monitoring/hooks/useMonitoringDailyAnalytics';
import { useIspRecommendationDecisions } from '@/features/monitoring/hooks/useIspRecommendationDecisions';
import { useSupportPlanningSheet } from '@/features/monitoring/hooks/useSupportPlanningSheet';
import type { GoalLike } from '@/features/monitoring/domain/goalProgressTypes';
import type { SaveSupportPlanningSheetInput } from '@/features/monitoring/domain/supportPlanningSheetTypes';
import type { SupportPlanStringFieldKey } from '../../types';
import type { MonitoringEvidenceSectionProps, ToastState } from '../../types';
import { findSection, minusDaysYmd, todayYmd } from '../../utils/helpers';
import FieldCard from './FieldCard';
import type { SectionTabProps } from './tabProps';

export type MonitoringTabProps = SectionTabProps & {
  /** アクティブドラフトのuserId（エビデンス取得用） */
  userId: string | number | null | undefined;
  /** トースト表示用 */
  setToast: (toast: ToastState) => void;
};

// ─── ヘルパー ───────────────────────────────────────────

const DEFAULT_LOOKBACK_DAYS = 60;

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

// ─── サブコンポーネント ──────────────────────────────────

/** エビデンスセクション（内部コンポーネント） */
const MonitoringEvidenceSection: React.FC<MonitoringEvidenceSectionProps> = ({ userId, onAppend, isAdmin }) => {
  const range = React.useMemo(() => {
    const to = todayYmd();
    return { from: minusDaysYmd(to, 60), to }; // 過去60日
  }, []);

  const evidence = React.useMemo(() => {
    return buildMonitoringEvidence({ userId, range });
  }, [userId, range]);

  if (evidence.count === 0) return null;

  return (
    <Box sx={{ mt: 1, mb: 2 }}>
      <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover', borderStyle: 'dashed' }}>
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1} alignItems="center">
              <AutoStoriesIcon fontSize="small" color="primary" />
              <Typography variant="subtitle2" component="span" color="primary">
                日次記録エビデンス（過去60日: {evidence.count}件）
              </Typography>
            </Stack>
            <Button
              size="small"
              variant="contained"
              color="primary"
              startIcon={<ContentCopyRoundedIcon />}
              onClick={() => onAppend(evidence.text)}
              disabled={!isAdmin}
            >
              評価文へ引用
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            一覧入力テーブルから自動集計された実績です。モニタリング評価文の根拠として引用できます。
          </Typography>
          <Box sx={{ maxHeight: 200, overflowY: 'auto', bgcolor: 'background.paper', borderRadius: 1, p: 1, border: '1px solid', borderColor: 'divider' }}>
            <List dense disablePadding>
              {evidence.bullets.map((b: string, i: number) => (
                <ListItem key={i} disableGutters sx={{ py: 0.25 }}>
                  <ListItemText
                    primary={b}
                    primaryTypographyProps={{ variant: 'caption', sx: { display: 'block', lineHeight: 1.4 } }}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
};

/** Iceberg PDCA 分析結果の引用セクション */
const IcebergEvidenceSection: React.FC<{
  userId: string;
  onAppend: (text: string) => void;
  isAdmin: boolean;
}> = ({ userId, onAppend, isAdmin }) => {
  const { data: pdcaItems = [] } = useIcebergPdcaList({ userId });

  const evidence = React.useMemo(
    () => buildIcebergEvidence({ userId, items: pdcaItems }),
    [userId, pdcaItems],
  );

  if (evidence.totalCount === 0) return null;

  return (
    <Box sx={{ mt: 1, mb: 2 }}>
      <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover', borderStyle: 'dashed' }}>
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1} alignItems="center">
              <BubbleChartIcon fontSize="small" color="secondary" />
              <Typography variant="subtitle2" component="span" color="secondary">
                Iceberg PDCA 分析結果 ({evidence.actCount}件の改善 / 全{evidence.totalCount}件)
              </Typography>
            </Stack>
            <Button
              size="small"
              variant="contained"
              color="secondary"
              startIcon={<ContentCopyRoundedIcon />}
              onClick={() => onAppend(evidence.text)}
              disabled={!isAdmin}
              data-testid="iceberg-evidence-append"
            >
              評価文へ引用
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            ※ Iceberg PDCA で記録された行動分析・改善内容です。ACT フェーズの改善が優先表示されます。
          </Typography>
          <Box sx={{ maxHeight: 200, overflowY: 'auto', bgcolor: 'background.paper', borderRadius: 1, p: 1, border: '1px solid', borderColor: 'divider' }}>
            <List dense disablePadding>
              {evidence.bullets.map((b: string, i: number) => (
                <ListItem key={i} disableGutters sx={{ py: 0.25 }}>
                  <ListItemText
                    primary={b}
                    primaryTypographyProps={{ variant: 'caption', sx: { display: 'block', lineHeight: 1.4 } }}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
};

// ─── メインコンポーネント ────────────────────────────────

const MonitoringTab: React.FC<MonitoringTabProps> = ({ userId, setToast, ...sectionProps }) => {
  const navigate = useNavigate();
  const section = findSection('monitoring');
  const { account } = useAuth();

  const userIdStr = userId ? String(userId) : '';

  // ── Phase 3+4: goals から派生データを構築 ─────────────
  const goalLikes = useGoalLikes(sectionProps.form.goals);
  const goalNames = useGoalNames(sectionProps.form.goals);

  // ── モニタリング集計（目標進捗 + ISP 提案含む） ─────────
  const { summary, insightLines, recordCount } = useMonitoringDailyAnalytics(
    userIdStr,
    DEFAULT_LOOKBACK_DAYS,
    goalLikes.length > 0 ? goalLikes : undefined,
    Object.keys(goalNames).length > 0 ? goalNames : undefined,
  );

  // ── Phase 4-C4: ISP 判断記録 ──────────────────────────
  const monitoringPeriod = useMonitoringPeriod(DEFAULT_LOOKBACK_DAYS);

  const {
    decisionStatuses,
    decisionNotes,
    handleDecision,
    isSaving,
    error: decisionError,
    decisions,
  } = useIspRecommendationDecisions(
    userIdStr,
    userIdStr ? monitoringPeriod : undefined,
    summary?.ispRecommendations ?? null,
    account?.username ?? 'unknown',
  );

  // ── Phase 5-C: ISP ドラフト保存 ─────────────────────────
  const {
    records: savedRecords,
    saveDraft,
    isSaving: isSavingDraft,
    hasSaved: hasSavedDraft,
    error: draftError,
  } = useSupportPlanningSheet(userIdStr);

  const handleSaveDraft = React.useCallback(async () => {
    if (!decisions || decisions.length === 0) {
      setSnackMsg('保存する判断レコードがありません');
      setSnackSeverity('error');
      setSnackOpen(true);
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
      setSnackMsg(`${successCount}件のISP下書きを保存しました`);
      setSnackSeverity('success');
    } else if (draftError) {
      setSnackMsg('ISP下書きの保存に失敗しました');
      setSnackSeverity('error');
    } else {
      setSnackMsg(`${successCount}/${inputs.length}件を保存しました`);
      setSnackSeverity('success');
    }
    setSnackOpen(true);
  }, [decisions, userIdStr, goalNames, saveDraft, draftError]);

  // ── saving / error フィードバック ──────────────────────
  const [snackOpen, setSnackOpen] = React.useState(false);
  const [snackMsg, setSnackMsg] = React.useState('');
  const [snackSeverity, setSnackSeverity] = React.useState<'success' | 'error'>('success');

  const handleDecisionWithFeedback = React.useCallback(
    async (input: Parameters<typeof handleDecision>[0]) => {
      await handleDecision(input);
      if (!decisionError) {
        setSnackMsg('判断を記録しました');
        setSnackSeverity('success');
      } else {
        setSnackMsg('判断の保存に失敗しました');
        setSnackSeverity('error');
      }
      setSnackOpen(true);
    },
    [handleDecision, decisionError],
  );

  /** monitoringPlan フィールドへの追記共通ヘルパー */
  const appendToMonitoringPlan = React.useCallback(
    (text: string, duplicateMsg: string, successMsg: string) => {
      const currentVal = sectionProps.form.monitoringPlan || '';
      const headerLine = text.split('\n')[0];
      if (currentVal.includes(headerLine)) {
        setToast({ open: true, message: duplicateMsg, severity: 'info' });
        return;
      }
      sectionProps.onFieldChange('monitoringPlan', (currentVal ? currentVal + '\n\n' : '') + text);
      setToast({ open: true, message: successMsg, severity: 'success' });
    },
    [sectionProps, setToast],
  );

  /** Phase 5-D: ドラフトセクションを ISP エディタのフィールドへ転記 */
  const handleApplyToEditor = React.useCallback(
    (fieldKey: SupportPlanStringFieldKey, text: string) => {
      if (!sectionProps.isAdmin) return;
      const currentVal = sectionProps.form[fieldKey] || '';
      // 既に同じ内容がある場合は上書き確認代わりに置換する
      const newVal = currentVal
        ? `${currentVal}\n\n--- ドラフト反映 ---\n${text}`
        : text;
      sectionProps.onFieldChange(fieldKey, newVal);
      setToast({
        open: true,
        message: `「${fieldKey}」フィールドへ反映しました`,
        severity: 'success',
      });
    },
    [sectionProps, setToast],
  );

  /** Phase 5-E: 過去バッチの判断内容を ISP エディタへ再反映 */
  const handleReapplyBatch = React.useCallback(
    (batch: DraftBatch) => {
      if (!sectionProps.isAdmin) return;

      // バッチ内の全レコードをまとめて conferenceNotes フィールドへ反映
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

      const currentVal = sectionProps.form.conferenceNotes || '';
      const newVal = currentVal
        ? `${currentVal}\n\n--- 過去ドラフト反映 ---\n${text}`
        : text;
      sectionProps.onFieldChange('conferenceNotes', newVal);

      setToast({
        open: true,
        message: `${batch.records.length}件の判断レコードを「会議・同意の記録」へ反映しました`,
        severity: 'success',
      });
    },
    [sectionProps, setToast],
  );

  if (!section) return null;

  return (
    <Stack spacing={2}>
      {section.description ? (
        <Typography variant="subtitle1" component="span" sx={{ color: 'text.secondary' }}>
          {section.description}
        </Typography>
      ) : null}

      {/* Phase 1+4: 集計ダッシュボード + ISP 判断記録 */}
      {userIdStr && (
        <MonitoringDailyDashboard
          summary={summary}
          insightLines={insightLines}
          recordCount={recordCount}
          isAdmin={sectionProps.isAdmin}
          goalNames={goalNames}
          decisionStatuses={decisionStatuses}
          decisionNotes={decisionNotes}
          onDecision={handleDecisionWithFeedback}
          decisions={decisions}
          onAppendInsight={(text) =>
            appendToMonitoringPlan(
              text,
              'この期間の所見は既に引用されています。',
              '所見ドラフトを引用しました。内容を調整してください。',
            )
          }
          onSaveDraft={handleSaveDraft}
          isSavingDraft={isSavingDraft}
          hasSavedDraft={hasSavedDraft}
          onApplyToEditor={handleApplyToEditor}
          savedRecords={savedRecords}
          onReapplyBatch={handleReapplyBatch}
        />
      )}

      {/* Phase 4-C4: 保存中インジケーター */}
      {isSaving && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ pl: 1 }}>
          <CircularProgress size={14} />
          <Typography variant="caption" color="text.secondary">
            判断を保存中…
          </Typography>
        </Stack>
      )}

      {/* 既存: 日次記録エビデンス（生データ引用） */}
      {userId && (
        <MonitoringEvidenceSection
          userId={String(userId)}
          isAdmin={sectionProps.isAdmin}
          onAppend={(text) =>
            appendToMonitoringPlan(
              text,
              'この期間のエビデンスは既に引用されています。',
              'エビデンスを引用しました。内容を調整してください。',
            )
          }
        />
      )}

      {/* 既存: Iceberg PDCA 引用 */}
      {userId && (
        <IcebergEvidenceSection
          userId={String(userId)}
          isAdmin={sectionProps.isAdmin}
          onAppend={(text) =>
            appendToMonitoringPlan(
              text,
              'Iceberg分析結果は既に引用されています。',
              'Iceberg分析結果を引用しました。内容を調整してください。',
            )
          }
        />
      )}

      {userId && (
        <Box sx={{ mt: 1 }}>
          <Button
            variant="outlined"
            color="secondary"
            size="small"
            startIcon={<BubbleChartIcon />}
            onClick={() => navigate(buildIcebergPdcaUrl(String(userId), { source: 'monitoring' }))}
            data-testid="monitoring-reanalysis-link"
          >
            再分析する
          </Button>
        </Box>
      )}

      <Stack spacing={2}>
        {section.fields.map((field) => (
          <FieldCard key={field.key} field={field} {...sectionProps} />
        ))}
      </Stack>

      {/* Phase 4-C4: フィードバック Snackbar */}
      <Snackbar
        open={snackOpen}
        autoHideDuration={3000}
        onClose={() => setSnackOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackSeverity}
          variant="filled"
          onClose={() => setSnackOpen(false)}
          sx={{ width: '100%' }}
        >
          {snackMsg}
        </Alert>
      </Snackbar>
    </Stack>
  );
};

export default React.memo(MonitoringTab);
