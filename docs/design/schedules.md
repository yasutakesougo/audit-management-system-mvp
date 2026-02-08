# Schedules 機能設計メモ

## 1. ゴールと前提

- 生活介護事業所向けの「通所スケジュール」管理機能。
- フロントエンド単体で **Demo ポート** と **SharePoint 実ポート** を切り替え可能にする。
- 認証（MSAL）と機能フラグ（featureFlags）で段階的にリリースできる構造を目指す。

前提要素:

- 認証: MSAL (PublicClientApplication) + Entra ID / SharePoint Online
- データソース:
  - Demo モード: ローカル／モックデータ
  - 本番モード: SharePoint リスト `ScheduleEvents` ほか
- 代表的な機能フラグ:
  - `schedules`
  - `schedulesCreate`
  - `schedulesWeekV2`

---

## 2. ポート設計: useSchedulesPort

目的:

- 「どこからデータを取るか」を UI から分離する。
- `VITE_FORCE_SHAREPOINT` / `VITE_DEMO_MODE` / `VITE_SKIP_LOGIN` + runtime 判定で Demo / SharePoint を一箇所で決める。

役割（ざっくり）:

- `useSchedulesPort`:
  - Demo モード:
    - ローカルモックから `ScheduleEvent[]` を返す
    - 作成／更新もメモリ or localStorage ベースで完結
  - SharePoint モード:
    - `spClient` 経由で `ScheduleEvents` リストにアクセス
    - `ScheduleEvent` ←→ SharePoint アイテムのマッピングを担当
  - ロギング:
    - `[schedules] using Demo port`
    - `[schedules] using SharePoint port`

---

## 3. データモデル: ScheduleEvent → BaseSchedule

### 3.1 型の階層

- `BaseSchedule`: 画面共通で必要な最小セット（id / userId / start / end / status / note など）
- `ScheduleEvent`: 週・月用の拡張（担当者・メタデータなど）
- `DailySchedule`: 必要に応じた日画面向け派生型（ソート済み・グルーピング済み等）

### 3.2 SharePoint リストとの対応

- リスト名: `ScheduleEvents`
- 列は `src/sharepoint/fields.ts` / `src/features/schedules/data/spRowSchema.ts` に準拠（ハードコード禁止）
- 主要列マッピング（SharePoint 内部名ベース / 必要に応じて列を追加）:

| 区分 | 内部名 (SP) | 型 | 備考 |
| --- | --- | --- | --- |
| 共通 | `Title` | 1 行テキスト | 件名 or 利用者名 |
| 共通 | `EventDate` / `EndDate` | 日時 | 開始・終了。存在しない場合は `Start`/`End` も見る |
| 共通 | `Start` / `End` | 日時 | 互換用（Schedules リスト互換）。両方に書き込む |
| 共通 | `AllDay` | Yes/No | 任意。時間帯から自動判定も行う |
| 共通 | `Status` | Choice | `statusDictionary` で正規化 |
| 共通 | `cr014_category` | Choice/Text | `Org` / `User` / `Staff` |
| 共通 | `Notes` / `Note` | 複数行テキスト | どちらでも可 |
| 共通 | `LocationName` / `Location` | テキスト | 任意 |
| 共通 | `cr014_dayKey` | テキスト | `yyyyMMdd`。未設定ならフロントで算出 |
| 共通 | `cr014_fiscalYear` | テキスト | 未設定なら開始日から算出 |
| 共通 | `RRule` / `RecurrenceData` | テキスト | 繰り返しルール（任意） |
| 共通 | `@odata.etag` / `Created` / `Modified` | 既定 | SP 既定列 |
| 利用者 | `ServiceType` (`cr014_serviceType` も併記) | Choice/Text | サービス種別。互換のため両方書き込む |
| 利用者 | `cr014_personType` | Choice | `Internal` / `External` |
| 利用者 | `cr014_personId` / `cr014_personName` | テキスト | 内部利用者 ID / 氏名 |
| 利用者 | `TargetUserId` (`TargetUser`) | Lookup | Users_Master への Lookup。無い場合は personId を使用 |
| 利用者 | `cr014_externalPersonName` / `cr014_externalPersonOrg` / `cr014_externalPersonContact` | テキスト | 外部利用者用 |
| 利用者 | `cr014_staffIds` / `cr014_staffNames` | 複数行テキスト(JSON) | 担当職員の ID/氏名。見つからなければ `AssignedStaffId` などをフォールバック |
| 利用者 | `AssignedStaffId` / `AssignedStaff` | Lookup | 担当者 Lookup（数値 ID） |
| 職員 | `SubType` | Choice | 例: `会議` / `研修` / `年休` |
| 職員 | `cr014_staffIds` / `cr014_staffNames` | 複数行テキスト(JSON) | 省略可。Lookup (`StaffLookupId` など) も読み取る |
| 職員 | `cr014_dayPart` | Choice/Text | `年休` のとき `Full` / `AM` / `PM` |
| 組織 | `SubType` | Choice | 例: `会議` / `研修` / `監査` |
| 組織 | `cr014_orgAudience` | 複数行テキスト(JSON) | 参加対象。文字列配列を JSON で格納 |
| 組織 | `cr014_resourceId` | テキスト | 施設・会議室など |
| 組織 | `ExternalOrgName` | テキスト | 外部団体名 |

