# サイドメニュー現状分析

> 更新日: 2026-02-23  
> 対象ファイル: `src/app/AppShell.tsx`  
> 関連ドキュメント: `docs/navigation-audit.md`

## 📋 概要

本リポジトリのサイドメニューは、福祉運営向けのReact SPA(Single Page Application)における主要なナビゲーションUIです。デスクトップ/タブレット表示時に常時表示される固定ドロワーと、モバイル表示時にハンバーガーメニューから開くドロワーの二層構造で実装されています。

---

## 🏗️ アーキテクチャ概要

### コンポーネント構成

```
AppShell (src/app/AppShell.tsx)
├── HeaderBar（AppBar）
│   ├── Menu トグルボタン
│   ├── タイトル表示
│   ├── 検索フィールド
│   └── ユーザーメニュー
├── Sidebar（デスクトップ用固定ドロワー）
│   ├── ナビゲーション検索フィールド
│   ├── グループ化されたナビゲーションリスト
│   └── 折りたたみトグル
├── MobileDrawer（モバイル/タブレット用）
│   ├── ナビゲーション検索フィールド
│   └── グループ化されたナビゲーションリスト
└── Footer（FixedActions）
    └── クイックアクション ボタン群
```

### 関連レイアウトコンポーネント

- **AppShellLayout**: トラディショナル版（旧レイアウト）
- **AppShellV2**: 最新版（現在の推奨）
- **ActivityBar**: VS Code風アクティビティバー（有効時）

---

## 🗂️ サイドメニューの構成

### グループ分類ポリシー（2026-02版）

サイドメニューは**6つのグループ**に自動分類されます。グループ順序は以下の通り：

| 順位 | グループ | Emoji | 含まれるナビゲーション |
|------|---------|--------|----------------------|
| 1️⃣  | **日次** | 🗓 | 日次記録、健康記録、申し送り、司会ガイド、朝会/夕会、議事録 |
| 2️⃣  | **記録・運用** | 🗂 | 黒ノート、月次記録、スケジュール |
| 3️⃣  | **振り返り・分析** | 📊 | 分析ダッシュボード、氷山分析、氷山PDCA、アセスメント、特性アンケート |
| 4️⃣  | **マスタ** | 👥 | 利用者、職員 |
| 5️⃣  | **管理** | 🛡 | 支援手順マスタ、個別支援手順、職員勤怠管理、自己点検、監査ログ |
| 6️⃣  | **設定** | ⚙️ | 表示設定など |

**グループ分類ロジック**: `pickGroup()` 関数（L116-169）で以下の優先順で判定：

1. ルートパス (`to` プロパティ) からのマッチング
2. ラベルテキストからのキーワード検索
3. `testId` からのマッチング
4. デフォルトは「記録・運用」グループ

### ナビゲーション項目一覧

#### 🗓 日次グループ（L300-340）

| ラベル | ルート | アイコン | 対象 | 備考 |
|--------|--------|---------|------|------|
| 日次記録 | `/dailysupport` | 📋 | 全員 | `/daily/*` 配下も同じグループとして扱い |
| 健康記録 | `/daily/health` | ✏️ | 全員 | - |
| 申し送りタイムライン | `/handoff-timeline` | 🕐 | 全員 | - |
| 司会ガイド | `/meeting-guide` | 🧠 | 全員 | - |
| 朝会（作成） | `/meeting-minutes/new?category=朝会` | ➕ | 全員 | - |
| 夕会（作成） | `/meeting-minutes/new?category=夕会` | ➕ | 全員 | - |
| 議事録アーカイブ | `/meeting-minutes` | ✏️ | 全員 | - |

#### 🗂 記録・運用グループ（L341-358）

