# 段階2：ビジュアル強化 CSS 設計案

> **実装予定時間**: 3-4 時間  
> **対象ファイル**: `src/app/AppShell.tsx`（スタイリング部分）  
> **難易度**: 🟡 中（CSS + React state）

---

## 🎨 デザイン方針

段階1（ラベル変更）の後、さらに視覚的な分離を強化します。

### 目標

1. **「日次業務」と「管理」の分離を明確化**
   - セパレーターの強度を変える
   - 色分け（管理は赤/警告色）

2. **スクロール時の定位置性を向上**
   - グループタイトルが「粘着」して常に見える（sticky）
   - または タイプセット制御で単語を揃える

3. **バッジ（未読件数）への準備**
   - UI 構造を先行してセットアップ
   - 実装は段階3）

---

## 📐 視覚的構造

### 現行（段階0）

```
┌─────────────────────┐
│ 📌 今日の業務      │  ← グループタイトル
├─────────────────────┤  ← 薄い divider
│ • 日次記録         │
│ • 健康記録         │
│ • ...             │
├─────────────────────┤
│ 📚 記録を参照      │
├─────────────────────┤
│ 🔍 分析して改善    │
├─────────────────────┤  ← グループ間は同じ強度
│ 👥 利用者・職員    │
├─────────────────────┤
│ ⚙️ システム管理    │  ← Admin グループ
├─────────────────────┤
│ ⚙️ 表示設定       │
└─────────────────────┘
```

### 提案後（段階2）

```
┌─────────────────────┐
│ 📌 今日の業務      │  ← 標準タイトル
├─────────────────────┤  ← 薄い分割線
│ • 日次記録         │
│ • 健康記録         │
│ • ...             │
════════════════════════  ← 強い border（セパレーター）
│ 📚 記録を参照      │
├─────────────────────┤
│ 🔍 分析して改善    │
├─────────────────────┤
│ 👥 利用者・職員    │
════════════════════════  ← 強い border（Admin 前）
│ ⚙️ システム管理    │  ← 赤系タイトル（警告色）
├─────────────────────┤
│ ⚙️ 表示設定       │
└─────────────────────┘
```

---

## 🔧 実装コード（パターン別）

### パターン1：シンプル版（セパレーターのみ強化）

**難易度**: 🟢 低 | **工数**: 1 時間 | **推奨**: YES

```typescript
// src/app/AppShell.tsx（L740 renderGroupedNavList 内）

// 現行コード
{!navCollapsed && groupKey !== 'settings' && <Divider sx={{ mt: 1, mb: 0.5 }} />}

// 改善コード: グループごとに分離度を変える
{!navCollapsed && groupKey !== 'settings' && (
  <Divider
    sx={{
      mt: 1.5,
      mb: 1.5,
      // Admin グループの前後は強調
      ...(groupKey === 'master' && {
        borderColor: 'divider',
        borderWidth: 2,  // 通常より太い
        opacity: 0.8,
        my: 2,  // 上下マージンを広げる
      }),
    }}
  />
)}
```

**効果**:
- Admin グループ前に「強い分割線」が出現
- 誤操作を防ぐ（管理者機能の境界が明確）

---

### パターン2：カラー版（推奨）

**難易度**: 🟡 中 | **工数**: 2 時間 | **推奨**: YES

