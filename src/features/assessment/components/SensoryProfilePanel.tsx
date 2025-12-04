import { SensoryRadar } from '@/features/assessment/components/SensoryRadar';
import type { SensoryProfile } from '@/features/assessment/domain/types';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import React from 'react';

type Props = {
  profile: SensoryProfile;
  onChange: (next: SensoryProfile) => void;
  readOnly?: boolean;
};

const SENSORY_KEYS: { key: keyof SensoryProfile; label: string; desc: string }[] = [
  { key: 'visual', label: '視覚', desc: '光・色彩への反応' },
  { key: 'auditory', label: '聴覚', desc: '音への反応' },
  { key: 'tactile', label: '触覚', desc: '肌触り・接触' },
  { key: 'olfactory', label: '嗅覚・味覚', desc: 'におい・味' },
  { key: 'vestibular', label: '前庭覚', desc: '揺れ・バランス・回転' },
  { key: 'proprioceptive', label: '固有受容覚', desc: '力の加減・ボディイメージ' },
];

export const SensoryProfilePanel: React.FC<Props> = ({ profile, onChange, readOnly = false }) => {
  const handleSliderChange = (key: keyof SensoryProfile) => (_: Event, value: number | number[]) => {
    if (readOnly) return;
    onChange({
      ...profile,
      [key]: value as number,
    });
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" gutterBottom fontWeight="bold">
          感覚プロファイル (Sensory Profile)
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          1: 鈍麻 (感じにくい) ↔ 3: 定型 ↔ 5: 過敏 (感じやすい)
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gap: 4,
            gridTemplateColumns: { xs: '1fr', md: '5fr 7fr' },
            alignItems: 'center',
          }}
        >
          <Box>
            <SensoryRadar profile={profile} />
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {SENSORY_KEYS.map(({ key, label, desc }) => (
              <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ width: 120 }}>
                  <Typography variant="subtitle2" fontWeight="bold">
                    {label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {desc}
                  </Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Slider
                    value={profile[key]}
                    onChange={handleSliderChange(key)}
                    step={1}
                    marks
                    min={1}
                    max={5}
                    disabled={readOnly}
                    valueLabelDisplay="auto"
                    sx={{
                      color:
                        profile[key] > 3 ? 'error.main' : profile[key] < 3 ? 'info.main' : 'primary.main',
                    }}
                  />
                </Box>
                <Typography variant="body1" fontWeight="bold" sx={{ width: 30, textAlign: 'center' }}>
                  {profile[key]}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};
