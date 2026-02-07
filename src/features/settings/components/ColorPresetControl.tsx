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

export type ColorPreset = UserSettings['colorPreset'];

interface ColorPresetControlProps {
  value: ColorPreset;
  onChange: (preset: ColorPreset) => void;
}

/**
 * Color Preset Control Component (Phase 7.2)
 * Allows users to select from predefined color presets:
 * - default: Standard MUI palette (blue/pink)
 * - highContrast: Maximum contrast for accessibility
 * - custom: User-defined colors (Phase 7.2 v2 with ColorPicker)
 */
export const ColorPresetControl: React.FC<ColorPresetControlProps> = ({
  value,
  onChange,
}) => {
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange(event.target.value as ColorPreset);
    },
    [onChange]
  );

  const colorPresetOptions = [
    {
      value: 'default' as const,
      label: 'デフォルト',
      description: 'MUI 標準カラー',
      primaryColor: '#1976d2',
      secondaryColor: '#dc004e',
      enabled: true,
    },
    {
      value: 'highContrast' as const,
      label: 'ハイコントラスト',
      description: '最大コントラスト（アクセシビリティ重視）',
      primaryColor: '#000000',
      secondaryColor: '#ffffff',
      enabled: true,
    },
  ];

  return (
    <FormControl component="fieldset" fullWidth>
      <FormLabel component="legend" sx={{ fontWeight: 700, mb: 1.5 }}>
        カラープリセット
      </FormLabel>
      <RadioGroup
        value={value}
        onChange={handleChange}
        data-testid="color-preset-radio-group"
      >
        <Stack spacing={1.5}>
          {colorPresetOptions.map((option) => (
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
                cursor: option.enabled ? 'pointer' : 'not-allowed',
                opacity: option.enabled ? 1 : 0.6,
                '&:hover': option.enabled
                  ? {
                      backgroundColor: 'action.hover',
                    }
                  : {},
              }}
            >
              <FormControlLabel
                value={option.value}
                disabled={!option.enabled}
                control={
                  <Radio
                    size="small"
                    sx={{ mr: 1.5, mt: 0.25 }}
                    data-testid={`color-preset-radio-${option.value}`}
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

      {/* Color preview swatches for selected preset */}
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
        <Stack direction="row" spacing={2}>
          {colorPresetOptions
            .filter((option) => value === option.value)
            .map((option) => (
              <Box key={option.value} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 1,
                    backgroundColor: option.primaryColor,
                    border: '2px solid',
                    borderColor: 'divider',
                  }}
                  title={`Primary: ${option.primaryColor}`}
                />
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 1,
                    backgroundColor: option.secondaryColor,
                    border: '2px solid',
                    borderColor: 'divider',
                  }}
                  title={`Secondary: ${option.secondaryColor}`}
                />
                <Typography variant="caption" color="text.secondary">
                  Primary / Secondary
                </Typography>
              </Box>
            ))}
        </Stack>
      </Stack>
    </FormControl>
  );
};

export default ColorPresetControl;
