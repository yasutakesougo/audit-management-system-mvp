import React, { useCallback } from 'react';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import RadioGroup from '@mui/material/RadioGroup';
import Radio from '@mui/material/Radio';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CompressIcon from '@mui/icons-material/Compress';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import ExpandIcon from '@mui/icons-material/Expand';

type Density = 'compact' | 'comfortable' | 'spacious';

interface DensityControlProps {
  value: Density;
  onChange: (density: Density) => void;
}

const densityOptions: Array<{
  value: Density;
  label: string;
  description: string;
  icon: React.ElementType;
}> = [
  {
    value: 'compact',
    label: 'コンパクト',
    description: '余白を最小化。情報密度を高めます。',
    icon: CompressIcon,
  },
  {
    value: 'comfortable',
    label: '標準',
    description: 'バランスの取れた表示。推奨設定です。',
    icon: UnfoldMoreIcon,
  },
  {
    value: 'spacious',
    label: 'ゆったり',
    description: '余白を広げ。見やすさを優先します。',
    icon: ExpandIcon,
  },
];

/**
 * Density Control Component
 *
 * ユーザーが UI の密度（padding/margin）を選択するためのラジオボタングループ。
 * compact (4px) / comfortable (8px) / spacious (12px) の3段階。
 */
export const DensityControl: React.FC<DensityControlProps> = ({ value, onChange }) => {
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange(event.target.value as Density);
    },
    [onChange]
  );

  return (
    <FormControl component="fieldset" fullWidth>
      <FormLabel component="legend" sx={{ fontWeight: 700, mb: 2 }}>
        UI の密度
      </FormLabel>
      <RadioGroup
        row={false}
        value={value}
        onChange={handleChange}
        aria-label="UI密度選択"
      >
        {densityOptions.map((option) => {
          const Icon = option.icon;
          return (
            <FormControlLabel
              key={option.value}
              value={option.value}
              control={<Radio />}
              label={
                <Stack spacing={0.5} sx={{ ml: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Icon fontSize="small" sx={{ color: 'text.secondary' }} />
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {option.label}
                    </Typography>
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary', display: 'block' }}
                  >
                    {option.description}
                  </Typography>
                </Stack>
              }
              sx={{
                mb: 1.5,
                '&:last-child': { mb: 0 },
              }}
            />
          );
        })}
      </RadioGroup>
    </FormControl>
  );
};

export default DensityControl;
