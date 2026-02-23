# メニュー最適化 実装ロードマップ

> **提案日**: 2026-02-23  
> **ステータス**: 設計フェーズ  
> **推奨開始時期**: 即時（段階1）

---

## 📊 現状 vs 提案の比較

### グループラベル再編案

| 段階 | 現行 | 推奨 | メリット | 優先度 |
|------|------|------|---------|--------|
| **段階1** | 🗓 日次 | 📌 今日の業務 | 日次性を強調、毎日用 | 🔴 高 |
| **段階1** | 🗂 記録・運用 | 📚 記録アーカイブ | 過去参照の明確化 | 🔴 高 |
| **段階1** | 📊 振り返り・分析 | 🔍 分析・改善 | アクション指向に | 🔴 高 |
| **段階2** | 👥 マスタ + 🛡 管理 | ⚙️ システム管理 | グループ統合で簡潔化 | 🟡 中 |
| **既存** | ⚙️ 設定 | ⚙️ 設定 | （変更なし） | 🟢 低 |

### ビジュアル構成の改善

```
【現行】
┌─────────────────────┐
│ 🗓 日次 (7 items)    │
├─ 日次記録
├─ 健康記録
├─ ...
├─────────────────────┤
│ 🗂 記録・運用 (3)    │
├─ 黒ノート
├─ ...
├─────────────────────┤
│ 📊 振り返り・分析 (4)│
├─ 分析
├─ ...

【提案】
┌─────────────────────┐
│ 📌 今日の業務 (7)    │ ← 強調
├─ 日次記録
├─ 申し送り
├─ ...
├──────────────────────┤ ← 視覚的セパレーター
│ 📚 記録アーカイブ (3) │
├─ 黒ノート
├─ ...
├──────────────────────┤
│ 🔍 分析・改善 (4)    │
├─ 分析
├─ ...
├──────────────────────┤ ← 強い分離
│ ⚙️ システム管理       │ ← 右寄せ or グレーアウト
├─ 設定
├─ ...
```

---

## 🚀 3段階実装ロードマップ

### **段階1: グループラベルと構造の再編（1-2日）**

**対象**: `src/app/config/navigationConfig.ts`  
**影響**: ラベル表示のみ、ロジック変更なし  
**リスク**: 🟢 低（UI の見た目変更のみ）  
**ROI**: 🔴 高（即座に UX 改善）

#### 1-1. グループラベルの変更

```typescript
// navigationConfig.ts L44-49

// 現행
export const groupLabel: Record<NavGroupKey, string> = {
  daily: '🗓 日次',
  record: '🗂 記録・運用',
  review: '📊 振り返り・分析',
  master: '👥 マスタ',
  admin: '🛡 管理',
  settings: '⚙️ 設定',
};

// 提案
export const groupLabel: Record<NavGroupKey, string> = {
  daily: '📌 今日の業務',
  record: '📚 記録アーカイブ',
  review: '🔍 分析・改善',
  master: '👥 マスタ',
  admin: '⚙️ システム管理',
  settings: '⚙️ 設定',
};

// または、より詳細表記
export const groupLabel: Record<NavGroupKey, string> = {
  daily: '📌 今日の業務',           // 「毎日触る一等辺」
  record: '📚 記録を参照',          // 「過去のログを見る」
  review: '🔍 分析して改善',       // 「データから学ぶ」
  master: '👥 利用者・職員',        // 「基本情報」
  admin: '⚙️ システム管理',         // 「権限者のみ」
  settings: '⚙️ 表示設定',          // 「UI カスタマイズ」
};
```

**実装時間**: 5 分  
**テスト**: `navigationConfig.spec.ts` の `groupLabel` アサーション更新のみ

#### 1-2. グループ統合の検討（オプション）

現行で `master`（マスタ）と `admin`（管理）が分かれていますが、**カテゴリー的には同じ「システム側」**なので統合する案：

