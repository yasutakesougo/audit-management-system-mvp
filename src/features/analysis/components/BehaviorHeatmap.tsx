import type { BehaviorObservation } from '@/features/daily/domain/daily/types';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import React, { useMemo } from 'react';
import {
    CartesianGrid,
    ResponsiveContainer,
    Scatter,
    ScatterChart,
    Tooltip,
    XAxis,
    YAxis,
    ZAxis,
} from 'recharts';

export type BehaviorHeatmapProps = {
  data: BehaviorObservation[];
  title?: string;
};

export const BehaviorHeatmap: React.FC<BehaviorHeatmapProps> = ({ data, title = '時間帯別発生分布' }) => {
  const chartData = useMemo(() => (
    data.map((record) => {
      const date = new Date(record.timestamp);
      return {
        hour: Number((date.getHours() + date.getMinutes() / 60).toFixed(2)),
        dateLabel: date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }),
        intensity: record.intensity,
        behavior: record.behavior,
        timestamp: record.timestamp,
      };
    })
  ), [data]);

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
            <ScatterChart margin={{ top: 16, right: 24, bottom: 16, left: 0 }}>
              <CartesianGrid strokeOpacity={0.4} />
              <XAxis
                type="number"
                dataKey="hour"
                name="時間"
                unit="時"
                domain={[0, 24]}
                ticks={[0, 6, 12, 18, 24]}
              />
              <YAxis
                type="category"
                dataKey="dateLabel"
                name="日付"
                allowDuplicatedCategory={false}
                width={60}
              />
              <ZAxis type="number" dataKey="intensity" name="強度" range={[80, 400]} />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ payload }) => {
                  if (!payload?.length) return null;
                  const point = payload[0].payload as typeof chartData[number];
                  return (
                    <Box sx={{ bgcolor: 'background.paper', borderRadius: 1, px: 1.5, py: 1, boxShadow: 2 }}>
                      <Typography variant="body2" fontWeight="bold">
                        {point.behavior}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(point.timestamp).toLocaleString()}<br />
                        強度: Lv.{point.intensity}
                      </Typography>
                    </Box>
                  );
                }}
              />
              <Scatter data={chartData} fill="#d32f2f" fillOpacity={0.65} />
            </ScatterChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  );
};

export default BehaviorHeatmap;
