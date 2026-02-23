# サイドメニュー クイックリファレンス

> **このドキュメント**: 開発者向けの簡潔なチートシート  
> **詳細はこちら**:
> - [SIDEMENU_ANALYSIS.md](SIDEMENU_ANALYSIS.md) — 完全な技術分析
> - [SIDEMENU_DIAGRAMS.md](SIDEMENU_DIAGRAMS.md) — アーキテクチャ図
> - [SIDEMENU_METRICS.md](SIDEMENU_METRICS.md) — メトリクス & 改善提案

---

## 🎯 概要（30秒版）

**役割**: React SPA の主要ナビゲーション UI  
**ファイル**: `src/app/AppShell.tsx` (1457 lines)  
**アーキテクチャ**:
- Desktop: 固定サイドバー（折りたたみ 64px↔240px）
- Mobile: ハンバーガーメニュー
- Footer: 5 クイックアクション

**グループ**: 6 分類（日次→記録→分析→マスタ→管理→設定）

---

## 🔧 よくやることリスト

### 1️⃣ ナビゲーション項目を追加

```typescript
// src/app/AppShell.tsx L297-430

const items: NavItem[] = [
  // ... 既存項目

  {
    label: '新しいページ',
    to: '/new-page',
    isActive: (pathname) => pathname.startsWith('/new-page'),
    icon: IconComponent,        // MUI icon
    audience: NAV_AUDIENCE.all, // or 'staff' or 'admin'
    prefetchKey: PREFETCH_KEYS.newPage, // optional
    testId: TESTIDS.nav.newPage, // optional
  },
];
```

**チェックリスト**:
- [ ] `isActive()` で正確に判定
- [ ] `audience` で権限制御
- [ ] `icon` を指定（ユーザーにビジネス価値）
- [ ] テスト追加

---

### 2️⃣ グループ分類をカスタマイズ

```typescript
// src/app/AppShell.tsx L116-169

function pickGroup(item: NavItem, isAdmin: boolean): NavGroupKey {
  const { to, label, testId } = item;
  
  // 新規グループルール追加例
  if (to.startsWith('/my-feature')) {
    return 'record'; // または他のグループ
  }
  
  // ... 既存ルール
}
```

**グループキー**: `'daily' | 'record' | 'review' | 'master' | 'admin' | 'settings'`

---

### 3️⃣ フッター Quick Actions を変更

```typescript
// src/app/AppShell.tsx L1259-1290

const baseActions: FooterAction[] = [
  {
    key: 'daily-attendance',
    label: '通所管理',
    to: '/daily/attendance',
    color: 'info',
    variant: 'contained',
  },
  // ... 他のアクション
];
```

⚠️ **制限**: 最大 4-5 個まで（デザイン上）

---

### 4️⃣ フィーチャーフラグで条件付きにする

**方法 A**: 配列スプレッド

```typescript
// L378-386: schedules フラグの例

if (schedulesEnabled && !items.some(item => item.testId === TESTIDS.nav.schedules)) {
  items.push({
    label: 'スケジュール',
    to: '/schedules/week',
    // ...
  });
}
```

**方法 B**: 三項演算子

```typescript
// L391-395: staffAttendance フラグの例

...(staffAttendanceEnabled ? [
  {
    label: '職員勤怠',
    to: '/staff/attendance',
    // ...
  },
] : []),
```

---

### 5️⃣ アクティブ状態のスタイルをカスタマイズ

```typescript
// src/app/AppShell.tsx L639-642

sx: {
  ...(isBlackNote && active ? {
    borderLeft: 4,
    borderColor: 'primary.main',
    fontWeight: 700,
  } : {}),
  // ... 他のスタイル
}
```

---

## 🔐 権限制御（RBAC）

### Audience プロップの値

| 値 | 表示対象 | 例 |
|----|---------|-----|
| `'all'` | 全員 | 日次記録、健康記録 |
| `'staff'` | 職員以上 | 黒ノート、月次記録 |
| `'admin'` | 管理者のみ | 自己点検、監査ログ |

### ロール判定ロジック

```typescript
// L222-227

const currentRole = useAuthStore((s) => s.currentUserRole);
const isAdmin = canAccess(role, 'admin'); // true if 'admin' role
const navAudience = isAdmin ? 'admin' : 'staff';

// ⚠️ 重要: 認証完了まで admin アイテムは追加されない
...(isAdmin && (authzReady || SKIP_LOGIN) ? [
  // admin メニューここ
] : [])
```