```typescript
// 案A: グループキーを統合（非推奨 - ロジック変更が大きい）
export type NavGroupKey = 'daily' | 'record' | 'review' | 'system' | 'settings';

// 案B: グループ分けはそのままで、ビジュアル分離を明確にする（推奨）
export const groupLabel: Record<NavGroupKey, string> = {
  daily: '📌 今日の業務',
  record: '📚 記録を参照',
  review: '🔍 分析して改善',
  master: '👥 利用者・職員',      // 「基本マスタ」
  admin: '🔐 管理機能',            // 「権限者のみ」（明確に分離）
  settings: '⚙️ 表示設定',
};
```

**段階1での推奨**: **案B（ラベル変更のみ）** で十分。後で必要に応じて統合。

---

### **段階2: ビジュアルと UX 改善（3-5日）**

**対象**: `src/app/AppShell.tsx` + MUI styling  
**影響**: UI 表示、一部 React state  
**リスク**: 🟡 中（CSS/スタイル、ブラウザ互換性確認必要）  
**ROI**: 🟡 中（見た目と体験が劇的に改善）

#### 2-1. セパレーターの視覚的強化

```typescript
// AppShell.tsx L740 (renderGroupedNavList 内)

// 現行
{!navCollapsed && groupKey !== 'settings' && <Divider sx={{ mt: 1, mb: 0.5 }} />}

// 提案: グループごとに分離度を変える
{!navCollapsed && (
  <Divider sx={{
    mt: 1.5,
    mb: 1.5,
    // 「管理」グループの後は強調分離
    ...(groupKey === 'master' || groupKey === 'admin' ? {
      borderColor: 'divider',
      opacity: 0.8,
    } : {
      borderColor: 'divider',
      opacity: 0.5,
    }),
  }} />
)}
```

#### 2-2. グループタイトルのスタイル差別化

```typescript
// AppShell.tsx (ListSubheader styling)

// 現行
<ListSubheader sx={{
  bgcolor: 'background.paper',
  lineHeight: 1.6,
  py: 0.5,
  fontWeight: 700,
  fontSize: '0.75rem',
  color: 'text.secondary',
}} />

// 提案: グループごとに色分け
<ListSubheader sx={{
  bgcolor: 'background.paper',
  lineHeight: 1.6,
  py: 0.5,
  fontWeight: 700,
  fontSize: '0.75rem',
  color: groupKey === 'admin' ? 'error.main' : 'text.secondary', // admin は赤
  textTransform: groupKey === 'daily' ? 'uppercase' : undefined,   // daily は UPPERCASE
  letterSpacing: groupKey === 'daily' ? '0.05em' : 0,
}} />
```

**効果**: 管理者機能が「危険ゾーン」として視認できます。

#### 2-3. バッジ表示の準備（準備段階）

```typescript
// types/navigation.ts (新規または拡張)

export interface NavItemWithBadge extends NavItem {
  badge?: {
    count?: number;        // 未読件数など
    label?: string;        // 「要入力」など
    color?: 'error' | 'warning' | 'info' | 'success';
    variant?: 'dot' | 'standard';
  };
}

// 使用例: 申し送りタイムラインに未読件数を表示
{
  label: '申し送りタイムライン',
  to: '/handoff-timeline',
  isActive: (pathname) => pathname.startsWith('/handoff-timeline'),
  audience: NAV_AUDIENCE.all,
  badge: {
    count: unreadHandoffCount,  // 外部 state から取得
    color: 'error',
  },
}
```

---

### **段階3: 高度な機能（2-3週間）**

**対象**: `AppShell.tsx` + state management + settings context  
**影響**: 永続化機構、ユーザー設定  
**リスク**: 🔴 高（複数の state 管理が増える）  
**ROI**: 🔴 高（スーパーユーザーの速度が劇的に上がる）

#### 3-1. お気に入り（固定）機能