| ラベル | ルート | アイコン | 対象ロール | フラグ | 備考 |
|--------|--------|---------|-----------|--------|------|
| 黒ノート一覧 | `/records` | 📋 | 職員以上 | - | PR #412で追加 |
| 月次記録 | `/records/monthly` | 📊 | 職員以上 | - | PR #412で追加 |
| スケジュール | `/schedules/week` | 📅 | 職員以上 | `schedules:true` | 条件付き追加（L378-386） |

#### 📊 振り返り・分析グループ（L359-375）

| ラベル | ルート | アイコン | 対象 | フラグ | 備考 |
|--------|--------|---------|------|--------|------|
| 分析 | `/analysis/dashboard` | 📈 | 職員以上 | - | - |
| 氷山分析 | `/analysis/iceberg` | 🔲 | 職員以上 | - | - |
| アセスメント | `/assessment` | 🧠 | 職員以上 | - | - |
| 特性アンケート | `/survey/tokusei` | ✏️ | 職員以上 | - | - |
| 氷山PDCA | `/analysis/iceberg-pdca` | 🕐 | 職員以上 | `icebergPdca:true` | 条件付き追加（L371-378） |

#### 👥 マスタグループ（L376-390）

| ラベル | ルート | アイコン | 対象 | 備考 |
|--------|--------|---------|------|------|
| 利用者 | `/users` | 👥 | 職員以上 | - |
| 職員 | `/staff` | 🏷️ | 職員以上 | `/staff/attendance` を除外 |
| 職員勤怠 | `/staff/attendance` | 🏷️ | 職員以上 | 条件付き（`staffAttendance:true`） |

#### 🛡 管理グループ（L391-415）

管理ロール限定。**トランザクション管理のため、auth が ready になるか SKIP_LOGIN モードまで追加されない**（L399）

| ラベル | ルート | アイコン | 対象 | 権限 |
|--------|--------|---------|------|------|
| 支援手順マスタ | `/admin/step-templates` | ✅ | 管理者 | Admin |
| 個別支援手順 | `/admin/individual-support` | 🔲 | 管理者 | Admin |
| 職員勤怠管理 | `/admin/staff-attendance` | 🏷️ | 管理者 | Admin |
| 自己点検 | `/checklist` | ✅ | 管理者 | Admin |
| 監査ログ | `/audit` | 📊 | 管理者 | Admin |
| 支援活動マスタ | `/admin/templates` | ⚙️ | 管理者 | Admin |

---

## 📱 レスポンシブ動作

### 表示モード判定

```typescript
const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
```

- **Desktop (`md` 以上)**: 固定サイドバー常時表示 + 折りたたみ機能
- **Tablet & Mobile (`md` 未満)**: ハンバーガーメニューで Drawer 表示

### デスクトップ向け折りたたみ機能

```typescript
const currentDrawerWidth = navCollapsed ? drawerMiniWidth : drawerWidth;
// drawerWidth = 240px
// drawerMiniWidth = 64px (アイコンのみ表示)
```

- **折りたたみ時**: ラベルが隠れ、アイコンのみ表示
- **ホバー時**: アイコンの上に Tooltip でラベル表示
- **トグルボタン**: 左下の Chevron（`<` / `>` アイコン）で切り替え

### モバイル向け動作

- **ナビゲーション検索**: TextFieldで検索可能
- **自動クローズ**: 項目選択時に Drawer が自動的に閉じる
- **トップセーフエリア**: `pb: calc(1px * (var(--mobile-safe-area, 0)) + 0.5rem)` で iPhone ノッチ対応

---

## 🔍 ナビゲーション検索機能

### 実装内容（L519-531）

```typescript
const filteredNavItems = useMemo(() => {
  const q = navQuery.trim().toLowerCase();
  if (!q) return navItems;
  return navItems.filter((item) => (item.label ?? '').toLowerCase().includes(q));
}, [navItems, navQuery]);
```

**特徴**:
- インクリメンタルサーチ（リアルタイム検索）
- ラベルテキストのみ対象（URLは検索対象外）
- 大文字小文字の区別なし
- `Escape` キーで検索クリア
- `Enter` キーで最初のマッチ項目に移動

