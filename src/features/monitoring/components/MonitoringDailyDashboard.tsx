/**
 * @fileoverview モニタリング集計ダッシュボード
 * @description
 * DailyMonitoringSummary を受け取り、
 * - 記録状況サマリー
 * - 活動頻度
 * - 問題行動推移
 * - 昼食傾向
 * - 所見ドラフト
 * を5ブロックで表示する。
 *
 * 既存の引用セクション（MonitoringEvidenceSection）の**前段**に配置する。
 */
import AssessmentIcon from '@mui/icons-material/Assessment';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

import type { DecisionStatus, IspRecommendationDecision } from '../domain/ispRecommendationDecisionTypes';
import type { DailyMonitoringSummary } from '../domain/monitoringDailyAnalytics';
import type { SupportPlanningSheetRecord } from '../domain/supportPlanningSheetTypes';
import type { SupportPlanStringFieldKey } from '@/features/support-plan-guide/types';
import DraftHistoryPanel from './DraftHistoryPanel';
import type { DraftBatch } from './DraftHistoryPanel';
import GoalProgressCard from './GoalProgressCard';
import IspDecisionHistorySection from './IspDecisionHistorySection';
import IspDecisionSummaryCard from './IspDecisionSummaryCard';
import IspRecommendationCard from './IspRecommendationCard';
import type { DecisionInput } from './IspRecommendationCard';

import { LUNCH_LABELS, LUNCH_COLORS, TREND_ICON, TREND_LABEL } from './dashboard/constants';
import { SectionTitle } from './dashboard/SectionTitle';
import { ActivityList } from './dashboard/ActivityList';
import { BehaviorTagSection } from './dashboard/BehaviorTagSection';
import { IspPlanDraftPreviewSection } from './dashboard/IspPlanDraftPreviewSection';


// ─── メインコンポーネント ────────────────────────────────

export interface MonitoringDailyDashboardProps {
  summary: DailyMonitoringSummary | null;
  insightLines: string[];
  recordCount: number;
  onAppendInsight: (text: string) => void;
  isAdmin: boolean;
  /** goalId → 表示名のマップ（GoalProgressCard に渡す） */
  goalNames?: Record<string, string>;
  /** Phase 4-C: goalId → 判断ステータス */
  decisionStatuses?: Map<string, DecisionStatus>;
  /** Phase 4-C: goalId → 判断メモ */
  decisionNotes?: Map<string, string>;
  /** Phase 4-C: 判断操作コールバック */
  onDecision?: (input: DecisionInput) => void;
  /** Phase 4-D: 判断レコード配列（履歴表示用） */
  decisions?: IspRecommendationDecision[];
  /** Phase 5-C: ISP ドラフト保存コールバック */
  onSaveDraft?: () => void;
  /** Phase 5-C: ドラフト保存中フラグ */
  isSavingDraft?: boolean;
  /** Phase 5-C: ドラフト保存完了フラグ */
  hasSavedDraft?: boolean;
  /** Phase 5-D: ISP 計画書へのデータ転記コールバック */
  onApplyToEditor?: (fieldKey: SupportPlanStringFieldKey, text: string) => void;
  /** Phase 5-E: 保存済みドラフトレコード */
  savedRecords?: SupportPlanningSheetRecord[];
  /** Phase 5-E: 保存済みバッチを ISP 計画書へ再反映 */
  onReapplyBatch?: (batch: DraftBatch) => void;
}