```typescript
// src/app/AppShell.tsx（ListSubheader のスタイリング）

// コンポーネント内で groupColor を定義
const getGroupColor = (groupKey: NavGroupKey, isDarkMode: boolean) => {
  const colorMap: Record<NavGroupKey, { main: string; light: string; bg: string }> = {
    // 標準グループ（中立色）
    daily: {
      main: isDarkMode ? '#90CAF9' : '#1976D2',
      light: isDarkMode ? '#64B5F6' : '#42A5F5',
      bg: isDarkMode ? 'rgba(25, 118, 210, 0.1)' : 'rgba(25, 118, 210, 0.05)',
    },
    record: {
      main: isDarkMode ? '#81C784' : '#388E3C',
      light: isDarkMode ? '#66BB6A' : '#43A047',
      bg: isDarkMode ? 'rgba(56, 142, 60, 0.1)' : 'rgba(56, 142, 60, 0.05)',
    },
    review: {
      main: isDarkMode ? '#FFB74D' : '#F57C00',
      light: isDarkMode ? '#FFA726' : '#FB8C00',
      bg: isDarkMode ? 'rgba(245, 124, 0, 0.1)' : 'rgba(245, 124, 0, 0.05)',
    },
    master: {
      main: isDarkMode ? '#A1887F' : '#5D4037',
      light: isDarkMode ? '#8D6E63' : '#6D4C41',
      bg: isDarkMode ? 'rgba(93, 64, 55, 0.1)' : 'rgba(93, 64, 55, 0.05)',
    },
    // Admin グループ（警告色: 赤）
    admin: {
      main: isDarkMode ? '#EF5350' : '#D32F2F',  // 赤
      light: isDarkMode ? '#E57373' : '#E53935',
      bg: isDarkMode ? 'rgba(211, 47, 47, 0.1)' : 'rgba(211, 47, 47, 0.08)',
    },
    // 設定グループ（グレー）
    settings: {
      main: isDarkMode ? '#9E9E9E' : '#616161',
      light: isDarkMode ? '#757575' : '#757575',
      bg: isDarkMode ? 'rgba(97, 97, 97, 0.05)' : 'rgba(97, 97, 97, 0.03)',
    },
  };
  
  return colorMap[groupKey];
};

// renderGroupedNavList 内で使用
const renderGroupedNavList = (onNavigate?: () => void) => {
  const mode = useTheme().palette.mode;
  const isDarkMode = mode === 'dark';
  
  return (
    <List dense sx={{ px: 1 }}>
      {groupedNavItems.ORDER.map((groupKey) => {
        const items = groupedNavItems.map.get(groupKey) ?? [];
        if (items.length === 0) return null;
        
        const groupColor = getGroupColor(groupKey, isDarkMode);
        
        return (
          <Box key={groupKey} sx={{ mb: 1.5 }}>
            {!navCollapsed && (
              <ListSubheader
                sx={{
                  bgcolor: groupColor.bg,  // 背景色
                  color: groupColor.main,  // テキスト色
                  lineHeight: 1.6,
                  py: 0.5,
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  px: 2,
                  borderBottom: `2px solid ${groupColor.light}`,  // 下線
                  borderRadius: 1,
                  mb: 1,
                }}
              >
                {groupLabel[groupKey]}
              </ListSubheader>
            )}
            {items.map((item) => renderNavItem(item, onNavigate))}
            
            {/* 強い分割線: Admin グループの後 */}
            {!navCollapsed && groupKey === 'master' && (
              <Divider
                sx={{
                  mt: 2,
                  mb: 1.5,
                  borderColor: 'error.main',
                  opacity: 0.6,
                  borderWidth: 2,
                }}
              />
            )}
          </Box>
        );
      })}
    </List>
  );
};
```

**効果**:
- 各グループが色分けされ、視認性向上
- Admin グループが赤で強調（危険な操作を認識させる）
- ダークモードでも色が調整される

**カラーパレット**:
```
日次 (Daily):     青（信頼・重要）
記録 (Record):    緑（参照・過去）
分析 (Review):    オレンジ（何言考・分析）
マスタ (Master):  茶色（基本・安定）
管理 (Admin):     赤（警告・高権限）
設定 (Settings):  グレー（ユーティリティ）
```

---

### パターン3：フル機能版（バッジ + sticky）

**難易度**: 🔴 高 | **工数**: 4+ 時間 | **推奨**: 計画段階

```typescript
// src/app/AppShell.tsx

interface GroupWithBadge extends NavGroup {
  badge?: {
    count?: number;
    label?: string;
    color?: 'error' | 'warning' | 'info' | 'success';
  };
}

// グループバッジの状態管理（例: 未読申し送り件数）
const [groupBadges, setGroupBadges] = useState<Map<NavGroupKey, number>>(
  new Map([
    ['daily', 2],  // 「日次」グループに未読: 2
  ])
);

// ListSubheader に sticky を追加
<ListSubheader
  sx={{
    position: 'sticky',  // スクロール時も常に見える
    top: 0,
    zIndex: 10,
    bgcolor: groupColor.bg,
    borderBottom: `2px solid ${groupColor.light}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  }}
>
  <span>{groupLabel[groupKey]}</span>
  
  {/* バッジ表示 */}
  {groupBadges.get(groupKey) && (
    <Chip
      label={groupBadges.get(groupKey)}
      size="small"
      color={groupKey === 'admin' ? 'error' : 'default'}
      variant="outlined"
    />
  )}
</ListSubheader>
```

**効果**:
- グループタイトルがスクロール時に「粘着」
- 未読件数などがバッジで表示
- ユーザーが「このグループに未処理がある」と認識可能

---

## 📋 実装チェックリスト（パターン2 を例に）

### ステップ1: Color 定義関数を追加

```typescript
// AppShell.tsx (L200 あたり)

