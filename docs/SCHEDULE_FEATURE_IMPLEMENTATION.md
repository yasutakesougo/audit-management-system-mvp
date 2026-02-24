# スケジュール機能 - 実装状況ドキュメント

**作成日**: 2026年2月24日  
**バージョン**: 1.0  
**対象**: audit-management-system

---

## 📋 概要

スケジュール機能は、利用者・職員の予定管理を行うコア機能です。SharePoint/Microsoft Graph からのデータ取得と、複数の表示モード（月間・週間・日間）をサポートしています。

### 現在の状態
- **ステータス**: 実装中・開発中
- **有効化条件**: Feature flag `VITE_FEATURE_SCHEDULES=1` または localStorage
- **主要ルート**: `/schedules/week` (週間ビュー)

---

## 🗂️ ディレクトリ構造

```
src/features/schedules/
├── components/          # UI コンポーネント（表示層）
│   ├── WeekServiceSummaryChips.tsx
│   ├── SchedulesHeader.tsx
│   ├── SchedulesFilterResponsive.tsx
│   ├── ScheduleEmptyHint.tsx
│   ├── NextActionCard.tsx
│   ├── MobileAgendaView.tsx
│   ├── DaySummaryDrawer.tsx
│   ├── DayPopover.tsx
│   └── CreateScheduleDialog.tsx
├── routes/              # ページ・ルートコンポーネント
│   ├── MonthPage.tsx    # 月間表示ページ
│   ├── WeekPage.tsx     # 週間表示ページ（メイン）
│   ├── DayView.tsx      # 日間表示
│   ├── ScheduleCreateDialog.tsx
│   ├── ScheduleViewDialog.tsx
│   └── DevScheduleCreateDialogPage.tsx
├── hooks/               # カスタムフック（ロジック層）
│   ├── useSchedules.ts  # スケジュール管理
│   ├── useSchedulesPageState.ts
│   ├── useSchedulesToday.ts
│   ├── useScheduleUserOptions.ts
│   ├── useStaffOptions.ts
│   ├── useOrgOptions.ts
│   ├── useWeekPageRouteState.ts
│   └── useWeekPageUiState.ts
├── domain/              # ビジネスロジック
│   ├── types.ts         # TypeScript型定義
│   ├── categoryLabels.ts
│   ├── scheduleFormState.ts
│   └── index.ts
├── data/                # データレイヤー・アダプター
│   ├── context.ts       # React Context
│   ├── contract.ts      # SharePointList Contract バリデーション
│   ├── port.ts          # インターフェース定義
│   ├── createAdapters.ts
│   ├── sharePointAdapter.ts  # SharePoint データソース
│   ├── graphAdapter.ts       # Microsoft Graph データソース
│   ├── demoAdapter.ts        # デモデータソース
│   ├── spRowSchema.ts   # SharePoint 行スキーマ
│   └── spSchema.ts      # SharePoint リスト構造
├── lib/                 # ユーティリティ
├── utils/               # ヘルパー関数
├── constants.ts         # 定数定義
├── statusMetadata.ts    # ステータス関連メタデータ
├── serviceTypeMetadata.ts
├── theme/               # スタイル・テーマ
└── __tests__/           # テスト
```

---

## 📑 主要ファイル別説明

### データ型 - `domain/types.ts`

```typescript
export type ScheduleItemCore = {
  id: string;
  title: string;
  start: string;    // ISO 8601
  end: string;      // ISO 8601
  category?: 'User' | 'Staff' | 'Org';
  status?: 'Planned' | 'Postponed' | 'Cancelled';
  serviceType?: 'absence' | 'late' | 'earlyLeave' | string;
  userId?: string;
  assignedStaffId?: string;
  vehicleId?: string;
  locationName?: string;
  notes?: string;
  etag: string;     // Conflict detection (Phase 2-0)
}
```

### ページコンポーネント

| ファイル | 説明 |
|---------|------|
| `WeekPage.tsx` | **メイン**：週間カレンダービュー。ルート `/schedules/week` |
| `MonthPage.tsx` | 月間ビュー（オプション） |
| `DayView.tsx` | 日間詳細ビュー |
| `ScheduleCreateDialog.tsx` | スケジュール作成ダイアログ（Route コンポーネント） |
| `ScheduleViewDialog.tsx` | スケジュール閲覧・編集ダイアログ |

### カスタムフック（ビジネスロジック）

| フック | 役割 |
|--------|------|
| `useSchedules()` | DOM 化されたスケジュール一覧・CRUD 操作 |
| `useSchedulesPageState()` | ページレベルの状態管理（フィルター、選択） |
| `useWeekPageRouteState()` | ルートクエリ（月/週の指定） |
| `useWeekPageUiState()` | UI 状態（サイドバー展開など） |
| `useScheduleUserOptions()` | 利用者オプション一覧 |
| `useStaffOptions()` | 職員オプション一覧 |

### データレイヤー

**Context**:
- `context.ts` - SchedulesContext（データソース、キャッシュなど）

**Adapter** (3 つのデータソースをサポート):
1. **SharePoint** (`sharePointAdapter.ts`)
   - 本番環境用
   - List: "スケジュール" (`cr014_schedules`)
   
2. **Microsoft Graph** (`graphAdapter.ts`)
   - Outlook Calendar 統合用
   
3. **Demo** (`demoAdapter.ts`)
   - 開発・テスト用

**Contract Validation** (`contract.ts`):
```typescript
validateSchedulesListContract(fields: ListFieldMeta[]): ContractValidationResult
// SharePoint List の必須フィールド・選択肢を検証
```

