/**
 * SceneChangeAlertCard — ABC場面変化アラート表示カード
 *
 * compareAbcPatternPeriods() の結果を表示し、
 * 支援計画 §5（予防的支援）への改善提案を提供する。
 *
 * 6層モデル: 第1層（観測） → 第2層（解釈） → 第4層（計画）
 */
import React from 'react';

import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import NewReleasesRoundedIcon from '@mui/icons-material/NewReleasesRounded';

import type { AbcPatternComparison, SceneChangeAlert } from '../compareAbcPatternPeriods';

// ────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────

interface Props {
  /** パターン比較結果 */
  comparison: AbcPatternComparison;
  /** ABC記録ページへの遷移 */
  onNavigateToAbcRecords?: () => void;
  /** 閉じる */
  onDismiss?: () => void;
}

// ────────────────────────────────────────────────────────────
// Sub: 個別アラート行
// ────────────────────────────────────────────────────────────

const SEVERITY_MAP = {
  alert: { color: 'error' as const, icon: '🔴' },
  warning: { color: 'warning' as const, icon: '🟠' },
  info: { color: 'info' as const, icon: '🟢' },
};

const AlertRow: React.FC<{ alert: SceneChangeAlert }> = ({ alert }) => {
  const sev = SEVERITY_MAP[alert.severity];
  return (
    <Stack spacing={0.5} sx={{ py: 0.5 }}>
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Typography variant="caption">{sev.icon}</Typography>
        <Typography variant="body2" fontWeight={500}>
          {alert.message}
        </Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ pl: 2.5 }}>
        → {alert.suggestion}
      </Typography>
    </Stack>
  );
};

// ────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────

export const SceneChangeAlertCard: React.FC<Props> = ({
  comparison,
  onNavigateToAbcRecords,
  onDismiss,
}) => {
  const [expanded, setExpanded] = React.useState(false);

  // 変化なしの場合は何も表示しない
  if (comparison.overallChangeLevel === 'none' || comparison.alerts.length === 0) {
    return null;
  }

  const severity = comparison.overallChangeLevel === 'significant'
    ? 'error'
    : comparison.overallChangeLevel === 'moderate'
      ? 'warning'
      : 'info';

  const changeLabel = comparison.overallChangeLevel === 'significant'
    ? '顕著な変化'
    : comparison.overallChangeLevel === 'moderate'
      ? '変化あり'
      : '軽微な変化';

  return (
    <Alert
      severity={severity as 'error' | 'warning' | 'info'}
      variant="outlined"
      icon={<NewReleasesRoundedIcon />}
      onClose={onDismiss}
      sx={{ '& .MuiAlert-message': { width: '100%' } }}
    >
      <AlertTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="subtitle2" fontWeight={700}>
            ABC記録のパターン変化
          </Typography>
          <Chip
            size="small"
            label={changeLabel}
            color={severity as 'error' | 'warning' | 'info'}
            variant="outlined"
            sx={{ height: 20 }}
          />
          <Chip
            size="small"
            label={`前期${comparison.previousCount}件 → 今期${comparison.currentCount}件`}
            variant="outlined"
            sx={{ height: 20, '& .MuiChip-label': { fontSize: '0.7rem' } }}
          />
        </Stack>
      </AlertTitle>

      {/* ── サマリー ── */}
      <Stack direction="row" spacing={2} sx={{ mt: 0.5, mb: 1 }}>
        {comparison.newSettings.length > 0 && (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <NewReleasesRoundedIcon fontSize="inherit" color="warning" />
            <Typography variant="caption">新出: {comparison.newSettings.length}場面</Typography>
          </Stack>
        )}
        {comparison.significantIncreases.length > 0 && (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <TrendingUpRoundedIcon fontSize="inherit" color="error" />
            <Typography variant="caption">急増: {comparison.significantIncreases.length}場面</Typography>
          </Stack>
        )}
        {comparison.disappearedSettings.length > 0 && (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <TrendingDownRoundedIcon fontSize="inherit" color="success" />
            <Typography variant="caption">消失: {comparison.disappearedSettings.length}場面</Typography>
          </Stack>
        )}
        {comparison.intensityShift.worsening && (
          <Chip
            size="small"
            label="強度悪化"
            color="error"
            variant="filled"
            sx={{ height: 18, '& .MuiChip-label': { px: 0.5, fontSize: '0.65rem' } }}
          />
        )}
      </Stack>

      {/* ── アラート詳細 ── */}
      <Button
        size="small"
        onClick={() => setExpanded(!expanded)}
        sx={{ textTransform: 'none', mb: 0.5 }}
      >
        {expanded ? '詳細を閉じる' : `${comparison.alerts.length}件のアラートを表示`}
      </Button>

      <Collapse in={expanded}>
        <Stack spacing={0.5} sx={{ mt: 0.5 }}>
          <Divider />
          {comparison.alerts.map((alert, i) => (
            <AlertRow key={i} alert={alert} />
          ))}
        </Stack>
      </Collapse>

      {/* ── フッター ── */}
      {onNavigateToAbcRecords && (
        <Button
          size="small"
          variant="text"
          onClick={onNavigateToAbcRecords}
          sx={{ mt: 1, textTransform: 'none' }}
        >
          ABC記録で詳細を確認 →
        </Button>
      )}
    </Alert>
  );
};
