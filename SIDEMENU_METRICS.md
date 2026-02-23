# サイドメニュー 主要指標 & 改善提案

> **最終更新**: 2026-02-23  
> **対象**: `src/app/AppShell.tsx` (1457 lines)

---

## 📊 コードメトリクス

### ファイルサイズと複雑度

| 指標 | 値 | ステータス | 備考 |
|------|-----|----------|------|
| **ファイル総行数** | 1457 行 | ⚠️ 中程度 | 単一ファイルが大きい |
| **navItems 配列** | ~35 項目 | ✅ 管理可能 | 条件付き項目を含む |
| **グループ数** | 6 分類 | ✅ 適切 | 直感的な分類 |
| **useMemo 使用** | 4 箇所 | ✅ 良好 | パフォーマンス最適化対応 |
| **useCallback 使用** | 3 箇所 | ✅ 良好 | 再レンダリング抑制 |
| **条件付きレンダリング** | 8 パターン | ⚠️ 複雑 | フィーチャーフラグ + ロール + パス |
| **テストケース** | 3 + TODO | ⚠️ 不十分 | 拡張テストが必要 |

### 関数チェーン深度

```
renderGroupedNavList()
├─ for each groupKey in ['daily', 'record', 'review', 'master', 'admin', 'settings']
│  ├─ map(renderNavItem for each item)
│  │  ├─ ListItemButton (+ Tooltip if collapsed)
│  │  ├─ conditional: NavLinkPrefetch vs RouterLink
│  │  └─ conditional: icon & label display
│  └─ Divider (if not last group)
└─ fallback: "該当なし"
```

**複雑度**: 中程度（3 ネスト実装可能）

---

## 📈 パフォーマンス分析

### 初期レンダリング

```
1. AppShell mount
   ├─ useFeatureFlags() → 4 boolean flags
   ├─ useUserAuthz() → role check (network dependent)
   ├─ useMemo: navItems → O(flags * roles) 計算
   └─ useMediaQuery → layout decision
   
Total: ~50-200ms (network 遅延による)
```

### 検索時のフィルタリング

```
navQuery change
├─ setNavQuery(newQ)
├─ filteredNavItems useMemo
│  └─ O(n) filter 操作 (n = ~35)
├─ groupedNavItems useMemo
│  └─ O(n) grouping 操作
└─ Re-render: 影響受ける Box のみ

Cost: ~2-5ms (ユーザーに即座に感じられない)
```

### メモリ使用量

- **navItems**: ~35 item × ~200 bytes ≈ 7KB
- **navQuery state**: variable length (typically <50 chars) ≈ 50B
- **UI state**: 6 boolean flags ≈ 48 bits
- **全体**: 10-20KB (許容範囲内)

---

## 🔒 セキュリティ分析

### 認証ゲート（L242-255）

| ポイント | 実装 | 評価 |
|---------|------|------|
| **Admin 遅延追加** | `authzReady \|\| SKIP_LOGIN` | ✅ 安全 |
| **ロール確認** | `canAccess(role, 'admin')` | ✅ 安全 |
| **Audience フィルタ** | `isNavVisible(item)` | ✅ 安全 |
| **クライアント側チェック** | 唯一のゲート | ⚠️ 注意 |
| **サーバー側チェック** | ルータレベルで確認必須 | ✅ 前提 |

**リスク**: UI に表示されなくても URL 直接 アクセスで保護ルートに到達可能。**サーバー側のルート保護が必須**。

### XSS対策

| ポイント | 実装 | 評価 |
|---------|------|------|
| **navQuery 入力** | `TextField` (MUI) | ✅ サニタイズ |
| **ラベル表示** | JSX 自動エスケープ | ✅ 安全 |
| **URL プロパティ** | hardcoded 文字列 | ✅ 安全 |
| **Custom event** | `window.dispatchEvent` | ⚠️ 検証 |

---

## ⚙️ 設定・フラグ依存関係

### フィーチャーフラグマトリクス

