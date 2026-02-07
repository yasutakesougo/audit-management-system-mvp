import React, { useCallback } from 'react';
import {
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Stack,
  Typography,
  Box,
} from '@mui/material';
import type { UserSettings } from '@/features/settings/settingsModel';

export type FontSize = UserSettings['fontSize'];

interface FontSizeControlProps {
  value: FontSize;
  onChange: (fontSize: FontSize) => void;
}

/**
 * FontSize Control Component
 * Allows users to select from 3 predefined font sizes
 * - small: 12px (compact, high density)
 * - medium: 14px (standard, comfortable)
 * - large: 16px (accessible, spacious)
 *
 * Applied via createAppTheme typography.fontSize
 */
export const FontSizeControl: React.FC<FontSizeControlProps> = ({ value, onChange }) => {
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange(event.target.value as FontSize);
    },
    [onChange]
  );

  const fontSizeOptions = [
    { value: 'small' as const, label: '小', description: '12px - コンパクト表示' },
    { value: 'medium' as const, label: '標準', description: '14px - 標準表示' },
    { value: 'large' as const, label: '大', description: '16px - 読みやすい' },
  ];

  return (
    <FormControl component="fieldset" fullWidth>
      <FormLabel component="legend" sx={{ fontWeight: 700, mb: 1.5 }}>
        フォントサイズ
      </FormLabel>
      <RadioGroup value={value} onChange={handleChange} data-testid="font-size-radio-group">
        <Stack spacing={1.5}>
          {fontSizeOptions.map((option) => (
            <Box
              key={option.value}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                p: 1.5,
                borderRadius: 1,
                backgroundColor:
                  value === option.value ? 'action.hover' : 'transparent',
                transition: 'background-color 0.2s ease',
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
            >
              <FormControlLabel
                value={option.value}
                control={
                  <Radio
                    size="small"
                    sx={{ mr: 1.5, mt: 0.25 }}
                    data-testid={`font-size-radio-${option.value}`}
                  />
                }
                label={
                  <Stack spacing={0.25}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: value === option.value ? 600 : 500,
                      }}
                    >
                      {option.label}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontSize: '0.7rem' }}
                    >
                      {option.description}
                    </Typography>
                  </Stack>
                }
                sx={{ width: '100%', m: 0 }}
              />
            </Box>
          ))}
        </Stack>
      </RadioGroup>

      {/* Preview text showing actual font sizes */}
      <Stack
        spacing={1}
        sx={{
          mt: 2.5,
          pt: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography variant="caption" color="text.secondary">
          プレビュー:
        </Typography>
        <Box
          sx={{
            '& .preview-small': {
              fontSize: '12px',
              lineHeight: 1.5,
            },
            '& .preview-medium': {
              fontSize: '14px',
              lineHeight: 1.5,
            },
            '& .preview-large': {
              fontSize: '16px',
              lineHeight: 1.5,
            },
          }}
        >
          <Typography className="preview-small" variant="caption">
            小サイズ表示です
          </Typography>
          <Typography className="preview-medium" variant="caption">
            標準サイズ表示です
          </Typography>
          <Typography className="preview-large" variant="caption">
            大サイズ表示です
          </Typography>
        </Box>
      </Stack>
    </FormControl>
  );
};

export default FontSizeControl;