---

## 🧪 テスト書きのコツ

### セットアップ（Navigation テストの前提）

```typescript
// tests/unit/AppShell.nav.spec.tsx

// Desktop view を確定
vi.mock('@mui/material/useMediaQuery', () => ({
  default: () => true,
}));

// Feature flags を設定
const defaultFlags: FeatureFlagSnapshot = {
  schedules: true,
  complianceForm: false,
  icebergPdca: false,
  staffAttendance: false,
};

// Auth を mock
vi.mock('@/auth/useUserAuthz', () => ({
  useUserAuthz: () => ({
    role: 'viewer',  // staff | admin
    ready: true,     // false でアイテム遅延
  }),
}));
```

### テストケース例

```typescript
it('shows schedules item when flag enabled', () => {
  const flags = { ...defaultFlags, schedules: true };
  
  render(<AppShell>content</AppShell>, { flags });
  
  const links = screen.getAllByRole('link');
  const hasSchedules = links.some(
    link => link.getAttribute('href')?.includes('/schedules')
  );
  expect(hasSchedules).toBe(true);
});

it('hides admin items for non-admin users', () => {
  // auth: role='staff' (default)
  render(<AppShell>content</AppShell>);
  
  const links = screen.getAllByRole('link');
  const hasAudit = links.some(
    link => link.getAttribute('href')?.includes('/audit')
  );
  expect(hasAudit).toBe(false);
});
```

---

## ⌨️ キーボードショートカット

| キー | 動作 | 対象 |
|------|------|------|
| `Escape` | 検索クリア | Search field フォーカス時 |
| `Enter` | 最初のマッチへ移動 | Search field フォーカス時 |
| `Alt+P` | NavShell HUD 表示 | App wide (dev mode) |

---

## 🎨 스타일링ポイント

### 折りたたみ状態の操作

```typescript
// Collapsed: 64px (アイコンのみ)
const drawerMiniWidth = 64;
const drawerWidth = 240;  // Expanded

// Toggle button
<IconButton onClick={() => setNavCollapsed(!navCollapsed)}>
  {navCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
</IconButton>

// ラベル表示を制御
const showLabel = !navCollapsed;
{showLabel && <ListItemText primary={label} />}

// Tooltip (collapsed 時のみ)
{navCollapsed ? (
  <Tooltip title={label} placement="right">
    <Box>{button}</Box>
  </Tooltip>
) : button}
```

### アクティブ項目の視覚化

```typescript
// ListItemButton の selected prop
<ListItemButton
  selected={active}  // bgcolor 自動適用
  aria-current={active ? 'page' : undefined}
  // 黒ノート特別扱い
  sx={{
    ...(isBlackNote && active ? {
      borderLeft: 4,
      borderColor: 'primary.main',
      fontWeight: 700,
    } : {}),
  }}
/>
```

### Footer アクション の Active 表示

```typescript
// L1308-1324

const isActive = location.pathname.startsWith(targetPath);
const accent = footerAccentByKey[key]; // '#C53030', '#2F855A', etc.

const activeSx = isActive
  ? {  
      color: accent,
      borderBottom: `3px solid ${accent}`, // ← 下線で表示
      fontWeight: 700,
    }
  : undefined;
```

---

## 🐛 よくあるトラブル

### 🚨 Issue: 新規項目が表示されない

**原因チェックリスト**:
1. [ ] `items` 配列に追加されたか？
2. [ ] フィーチャーフラグ条件を満たしているか？
3. [ ] `isNavVisible(item)` で `audience` がマッチするか？
4. [ ] 権限ロールが正しいか？（admin vs staff）
5. [ ] ページを full reload したか？ (HMR で反映されないことがある)

**デバッグ方法**:
```typescript
console.log('navItems:', filteredNavItems);
console.log('grouped:', groupedNavItems);
console.log('role:', currentRole, 'isAdmin:', isAdmin);
```

---

### 🚨 Issue: テスト失敗「aria-current が付与されていない」

**原因**: `currentPathname` と `isActive()` のマッチングミス