### キーボードショートカット

```typescript
const handleNavSearchKeyDown = (event, onNavigate?) => {
  if (event.key === 'Escape') setNavQuery('');
  if (event.key === 'Enter') navigate(first.to);
};
```

---

## 🚩 フィーチャーフラグ関連

### 条件付きナビゲーション項目

以下の項目はフィーチャーフラグが `true` の場合のみ表示されます：

| 項目 | フラグ | 条件式 | 備考 |
|------|--------|--------|------|
| スケジュール | `schedules` | L378 | 最後に追加 |
| 氷山PDCA | `icebergPdca` | L371-378 | `splice(3, 0, ...)` で分析グループ内に挿入 |
| 職員勤怠 | `staffAttendance` | L391-395 | 対象ユーザー向け show |
| コンプラ報告 | `complianceForm` | L418-424 | - |

### フラグ読み込み（L242-248）

```typescript
const { schedules, complianceForm, icebergPdca, staffAttendance, appShellVsCode } = useFeatureFlags();

// 無限ループ防止: Object を deps に入れず boolean フラグを作成
const schedulesEnabled = Boolean(schedules);
const complianceFormEnabled = Boolean(complianceForm);
const icebergPdcaEnabled = Boolean(icebergPdca);
const staffAttendanceEnabled = Boolean(staffAttendance);
```

**重要**: 2026-02版の修正では、フィーチャーフラグオブジェクトを直接 `useMemo` に渡さず、boolean フラグに変換して多重レンダリングを防止しています。

---

## 🎨 スタイリング

### サイドバーコンテナ（L813-828）

```typescript
sx={{ 
  overflowY: 'auto', 
  height: '100%', 
  pt: 2, 
  pb: 10  // フッター高さ対策
}}
```

### グループヘッダー（L651-660）

```typescript
ListSubheader: {
  bgcolor: 'background.paper',
  borderBottom: 1,
  borderColor: 'divider',
  fontWeight: 700,
  fontSize: '0.75rem',
  color: 'text.secondary',
}
```

### アクティブ状態

```typescript
// 黒ノート特別スタイリング
...(isBlackNote && active ? {
  borderLeft: 4,
  borderColor: 'primary.main',
  fontWeight: 700,
} : {})
```

---

## ⚙️ アクティブ状態判定

### `isActive()` コールバック

各ナビゲーション項目は `isActive()` 関数を持ち、現在のパスが該当項目かを判定します：

```typescript
type NavItem = {
  label: string;
  to: string;
  isActive: (pathname: string) => boolean;  // ← ここで判定
  // ... 他のプロパティ
};
```

**実装例**:

```typescript
{
  label: '日次記録',
  to: '/dailysupport',
  isActive: (pathname) => 
    pathname === '/dailysupport' || pathname.startsWith('/daily/'),
  // ...
}
```

### アクティブ項目の視覚的表現

1. **選択状態**: `ListItemButton` に `selected={active}` プロップを設定
2. **ARIA**: `aria-current="page"` を付与（スクリーンリーダー対応）

---

## 🦿 Footer Quick Actions

### 機能概要（L1205-1350）

固定フッター（画面下部）に表示される短距離ナビゲーション。タッチ操作が多い野外スタッフ向けに最適化。

### 現在のクイックアクション（L1259-1290）

```typescript
const footerActions: FooterAction[] = [
  {
    key: 'handoff-quicknote',          // 申し送り（新規作成）
    label: '今すぐ申し送り',
    onClick: handleQuickNoteClick,
  },
  {
    key: 'schedules-month',            // スケジュール月表示
    to: '/schedules/month',
  },
  {
    key: 'daily-attendance',           // 通所管理
    to: '/daily/attendance',
  },
  {
    key: 'daily-activity',             // ケース記録入力
    to: '/daily/table',
  },
  {
    key: 'daily-support',              // 支援手順記録入力
    to: '/daily/support',
  },
];
```

