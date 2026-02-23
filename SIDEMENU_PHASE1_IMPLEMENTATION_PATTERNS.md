# 段階1 実装版（i18n + A11y 対応）

> **実装予定時間**: 1 時間  
> **対象ファイル**: `src/app/config/navigationConfig.ts`  
> **品質基準**: i18n 対応 + A11y チェック込み

---

## 📋 実装コード

### パターンA：シンプル版（現在のアプローチ）

**推奨**: 今すぐ実装したい場合

```typescript
// src/app/config/navigationConfig.ts（L44-49）

/**
 * Navigation group labels with action-oriented wording
 * Updated 2026-02-23 for improved UX clarity
 * 
 * Emoji choices:
 * - 📌 (pin): emphasizes "everyday essentials"
 * - 📚 (books): archival/reference material
 * - 🔍 (magnifying glass): analysis/insight
 * - 👥 (people): master data (users/staff)
 * - ⚙️ (gear): system-level settings
 */
export const groupLabel: Record<NavGroupKey, string> = {
  daily: '📌 今日の業務',
  record: '📚 記録を参照',
  review: '🔍 分析して改善',
  master: '👥 利用者・職員',
  admin: '⚙️ システム管理',
  settings: '⚙️ 表示設定',
};
```

**利点**:
- ✅ シンプル、読みやすい
- ✅ 即座に実装可能
- ❌ i18n 対応が後付けになる

---

### パターンB：i18n 対応版（推奨）

**推奨**: 将来の多言語展開を見据える場合

```typescript
// src/app/config/navigationConfig.ts（新規セクション追加 L40-45 あたり）

/**
 * Navigation group label keys for internationalization (i18n)
 * Format: MENU.{GROUP}.{ASPECT}
 * 
 * Usage in i18n system:
 * - ja.json: "MENU.DAILY.LABEL": "📌 今日の業務"
 * - en.json: "MENU.DAILY.LABEL": "📌 Today's Tasks"
 * - zh.json: "MENU.DAILY.LABEL": "📌 今日的工作"
 */
export const NAV_GROUP_I18N_KEYS = {
  daily: 'MENU.DAILY.LABEL',
  record: 'MENU.RECORD.LABEL',
  review: 'MENU.REVIEW.LABEL',
  master: 'MENU.MASTER.LABEL',
  admin: 'MENU.ADMIN.LABEL',
  settings: 'MENU.SETTINGS.LABEL',
} as const satisfies Record<NavGroupKey, string>;

/**
 * Navigation group labels (日本語)
 * Uses i18n keys but also includes fallback strings
 * 
 * @deprecated Use useTranslation(NAV_GROUP_I18N_KEYS) instead for i18n support
 */
export const groupLabel: Record<NavGroupKey, string> = {
  daily: '📌 今日の業務',
  record: '📚 記録を参照',
  review: '🔍 分析して改善',
  master: '👥 利用者・職員',
  admin: '⚙️ システム管理',
  settings: '⚙️ 表示設定',
};
```

**i18n JSON ファイル例**:

```json
// locales/ja.json
{
  "MENU": {
    "DAILY": {
      "LABEL": "📌 今日の業務",
      "DESCRIPTION": "毎日必ず触る業務"
    },
    "RECORD": {
      "LABEL": "📚 記録を参照",
      "DESCRIPTION": "過去の記録を参照する"
    },
    "REVIEW": {
      "LABEL": "🔍 分析して改善",
      "DESCRIPTION": "データ分析と改善"
    },
    "MASTER": {
      "LABEL": "👥 利用者・職員",
      "DESCRIPTION": "基本情報管理"
    },
    "ADMIN": {
      "LABEL": "⚙️ システム管理",
      "DESCRIPTION": "管理者機能"
    },
    "SETTINGS": {
      "LABEL": "⚙️ 表示設定",
      "DESCRIPTION": "UI設定"
    }
  }
}

// locales/en.json
{
  "MENU": {
    "DAILY": {
      "LABEL": "📌 Today's Tasks",
      "DESCRIPTION": "Daily operations"
    },
    "RECORD": {
      "LABEL": "📚 Archive",
      "DESCRIPTION": "Browse past records"
    },
    "REVIEW": {
      "LABEL": "🔍 Analyze & Improve",
      "DESCRIPTION": "Analysis and improvement"
    },
    "MASTER": {
      "LABEL": "👥 Users & Staff",
      "DESCRIPTION": "Master data"
    },
    "ADMIN": {
      "LABEL": "⚙️ System Management",
      "DESCRIPTION": "Administrator features"
    },
    "SETTINGS": {
      "LABEL": "⚙️ Display Settings",
      "DESCRIPTION": "UI customization"
    }
  }
}
```

**利点**:
- ✅ 多言語対応に即座に対応可能
- ✅ 将来の変更が容易
- ❌ 若干複雑（i18n ライブラリが必要）

---

### パターンC：A11y 重視版（フル対応）

**推奨**: アクセシビリティを最优先する場合

