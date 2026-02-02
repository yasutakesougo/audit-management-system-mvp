# Phase 5: MUI Theme Density Application

**目的**: DensityControl で選択した density を MUI components に動的に適用

---

## 📋 概要

### Phase 4 → Phase 5 の進化

**Phase 4 (完了):**
```typescript
// CSS variables のみ
:root {
  --theme-density-base: 8px;
  --theme-density-factor: 1;
}
```
- ✅ Custom components が CSS variables で響応
- ❌ MUI components は影響を受けない

**Phase 5 (予定):**
```typescript
// MUI theme に density を統合
const theme = useMemo(() => 
  createTheme({
    spacing: 8 * settings.density, // density に応じて spacing multiplier 変更
  }),
  [settings.density]
);
```
- ✅ すべての MUI components が density に応答
- ✅ Button padding, Dialog spacing, Card margins すべて自動調整

---

## 🎯 実装詳細

### 1. Density → Spacing Multiplier マッピング

```typescript
// app/theme.tsx

export const densitySpacingMap = {
  compact: 0.75,      // spacing = 8 * 0.75 = 6px base
  comfortable: 1.0,   // spacing = 8 * 1.0 = 8px base (default)
  spacious: 1.25,     // spacing = 8 * 1.25 = 10px base
};

export type Density = keyof typeof densitySpacingMap;
```

### 2. useThemeWithDensity カスタムフック

```typescript
// app/theme.tsx

export function useThemeWithDensity(density: Density, mode: 'light' | 'dark') {
  const multiplier = densitySpacingMap[density];

  return useMemo(() => {
    return createTheme({
      palette: {
        mode,
        primary: { main: '#0066CC' },
        // ... other palette settings
      },
      spacing: (factor: number) => `${8 * multiplier * factor}px`,
      components: {
        MuiButton: {
          styleOverrides: {
            root: {
              padding: `${6 * multiplier}px ${16 * multiplier}px`,
            },
          },
        },
        MuiDialog: {
          styleOverrides: {
            paper: {
              margin: `${16 * multiplier}px`,
            },
          },
        },
        MuiCard: {
          styleOverrides: {
            root: {
              padding: `${16 * multiplier}px`,
            },
          },
        },
        // ... more component overrides
      },
    });
  }, [density, mode, multiplier]);
}
```

### 3. App.tsx で Theme を動的に生成

```typescript
// App.tsx

function App() {
  const { mode } = useContext(ColorModeContext);
  const { settings } = useSettingsContext();

  const theme = useThemeWithDensity(settings.density, mode);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ToastProvider>
        <SettingsProvider>
          {/* ... */}
        </SettingsProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
```

---

## 🧪 テスト戦略

### 単体テスト

```typescript
// app/theme.spec.ts

describe('useThemeWithDensity', () => {
  it('returns theme with correct spacing for compact density', () => {
    const theme = createThemeWithDensity('compact', 'light');
    const spacing = theme.spacing(2);
    
    // 8 * 0.75 * 2 = 12px
    expect(spacing).toBe('12px');
  });

  it('returns theme with correct spacing for spacious density', () => {
    const theme = createThemeWithDensity('spacious', 'light');
    const spacing = theme.spacing(2);
    
    // 8 * 1.25 * 2 = 20px
    expect(spacing).toBe('20px');
  });

  it('updates Button padding based on density', () => {
    const compactTheme = createThemeWithDensity('compact', 'light');
    const spaciousTheme = createThemeWithDensity('spacious', 'light');

    const compactPadding = compactTheme.components.MuiButton.styleOverrides.root.padding;
    const spaciousPadding = spaciousTheme.components.MuiButton.styleOverrides.root.padding;

    expect(compactPadding).not.toBe(spaciousPadding);
  });
});
```

### 統合テスト