- マッピング責務:
  - 取得時: `fromSpSchedule(item): Schedule`
  - 保存時: `toSpScheduleFields(schedule): SpItemPayload`

---

## 4. 日 / 週 / 月 画面の責務

### 4.1 共通

- ルーティング: `/schedules/day`, `/schedules/week`, `/schedules/month`（必要になったら）
- 共通 UI: 日付ナビ（前後移動・今日ボタン）、FAB（新規）、フィルター（利用者/ステータスなど）

### 4.2 Day ページ

- 1日分のスケジュールを縦方向に表示
- 主な責務: 日単位タイムライン、当日把握、ステータス更新

### 4.3 Week ページ

- 現在の中心ページ `/schedules/week`
- 主な責務: 週次カレンダー、通所パターン確認、将来的なドラッグ編集など

### 4.4 Month ページ（将来）

- 曜日パターンや長期傾向確認用。具体実装は未定だが `BaseSchedule` ベースで扱う想定。

---

## 5. 機能フラグと ProtectedRoute

### 5.1 featureFlags の設計

`src/config/featureFlags.ts` より抜粋:

- `FeatureFlagSnapshot`: `schedules`, `schedulesCreate`, `complianceForm`, `schedulesWeekV2`
- `resolveFeatureFlags(envOverride?)`: 環境変数＋runtime 判定からスナップショット生成
- 自動テスト/E2E 時は `isE2E` / `isTestMode` / `isAutomationRuntime` で `schedules` / `schedulesCreate` を強制 ON
- `FeatureFlagsProvider`: `value` 未指定時に `resolveFeatureFlags()` で再計算、`useFeatureFlags` で参照
- `__resetFeatureFlagsForTest`: テスト間汚染防止のリセット関数

### 5.2 ProtectedRoute の分岐パターン（/schedules/week 例）

1. `schedules` フラグ false → アクセス禁止（リダイレクト）
2. `schedules` true かつ `VITE_SKIP_LOGIN=1` → 認証なしで通す（開発・Demo）
3. `schedules` true かつ `VITE_SKIP_LOGIN=0`:
   - 未認証 → MSAL ログイン要求
   - 認証済み → 通過

ユニットテスト: `tests/unit/auth/ProtectedRoute.flags.spec.tsx` で flag × skip-login × auth-state をカバー。

---

## 6. テスト方針

### 6.1 ユニットテスト

- `useSchedulesPort`: Demo/SharePoint 切替条件、返却型の一貫性
- featureFlags: `resolveFeatureFlags(envOverride)` 分岐、`isAutomationRuntime` の検出
- ProtectedRoute: flag × skip-login × auth-state 分岐
- Schedule 関連のユニットテスト短縮版は `schedules*` を対象にする

### 6.2 E2E（Playwright）

- 対象: `tests/e2e/schedule-week.*.spec.ts`
- 観点: `/schedules/week` レンダリング、週次ナビ、FAB ダイアログ、ARIA smoke
- 実行: ローカル `npm run test:schedule-week`（5175 起動前提）、CI は workflows から

---

## 7. 環境モードと .env.local

### 7.1 開発・UI確認モード（ログインスキップ）

- 例: `VITE_SKIP_LOGIN=1`, `VITE_DEMO_MODE=0`, `VITE_FORCE_SHAREPOINT=0`, `VITE_SP_LIST_SCHEDULES=ScheduleEvents`
- 起動: `npm run dev:schedules` → `http://localhost:5175/schedules/week`

### 7.2 本番相当モード（SharePoint + 認証あり）

- 例: `VITE_SKIP_LOGIN=0`, `VITE_FORCE_SHAREPOINT=1` + 本番 MSAL/SP 設定
- Entra 設定: SPA Redirect URI（5175 など）登録、SharePoint 委任権限に管理者同意

---

## 8. 今後の拡張アイデア（メモ）

- `schedulesWeekV2`: タイムライン UX 改善、高密度表示、フィルタリング
- Nurse / Audit 連携: 出席 → 実績 → 請求 CSV へのトレーサビリティ
- スケジュールテンプレート: 曜日パターン定義・月次展開

Schedules Phase 1: /schedules/week is now the primary entry and always renders Schedules V2. The legacy schedule UI is removed; use /schedules only.
