import type { DailyBehaviorStat } from '@/features/analysis/hooks/useBehaviorAnalytics';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import React from 'react';
import {
    Bar,
    CartesianGrid,
    ComposedChart,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

const behaviorLegendItems = [
  { label: '発生回数', color: '#5B8C5A', shape: 'bar' as const },
  { label: '平均強度', color: '#FF9800', shape: 'line' as const },
];

export type BehaviorTrendChartProps = {
  data: DailyBehaviorStat[];
  title?: string;
};

export const BehaviorTrendChart: React.FC<BehaviorTrendChartProps> = ({ data, title = '行動発生推移' }) => {
  if (!data?.length) {
    return (
      <Card variant="outlined" sx={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography color="text.secondary">表示できるデータがありません</Typography>
      </Card>
    );
  }

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" fontWeight="bold" gutterBottom>
          {title}
        </Typography>
        <Box sx={{ width: '100%', height: 320 }}>
          <ResponsiveContainer>
            <ComposedChart data={data} margin={{ top: 16, right: 32, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="dateLabel" />
              <YAxis
                yAxisId="count"
                allowDecimals={false}
                label={{ value: '回数', angle: -90, position: 'insideLeft' }}
              />
              <YAxis
                yAxisId="intensity"
                orientation="right"
                domain={[0, 5]}
                allowDecimals
                label={{ value: '平均強度', angle: 90, position: 'insideRight' }}
              />
              <Tooltip
                cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
              />
              <Bar yAxisId="count" dataKey="count" name="発生回数" barSize={24} fill="#5B8C5A" radius={[4, 4, 0, 0]} />
              <Line
                yAxisId="intensity"
                type="monotone"
                dataKey="avgIntensity"
                name="平均強度"
                stroke="#FF9800"
                strokeWidth={3}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </Box>
        <Box
          component="ul"
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            justifyContent: 'flex-end',
            listStyle: 'none',
            p: 0,
            mt: 2,
          }}
        >
          {behaviorLegendItems.map((item) => (
            <Box
              component="li"
              key={item.label}
              sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', fontSize: '0.875rem' }}
            >
              <Box
                sx={{
                  width: item.shape === 'line' ? 20 : 12,
                  height: item.shape === 'line' ? 2 : 12,
                  borderRadius: item.shape === 'line' ? 1 : 0.5,
                  bgcolor: item.color,
                }}
              />
              {item.label}
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};

export default BehaviorTrendChart;