```
┌──────────────────────────┬──────┬──────────┬────────────┐
│ Flag                     │ 型   │ 初期値   │ Sidebar 影響│
├──────────────────────────┼──────┼──────────┼────────────┤
│ schedules (L247)         │ bool │ true     │ +1 item    │
│ complianceForm (L247)    │ bool │ false    │ +1 item    │
│ icebergPdca (L247)       │ bool │ false    │ +1 item    │
│ staffAttendance (L248)   │ bool │ false    │ +1 item    │
│ appShellVsCode (L248)    │ bool │ false    │ Layout変更 │
└──────────────────────────┴──────┴──────────┴────────────┘
```

### フラグ相互作用

```
1. schedules:
   ├─ スケジュール項目を記録グループに追加
   ├─ Footer 「予定」ボタン表示
   └─ prefetch: [muiForms, muiOverlay] あり

2. icebergPdca:
   ├─ 氷山PDCA項目を分析グループに挿入 (index 3)
   ├─ 既存アイテムなし確認 (checkSome)
   └─ prefetch: icebergPdcaBoard

3. complianceForm:
   ├─ コンプラ報告項目を追加 (末尾)
   ├─ フィーチャー不完全時でも末尾推奨
   └─ prefetch なし

4. staffAttendance:
   ├─ 職員向けと管理者向けで異なるルート
   ├─ staff: /staff/attendance
   ├─ admin: /admin/staff-attendance
   └─ staff 版のみ条件付き表示
```

---

## 🎯 使用パターン分析

### 一般スタッフ（全員）

```
Expected Flow:
1. 朝: 司会ガイド → 朝会作成 → 健康記録
2. 日中: 日次記録 → 支援活動
3. 夕: 夕会作成 → 申し送り → 議事録アーカイブ
4. 毎日: コンテキストに応じ黒ノート/月次/分析

Footer Actions:
→ 申し送り（クイック）/ 通所 / ケース記録 / 支援手順

Expected Sidebar:
→ 🗓 日次 + 🗂 記録運用
→ 📊 振り返り分析（週 1-2 回）
```

### 管理者（Admin）

```
Expected Flow:
1. 初日: 自己点検 → 支援手順マスタ編集
2. 定期: 個別支援手順更新 → 監査ログ確認
3. 月次: 月次集計確認
4. 必要に応じ: 職員勤怠管理

Footer Actions:
→ 全体利用（スタッフ同様）

Expected Sidebar:
→ 🗓 日次 + 🗂 記録運用 + 🛡 管理
→ 管理グループは最後（誤選択低減）
```

---

## 🚀 最適化提案

### 1. ファイル分割（コード整理）

**現状**: 1457 行の monolithic ファイル

**提案**:

```
src/app/
├─ AppShell.tsx (エントリ、ただし 400行に削減)
├─ layout/
│  ├─ useNavigation.ts (hooks)
│  │  ├─ useNavItems() — navItems 構築
│  │  ├─ useGroupedNav() — グループ化ロジック
│  │  └─ useNavFiltering() — 検索フィルタ
│  │
│  ├─ components/
│  │  ├─ SidebarNav.tsx (デスクトップ専用)
│  │  ├─ MobileNav.tsx (モバイル専用)
│  │  ├─ NavGroup.tsx (グループレンダリング)
│  │  ├─ NavItem.tsx (単一項目)
│  │  └─ FooterQuickActions.tsx (既存: 独立化)
│  │
│  └─ config/
│     ├─ navAudience.ts (権限定義)
│     ├─ navGroups.ts (グループマッピング)
│     ├─ navItems.ts (アイテム定義)
│     └─ navPrefetch.ts (prefetch キー)
│
└─ (改善後) AppShell.tsx (200-300 行)
   └─ 依存関係: 上記 hooks/components/config
```

**メリット**:
- ✅ 各部分の責務が明確
- ✅ テストがしやすい（ユニットテスト可能）
- ✅ 保守性向上

**デメリット**:
- ⚠️ 小ファイル化による複雑化の可能性

**実装コスト**: 中程度（2-3 時間）

---

### 2. ナビゲーション設定の外部化

**現状**: navItems が useMemo 内で定義

**提案**:

```typescript
// src/app/layout/config/navItems.ts

export const createNavItems = (flags: FeatureFlagSnapshot, role: string): NavItem[] => {
  const items: NavItem[] = [
    // 共通項目 (must-have)
    DAILY_ITEMS,
    // 条件付き項目
    ...(flags.schedules ? SCHEDULES_ITEMS : []),
    ...(flags.icebergPdca && role !== 'viewer' ? ICEBERG_PDCA_ITEMS : []),
  ];
  return items;
};

export const NAV_GROUPS = {
  daily: { label: '🗓 日次', order: 1 },
  record: { label: '🗂 記録・運用', order: 2 },
  // ...
};

export const pickGroup = (item: NavItem, isAdmin: boolean): NavGroupKey => {
  // ロジックを関数化
};
```

**メリット**:
- ✅ 設定と ロジックが分離
- ✅ テスト容易（mock しやすい）
- ✅ SSR 対応しやすい

**実装コスト**: 小程度（1 時間）

---

### 3. Context API で状態共有

**現状**: AppShell で全状態管理 → children が参照不可

**提案**:

```typescript
// src/app/layout/NavContext.tsx

export interface NavContextValue {
  isCollapsed: boolean;
  setCollapsed: (v: boolean) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  navItems: NavItem[];
  // ...
}

export const NavContext = createContext<NavContextValue | null>(null);
export const useNav = () => useContext(NavContext);

// AppShell でプロバイド
<NavContext.Provider value={{...}}>
  {children}
</NavContext.Provider>
```

**ユースケース**:
- 深い階層のコンポーネントが navState 参照
- Search within feature pages

**メリット**:
- ✅ prop drilling 削減
- ✅ 部分的な nav state 共有

**実装コスト**: 中程度（1-2 時間）

---

### 4. Mobile/Desktop コンポーネント分離

**現状**: useMediaQuery で条件分岐

**提案**:

```typescript
// src/app/layout/components/SidebarNav.tsx (Desktop)
export const SidebarNav: React.FC<Props> = ({ ... }) => {
  return (
    <Box sx={{ /* desktop specific */ }}>
      {/* Permanent drawer content */}
    </Box>
  );
};

// src/app/layout/components/MobileNav.tsx (Mobile)
export const MobileNav: React.FC<Props> = ({ ... }) => {
  return (
    <Drawer variant="temporary" { ... }>
      {/* Mobile drawer content */}
    </Drawer>
  );
};

// AppShell で使い分け
{isDesktop ? <SidebarNav /> : <MobileNav />}
```

**メリット**:
- ✅ 各デバイス向け UI の単純化
- ✅ レスポンシブ複雑度削減

**実装コスト**: 小程度（1 時間）

---

### 5. テスト拡張

**現状**: 3 テストケース + 1 TODO

**提案**:

```typescript
describe('AppShell Navigation', () => {
  // 既存
  it('marks current route button with aria-current="page"', () => { });
  it('leaves status neutral when ping aborts', () => { });

  // 追加提案
  describe('Search & Filtering', () => {
    it('filters items by search query', () => { });
    it('navigates to first item on Enter key', () => { });
    it('clears search on Escape key', () => { });
  });

  describe('Feature Flags', () => {
    it('shows schedules when flag enabled', () => { });
    it('hides compliance when flag disabled', () => { });
    it('shows iceberg-pdca conditionally', () => { });
  });

  describe('Role-based Access', () => {
    it('shows admin items for admin role', () => { });
    it('hides admin items for staff role', () => { });
    it('delays admin items until auth ready', () => { });
  });

  describe('Responsive', () => {
    it('shows desktop sidebar on md+', () => { });
    it('shows mobile drawer on < md', () => { });
    it('auto-closes drawer on navigation', () => { });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => { });
    it('supports keyboard navigation', () => { });
    it('displays Tooltip on collapsed hover', () => { });
  });

  describe('Performance', () => {
    it('memoizes navItems correctly', () => { });
    it('does not re-render on unrelated state changes', () => { });
  });
});
```

**メリット**:
- ✅ 回帰テスト防止
- ✅ 保守性向上

