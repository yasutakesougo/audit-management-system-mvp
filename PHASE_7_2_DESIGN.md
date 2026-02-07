# Phase 7.2: Color Customization - 実装設計書

**Date:** 2026-02-02  
**Phase:** 7.2 (Color Customization)  
**Predecessor:** Phase 7.1 ✅ (PR #325)  
**Status:** 実装待機中

---

## 🎯 目標

ユーザーが色プリセットを選択でき、高コントラストや完全カスタマイズが可能な色管理システムを実装。

---

## 📋 実装仕様

### UserSettings 拡張（既に schema に存在）

```typescript
interface UserSettings {
  // ... existing fields
  colorPreset: 'default' | 'highContrast' | 'custom';
  
  // Custom colors (Phase 7.2 v2 で追加予定)
  customPrimaryColor?: string;    // e.g., '#1976d2'
  customSecondaryColor?: string;  // e.g., '#dc004e'
}
```

---

## 📦 実装ファイル

### 1. ColorPresetControl.tsx (NEW) - ~120 lines

**Purpose:** ユーザーが3つの色プリセットを選択できる UI コンポーネント

```typescript
// Location: src/features/settings/components/ColorPresetControl.tsx

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
 * Color Preset Control Component
 * Allows users to select from predefined color presets:
 * - default: Standard MUI palette (blue/pink)
 * - highContrast: Maximum contrast for accessibility
 * - custom: User-defined colors (future v2 feature)
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
      description: 'MUI 標準カラー (青/ピンク)',
      primaryColor: '#1976d2',
      secondaryColor: '#dc004e',
    },
    {
      value: 'highContrast' as const,
      label: 'ハイコントラスト',
      description: '最大コントラスト (アクセシビリティ)',
      primaryColor: '#000000',
      secondaryColor: '#ffffff',
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

      {/* Color preview swatches */}
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
          {colorPresetOptions.map((option) => (
            value === option.value && (
              <Box key={option.value} sx={{ display: 'flex', gap: 1 }}>
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
              </Box>
            )
          ))}
        </Stack>
      </Stack>
    </FormControl>
  );
};

export default ColorPresetControl;
```

---

### 2. createAppTheme.ts (UPDATE) - ~15 lines

**Update location:** 既存の `createAppTheme` 関数に palette override を追加

```typescript
/**
 * Color preset map (Phase 7.2 - Color Customization)
 * Maps user-selected colorPreset to palette colors
 */
const colorPresetMap = {
  default: {
    primary: '#1976d2',      // MUI Blue
    secondary: '#dc004e',    // MUI Pink
  },
  highContrast: {
    primary: '#000000',      // Black
    secondary: '#ffffff',    // White
  },
} as const;

export function createAppTheme(settings: UserSettings): Theme {
  const densityBase = densitySpacingMap[settings.density];
  const baseFontSize = fontSizeMap[settings.fontSize];
  const colorPreset = colorPresetMap[settings.colorPreset];

  return createTheme({
    spacing: densityBase,
    typography: {
      fontSize: baseFontSize,
    },
    palette: {
      primary: { main: colorPreset.primary },
      secondary: { main: colorPreset.secondary },
    },
    components: {
      // ... existing overrides
    },
  });
}
```

---

### 3. SettingsDialog.tsx (UPDATE) - ~15 lines

**Update location:** FontSizeControl 後に ColorPresetControl を追加

```typescript
import { DensityControl, FontSizeControl, ColorPresetControl } from './components';

// In JSX:
<FontSizeControl
  value={settings.fontSize}
  onChange={handleFontSizeChange}
/>
<Divider sx={{ my: 2 }} />
<Stack spacing={2}>
  <ColorPresetControl
    value={settings.colorPreset}
    onChange={(preset) => updateSettings({ colorPreset: preset })}
  />
</Stack>
```

---

### 4. ColorPresetControl.spec.tsx (NEW) - ~180 lines

**Test coverage:**
- ✅ Rendering (all presets, labels, descriptions)
- ✅ Color swatches display
- ✅ Selection state
- ✅ onChange callback
- ✅ Accessibility (roles, labels)
- ✅ Keyboard navigation

```typescript
// Location: src/features/settings/components/__tests__/ColorPresetControl.spec.tsx

describe('ColorPresetControl', () => {
  it('should render all color preset options', () => {
    render(<ColorPresetControl value="default" onChange={vi.fn()} />);
    expect(screen.getByText('デフォルト')).toBeInTheDocument();
    expect(screen.getByText('ハイコントラスト')).toBeInTheDocument();
  });

  it('should call onChange when selecting a preset', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ColorPresetControl value="default" onChange={onChange} />);

    const highContrastRadio = screen.getByTestId('color-preset-radio-highContrast');
    await user.click(highContrastRadio);

    expect(onChange).toHaveBeenCalledWith('highContrast');
  });

  // ... more tests
});
```

---

## 🔄 実装パターン（確立済み）

1. **新規 Control コンポーネント作成** (FontSizeControl と同じ)
   - Radio buttons with descriptions
   - Visual preview (color swatches)
   - ARIA labels for accessibility

2. **createAppTheme に override 追加**
   - Pure function: settings → palette
   - No side effects

3. **SettingsDialog に統合**
   - Component import
   - Handler function
   - Divider for separation

4. **Spec ファイルで全テスト**
   - 12+ test cases
   - Coverage: rendering, interactions, a11y

---

## ⏱️ 推定時間

| タスク | 時間 |
|--------|------|
| ColorPresetControl.tsx 作成 | 15分 |
| createAppTheme 更新 | 5分 |
| SettingsDialog 統合 | 5分 |
| ColorPresetControl.spec.tsx 作成 | 15分 |
| 検証 (typecheck/lint/test) | 5分 |
| コミット & PR 作成 | 5分 |
| **合計** | **~45分** |

---

## ✅ 検証チェックリスト

- [ ] Typecheck: PASS
- [ ] Lint: PASS
- [ ] Tests: 12/12 PASS
- [ ] ColorPresetControl renders correctly
- [ ] Color swatches show current preset
- [ ] onChange callback works
- [ ] SettingsDialog displays all controls
- [ ] Colors apply to MUI components
- [ ] Persistence (localStorage) works
- [ ] Manual smoke test PASS

---

## 🚀 実装開始コマンド

```bash
# PR #325 マージ確認後
git checkout main
git pull origin main

# ブランチ作成
git checkout -b feat/phase7-color-customization

# 実装開始
# 1. ColorPresetControl.tsx
# 2. createAppTheme.ts update
# 3. SettingsDialog.tsx update
# 4. ColorPresetControl.spec.tsx
# 5. Validation
# 6. Commit & Push
# 7. PR create with auto-merge
```

---

## 📊 PR #325 (Font Size Control) 完了後のシーケンス

```
PR #325 MERGED
  ↓
PR #326: Phase 7.2 (Color Customization) START
  ↓ (45分)
PR #326 MERGED
  ↓ (optional)
PR #327: Phase 7.3 (Layout Presets) START
  ↓
Settings System Complete! ✨
```

---

**準備完了！PR #325 マージ後すぐに Phase 7.2 実装開始できます。** 🚀
