/**
 * 申し送りAI分析ダッシュボード
 *
 * Phase 1 の3本の Pure Function を統合し、
 * 朝会・夕会・管理者確認で使える分析画面を提供する。
 *
 * データフロー:
 *   HandoffRecord[] → useMemo × 3
 *     → extractKeywords    → KeywordCloudCard
 *     → computeUserTrends  → UserTrendCard
 *     → computeTimePatterns → TimePatternHeatmap
 *
 * 子コンポーネントでは再計算しない。
 */

import AnalyticsIcon from '@mui/icons-material/Analytics';
import AssessmentIcon from '@mui/icons-material/Assessment';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useMemo, useState } from 'react';
import type { HandoffRecord } from '../../handoffTypes';
import { computeTimePatterns } from '../computeTimePatterns';
import { computeUserTrends } from '../computeUserTrends';
import { extractKeywords } from '../extractKeywords';
import KeywordCloudCard from './KeywordCloudCard';
import TimePatternHeatmap from './TimePatternHeatmap';
import UserTrendCard from './UserTrendCard';

// ── 期間オプション ──

type PeriodOption = 7 | 14 | 30;

const PERIOD_OPTIONS: { value: PeriodOption; label: string }[] = [
  { value: 7, label: '7日' },
  { value: 14, label: '14日' },
  { value: 30, label: '30日' },
];

// ── Props ──

export interface HandoffAnalysisDashboardProps {
  /** 分析対象の申し送りレコード（全件） */
  records: HandoffRecord[];
  /** ダッシュボードのタイトル */
  title?: string;
}

/**
 * 申し送り分析ダッシュボード
 *
 * @example
 * ```tsx
 * <HandoffAnalysisDashboard records={allHandoffs} />
 * ```
 */
export default function HandoffAnalysisDashboard({
  records,
  title = '申し送り分析ダッシュボード',
}: HandoffAnalysisDashboardProps) {
  const [period, setPeriod] = useState<PeriodOption>(14);

  // ── 期間フィルタ ──
  const filteredRecords = useMemo(() => {
    if (records.length === 0) return [];
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - period);
    const cutoffIso = cutoff.toISOString();
    return records.filter((r) => r.createdAt >= cutoffIso);
  }, [records, period]);

  // ── 分析計算（子コンポーネントでは再計算しない） ──
  const keywords = useMemo(() => extractKeywords(filteredRecords), [filteredRecords]);
  const userTrends = useMemo(() => computeUserTrends(filteredRecords), [filteredRecords]);
  const timePatterns = useMemo(() => computeTimePatterns(filteredRecords), [filteredRecords]);

  // ── サマリー値 ──
  const summary = useMemo(() => {
    const total = filteredRecords.length;
    const critical = filteredRecords.filter(
      (r) => r.severity === '重要' && r.status !== '対応済' && r.status !== '完了',
    ).length;
    const topCategory = keywords.hits.length > 0 ? keywords.hits[0] : null;
    const trendingUsers = userTrends.filter((t) => t.recentTrend === 'increasing').length;

    return { total, critical, topCategory, trendingUsers };
  }, [filteredRecords, keywords, userTrends]);

  return (
    <Box>
      {/* ── ヘッダー ── */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 3 }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <AnalyticsIcon color="primary" sx={{ fontSize: 28 }} />
          <Typography variant="h6" fontWeight={700}>
            {title}
          </Typography>
        </Stack>

        <ToggleButtonGroup
          value={period}
          exclusive
          onChange={(_, v) => v && setPeriod(v)}
          size="small"
        >
          {PERIOD_OPTIONS.map(({ value, label }) => (
            <ToggleButton key={value} value={value} sx={{ px: 2 }}>
              {label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      {/* ── サマリーカード ── */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3}>
            {/* 総件数 */}
            <Grid size={{ xs: 6, sm: 3 }}>
              <Stack alignItems="center">
                <Typography variant="caption" color="text.secondary">対象件数</Typography>
                <Typography variant="h4" fontWeight={700}>{summary.total}</Typography>
                <Typography variant="caption" color="text.secondary">直近{period}日</Typography>
              </Stack>
            </Grid>

            {/* 要対応 */}
            <Grid size={{ xs: 6, sm: 3 }}>
              <Stack alignItems="center">
                <Typography variant="caption" color="text.secondary">要対応（重要）</Typography>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  {summary.critical > 0 && <WarningAmberIcon color="error" sx={{ fontSize: 20 }} />}
                  <Typography
                    variant="h4"
                    fontWeight={700}
                    color={summary.critical > 0 ? 'error.main' : 'success.main'}
                  >
                    {summary.critical}
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {summary.critical > 0 ? '未対応あり' : 'なし'}
                </Typography>
              </Stack>
            </Grid>

            {/* 最頻キーワード */}
            <Grid size={{ xs: 6, sm: 3 }}>
              <Stack alignItems="center">
                <Typography variant="caption" color="text.secondary">最頻キーワード</Typography>
                {summary.topCategory ? (
                  <>
                    <Typography variant="h5" fontWeight={700} sx={{ mt: 0.5 }}>
                      {summary.topCategory.keyword}
                    </Typography>
                    <Chip
                      label={`${summary.topCategory.count}件`}
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ mt: 0.5 }}
                    />
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>—</Typography>
                )}
              </Stack>
            </Grid>

            {/* 増加傾向の利用者 */}
            <Grid size={{ xs: 6, sm: 3 }}>
              <Stack alignItems="center">
                <Typography variant="caption" color="text.secondary">増加傾向の利用者</Typography>
                <Typography
                  variant="h4"
                  fontWeight={700}
                  color={summary.trendingUsers > 0 ? 'warning.main' : 'text.primary'}
                >
                  {summary.trendingUsers}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {summary.trendingUsers > 0 ? '名 — 注目' : '名'}
                </Typography>
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* ── 分析カード ── */}
      <Grid container spacing={3}>
        {/* キーワード + ユーザー: 左右2カラム */}
        <Grid size={{ xs: 12, md: 6 }}>
          <KeywordCloudCard data={keywords} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <UserTrendCard trends={userTrends} />
        </Grid>

        {/* 時間パターン: 全幅 */}
        <Grid size={12}>
          <TimePatternHeatmap data={timePatterns} />
        </Grid>
      </Grid>

      {/* ── フッター ── */}
      <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <AssessmentIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
          <Typography variant="caption" color="text.disabled">
            分析対象: {filteredRecords.length}件 / 全{records.length}件
          </Typography>
        </Stack>
      </Stack>
    </Box>
  );
}
