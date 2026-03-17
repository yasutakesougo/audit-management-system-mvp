/**
 * PlannerTrendSparkline — 週次トレンドを描画するミニ SVG チャート (P5-C2)
 *
 * 描画専用コンポーネント。ドメインロジックなし。
 * PlannerTrendSeries を受け取り、2段構成のスパークラインを表示する:
 *
 *  1. 上段: 採用率 (acceptance rate) の折れ線
 *  2. 下段: 判断件数 (decision count) のバーチャート
 *
 * データがない場合（isEmpty=true）は何も描画しない。
 */

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { PlannerTrendSeries } from '../../domain/plannerInsights';

// ────────────────────────────────────────────
// 定数
// ────────────────────────────────────────────

/** チャートの描画エリアサイズ */
const CHART_WIDTH = 200;
const LINE_HEIGHT = 48;
const BAR_HEIGHT = 32;
const PADDING = 4;

/** 色 */
const LINE_COLOR = '#2196F3'; // MUI blue[500]
const LINE_DOT_COLOR = '#1976D2'; // MUI blue[700]
const BAR_COLOR = '#90CAF9'; // MUI blue[200]
const GRID_COLOR = '#E0E0E0';
const LABEL_COLOR = '#757575';

// ────────────────────────────────────────────
// Props
// ────────────────────────────────────────────

type PlannerTrendSparklineProps = {
  series: PlannerTrendSeries;
};

// ────────────────────────────────────────────
// コンポーネント
// ────────────────────────────────────────────

export const PlannerTrendSparkline: React.FC<PlannerTrendSparklineProps> = ({ series }) => {
  if (series.isEmpty) return null;

  const { points } = series;
  const n = points.length;
  if (n === 0) return null;

  // ── 座標計算: 折れ線 (acceptanceRate 0-1) ──
  const stepX = (CHART_WIDTH - PADDING * 2) / Math.max(n - 1, 1);
  const linePoints: { x: number; y: number }[] = [];

  for (let i = 0; i < n; i++) {
    const pt = points[i];
    if (pt.acceptanceRate !== undefined) {
      const x = PADDING + i * stepX;
      const y = LINE_HEIGHT - PADDING - pt.acceptanceRate * (LINE_HEIGHT - PADDING * 2);
      linePoints.push({ x, y });
    }
  }

  // ── 座標計算: バーチャート (decisionCount) ──
  const maxCount = Math.max(...points.map((p) => p.decisionCount), 1);
  const barWidth = Math.max(stepX * 0.6, 4);

  return (
    <Box
      sx={{
        mt: 1,
        px: 1,
        py: 0.5,
        borderRadius: 1,
        bgcolor: 'rgba(33, 150, 243, 0.04)',
      }}
    >
      <Typography
        variant="caption"
        sx={{ color: LABEL_COLOR, fontWeight: 500, display: 'block', mb: 0.5 }}
      >
        週次トレンド（{n}週間）
      </Typography>

      {/* 上段: 採用率折れ線 */}
      <svg
        width={CHART_WIDTH}
        height={LINE_HEIGHT}
        viewBox={`0 0 ${CHART_WIDTH} ${LINE_HEIGHT}`}
        role="img"
        aria-label="週次採用率トレンド"
      >
        {/* 50% ガイドライン */}
        <line
          x1={PADDING}
          y1={LINE_HEIGHT / 2}
          x2={CHART_WIDTH - PADDING}
          y2={LINE_HEIGHT / 2}
          stroke={GRID_COLOR}
          strokeDasharray="3 3"
          strokeWidth={0.5}
        />
        {/* 折れ線 */}
        {linePoints.length >= 2 && (
          <polyline
            fill="none"
            stroke={LINE_COLOR}
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={linePoints.map((p) => `${p.x},${p.y}`).join(' ')}
          />
        )}
        {/* ドット */}
        {linePoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={LINE_DOT_COLOR} />
        ))}
      </svg>

      <Typography variant="caption" sx={{ color: LABEL_COLOR, fontSize: '0.65rem' }}>
        採用率
      </Typography>

      {/* 下段: 判断件数バー */}
      <svg
        width={CHART_WIDTH}
        height={BAR_HEIGHT}
        viewBox={`0 0 ${CHART_WIDTH} ${BAR_HEIGHT}`}
        role="img"
        aria-label="週次判断件数"
        style={{ marginTop: 2 }}
      >
        {points.map((pt, i) => {
          const barH = (pt.decisionCount / maxCount) * (BAR_HEIGHT - PADDING * 2);
          const x = PADDING + i * stepX - barWidth / 2;
          const y = BAR_HEIGHT - PADDING - barH;

          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(barH, 1)}
              rx={1}
              fill={BAR_COLOR}
            />
          );
        })}
      </svg>

      <Typography variant="caption" sx={{ color: LABEL_COLOR, fontSize: '0.65rem' }}>
        判断件数
      </Typography>

      {/* 週ラベル */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          mt: 0.25,
          px: `${PADDING}px`,
        }}
      >
        {points.length > 0 && (
          <>
            <Typography variant="caption" sx={{ color: LABEL_COLOR, fontSize: '0.6rem' }}>
              {points[0].weekLabel}
            </Typography>
            <Typography variant="caption" sx={{ color: LABEL_COLOR, fontSize: '0.6rem' }}>
              {points[points.length - 1].weekLabel}
            </Typography>
          </>
        )}
      </Box>
    </Box>
  );
};