const MonitoringDailyDashboard: React.FC<MonitoringDailyDashboardProps> = ({
  summary,
  insightLines,
  recordCount,
  onAppendInsight,
  isAdmin,
  goalNames,
  decisionStatuses,
  decisionNotes,
  onDecision,
  decisions,
  onSaveDraft,
  isSavingDraft,
  hasSavedDraft,
  onApplyToEditor,
  savedRecords,
  onReapplyBatch,
}) => {
  const [justAppended, setJustAppended] = React.useState(false);

  const handleAppend = React.useCallback(
    (text: string) => {
      onAppendInsight(text);
      setJustAppended(true);
      setTimeout(() => setJustAppended(false), 3000);
    },
    [onAppendInsight],
  );

  if (!summary) {
    return (
      <Box sx={{ mt: 1, mb: 2 }}>
        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover', borderStyle: 'dashed', textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            この利用者の日々の記録がまだありません。
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            日々の記録の一覧入力テーブルにデータを入力すると、ここにモニタリング集計・所見ドラフトが自動生成されます。
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 1, mb: 2 }}>
      <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover', borderStyle: 'dashed' }}>
        <Stack spacing={2}>
          {/* ヘッダー */}
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" rowGap={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <AssessmentIcon fontSize="small" color="primary" />
              <Typography variant="subtitle2" component="span" color="primary">
                日々の記録ダッシュボード
              </Typography>
            </Stack>
            <Button
              size="small"
              variant={justAppended ? 'outlined' : 'contained'}
              color={justAppended ? 'success' : 'primary'}
              startIcon={<ContentCopyRoundedIcon />}
              onClick={() => handleAppend(insightLines.join('\n'))}
              disabled={!isAdmin || insightLines.length === 0}
              data-testid="monitoring-insight-append"
            >
              {justAppended ? '所見を引用しました ✓' : '所見を評価文へ引用'}
            </Button>
          </Stack>

          {/* 対象期間 */}
          <Typography variant="caption" color="text.secondary">
            対象期間: {summary.period.from} 〜 {summary.period.to}（{recordCount}件の日々の記録から集計）
          </Typography>

          {/* 判断完了率カード（judgments がある場合のみ） */}
          {decisions && decisions.length > 0 && summary.ispRecommendations && (
            <IspDecisionSummaryCard
              recommendations={summary.ispRecommendations}
              decisions={decisions}
            />
          )}

          {/* 1. 記録状況 */}
          <Box>
            <SectionTitle>📊 記録状況</SectionTitle>
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" rowGap={0.5}>
              <Typography variant="body2">
                {summary.period.recordedDays}日 / {summary.period.totalDays}日中
              </Typography>
              <Box sx={{ flexGrow: 1, maxWidth: 200, minWidth: 100 }}>
                <LinearProgress
                  variant="determinate"
                  value={summary.period.recordRate}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
              <Typography variant="caption" color="text.secondary">
                記録率 {summary.period.recordRate}%
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              対象期間中の全日数に対する記録作成済み日数の割合です
            </Typography>
          </Box>

          <Divider />

          {/* 2. 活動頻度 */}
          <Box>
            <SectionTitle>🏃 活動頻度</SectionTitle>
            <Stack spacing={1}>
              <ActivityList label="午前" items={summary.activity.topAm} />
              <ActivityList label="午後" items={summary.activity.topPm} />
              {summary.activity.topAm.length === 0 && summary.activity.topPm.length === 0 && (
                <Typography variant="caption" color="text.secondary">
                  活動記録なし
                </Typography>
              )}
            </Stack>
          </Box>

          <Divider />

          {/* 3. 問題行動 */}
          <Box>
            <SectionTitle>
              <Stack direction="row" spacing={0.5} alignItems="center" component="span">
                <WarningAmberIcon fontSize="inherit" />
                <span>問題行動</span>
              </Stack>
            </SectionTitle>
            {summary.behavior.totalDays === 0 ? (
              <Typography variant="body2" color="success.main">
                期間中の問題行動記録なし ✓
              </Typography>
            ) : (
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2">
                    発生 {summary.behavior.totalDays}日（発生率 {summary.behavior.rate}%）
                  </Typography>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    {TREND_ICON[summary.behavior.recentChange]}
                    <Typography variant="caption" color="text.secondary">
                      {TREND_LABEL[summary.behavior.recentChange]}
                      {summary.behavior.changeRate !== 0 &&
                        ` (${summary.behavior.changeRate > 0 ? '+' : ''}${summary.behavior.changeRate}%)`}
                    </Typography>
                  </Stack>
                </Stack>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" rowGap={0.5}>
                  {summary.behavior.byType.map((b) => (
                    <Chip
                      key={b.type}
                      label={`${b.label} ${b.count}件`}
                      size="small"
                      color="warning"
                      variant="outlined"
                    />
                  ))}
                </Stack>
              </Stack>
            )}
          </Box>

          <Divider />

          {/* 3.5. 行動タグ分析 */}
          {summary.behaviorTagSummary && (
            <>
              <BehaviorTagSection tagSummary={summary.behaviorTagSummary} />
              <Divider />
            </>
          )}

          {/* 3.7. 目標進捗 */}
          {summary.goalProgress && summary.goalProgress.length > 0 && (
            <>
              <GoalProgressCard
                goalProgress={summary.goalProgress}
                goalNames={goalNames}
              />
              <Divider />
            </>
          )}

          {/* 3.9. ISP 見直し提案 */}
          {summary.ispRecommendations && summary.ispRecommendations.recommendations.length > 0 && (
            <>
              <IspRecommendationCard
                ispRecommendations={summary.ispRecommendations}
                goalNames={goalNames}
                decisionStatuses={decisionStatuses}
                decisionNotes={decisionNotes}
                onDecision={onDecision}
              />
              <Divider />
            </>
          )}

          {/* 4. 判断履歴 */}
          {decisions && decisions.length > 0 && (
            <>
              <IspDecisionHistorySection
                decisions={decisions}
                recommendations={summary.ispRecommendations}
                goalNames={goalNames}
              />
              <Divider />
            </>
          )}

          {/* 4.5. ISP 計画書ドラフトプレビュー (Phase 5-B) */}
          {summary.goalProgress && summary.goalProgress.length > 0 && (
            <IspPlanDraftPreviewSection
              summary={summary}
              insightLines={insightLines}
              decisions={decisions ?? []}
              goalNames={goalNames}
              onAppendInsight={handleAppend}
              onSaveDraft={onSaveDraft}
              isSavingDraft={isSavingDraft}
              hasSavedDraft={hasSavedDraft}
              onApplyToEditor={onApplyToEditor}
            />
          )}

          {/* 4.6. 保存済みドラフト履歴 (Phase 5-E) */}
          {savedRecords && savedRecords.length > 0 && (
            <>
              <DraftHistoryPanel
                records={savedRecords}
                onReapply={onReapplyBatch}
              />
              <Divider />
            </>
          )}

          {/* 5. 昼食傾向 */}
          <Box>
            <SectionTitle>
              <Stack direction="row" spacing={0.5} alignItems="center" component="span">
                <RestaurantIcon fontSize="inherit" />
                <span>昼食傾向</span>
              </Stack>
            </SectionTitle>
            {summary.lunch.totalWithData === 0 ? (
              <Typography variant="caption" color="text.secondary">
                この期間の昼食記録はありません
              </Typography>
            ) : (
              <Stack spacing={1}>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" rowGap={0.5}>
                  {Object.entries(summary.lunch.ratios)
                    .filter(([, r]) => (r ?? 0) > 0)
                    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
                    .map(([key, r]) => (
                      <Chip
                        key={key}
                        label={`${LUNCH_LABELS[key] ?? key} ${r}%`}
                        size="small"
                        color={LUNCH_COLORS[key] ?? 'default'}
                        variant="outlined"
                      />
                    ))}
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="caption" color="text.secondary">
                    摂食安定度
                  </Typography>
                  <Box sx={{ flexGrow: 1, maxWidth: 120 }}>
                    <LinearProgress
                      variant="determinate"
                      value={summary.lunch.stableScore}
                      color={summary.lunch.stableScore >= 70 ? 'success' : summary.lunch.stableScore >= 40 ? 'warning' : 'error'}
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {summary.lunch.stableScore}%
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  昼食量の一貫性を示します（完食率が高いほどスコアが高くなります）
                </Typography>
              </Stack>
            )}
          </Box>

          {/* 5. 所見ドラフト */}
          {insightLines.length > 0 && (
            <>
              <Divider />
              <Box>
                <SectionTitle>📝 所見ドラフト</SectionTitle>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  日々の記録から自動生成された下書きです。「所見を評価文へ引用」ボタンでモニタリング評価文に転記できます。
                  内容は必要に応じて加筆・修正してください。
                </Typography>
                <Box
                  sx={{
                    bgcolor: 'background.paper',
                    borderRadius: 1,
                    p: 1.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    whiteSpace: 'pre-wrap',
                    fontSize: '0.8rem',
                    lineHeight: 1.6,
                  }}
                >
                  {insightLines.join('\n')}
                </Box>
              </Box>
            </>
          )}
        </Stack>
      </Paper>
    </Box>
  );
};



export default React.memo(MonitoringDailyDashboard);