**ポリシー**: 
- 最大 4 つの操作に制限（ガイドラインに準拠）
- 高頻度デイリータスクのみ
- 安全な操作優先（編集限定/管理者限定は避ける）

### UI/UXディテール

#### アクティブインジケーター（L1308-1324）

```typescript
const activeSx = isActive
  ? {
      color: footerAccentByKey[key],    // 色分け（赤/茶/緑など）
      borderBottom: `3px solid ${accent}`,
      fontWeight: 700,
      '&:hover': {
        backgroundColor: theme.palette.action.hover,
      },
    }
  : undefined;
```

#### 短縮ラベル（L1249-1256）

```typescript
const footerShortLabelByKey = {
  'handoff-quicknote': '申し送り',
  'schedules-month': '予定',
  'daily-attendance': '通所',
  'daily-activity': 'ケース記録',
  'daily-support': '支援手順',
};
```

**背景**: フッター幅の制約でラベルを短い表現に統一

#### スクロール対応（L1279-1286）

```typescript
Stack: {
  overflowX: 'auto',
  overflowY: 'hidden',
  WebkitOverflowScrolling: 'touch',    // iOS スムーススクロール
  scrollbarWidth: 'thin',
}
```

**備考**: アクション数が増えた場合は横スクロール可能

### 申し送り Quick Note Dialog（L1338-1350）

Handoff Timeline ページ以外で「今すぐ申し送り」ボタンをクリック時に、モーダルダイアログで `HandoffQuickNoteCard` を表示。

```typescript
const handleQuickNoteClick = () => {
  if (isHandoffTimeline) {
    // Timeline ページ内なら custom event dispatch
    window.dispatchEvent(new CustomEvent('handoff-open-quicknote'));
    return;
  }
  // 通常はダイアログで表示
  setQuickNoteOpen(true);
};
```

---

## 🔐 権限・ロール管理

### ロール分類（L88-91）

```typescript
type NavAudience = 'all' | 'staff' | 'admin';

const NAV_AUDIENCE = {
  all: 'all',      // 全員表示
  staff: 'staff',  // 職員以上表示
  admin: 'admin',  // 管理者限定
};
```

### ロール判定ロジック（L222-227）

```typescript
const isAdmin = canAccess(role, 'admin');
const navAudience: NavAudience = isAdmin ? 
  NAV_AUDIENCE.admin : 
  NAV_AUDIENCE.staff;
```

### ナビゲーション可視化ルール（L428-435）

```typescript
const isNavVisible = (item: NavItem): boolean => {
  const audience = item.audience ?? 'all';
  if (audience === 'all') return true;
  if (audience === 'admin') return navAudience === 'admin';
  return navAudience === 'admin' || navAudience === 'staff';
};
```

### 認証準備待ち（L399）

管理者メニューは **auth が ready になるか SKIP_LOGIN モード** まで追加されません：

```typescript
...(isAdmin && (authzReady || SKIP_LOGIN) ? [
  // 管理メニューアイテム
] : [])
```

---

## 🎯 Prefetch統合

連携ナビゲーション項目に対してコード分割資源の先読み（prefetch）を実装：

```typescript
type NavItem = {
  prefetchKey?: PrefetchKey;      // 単一リソース
  prefetchKeys?: PrefetchKey[];   // 複数リソース
};
```

**使用例**:

```typescript
{
  label: 'スケジュール',
  to: '/schedules/week',
  prefetchKey: PREFETCH_KEYS.schedulesWeek,
  prefetchKeys: [PREFETCH_KEYS.muiForms, PREFETCH_KEYS.muiOverlay],
}
```

**実装部**:

```typescript
<NavLinkPrefetch
  to={to}
  preloadKey={prefetchKey}
  preloadKeys={prefetchKeys}
  meta={{ label }}
>
  {content}
</NavLinkPrefetch>
```