```typescript
// src/app/config/navigationConfig.ts（L40-80）

/**
 * Navigation group metadata with A11y support
 * Includes aria-descriptions and semantic information
 */
export interface NavGroupMetadata {
  label: string;              // Visual label (with emoji)
  labelText: string;          // Text-only label (no emoji)
  ariaLabel: string;          // Full accessible label
  ariaDescription?: string;   // Longer description for screen readers
  purpose: string;            // Internal documentation
}

export const navGroupMetadata: Record<NavGroupKey, NavGroupMetadata> = {
  daily: {
    label: '📌 今日の業務',
    labelText: '今日の業務',
    ariaLabel: '今日の業務（ピンマーク）',
    ariaDescription: '毎日必ず触る日次業務：日次記録、健康記録、申し送りタイムラインなど',
    purpose: 'Daily work that users interact with every day',
  },
  record: {
    label: '📚 記録を参照',
    labelText: '記録を参照',
    ariaLabel: '記録を参照（本マーク）',
    ariaDescription: '過去の記録を参照・検索する：黒ノート、月次記録、スケジュールなど',
    purpose: 'Archive and reference past records',
  },
  review: {
    label: '🔍 分析して改善',
    labelText: '分析して改善',
    ariaLabel: '分析して改善（虫眼鏡マーク）',
    ariaDescription: 'データ分析と改善：分析ダッシュボード、氷山分析、アセスメントなど',
    purpose: 'Data analysis and improvement',
  },
  master: {
    label: '👥 利用者・職員',
    labelText: '利用者・職員',
    ariaLabel: '利用者・職員マスタ（人マーク）',
    ariaDescription: '基本情報管理：利用者情報、職員情報',
    purpose: 'Master data for users and staff',
  },
  admin: {
    label: '⚙️ システム管理',
    labelText: 'システム管理',
    ariaLabel: 'システム管理（歯車マーク、管理者のみ）',
    ariaDescription: '管理者向け機能：支援手順マスタ、自己点検、監査ログなど',
    purpose: 'Administrator-only system management',
  },
  settings: {
    label: '⚙️ 表示設定',
    labelText: '表示設定',
    ariaLabel: '表示設定（歯車マーク）',
    ariaDescription: 'UI設定：ダークモード、レイアウト設定など',
    purpose: 'User interface customization',
  },
};

/**
 * Fallback to simple labels if metadata not used
 */
export const groupLabel: Record<NavGroupKey, string> = Object.entries(
  navGroupMetadata,
).reduce(
  (acc, [key, meta]) => {
    acc[key as NavGroupKey] = meta.label;
    return acc;
  },
  {} as Record<NavGroupKey, string>,
);
```

**AppShell.tsx での使用**:

```typescript
// AppShell.tsx（L720 ListSubheader）

<ListSubheader
  sx={{...}}
  aria-label={navGroupMetadata[groupKey]?.ariaLabel}
  title={navGroupMetadata[groupKey]?.ariaDescription}
>
  {navGroupMetadata[groupKey]?.label}
</ListSubheader>
```

**利点**:
- ✅ 完全な A11y 対応
- ✅ スクリーンリーダー対応
- ✅ i18n も容易
- ❌ 初期実装が複雑

---

## 🎯 どのパターンを選ぶ？

| 状況 | 推奨パターン | 理由 |
|------|------------|------|
| **今すぐリリースしたい** | A（シンプル版） | 5分で実装完了、リスクゼロ |
| **将来的に多言語対応予定** | B（i18n 版） | 後付けより今のうちに仕込む |
| **障害者等アクセシビリティ対応が求められている** | C（A11y 版） | WCAG 2.1 AA レベルに対応 |
| **全部対応したい（完璧志向）** | B + C 併用 | i18n + A11y の完全セット |

**筆者の推奨**: **パターン B（i18n 版）**  
理由：
- 実装負荷が低い（シンプル版と同等）
- A11y は後付けできるが、i18n は今付けないと技術債になりやすい
- 絵文字は言語非依存なので、多言語対応時も変更不要

---

## 🚀 実装ステップ（パターン B を例に）

### ステップ 1: i18n 管理システムの確認

```bash
# 既存の i18n ライブラリを確認
grep -r "useTranslation\|i18next\|react-i18next" src/

# もし i18n がまだ導入されていない場合は、
# パターン A（シンプル版）から始めて、後で B に移行する
```

### ステップ 2: navigationConfig.ts に i18n キーを追加

```typescript
// L40-50 に以下を追加

export const NAV_GROUP_I18N_KEYS = {
  daily: 'MENU.DAILY.LABEL',
  record: 'MENU.RECORD.LABEL',
  review: 'MENU.REVIEW.LABEL',
  master: 'MENU.MASTER.LABEL',
  admin: 'MENU.ADMIN.LABEL',
  settings: 'MENU.SETTINGS.LABEL',
} as const;

export const groupLabel: Record<NavGroupKey, string> = {
  daily: '📌 今日の業務',
  record: '📚 記録を参照',
  review: '🔍 分析して改善',
  master: '👥 利用者・職員',
  admin: '⚙️ システム管理',
  settings: '⚙️ 表示設定',
};
```

