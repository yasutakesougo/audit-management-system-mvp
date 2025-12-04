import type { SensoryProfile } from '@/features/assessment/domain/types';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import React from 'react';
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts';

type Props = {
  profile: SensoryProfile;
};

const LABELS: Record<keyof SensoryProfile, string> = {
  visual: '視覚',
  auditory: '聴覚',
  tactile: '触覚',
  olfactory: '嗅覚・味覚',
  vestibular: '前庭覚\n(揺れ)',
  proprioceptive: '固有受容\n(力加減)',
};

const ORDER: (keyof SensoryProfile)[] = ['visual', 'auditory', 'tactile', 'olfactory', 'vestibular', 'proprioceptive'];

export const SensoryRadar: React.FC<Props> = ({ profile }) => {
  const theme = useTheme();

  const data = ORDER.map((key) => ({
    subject: LABELS[key],
    value: profile[key],
    fullMark: 5,
  }));

  return (
    <Box sx={{ width: '100%', height: 300, position: 'relative' }}>
      <ResponsiveContainer>
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="subject" tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} />
          <PolarRadiusAxis angle={30} domain={[0, 5]} tickCount={6} />
          <Radar
            name="感覚特性"
            dataKey="value"
            stroke={theme.palette.primary.main}
            fill={theme.palette.primary.main}
            fillOpacity={0.6}
          />
          <Tooltip formatter={(value: number) => [value, '強度']} contentStyle={{ borderRadius: 8 }} />
        </RadarChart>
      </ResponsiveContainer>
    </Box>
  );
};