**解決**:
```typescript
const active = isActive(currentPathname); // 呼び出し
// 期待: pathname === '/target' or pathname.startsWith('/target')
// 実際: isActive 実装を確認
```

---

### 🚨 Issue: モバイルで Drawer が閉じない

**原因**: `handleMobileNavigate` の呼び出しが抜けている

**修正**:
```typescript
// L1024: renderGroupedNavList(handleMobileNavigate) を渡す

const handleMobileNavigate = useCallback(() => {
  setMobileOpen(false);  // ← これが重要
  setNavQuery('');
}, []);

{renderGroupedNavList(handleMobileNavigate)} // ← 渡す
```

---

### 🚨 Issue: 無限ループ / 過度なレンダリング

**原因**: Object を deps に直接指定

**修正前**:
```typescript
const { schedules, complianceForm } = useFeatureFlags();
useMemo(() => { ... }, [schedules, complianceForm]);
// ❌ Object の参照が毎回変わる
```

**修正後**:
```typescript
const schedulesEnabled = Boolean(schedules);
const complianceFormEnabled = Boolean(complianceForm);
useMemo(() => { ... }, [schedulesEnabled, complianceFormEnabled]);
// ✅ boolean は stable
```

---

## 📋 チェックリスト

### PR を作成する前に

- [ ] 新規 item: `label`, `to`, `isActive()` すべて定義
- [ ] テストケース追加 (`AppShell.nav.spec.tsx`)
- [ ] スナップショット更新が必要？ (`npm test -- -u`)
- [ ] ARIA label: 検索フィールド、トグルボタン
- [ ] Responsive: Mobile でも動作確認
- [ ] アクセシビリティ: 黒背景 + 白文字で読めるか

### リリース前に

- [ ] Feature flag が本番切り替え対応済み
- [ ] ユーザー権限ロジックが正しい
- [ ] パフォーマンス: Console でログが多くないか
- [ ] E2E テスト: Fire flow が成功
- [ ] Navigation audit ドキュメント更新

---

## 📞 サポート & 参考

| リソース | 用途 |
|---------|------|
| [SIDEMENU_ANALYSIS.md](SIDEMENU_ANALYSIS.md) | 詳細な技術分析（アーキテクチャ、実装詳細） |
| [SIDEMENU_DIAGRAMS.md](SIDEMENU_DIAGRAMS.md) | ビジュアル図（フロー、構造） |
| [SIDEMENU_METRICS.md](SIDEMENU_METRICS.md) | メトリクス、改善提案、ロードマップ |
| [docs/navigation-audit.md](docs/navigation-audit.md) | ナビゲーション監査（ルート分類） |
| [src/app/AppShell.tsx](src/app/AppShell.tsx) | 実装コード |
| [tests/unit/AppShell.nav.spec.tsx](tests/unit/AppShell.nav.spec.tsx) | テストコード |

---

## 💡 Tips

### 検索のテスト

```bash
# ナビゲーション検索フィールドをテスト
1. 検索フィールドに "日次" と入力
2. 結果が日次グループのみになることを確認
3. Escape で検索クリア
4. Enter で最初のマッチに移動
```

### パフォーマンス計測

```typescript
// Chrome DevTools → Performance パネル
// Sidebar toggle → filter → group = ~5ms が目安
console.time('navFilter');
// ... フィルタ処理
console.timeEnd('navFilter');
```

### Responsive デバッグ

```bash
# Chrome DevTools → Device Emulation
# Toggle between:
# - Desktop (1920x1080) → sidebar visible
# - Tablet (768x1024) → drawer visible
# - Mobile (375x667) → drawer visible

# Custom breakpoint at MUI md (960px)
```

---

## 🎓 用語集

| 用語 | 説明 |
|------|------|
| **NavItem** | ナビゲーション項目の型 |
| **isActive** | 現在のパスと項目がマッチするか判定 |
| **audience** | 表示対象ロール（all/staff/admin） |
| **pickGroup** | NavItem をグループ分類する関数 |
| **prefetchKey** | コード分割リソースの先読みキー |
| **navCollapsed** | デスクトップサイドバー折りたたみ状態 |
| **Footer Quick Actions** | 画面下部の固定アクションボタン |

---

**最終更新**: 2026-02-23  
**作成者**: AI Assistant  
**バージョン**: 1.0 (Quick Reference)
