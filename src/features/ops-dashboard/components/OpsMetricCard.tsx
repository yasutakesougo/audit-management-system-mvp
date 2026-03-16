/**
 * @fileoverview OpsMetricCard — Ops Dashboard 用の汎用 KPI カード
 * @description
 * 主指標 1 つ + 補助指標 N 個 + 色ステータスに対応する
 * 再利用可能な KPI カードコンポーネント。
 *
 * 設計方針:
 * - MUI で統一
 * - 色は success / warning / error の 3 段階
 * - 主指標は大きく、補助指標は caption で
 */
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

// ─── 型定義 ──────────────────────────────────────────────

export type MetricStatus = 'good' | 'warning' | 'critical';

/** 補助指標 */
export interface SubMetric {
  label: string;
  value: string | number;
}

export interface OpsMetricCardProps {
  /** カードタイトル */
  title: string;
  /** アイコン（MUI Icon element） */
  icon: React.ReactElement;
  /** 主指標の値（大きく表示） */
  primaryValue: string | number;
  /** 主指標の単位 */
  primaryUnit?: string;
  /** 主指標の説明ラベル */
  primaryLabel?: string;
  /** 色ステータス */
  status: MetricStatus;
  /** 補助指標（最大 3 つ推奨） */
  subMetrics?: SubMetric[];
  /** children で追加コンテンツ */
  children?: React.ReactNode;
}

// ─── ステータス色 ────────────────────────────────────────

const STATUS_COLORS: Record<MetricStatus, string> = {
  good: '#10b981',     // emerald-500
  warning: '#f59e0b',  // amber-500
  critical: '#ef4444', // red-500
};

const STATUS_BG: Record<MetricStatus, string> = {
  good: 'rgba(16, 185, 129, 0.08)',
  warning: 'rgba(245, 158, 11, 0.08)',
  critical: 'rgba(239, 68, 68, 0.08)',
};

// ─── コンポーネント ──────────────────────────────────────

const OpsMetricCard: React.FC<OpsMetricCardProps> = ({
  title,
  icon,
  primaryValue,
  primaryUnit,
  primaryLabel,
  status,
  subMetrics,
  children,
}) => {
  const accentColor = STATUS_COLORS[status];

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: STATUS_BG[status],
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          width: 4,
          height: '100%',
          bgcolor: accentColor,
          borderRadius: '4px 0 0 4px',
        },
      }}
    >
      {/* ヘッダー: アイコン + タイトル */}
      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1.5 }}>
        <Box sx={{ color: accentColor, display: 'flex', alignItems: 'center' }}>
          {React.cloneElement(icon, { sx: { fontSize: 20, ...((icon.props as Record<string, unknown>).sx || {}) } })}
        </Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
          {title}
        </Typography>
      </Stack>

      {/* 主指標 */}
      <Box sx={{ mb: 1 }}>
        <Stack direction="row" alignItems="baseline" spacing={0.5}>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              color: accentColor,
              lineHeight: 1,
            }}
          >
            {primaryValue}
          </Typography>
          {primaryUnit && (
            <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
              {primaryUnit}
            </Typography>
          )}
        </Stack>
        {primaryLabel && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, display: 'block' }}>
            {primaryLabel}
          </Typography>
        )}
      </Box>

      {/* 補助指標 */}
      {subMetrics && subMetrics.length > 0 && (
        <Stack spacing={0.25} sx={{ mt: 1 }}>
          {subMetrics.map((sm) => (
            <Stack key={sm.label} direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="caption" color="text.secondary">
                {sm.label}
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                {sm.value}
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}

      {/* 追加コンテンツ */}
      {children}
    </Paper>
  );
};

export default React.memo(OpsMetricCard);
