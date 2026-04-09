/**
 * AdoptionMetricsPanel — 提案採用率 metrics の表示パネル
 *
 * Issue #11: Adoption Metrics
 *
 * ExcellenceTab 内に配置し、操作済み提案の採用率 / 却下率 /
 * ISP 候補反映率 / ルール別採用率を表示する。
 *
 * accept + dismiss = 0 のときは非表示（ノイズ削減）。
 *
 * @see src/features/daily/domain/adoptionMetrics.ts — 集計 pure function
 * @see src/features/support-plan-guide/hooks/useAdoptionMetrics.ts — データ取得
 */

import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { useState } from 'react';

import type { RuleMetrics } from '@/features/daily/domain/legacy/adoptionMetrics';
import { useAdoptionMetrics } from '../../hooks/useAdoptionMetrics';

// ─── Props ───────────────────────────────────────────────

export type AdoptionMetricsPanelProps = {
  /** 対象利用者 ID */
  userId: string;
  /** improvementIdeas テキスト（ISP反映率算出用） */
  improvementIdeas?: string;
};

// ─── 色判定 ──────────────────────────────────────────────

type HealthLevel = 'success' | 'warning' | 'error';

function getHealthLevel(acceptRate: number): HealthLevel {
  if (acceptRate >= 70) return 'success';
  if (acceptRate >= 30) return 'warning';
  return 'error';
}

function getHealthEmoji(level: HealthLevel): string {
  if (level === 'success') return '🟢';
  if (level === 'warning') return '🟡';
  return '🔴';
}

// ─── Component ───────────────────────────────────────────

const AdoptionMetricsPanel: React.FC<AdoptionMetricsPanelProps> = ({
  userId,
  improvementIdeas = '',
}) => {
  const { metrics, isLoading, error } = useAdoptionMetrics(userId, improvementIdeas);
  const [ruleExpanded, setRuleExpanded] = useState(false);

  // Loading
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
        <CircularProgress size={16} />
        <Typography variant="caption" color="text.secondary">
          採用状況を取得中…
        </Typography>
      </Box>
    );
  }

  // Error
  if (error) {
    return (
      <Typography variant="caption" color="error" sx={{ py: 0.5 }}>
        採用状況の取得に失敗しました: {error}
      </Typography>
    );
  }

  // データなし or 操作なし → 非表示
  if (!metrics || metrics.actionedCount === 0) return null;

  const health = getHealthLevel(metrics.acceptRate);
  const emoji = getHealthEmoji(health);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        bgcolor: 'background.default',
        borderColor: 'divider',
      }}
      data-testid="adoption-metrics-panel"
    >
      <Stack spacing={1.5}>
        {/* ヘッダー */}
        <Stack direction="row" spacing={1} alignItems="center">
          <BarChartRoundedIcon fontSize="small" color="action" />
          <Typography variant="subtitle2" component="span" color="text.secondary">
            📊 提案採用状況（直近30日・操作済みベース）
          </Typography>
        </Stack>

        {/* サマリー行 */}
        <Stack direction="row" spacing={2} flexWrap="wrap" alignItems="center">
          <MetricChip label="採用" count={metrics.acceptCount} color="success" />
          <MetricChip label="却下" count={metrics.dismissCount} color="default" />
          <MetricChip label="個別支援計画反映" count={metrics.ispImportCount} color="primary" />
        </Stack>

        {/* 採用率バー */}
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              採用率（操作済みベース）
            </Typography>
            <Typography variant="caption" fontWeight={700}>
              {emoji} {metrics.acceptRate}%
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={metrics.acceptRate}
            color={health}
            sx={{ height: 6, borderRadius: 3 }}
          />
        </Box>

        {/* 個別支援計画反映率バー */}
        {metrics.acceptCount > 0 && (
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                個別支援計画候補反映率
              </Typography>
              <Typography variant="caption" fontWeight={700}>
                {metrics.ispImportRate}%
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={metrics.ispImportRate}
              color="primary"
              sx={{ height: 6, borderRadius: 3 }}
            />
          </Box>
        )}

        {/* ルール別展開 */}
        {metrics.byRule.length > 0 && (
          <>
            <Stack
              direction="row"
              alignItems="center"
              sx={{ cursor: 'pointer' }}
              onClick={() => setRuleExpanded(prev => !prev)}
            >
              <IconButton size="small" data-testid="rule-expand-toggle">
                {ruleExpanded ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
              </IconButton>
              <Typography variant="caption" color="text.secondary">
                ルール別採用率 ({metrics.byRule.length}ルール)
              </Typography>
            </Stack>

            <Collapse in={ruleExpanded}>
              <Stack spacing={0.75} sx={{ pl: 1 }}>
                {metrics.byRule.map(rule => (
                  <RuleRow key={rule.rulePrefix} rule={rule} />
                ))}
              </Stack>
            </Collapse>
          </>
        )}
      </Stack>
    </Paper>
  );
};

export default React.memo(AdoptionMetricsPanel);

// ─── サブコンポーネント ─────────────────────────────────

type MetricChipProps = {
  label: string;
  count: number;
  color: 'success' | 'default' | 'primary';
};

const MetricChip: React.FC<MetricChipProps> = ({ label, count, color }) => (
  <Chip
    label={`${label} ${count}件`}
    size="small"
    color={color}
    variant="outlined"
    sx={{
      fontSize: '0.7rem',
      height: 24,
      '& .MuiChip-label': { px: 1 },
    }}
  />
);

type RuleRowProps = {
  rule: RuleMetrics;
};

const RuleRow: React.FC<RuleRowProps> = ({ rule }) => {
  const total = rule.acceptCount + rule.dismissCount;
  const isLowAccept = rule.acceptRate < 30 && total >= 3;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.25 }}>
        <Typography variant="caption" color="text.secondary">
          {isLowAccept ? '⚠️ ' : ''}{rule.label}
        </Typography>
        <Typography variant="caption" fontWeight={600}>
          {rule.acceptRate}% ({rule.acceptCount}/{total})
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={rule.acceptRate}
        color={rule.acceptRate >= 50 ? 'success' : 'warning'}
        sx={{ height: 4, borderRadius: 2 }}
      />
    </Box>
  );
};