```typescript
// features/settings/SettingsContext.tsx に追加

interface NavSettings {
  favoriteItems?: string[];     // testId of favorite nav items
  pinnedItems?: string[];        // Fixed at top
  hiddenItems?: string[];        // Hidden from view
}

export const useNavSettings = () => {
  const { settings, updateSettings } = useSettingsContext();
  
  return {
    isFavorite: (testId: string) => settings.navSettings?.favoriteItems?.includes(testId) ?? false,
    addFavorite: (testId: string) => {
      updateSettings({
        navSettings: {
          ...settings.navSettings,
          favoriteItems: [...(settings.navSettings?.favoriteItems ?? []), testId],
        },
      });
    },
    removeFavorite: (testId: string) => {
      updateSettings({
        navSettings: {
          ...settings.navSettings,
          favoriteItems: (settings.navSettings?.favoriteItems ?? []).filter(id => id !== testId),
        },
      });
    },
  };
};
```

#### 3-2. ショートカットキー（`Cmd+K` で検索窓にフォーカス）

```typescript
// AppShell.tsx

useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Cmd+K or Ctrl+K
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      // search input にフォーカス
      const searchInput = document.querySelector('[aria-label="メニュー検索"]') as HTMLInputElement;
      searchInput?.focus();
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

#### 3-3. フィーチャーフラグ項目のプレースホルダー対応

```typescript
// navigationConfig.ts の NavItem に追加

export type NavItem = {
  label: string;
  to: string;
  isActive: (pathname: string) => boolean;
  testId?: string;
  icon?: React.ElementType;
  audience?: NavAudience;
  
  // 新規フィールド
  disabled?: boolean;           // 権限不足で利用不可
  disabledReason?: string;      // 「管理者に依頼してください」
  locked?: boolean;             // 契約外機能
  comingSoon?: boolean;         // ロードマップ上の機能
};

// AppShell.tsx での表示
<ListItemButton
  disabled={item.disabled}
  title={item.disabledReason}
  sx={{
    ...(item.disabled && {
      opacity: 0.5,
      cursor: 'not-allowed',
      '&:hover': { backgroundColor: 'transparent' },
    }),
  }}
>
  {content}
</ListItemButton>
```

---

## 📋 実装チェックリスト

### 段階1（即実装推奨）

- [ ] `groupLabel` を新ラベルに変更
  ```
  投下時間: 5分
  ```
- [ ] 既存テストを新ラベルに対応させる
  ```
  投下時間: 10分
  ```
- [ ] E2E test の label アサーション更新
  ```
  投下時間: 10分
  ```
- [ ] スクリーンショット更新（ドキュメント用）
  ```
  投下時間: 15分
  ```

**段階1 合計**: **40分～1時間**

### 段階2（次のスプリント推奨）

- [ ] セパレーター CSS をグループごとに調整
  ```
  投下時間: 45分
  ```
- [ ] グループラベルのカラーリング実装
  ```
  投下時間: 1時間
  ```
- [ ] 画面確認 + 微調整
  ```
  投下時間: 1時間
  ```
- [ ] バッジ機能の型定義（コンポーネント実装なし、設計のみ）
  ```
  投下時間: 1時間
  ```

**段階2 合計**: **3.5～4時間**

### 段階3（計画フェーズ）

- [ ] `SettingsContext` に `navSettings` フィールド追加
  ```
  投下時間: 2時間
  ```
- [ ] お気に入り UI（アイコン/ドラッグドロップ）実装
  ```
  投下時間: 6時間
  ```
- [ ] ショートカットキー実装 + テスト
  ```
  投下時間: 2時間
  ```
- [ ] プレースホルダー UI テスト
  ```
  投下時間: 3時間
  ```

**段階3 合計**: **13時間** （別途スプリント推奨）

---

## 🎯 推奨実装順序

```
【推奨パス】

Week 1 (即実施)
├─ 段階1: グループラベル変更 (~1h)
└─ Local test + PR review

Week 2
├─ 段階2: ビジュアル改善 (~4h)
└─ E2E test confirm

Week 3-4 (計画フェーズ)
├─ 段階3: お気に入り + ショートカット
└─ ユーザーテスト

【代替パス】（リソース限定時）

Week 1
└─ 段階1 のみ