**実装コスト**: 中程度（2-3 時間）

---

### 6. Storybook Integration

**提案**:

```typescript
// src/app/layout/components/__stories__/NavItem.stories.tsx

export default {
  title: 'Layout/Navigation/NavItem',
  component: NavItem,
};

export const Active = {
  args: {
    item: { label: '日次記録', ... },
    active: true,
    collapsed: false,
  },
};

export const Collapsed = {
  args: { ...Active.args, collapsed: true },
};

export const Disabled = {
  args: { ...Active.args, visible: false },
};

export const WithPrefetch = {
  args: { ...Active.args, prefetchKey: PREFETCH_KEYS.dailyMenu },
};
```

**メリット**:
- ✅ ビジュアルリグレッション防止
- ✅ 単体コンポーネント開発効率化

**実装コスト**: 小-中程度（1-2 時間）

---

## 🗂️ 優先度別実装ロードマップ

| 優先度 | 提案 | 難易度 | 時間 | 影響度 |
|--------|------|--------|------|--------|
| 🔴 **P0** | **テスト拡張** | 低 | 2-3h | 高 |
| 🔴 **P0** | **設定外部化** | 低 | 1h | 中 |
| 🟡 **P1** | **ファイル分割** | 中 | 2-3h | 中 |
| 🟡 **P1** | **Mobile/Desktop 分離** | 中 | 1h | 中 |
| 🟢 **P2** | **Context API 追加** | 中 | 1-2h | 低 |
| 🟢 **P2** | **Storybook** | 低 | 1-2h | 低 |

---

## 🐛 保留中の Issue 追跡

### Issue 1: Context-only ルート検証

**状態**: ⚠️ Open

**説明**: 
- `/daily/activity` — 親ナビゲーション未確認
- `/daily/support-checklist` — 親ナビゲーション未確認
- `/schedules/day` — 親ナビゲーション未確認

**アクション**:
1. 各ルートの実装確認
2. 親リンク先 コンポーネント特定
3. ドキュメント更新

**完了条件**: 各ルートに「親から到達可能」判定

---

### Issue 2: PR #411 CI失敗

**状態**: ⚠️ Parked

**説明**: レイアウト + テーマ変更 PR が CI 全体失敗

**原因**: Layout/Theme 関連の広範な変更

**推奨アクション**: 小さな PR に分割
- PR-A: Layout stabilization のみ
- PR-B: Theme (eye-friendly) のみ

**完了条件**: 両 PR が CI green

---

### Issue 3: Footer Quick Actions ポリシー

**状態**: ⚠️ Open

**説明**: 現在 5 アクション中で、スケジュール月表示が含まれている

**選択肢**:
1. `/daily/health` に swap
2. `/nurse/observation` に追加
3. 現状維持（5個）

**完了条件**: 運用チームと協議決定

---

## 📌 チェックリスト (DoD)

ナビゲーションの更新時には以下を確認:

- [ ] 新規 navItem に `isActive()`, `audience`, `icon` 指定
- [ ] グループ分類が `pickGroup()` で正しく判定される
- [ ] テストに新規テストケース追加
- [ ] アクセシビリティチェック (ARIA labels, keyboard nav)
- [ ] Responsive デバイス確認 (desktop, tablet, mobile)
- [ ] Prefetch キー確認（必要な場合）
- [ ] フィーチャーフラグ条件確認（ある場合）
- [ ] CI が green になったことを確認

---

## 📚 関連ドキュメント

1. [SIDEMENU_ANALYSIS.md](SIDEMENU_ANALYSIS.md) — 詳細分析
2. [SIDEMENU_DIAGRAMS.md](SIDEMENU_DIAGRAMS.md) — ビジュアル構成図
3. [docs/navigation-audit.md](docs/navigation-audit.md) — 監査レポート
4. [src/app/AppShell.tsx](src/app/AppShell.tsx) — 実装コード
5. [tests/unit/AppShell.nav.spec.tsx](tests/unit/AppShell.nav.spec.tsx) — テスト

---

**作成日**: 2026-02-23  
**更新日**: 2026-02-23  
**バージョン**: 1.0