### ステップ 3: AppShell.tsx で i18n キーを参照（オプション）

```typescript
// AppShell.tsx（現状のままでOK）
// 後で以下のように変更可能：
// const { t } = useTranslation('menu');
// const label = t(NAV_GROUP_I18N_KEYS[groupKey]);
```

### ステップ 4: テスト

```bash
npm test -- navigationConfig.spec.ts
npm run dev  # ビジュアル確認
```

---

## ✅ 実装チェックリスト（パターン B）

### コード変更

- [ ] `src/app/config/navigationConfig.ts`
  - [ ] `NAV_GROUP_I18N_KEYS` を追加（L40-50）
  - [ ] `groupLabel` を更新（L52-60）
  - [ ] JSDoc コメントを追加

### テスト

- [ ] 単体テスト更新（`navigationConfig.spec.ts`）
  ```typescript
  expect(groupLabel.daily).toBe('📌 今日の業務');
  expect(NAV_GROUP_I18N_KEYS.daily).toBe('MENU.DAILY.LABEL');
  ```

- [ ] E2E テスト確認
  ```bash
  npm run test:e2e:smoke
  ```

### ドキュメント

- [ ] README.md に i18n キー の説明を追加
- [ ] コード内にコメント追加（既に上記に含む）

### ビジュアル確認

- [ ] デスクトップビュー（展開・折りたたみ）
- [ ] モバイルビュー
- [ ] ダークテーマ
- [ ] ライトテーマ

---

## 🌍 多言語対応への道すじ

現在（パターン B 実装後）:

```
┌─────────────────────────┐
│ navigationConfig.ts     │
│ NAV_GROUP_I18N_KEYS     │
│ (key definitions)       │
└──────────┬──────────────┘
           │
           ↓
┌─────────────────────────┐
│ i18n/locales.json       │
│ (ja, en, zh, ...)       │
│ MENU.DAILY.LABEL = ...  │
└──────────┬──────────────┘
           │
           ↓
┌─────────────────────────┐
│ AppShell.tsx            │
│ useTranslation('menu')  │
│ t(NAV_GROUP_I18N_KEYS)  │
└─────────────────────────┘
```

**切り替え時機**:
- 段階1は `groupLabel` のみ使用
- 段階2 で `useTranslation` 導入（オプション）
- 段階3 で多言語リリース

---

## 📸 最終コード（パターン B）

<details>
<summary>コピペ用：完全なコード例</summary>

```typescript
// ============================================================================
// Navigation Group I18n Keys
// ============================================================================

/**
 * Translation keys for navigation group labels
 * Used by i18n system to support multiple languages
 * 
 * Keys follow naming convention: MENU.{GROUP}.LABEL
 * 
 * @example
 * ```
 * const { t } = useTranslation('menu');
 * const label = t(NAV_GROUP_I18N_KEYS.daily);  // "📌 今日の業務"
 * ```
 */
export const NAV_GROUP_I18N_KEYS = {
  daily: 'MENU.DAILY.LABEL',
  record: 'MENU.RECORD.LABEL',
  review: 'MENU.REVIEW.LABEL',
  master: 'MENU.MASTER.LABEL',
  admin: 'MENU.ADMIN.LABEL',
  settings: 'MENU.SETTINGS.LABEL',
} as const satisfies Record<NavGroupKey, string>;

/**
 * Navigation group labels (日本語)
 * 
 * Updated 2026-02-23 for improved UX clarity:
 * - Replaced abstract names with action-oriented verbs
 * - Added emoji for visual differentiation
 * - Maintained i18n compatibility
 * 
 * Emoji meanings:
 * - 📌 (pin): emphasizes "everyday essentials"
 * - 📚 (books): archival/reference material
 * - 🔍 (magnifying glass): analysis/insight
 * - 👥 (people): master data management
 * - ⚙️ (gear): system-level settings
 * 
 * @deprecated For i18n support, use NAV_GROUP_I18N_KEYS + useTranslation()
 *             This is a fallback for non-i18n usage
 */
export const groupLabel: Record<NavGroupKey, string> = {
  daily: '📌 今日の業務',
  record: '📚 記録を参照',
  review: '🔍 分析して改善',
  master: '👥 利用者・職員',
  admin: '⚙️ システム管理',
  settings: '⚙️ 表示設定',
};
```

</details>

---

## 💬 まとめ

**段階1 の実装では**:

- パターン A（シンプル版）: 5分で完了、リスクゼロ
- パターン B（i18n 版）: 10分で完了、将来の多言語対応に備える
- パターン C（A11y 版）: 20分で完了、完全アクセシビリティ対応

**筆者の推奨**: **パターン B（i18n 版）**を選択し、段階1 でこれを仕込んでおく。

次に進みましょう。以下のどれをサポートしますか？

1. **リリースノート（ユーザー向け）のドラフト作成**
2. **段階2（ビジュアル強化）の CSS 設計案**
3. **実装後の検証チェックリスト**

---

**作成**: 2026-02-23  
**推奨パターン**: B（i18n 版）
**実装時間**: 10分  
**リスク**: 🟢 低
