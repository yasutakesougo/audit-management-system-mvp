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
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
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

import type {
  ActivityRank,
  BehaviorTagSummary,
  DailyMonitoringSummary,
} from '../domain/monitoringDailyAnalytics';
import GoalProgressCard from './GoalProgressCard';

// ─── 定数 ────────────────────────────────────────────────

const LUNCH_LABELS: Record<string, string> = {
  full: '完食',
  '80': '8割',
  half: '半分',
  small: '少量',
  none: 'なし',
};

const LUNCH_COLORS: Record<string, 'success' | 'warning' | 'error' | 'default' | 'info'> = {
  full: 'success',
  '80': 'success',
  half: 'warning',
  small: 'error',
  none: 'error',
};

const TREND_ICON: Record<string, React.ReactNode> = {
  up: <TrendingUpIcon fontSize="small" color="error" />,
  down: <TrendingDownIcon fontSize="small" color="success" />,
  flat: <TrendingFlatIcon fontSize="small" color="action" />,
};

const TREND_LABEL: Record<string, string> = {
  up: '増加傾向',
  down: '減少傾向',
  flat: '横ばい',
};

const TAG_CATEGORY_COLORS: Record<string, 'primary' | 'secondary' | 'success' | 'info'> = {
  behavior: 'secondary',
  communication: 'info',
  dailyLiving: 'primary',
  positive: 'success',
};

// ─── サブコンポーネント ──────────────────────────────────

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5 }}>
    {children}
  </Typography>
);

const ActivityList: React.FC<{ label: string; items: ActivityRank[] }> = ({ label, items }) => {
  if (items.length === 0) return null;
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
      <Stack direction="row" spacing={0.5} flexWrap="wrap" rowGap={0.5} sx={{ mt: 0.5 }}>
        {items.map((a) => (
          <Chip
            key={a.label}
            label={`${a.label} (${a.count}回)`}
            size="small"
            variant="outlined"
          />
        ))}
      </Stack>
    </Box>
  );
};

const BehaviorTagSection: React.FC<{ tagSummary: BehaviorTagSummary }> = ({ tagSummary }) => {
  const TrendIcon =
    tagSummary.usageTrend === 'up'
      ? TrendingUpIcon
      : tagSummary.usageTrend === 'down'
        ? TrendingDownIcon
        : TrendingFlatIcon;

  return (
    <Box>
      <SectionTitle>
        <LocalOfferIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'text-bottom' }} />
        行動タグ分析
      </SectionTitle>

      {/* Top タグ */}
      <Stack direction="row" spacing={0.5} flexWrap="wrap" rowGap={0.5} sx={{ mt: 0.5 }}>
        {tagSummary.topTags.map((t) => (
          <Chip
            key={t.key}
            label={`${t.label} (${t.count}回)`}
            size="small"
            color={TAG_CATEGORY_COLORS[t.category ?? ''] ?? 'default'}
            variant="outlined"
            sx={{ maxWidth: 200 }}
          />
        ))}
      </Stack>

      {/* 付与率 */}
      <Box sx={{ mt: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 80 }}>
            タグ付与率
          </Typography>
          <LinearProgress
            variant="determinate"
            value={tagSummary.tagUsageRate}
            sx={{ flex: 1 }}
          />
          <Typography variant="caption" sx={{ fontWeight: 600, minWidth: 45 }}>
            {tagSummary.tagUsageRate}%
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.3, display: 'block' }}>
          {tagSummary.taggedRecords}件の記録にタグ付与あり（全{tagSummary.totalRecords}件中）、平均{tagSummary.avgTagsPerRecord}タグ/日
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.65rem' }}>
          ※ 日次記録で行動タグがどれだけ活用されているかの指標です
        </Typography>
      </Box>

      {/* カテゴリ分布 */}
      {tagSummary.categoryDistribution.length > 0 && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
            カテゴリ別分布
          </Typography>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" rowGap={0.5} sx={{ mt: 0.3 }}>
            {tagSummary.categoryDistribution.map((c) => (
              <Chip
                key={c.category}
                label={`${c.label} ${c.percentage}%`}
                size="small"
                color={TAG_CATEGORY_COLORS[c.category] ?? 'default'}
                variant="filled"
                sx={{ fontSize: '0.7rem', maxWidth: 180 }}
              />
            ))}
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.3, display: 'block', fontSize: '0.65rem' }}>
            ※ 全タグ付与数に対する各カテゴリの割合
          </Typography>
        </Box>
      )}

      {/* トレンド */}
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.5 }}>
        <TrendIcon fontSize="small" color={tagSummary.usageTrend === 'up' ? 'success' : 'inherit'} />
        <Typography variant="caption" color="text.secondary">
          {TREND_LABEL[tagSummary.usageTrend] || '横ばい'}
          {tagSummary.usageTrendRate !== 0 && ` (${tagSummary.usageTrendRate > 0 ? '+' : ''}${tagSummary.usageTrendRate}%)`}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem', ml: 0.5 }}>
          ※ 前半/後半比較
        </Typography>
      </Stack>
    </Box>
  );
};

// ─── メインコンポーネント ────────────────────────────────

export interface MonitoringDailyDashboardProps {
  summary: DailyMonitoringSummary | null;
  insightLines: string[];
  recordCount: number;
  onAppendInsight: (text: string) => void;
  isAdmin: boolean;
  /** goalId → 表示名のマップ（GoalProgressCard に渡す） */
  goalNames?: Record<string, string>;
}

const MonitoringDailyDashboard: React.FC<MonitoringDailyDashboardProps> = ({
  summary,
  insightLines,
  recordCount,
  onAppendInsight,
  isAdmin,
  goalNames,
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
            この利用者の日次記録がまだありません。
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            日次記録の一覧入力テーブルにデータを入力すると、ここにモニタリング集計・所見ドラフトが自動生成されます。
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
                日次記録ダッシュボード
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
            対象期間: {summary.period.from} 〜 {summary.period.to}（{recordCount}件の日次記録から集計）
          </Typography>

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
              対象期間中の全日数に対する記録入力済み日数の割合です
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

          {/* 4. 昼食傾向 */}
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
                  日次記録から自動生成された下書きです。「所見を評価文へ引用」ボタンでモニタリング評価文に転記できます。
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