---

## ♿ アクセシビリティ

### ARIA 属性設定

```typescript
// ナビゲーション全体
<Box role="navigation" aria-label="主要ナビゲーション">

// アクティブ項目
<ListItemButton aria-current="page">

// トグルボタン
<IconButton 
  aria-label="ナビを展開"
  aria-expanded={!navCollapsed}
>

// メニュー検索
<TextField inputProps={{ 'aria-label': 'メニュー検索' }} />
```

### スクリーンリーダー対応

- グループヘッダー: `ListSubheader` で意味的グループ化
- 「該当なし」メッセージ: 検索結果ゼロ時に表示
- Tooltip: 折りたたみ時にラベルを読み上げ対応

---

## 🐛 既知の問題と改善点

### 1. アクティブ状態の同期遅延（テスト済み）

**状態**: ✅ 修正済み（PR #412）

- **問題**: ページ遷移時に aria-current が即座に更新されないことがあった
- **原因**: `location.pathname` の参照が不安定だった
- **解決**: `const currentPathname = location.pathname` で参照を確定（L614）

### 2. フィーチャーフラグ多重レンダリング

**状態**: ✅ 修正済み（2026-02版）

- **問題**: フィーチャーフラグオブジェクトを直接 deps に入れると無限ループ
- **解決**: boolean フラグへの変換（L242-248）

```typescript
// ❌ 旧: 無限ループ
useMemo(() => { ... }, [schedules, complianceForm, ...])

// ✅ 新: 安定化
const schedulesEnabled = Boolean(schedules);
useMemo(() => { ... }, [schedulesEnabled, ...])
```

### 3. Context-only ルートの親ナビゲーション未確認

**状態**: ⚠️ 要確認

以下のルートは Side Menu に含めず、親ナビゲーションからのみアクセス可能にすることが想定されていますが、**親ナビゲーションの実装が確認されていません**：

```
- /daily/activity — 日次アクティビティ詳細
- /daily/support-checklist — 支援チェックリスト
- /schedules/day — スケジュール日表示
- /schedules/month — スケジュール月表示 ← 実は Footer に含まれている
```

**推奨アクション**: 各ルートの親リンクポイントを検証し、ドキュメント化する

### 4. "黒ノート" UI の特別扱い

**状態**: ✅ 実装済み

黒ノートが active の場合、左ボーダーを付与：

```typescript
...(isBlackNote && active ? {
  borderLeft: 4,
  borderColor: 'primary.main',
  fontWeight: 700,
} : {})
```

**理由**: UI/UX が特殊なため目立たせる必要がある

---

## 📚 ナビゲーション監査ドキュメント

`docs/navigation-audit.md` にて以下を記録：

### ✅ 実装済み（PR #412）

7つの必要不可欠な Side Menu エントリを追加：

- `/records` —黒ノート一覧
- `/records/monthly` — 月次記録
- `/handoff-timeline` — 申し送りタイムライン（※ここに記載ないが Footer に含まれている）
- `/meeting-guide` — 司会ガイド
- `/admin/step-templates` — 支援手順マスタ
- `/admin/individual-support` — 個別支援手順
- `/admin/staff-attendance` — 職員勤怠管理

**変更理由**: URL-only アクセスは運用上の脆弱性（知識の部分最適化、動作不可知性）

### 📌 未実装・保留中

1. **PR #411 (Draft)**: 
   - レイアウト安定化 + 目に優しいテーマ変更
   - 但し CI 全体の失敗があり保留中
   - 小さな PR に分割することが推奨

2. **Context-only ルート検証**:
   - `/daily/time-based` の親リンク確認
   - `/daily/activity` の到達経路確認

3. **Footer Quick Actions ポリシー決定**:
   - `/daily/health` を組み込むか検討
   - `/nurse/observation` の候補追加？