---

## 🎨 UI コンポーネント一覧

| コンポーネント | 説明 |
|---------------|------|
| `SchedulesHeader` | ページヘッダー（タイトル、操作ボタン） |
| `SchedulesFilterResponsive` | フィルターパネル（キーワード、職員、ステータスなど） |
| `CreateScheduleDialog` | スケジュール作成フォーム |
| `NextActionCard` | 次のアクション情報カード |
| `WeekServiceSummaryChips` | 週間サービスサマリー表示 |
| `MobileAgendaView` | モバイル用アジェンダビュー |
| `DaySummaryDrawer` | 日次サマリードローワー |
| `DayPopover` | 日付セルのポップオーバー |
| `ScheduleEmptyHint` | データ空時のヒント表示 |

---

## 🔄 データフロー図

```
SharePoint List (cr014_schedules)
    ↓
sharePointAdapter ← graphAdapter (Graph API)
    ↓
SchedulesContext (React Context)
    ↓
useSchedules() hook
    ↓
WeekPage / MonthPage / Components
```

---

## 🚀 機能一覧

### ✅ 実装済み・テスト対象

- [x] 週間ビュー表示（メイン）
- [x] スケジュール一覧取得
- [x] スケジュール作成フォーム
- [x] スケジュール閲覧・編集ダイアログ
- [x] Status 検証（Planned, Postponed, Cancelled）
- [x] Service Type 分類（absence, late, earlyLeave など）
- [x] Category 分類（User, Staff, Org）
- [x] フィルターUI（キーワード、職員、ステータス）
- [x] レスポンシブ対応
- [x] Accessibility（a11y）対応

### 🔮 将来の拡張

- [ ] 月間ビュー統合
- [ ] スケジュール競合検出（etag ベース Phase 2-0）
- [ ] DrillDown（日→時間帯別表示）
- [ ] リアルタイム更新（WebSocket）
- [ ] ローカライゼーション（多言語対応）

---

## 🧪 テスト対象ファイル

### Unit Tests
- `tests/unit/ScheduleCreateDialog.spec.tsx`
- `tests/unit/schedule.tabs.spec.tsx`

### E2E Tests  
- `tests/e2e/router.smoke.spec.ts` - Smoke test に含まれる

### Coverage
- 目標: >= 70% (Lines, Functions, Statements)
- Branch: >= 65%

---

## 🔑 Feature Flag

### 有効化（開発環境）

#### 環境変数
```bash
VITE_FEATURE_SCHEDULES=1 npm run dev
```

#### ブラウザコンソール
```javascript
localStorage.setItem("feature:schedules", "1");
// ページ再読み込み
```

#### 無効時の挙動
- ルート: `/schedules/*` → `ScheduleUnavailablePage` へリダイレクト
- メッセージ: "スケジュール機能は利用できません"

---

## 📞 共同開発ガイド

### 新機能追加時の流れ

1. **型定義**: `domain/types.ts` に新しい型を追加
2. **ビジネスロジック**: `domain/scheduleFormState.ts` または新規 hook を作成
3. **UI コンポーネント**: `components/` または `routes/` に作成
4. **テスト**: `__tests__/` または `tests/unit/` に追加
5. **SharePoint スキーマ**: 必要に応じて `data/spSchema.ts` を更新

### 注意点

- **eTag**: Conflict detection（Phase 2-0）の重要フィールド
- **Timezone**: `resolveSchedulesTz()` を使用（JST 指定）
- **Accessibility**: `useAnnounce()` で screen reader 対応
- **Feature Flag**: CI で `VITE_FEATURE_SCHEDULES` 状態を確認

### 推奨リソース

- 型定義リファレンス: [domain/types.ts](../src/features/schedules/domain/types.ts)
- UI Architecture: [docs/ui-architecture.md](./ui-architecture.md)
- i18n (日本語): [src/i18n/helpers.ts](../src/i18n/helpers.ts)

---

## 📊 関連ドキュメント

- **UI Architecture**: [docs/ui-architecture.md](./ui-architecture.md) - 3レイヤー分離設計
- **SharePoint Schema**: [provision/schema.xml](../provision/schema.xml) - リスト構造
- **i18n**: [src/i18n/ui.ts](../src/i18n/ui.ts) - 日本語テキスト定義
- **Test Strategy**: [docs/CI_TEST_STABILITY_STRATEGY.md](./CI_TEST_STABILITY_STRATEGY.md)

---

## ❓ Q&A

**Q: データソースを Graph API から SharePoint に切り替えたい**  
A: `data/context.ts` の adapter 初期化で切り替え可能。デフォルトは SharePoint。

**Q: 新しい Service Type を追加したい**  
A: `domain/types.ts` の `ScheduleServiceType` と `serviceTypeMetadata.ts` を更新。

**Q: スケジュール作成フォームのバリデーションを変更したい**  
A: `domain/scheduleFormState.ts` の `validateScheduleForm()` を編集。

**Q: 他のページからスケジュールを作成したい**  
A: `ScheduleCreateDialog.tsx` コンポーネントをインポートし、`open` prop を制御。

---

## 🔗 リンク集

- 📝 [README.md](../README.md)
- 🏗️ [UI Architecture](./ui-architecture.md)
- 🧪 [Test Strategy](./CI_TEST_STABILITY_STRATEGY.md)
- 📦 [package.json](../package.json)

---

**最終更新**: 2026年2月24日