Week 2-3
└─ 段階2 の一部（セパレーターのみ）

段階3 は長期計画に組み込み
```

---

## 💡 各段階のビジュアル比較

### 現行（段階0）

```
📌 今日の業務
 ├─ 日次記録
 ├─ 健康記録
 ├─ 申し送りタイムライン
 ├─ 司会ガイド
 ├─ 朝会（作成）
 ├─ 夕会（作成）
 └─ 議事録アーカイブ
────────────────────
📚 記録を参照
 ├─ 黒ノート一覧
 ├─ 月次記録
 └─ スケジュール
────────────────────
🔍 分析して改善
 ├─ 分析
 ├─ 氷山分析
 ├─ アセスメント
 └─ 特性アンケート
────────────────────
👥 利用者・職員
 ├─ 利用者
 └─ 職員
────────────────────
🔐 管理機能
 ├─ 支援手順マスタ
 ├─ 自己点検
 └─ 監査ログ
```

### 段階2 適用後（セパレーター強化 + 色分け）

```
【📌 今日の業務】  ← 通常色
 ├─ 日次記録
 ├─ 申し送りタイムライン [NEW] 2 件
 ├─ ...
 
 ════════════════════  ← 薄い分割線
【📚 記録を参照】   ← 通常色
 ├─ ...

 ════════════════════  ← 薄い分割線
【🔍 分析して改善】 ← 通常色
 ├─ ...

 ════════════════════════
【⚙️ システム管理】  ← 赤色強調
 ├─ ...
 
【⚙️ 表示設定】     ← 薄いグレー
 ├─ ...
```

### 段階3 適用後（フル機能）

```
【📌 お気に入い】     ← 新グループ
 ├─ ⭐ 日次記録
 ├─ ⭐ 申し送りタイムライン
 └─ ⭐ 黒ノート

【📌 今日の業務】
 ├─ 日次記録
 ├─ 申し送りタイムライン [2]  ← バッジ
 └─ ...

 ════════════════════
【📚 記録を参照】
 ├─ ...
 
 ハンバーガー ≡ Cmd+K で検索窓フォーカス
```

---

## ✅ 成功基準

| 段階 | KPI | 目標 | 測定方法 |
|------|-----|------|--------|
| 1 | ラベル変更 | 新しいラベル表示 | スクリーンショット比較 |
| 1 | テスト | 全テスト PASS | `npm test` |
| 2 | セパレーター | 管理グループが視認可能 | UI 確認 |
| 2 | ユーザー反応 | 「見やすくなった」フィードバック | QA チーム確認 |
| 3 | 使用率 | お気に入り > 50% のユーザーが使用 | アナリティクス |
| 3 | ショートカット | 電話向けテストで速度 +30% | Lighthouse |

---

## 🔗 関連リソース

- [SIDEMENU_STATUS_2026_02_23.md](SIDEMENU_STATUS_2026_02_23.md) - 現状分析
- [SIDEMENU_TEST_ROADMAP.md](SIDEMENU_TEST_ROADMAP.md) - テスト実装計画
- [SIDEMENU_QUICKREF.md](SIDEMENU_QUICKREF.md) - 開発者リファレンス

---

## 🤔 質問＆判断

**Q1**: 段階1をすぐに実装してもいいですか？

**A**: はい。ラベル変更のみなので **リスク 0**、**影響度 高** です。1 時間で完了し、すぐに UX 評価できます。

**Q2**: 段階2 するときは、既存のモバイル表示への影響は？

**A**: セパレーターとカラーリングは CSS のみなので、モバイルでも同じように機能します。ただし **色分けは濃度を調整**（暗いテーマで見やすく）する必要があります。

**Q3**: 段階3 のお気に入い機能は、ローカルストレージと settings API の両方で管理すればいい？

**A**: 推奨は **settings API のみ** です。サーバー側に保存すれば、複数デバイス同期します。

---

**作成**: 2026-02-23  
**ステータス**: 実装準備完了  
**次のアクション**: 段階1 開始の GO/NOGO 判断
