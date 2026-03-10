import { motionTokens } from '@/app/theme';
import type {
    DonutSegment,
    HeatmapCell,
    KpiCard,
    RecentEvent,
} from '@/features/analysis/hooks/useAnalysisDashboardViewModel';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React from 'react';

const HOUR_LABELS = ['0', '3', '6', '9', '12', '15', '18', '21'];

/** KPI Stat Card */
export const KpiStatCard: React.FC<{ kpi: KpiCard }> = ({ kpi }) => {
  const TrendIcon =
    kpi.trend === 'up' ? TrendingUpIcon : kpi.trend === 'down' ? TrendingDownIcon : TrendingFlatIcon;

  return (
    <Card
      variant="outlined"
      sx={{
        p: 2.5,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
        borderLeft: `4px solid ${kpi.color}`,
        transition: `box-shadow ${motionTokens.duration.normal} ${motionTokens.easing.standard}`,
        '&:hover': { boxShadow: 3 },
      }}
    >
      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ letterSpacing: 0.5 }}>
        {kpi.label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mt: 1 }}>
        <Typography variant="h4" fontWeight={800} sx={{ color: kpi.color, lineHeight: 1 }}>
          {kpi.value}
        </Typography>
        {kpi.unit && (
          <Typography variant="body2" color="text.secondary" fontWeight={500}>
            {kpi.unit}
          </Typography>
        )}
      </Box>
      {kpi.trend && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
          <TrendIcon sx={{ fontSize: 16, color: kpi.trend === 'up' ? '#d32f2f' : kpi.trend === 'down' ? '#5B8C5A' : '#9E9E9E' }} />
          <Typography variant="caption" color="text.secondary">
            {kpi.trend === 'up' ? '増加傾向' : kpi.trend === 'down' ? '減少傾向' : '横ばい'}
          </Typography>
        </Box>
      )}
    </Card>
  );
};

/** Pure CSS Horizontal Bar Chart */
export const CssBarChart: React.FC<{ data: { label: string; value: number; color: string }[] }> = ({ data }) => {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <Card variant="outlined" sx={{ p: 2.5, height: '100%' }}>
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>
        日別発生件数
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
        {data.slice(-10).map((d) => (
          <Box key={d.label} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{ minWidth: 40, textAlign: 'right', color: 'text.secondary' }}>
              {d.label}
            </Typography>
            <Box sx={{ flex: 1, position: 'relative', height: 18, bgcolor: 'action.hover', borderRadius: 1, overflow: 'hidden' }}>
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  height: '100%',
                  width: `${(d.value / max) * 100}%`,
                  bgcolor: d.color,
                  borderRadius: 1,
                  transition: motionTokens.transition.progressBar,
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  position: 'absolute',
                  right: 4,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontWeight: 700,
                  fontSize: '0.65rem',
                  color: d.value / max > 0.5 ? '#fff' : 'text.primary',
                }}
              >
                {d.value}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Card>
  );
};

/** SVG Donut Chart */
export const SvgDonutChart: React.FC<{ segments: DonutSegment[] }> = ({ segments }) => {
  const size = 140;
  const stroke = 22;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((s, seg) => s + seg.value, 0);

  let offset = 0;

  return (
    <Card variant="outlined" sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Typography variant="subtitle2" fontWeight={700} gutterBottom sx={{ alignSelf: 'flex-start' }}>
        実施ステータス
      </Typography>
      <Box sx={{ position: 'relative', width: size, height: size, my: 1 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Background ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e0e0e0"
            strokeWidth={stroke}
          />
          {/* Data segments */}
          {total > 0 &&
            segments.map((seg) => {
              const dashLen = (seg.value / total) * circumference;
              const dashOffset = -offset;
              offset += dashLen;
              return (
                <circle
                  key={seg.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={stroke}
                  strokeDasharray={`${dashLen} ${circumference - dashLen}`}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="butt"
                  style={{
                    transform: 'rotate(-90deg)',
                    transformOrigin: '50% 50%',
                    transition: motionTokens.transition.chartStroke,
                  }}
                />
              );
            })}
        </svg>
        {/* Center label */}
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
          }}
        >
          <Typography variant="h6" fontWeight={800} lineHeight={1}>
            {total}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            件
          </Typography>
        </Box>
      </Box>
      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center', mt: 1 }}>
        {segments.map((seg) => (
          <Box key={seg.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: seg.color }} />
            <Typography variant="caption" color="text.secondary">
              {seg.label} {seg.percentage}%
            </Typography>
          </Box>
        ))}
      </Box>
    </Card>
  );
};

/** CSS Heatmap (24 hours) */
export const CssHeatmap: React.FC<{ cells: HeatmapCell[] }> = ({ cells }) => (
  <Card variant="outlined" sx={{ p: 2.5, height: '100%' }}>
    <Typography variant="subtitle2" fontWeight={700} gutterBottom>
      時間帯別発生ヒートマップ
    </Typography>
    <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
      {cells.map((cell) => (
        <Tooltip key={cell.hour} title={`${cell.hour}時台: ${cell.count}件`} arrow>
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: 0.5,
              bgcolor: `rgba(237, 108, 2, ${Math.max(cell.intensity, 0.06)})`,
              border: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'default',
              transition: motionTokens.transition.bgColorSlow,
            }}
          >
            <Typography variant="caption" sx={{ fontSize: '0.6rem', color: cell.intensity > 0.5 ? '#fff' : 'text.secondary' }}>
              {cell.count > 0 ? cell.count : ''}
            </Typography>
          </Box>
        </Tooltip>
      ))}
    </Box>
    {/* Hour axis labels */}
    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5, px: 0.5 }}>
      {HOUR_LABELS.map((label) => (
        <Typography key={label} variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
          {label}時
        </Typography>
      ))}
    </Box>
  </Card>
);

/** Recent Events Timeline */
export const EventTimeline: React.FC<{ events: RecentEvent[] }> = ({ events }) => (
  <Card variant="outlined" sx={{ p: 2.5, height: '100%', overflow: 'auto' }}>
    <Typography variant="subtitle2" fontWeight={700} gutterBottom>
      最近の行動記録
    </Typography>
    {events.length === 0 ? (
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
        データがありません
      </Typography>
    ) : (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
        {events.map((ev) => (
          <Box
            key={ev.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              px: 1.5,
              py: 1,
              bgcolor: 'action.hover',
              borderRadius: 1,
              borderLeft: `3px solid ${ev.intensity >= 4 ? '#d32f2f' : ev.intensity >= 2 ? '#FF9800' : '#5B8C5A'}`,
            }}
          >
            {/* Intensity badge */}
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                bgcolor: ev.intensity >= 4 ? '#d32f2f' : ev.intensity >= 2 ? '#FF9800' : '#5B8C5A',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '0.75rem',
                flexShrink: 0,
              }}
            >
              {ev.intensity}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" fontWeight={600} noWrap>
                {ev.behavior}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {ev.time}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    )}
  </Card>
);