const getGroupColor = (groupKey: NavGroupKey, isDarkMode: boolean) => {
  // 上記のコード参照
};
```

- [ ] 関数をコンポーネント内に定義がて
- [ ] TypeScript エラーなし

### ステップ2: ListSubheader スタイルを更新

```typescript
// AppShell.tsx (L730 ListSubheader)

sx={{
  ...existing,
  bgcolor: groupColor.bg,
  color: groupColor.main,
  borderBottom: `2px solid ${groupColor.light}`,
}}
```

- [ ] 既存スタイルを上書きしない（merge）
- [ ] ダークモード両立確認

### ステップ3: Divider（分割線）を強化

```typescript
// AppShell.tsx (L740)

{groupKey === 'master' && (
  <Divider sx={{...}} />
)}
```

- [ ] Master グループの後に強い divider が表示されるか確認
- [ ] Admin グループが視覚的に分離されているか確認

### ステップ4: テスト

```bash
# ビジュアルテスト
npm run dev
  ✓ Light mode 確認
  ✓ Dark mode 確認
  ✓ スクロール確認
  ✓ モバイル表示確認（≤600px）

# E2E テスト
npm run test:e2e:smoke
  ✓ ナビゲーション機能のみ確認（スタイルではない）
```

- [ ] すべてのビジュアルチェック完了
- [ ] E2E テスト PASS

---

## 🌓 ダークモード対応確認

特に Important: ダークモード で **赤色（Admin）** が見えるかを確認

```typescript
// Dark mode での色調整
// WCAG AA レベル（4.5:1 以上のコントラスト比）を確認

// ❌ ダメな例
admin: {
  main: '#FF6B6B',  // 明るい赤 → ダークテーマで背景に埋もれる
}

// ✅ 良い例
admin: {
  main: isDarkMode ? '#EF5350' : '#D32F2F',  // ダークモードで濃淡調整
}
```

---

## 📸 ビフォー・アフター（段階2 適用後）

### Light Mode

```
【Before】
───────────────────
📌 今日の業務
───────────────────
• 日次記録
• 健康記録

───────────────────
📚 記録を参照
───────────────────
• 黒ノート

───────────────────
⚙️ システム管理
───────────────────
• 支援手順

【After】
┌─────────────────┐
│ 📌 今日の業務    │ ← 青背景 + テキスト
├─────────────────┤
│ • 日次記録      │
│ • 健康記録      │
└─────────────────┘
════════════════════ ← 強い分割線

┌─────────────────┐
│ 📚 記録を参照    │ ← 緑背景 + テキスト
├─────────────────┤
│ • 黒ノート      │
└─────────────────┘

════════════════════ ← 赤い強い分割線

┌─────────────────┐
│ ⚙️ システム管理   │ ← 赤背景（警告）
├─────────────────┤
│ • 支援手順      │
└─────────────────┘
```

---

## 🔄 段階3 への展開

段階2 が完了すると、段階3 は以下を追加するだけ：

```typescript
// 段階2 で準備した色・構造上に、以下を乗せる

1. Sticky ListSubheader
   └─ スクロール時にタイトルが固定される

2. 未読バッジ
   └─ Chip コンポーネントで件数表示

3. お気に入い ピンアイコン
   └─ ListItemButton に Star icon

4. ショートカットキーのヘルプ表示
   └─ Tooltip: "Cmd+K で検索"
```

**段階2 が終わっている場合、段階3 は +3-4h で完了**

---

## ✅ リリース後の確認項目

- [ ] すべてのブラウザで色が正しく表示されている
- [ ] コントラスト比 WCAG AA 以上（accessibility check tool）
- [ ] ダークモード でも可読性がある
- [ ] モバイル（iPhone/Android）で崩れていない
- [ ] Print CSS に影響がない（印刷時も見やすい）
- [ ] ユーザーフィードバック: 「見やすくなった」

---

## 💡 段階2 の Next Actions

| 優先度 | タスク | 工数 |
|--------|--------|------|
| 🔴 高 | パターン1（セパレーター）を実装 | 1h |
| 🟡 中 | パターン2（カラー）を実装 | 2h |
| 🟢 低 | パターン3（バッジ）は計画フェーズに | TBD |

**推奨**: パターン1 + パターン2 をセットで実装（合計 3h）

---

**作成**: 2026-02-23  
**推奨選択**: パターン2（カラー版）  
**次のステップ**: 開発環境で試す
