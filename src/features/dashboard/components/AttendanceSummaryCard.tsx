/**
 * AttendanceSummaryCard — 出欠サマリーカード（共通コンポーネント）
 *
 * SVGドーナツチャート + 健康KPIバッジで出欠割合を可視化する。
 * メインダッシュボード（施設全体）と分析ダッシュボード（IBD対象者）の
 * 両方で使用可能。
 */

import type { AttendanceSummaryData } from '@/features/analysis/hooks/useAnalysisDashboardViewModel';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import NightsStayIcon from '@mui/icons-material/NightsStay';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

export type AttendanceSummaryCardProps = {
  data: AttendanceSummaryData;
  /** カードタイトル（用途に応じて変更可能） */
  title?: string;
  /** Card で囲むかどうか（既存 Paper 内で使う場合は false） */
  withCard?: boolean;
};

const DonutContent: React.FC<{ data: AttendanceSummaryData; title: string }> = ({ data, title }) => {
  const size = 120;
  const stroke = 18;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = data.donut.reduce((s, seg) => s + seg.value, 0);

  let offset = 0;

  return (
    <>
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>
        {title}
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mt: 1, flex: 1 }}>
        {/* Donut */}
        <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e0e0e0" strokeWidth={stroke} />
            {total > 0 &&
              data.donut.map((seg) => {
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
                    style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dasharray 0.5s ease-out' }}
                  />
                );
              })}
          </svg>
          <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
            <Typography variant="h6" fontWeight={800} lineHeight={1}>
              {total}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              名
            </Typography>
          </Box>
        </Box>

        {/* Legend + KPI badges */}
        <Box sx={{ flex: 1 }}>
          <Stack spacing={0.5}>
            {data.donut.map((seg) => (
              <Box key={seg.label} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: seg.color, flexShrink: 0 }} />
                <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                  {seg.label}
                </Typography>
                <Typography variant="body2" fontWeight={700}>
                  {seg.value}名
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  ({seg.percentage}%)
                </Typography>
              </Box>
            ))}
          </Stack>

          {/* Health badges */}
          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
            {data.feverCount > 0 && (
              <Chip
                size="small"
                icon={<LocalFireDepartmentIcon sx={{ fontSize: 16 }} />}
                label={`発熱 ${data.feverCount}名`}
                color="error"
                variant="outlined"
                sx={{ fontWeight: 600 }}
              />
            )}
            {data.eveningPending > 0 && (
              <Chip
                size="small"
                icon={<NightsStayIcon sx={{ fontSize: 16 }} />}
                label={`夕方未完了 ${data.eveningPending}名`}
                color="warning"
                variant="outlined"
                sx={{ fontWeight: 600 }}
              />
            )}
            {data.feverCount === 0 && data.eveningPending === 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                ⚑ 健康アラートなし
              </Typography>
            )}
          </Stack>
        </Box>
      </Box>
    </>
  );
};

export const AttendanceSummaryCard: React.FC<AttendanceSummaryCardProps> = ({
  data,
  title = '📋 出欠・稼働サマリー',
  withCard = true,
}) => {
  if (withCard) {
    return (
      <Card
        variant="outlined"
        sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column' }}
        data-testid="attendance-summary-card"
      >
        <DonutContent data={data} title={title} />
      </Card>
    );
  }

  return (
    <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1.5 }} data-testid="attendance-summary-card">
      <DonutContent data={data} title={title} />
    </Box>
  );
};

export default AttendanceSummaryCard;