```typescript
// tests/integration/phase5-density-mui.spec.tsx

describe('MUI Theme Density Integration', () => {
  it('applies density to all MUI components on settings change', async () => {
    const { rerender } = render(
      <SettingsProvider>
        <App />
      </SettingsProvider>
    );

    // Get initial Button padding (comfortable = default)
    const button = screen.getByRole('button', { name: /test/i });
    const initialPadding = window.getComputedStyle(button).padding;

    // Change density to compact
    const compactButton = screen.getByTestId('density-compact');
    await userEvent.click(compactButton);

    // Verify padding changed
    await waitFor(() => {
      const newPadding = window.getComputedStyle(button).padding;
      expect(newPadding).not.toBe(initialPadding);
    });
  });
});
```

---

## 📊 影響範囲

### MUI Components 影響度マップ

| Component | 影響 | 理由 |
|-----------|------|------|
| **Button** | 高 | padding, height が変更 |
| **TextField** | 高 | padding, height が変更 |
| **Dialog** | 高 | margin, padding が変更 |
| **Card** | 高 | padding が変更 |
| **List** | 中 | item height が変更 |
| **Stack** | 中 | spacing が変更 |
| **Box** | 低 | margin/padding で個別制御 |

### ビジュアル変化

**Compact (0.75x):**
```
┌──────────────────────┐
│ [Button] [Button]    │  ← padding smaller
│ ┌──────────────────┐ │
│ │ Dialog Content   │ │  ← dialog margin smaller
│ │ [Input]          │ │  ← input height smaller
│ └──────────────────┘ │
└──────────────────────┘
```

**Spacious (1.25x):**
```
┌────────────────────────────┐
│   [Button]   [Button]      │  ← padding larger
│   ┌────────────────────┐   │
│   │ Dialog Content     │   │  ← dialog margin larger
│   │ [Input]            │   │  ← input height larger
│   └────────────────────┘   │
└────────────────────────────┘
```

---

## 🛠️ 実装チェックリスト

- [ ] useThemeWithDensity フック実装
- [ ] MuiButton styleOverrides 追加
- [ ] MuiDialog styleOverrides 追加
- [ ] MuiTextField styleOverrides 追加
- [ ] MuiCard styleOverrides 追加
- [ ] MuiList/MuiListItem styleOverrides 追加
- [ ] App.tsx で theme 動的生成
- [ ] 単体テスト実装 (spacing calculations)
- [ ] 統合テスト実装 (visual changes)
- [ ] E2E smoke test 追加
- [ ] Snapshot 更新

---

## 📅 推定実装時間

- **設計・計画**: ✅ 完了 (このドキュメント)
- **コード実装**: ~2-3時間
- **テスト・検証**: ~1-2時間
- **CI/CD**: ~1時間
- **合計**: ~4-6時間

---

## ⚙️ 技術決定

### Decision 1: Theme Multiplier vs CSS Variables

**選択**: Theme Multiplier (MUI createTheme)

**理由**:
- MUI components が自動的に応答
- CSS variables より柔軟
- snapshot test の管理が容易

### Decision 2: Dynamic Theme vs Theme Switching

**選択**: Dynamic Theme (useMemo)

**理由**:
- settings 変更時に即座に反映
- Theme Provider の再マウント不要

### Decision 3: Global spacing() vs Component-level overrides

**選択**: Global spacing() + Component-level overrides

**理由**:
- Global spacing で基本的なレイアウト制御
- Component-level で例外的な調整
- バランスの取れたアプローチ

---

## 🔗 依存関係

```
Phase 4 ✅ (CSS Variables)
    ↓
Phase 5 (MUI Theme Integration)
    ↓
Phase 6 (Font Size Control) ← 同じパターン
    ↓
Phase 7 (Color Customization) ← 同じパターン
```

---

## 📌 次のステップ

1. **PR #318 & #319 マージ完了を待つ** (数分)
2. **Phase 4 ブランチを main に merge**
3. **feat/phase5-mui-theme-density ブランチ作成**
4. **useThemeWithDensity 実装開始**
5. **MUI components styleOverrides 追加**
6. **テスト実装**
7. **PR #321 作成 (Phase 5)**

---

**準備完了です！** 🚀

PR #319 の CI 完了と同時に、Phase 5 実装を開始できます。