---

## 🔧 ホットスポット（頻出編集箇所）

### ナビゲーション項目の追加

```typescript
const items: NavItem[] = [
  // ... 既存
  {
    label: '新規ナビゲーション',
    to: '/new-route',
    isActive: (pathname) => pathname.startsWith('/new-route'),
    icon: IconComponent,
    audience: NAV_AUDIENCE.staff,  // or 'all' or 'admin'
    prefetchKey: PREFETCH_KEYS.newRoute,
  },
];
```

**重要**: 新規追加時に以下を確認
1. `audience` プロップで権限制御
2. `isActive()` ロジックが完全か
3. グループ分類が `pickGroup()` で正しく判定されるか
4. テストの更新 (`tests/unit/AppShell.nav.spec.tsx`)

### グループ分類ルールの変更

```typescript
// L116-169 の pickGroup() 関数を修正
// 新しい分類ルールを追加
if (to.startsWith('/new-category')) {
  return 'appropriate-group';
}
```

### フッアクション（Footer）の変更

```typescript
// L1259-1290 の footerActions 配列を編集
const baseActions: FooterAction[] = [
  // 最大 3-4 個に制限
];
```

---

## 📊 パフォーマンス最適化

### useMemo の活用

```typescript
// L297-430: navItems の構築を memoize
const navItems = useMemo(() => { ... }, [dashboardPath, ...]);

// L501-505: フィルタ結果を memoize
const filteredNavItems = useMemo(() => { ... }, [navItems, navQuery]);

// L533-549: グループ化済みナビゲーションをmemoize
const groupedNavItems = useMemo(() => { ... }, [filteredNavItems, isAdmin]);
```

### useCallback の活用

```typescript
// L593: ナビゲーション検索キーボン処理
const handleNavSearchKeyDown = useCallback((event, onNavigate?) => { ... }, [navigate]);

// L618: ナビゲーション項目レンダリング
const renderNavItem = useCallback((item, onNavigate?) => { ... }, [currentPathname, isAdmin, navCollapsed]);
```

---

## 🧪 テスト対象

`tests/unit/AppShell.nav.spec.tsx`:

1. **アクティブ状態**: aria-current="page" が正しく付与されるか
2. **フィーチャーフラグ**: 条件付きアイテムが表示/非表示されるか
3. **SharePoint 接続状態**: 接続状態の ping 状態遷移

---

## 📋 まとめ

### 強み ✅

1. **グループ化**: 6 つのグループで直感的な分類
2. **検索機能**: インクリメンタルサーチで素早いアクセス
3. **レスポンシブ**: Desktop, Tablet, Mobile で最適化
4. **アクセシビリティ**: ARIA 対応、Tooltip、キーボード操作
5. **権限制御**: ロール別にメニュー自動フィルタリング
6. **フィーチャーフラグ**: 条件付きナビゲーション対応
7. **Prefetch 統合**: パフォーマンス最適化の準備完備

### 課題・改善余地 ⚠️

1. **Context-only ルート の parent navigation 検証不足**
2. **PR #411 の保留**: レイアウト/テーマ改善が未実施
3. **Footer Quick Actions ポリシー**: 最終決定待ち

---

## 🎓 参考資料

- **監査ドキュメント**: [docs/navigation-audit.md](docs/navigation-audit.md)
- **主要ファイル**: [src/app/AppShell.tsx](src/app/AppShell.tsx)
- **テスト**: [tests/unit/AppShell.nav.spec.tsx](tests/unit/AppShell.nav.spec.tsx)
- **レイアウトコンポーネント**: 
  - [src/app/layout/AppShell.tsx](src/app/layout/AppShell.tsx)
  - [src/components/layout/AppShellV2.tsx](src/components/layout/AppShellV2.tsx)

---

**作成者**: AI Assistant  
**最終確認日**: 2026-02-23  
**バージョン**: 1.0
