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
  DailyMonitoringSummary,
} from '../domain/monitoringDailyAnalytics';

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
      <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
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

// ─── メインコンポーネント ────────────────────────────────

export interface MonitoringDailyDashboardProps {
  summary: DailyMonitoringSummary | null;
  insightLines: string[];
  recordCount: number;
  onAppendInsight: (text: string) => void;
  isAdmin: boolean;
}

const MonitoringDailyDashboard: React.FC<MonitoringDailyDashboardProps> = ({
  summary,
  insightLines,
  recordCount: _recordCount,
  onAppendInsight,
  isAdmin,
}) => {
  if (!summary) {
    return (
      <Box sx={{ mt: 1, mb: 2 }}>
        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover', borderStyle: 'dashed', textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            日次記録がありません。一覧入力テーブルにデータを入力すると、モニタリング集計が表示されます。
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
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1} alignItems="center">
              <AssessmentIcon fontSize="small" color="primary" />
              <Typography variant="subtitle2" component="span" color="primary">
                モニタリング集計 ({summary.period.from} 〜 {summary.period.to})
              </Typography>
            </Stack>
            <Button
              size="small"
              variant="contained"
              color="primary"
              startIcon={<ContentCopyRoundedIcon />}
              onClick={() => onAppendInsight(insightLines.join('\n'))}
              disabled={!isAdmin || insightLines.length === 0}
              data-testid="monitoring-insight-append"
            >
              所見を引用
            </Button>
          </Stack>

          {/* 1. 記録状況 */}
          <Box>
            <SectionTitle>📊 記録状況</SectionTitle>
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography variant="body2">
                {summary.period.recordedDays}日 / {summary.period.totalDays}日中
              </Typography>
              <Box sx={{ flexGrow: 1, maxWidth: 200 }}>
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
                <Stack direction="row" spacing={0.5} flexWrap="wrap">
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
                昼食記録なし
              </Typography>
            ) : (
              <Stack spacing={1}>
                <Stack direction="row" spacing={0.5} flexWrap="wrap">
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
                    安定度
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
              </Stack>
            )}
          </Box>

          {/* 5. 所見ドラフト */}
          {insightLines.length > 0 && (
            <>
              <Divider />
              <Box>
                <SectionTitle>📝 所見ドラフト（自動生成）</SectionTitle>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  ※ 下記は日次記録データから自動生成された下書きです。内容を確認・修正のうえご活用ください。
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
