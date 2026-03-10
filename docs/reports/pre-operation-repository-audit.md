# Pre-Operation Repository Audit Report

> Generated: 2026-03-11
> Scope: `src/` directory (excluding `node_modules`)
> Purpose: Issue #837 — 運用前リポジトリ監査

---

## 1. 概要

| 指標 | 値 |
|------|-----|
| 総ファイル数 (ts/tsx) | 1,294 |
| 総行数 | 190,913 |
| プロダクションコード (テスト除外) | 1,124 ファイル |
| 400行超ファイル数 | 71 |
| 600行超ファイル数 | 2 (テスト除外) |
| `as any` 使用箇所 | 44 |
| `unknown as` 使用箇所 | 53 |
| `: any` パラメータ | 6 |
| TODO/FIXME | 2 |
| `import type` 使用数 | 879 |
| 通常 `import` 数 | 5,669 |
| Loading UI 散在 (CircularProgress/LinearProgress) | 159 箇所 |
| Error Alert 散在 | 20+ 箇所 |

---

## 2. 監査方法

1. `wc -l` + `sort` で全ファイル行数ランキング
2. `grep` で `as any` / `unknown as` / `: any` / `TODO` / `FIXME` を抽出
3. Loading/Error UI の使用パターンをスキャン
4. 共通コンポーネントの再利用状況を確認
5. import/export パターンを分析

---

## 3. カテゴリ別結果

### 3.1 巨大ファイル (400行超)

#### 600行超 (Critical)

| ファイル | 行数 | 問題種別 | リスク |
|---------|------|---------|--------|
| `src/pages/OpeningVerificationPage.tsx` | 993 | UI + state + helper 混在 | medium |
| `src/features/handoff/__tests__/handoffApi.spec.ts` | 699 | テスト（許容） | low |

#### 500–599行 (High)

| ファイル | 行数 | 問題種別 | リスク |
|---------|------|---------|--------|
| `src/features/staff/StaffForm.tsx` | 596 | UI + form logic 混在 | medium |
| `src/features/users/UserDetailSections/index.tsx` | 595 | 複数セクション1ファイル | medium |
| `src/features/meeting/meetingSharePointSchema.ts` | 595 | スキーマ定義（許容） | low |
| `src/features/users/useUserForm.ts` | 582 | hook 肥大化 | medium |
| `src/features/schedules/routes/DayView.tsx` | 578 | UI + state 混在 | medium |
| `src/pages/AnalysisDashboardPage.tsx` | 577 | ページ + セクション混在 | medium |
| `src/features/handoff/handoffApi.ts` | 575 | API ロジック（許容） | low |
| `src/features/nurse/medication/MedicationRound.tsx` | 569 | UI + state 混在 | medium |
| `src/features/ibd/procedures/templates/HighRiskIncidentDialog.tsx` | 557 | ダイアログ肥大化 | low |
| `src/components/DailyForm.tsx` | 557 | フォーム肥大化 | medium |
| `src/lib/env.ts` | 550 | 環境変数（許容） | low |
| `src/features/resources/useIntegratedResourceCalendar.ts` | 545 | hook 肥大化 | medium |
| `src/features/operation-hub/useOperationHubData.ts` | 545 | hook 肥大化 | medium |
| `src/features/schedules/routes/WeekView.tsx` | 543 | UI + state 混在 | medium |
| `src/features/nurse/observation/BulkObservationList.tsx` | 541 | UI 肥大化 | medium |
| `src/pages/TokuseiSurveyResultsPage.tsx` | 531 | ページ肥大化 | low |
| `src/features/ibd/procedures/templates/TimeBasedSupportRecordForm.tsx` | 525 | フォーム肥大化 | low |
| `src/features/handoff/components/HandoffItem.tsx` | 521 | コンポーネント肥大化 | low |
| `src/features/nurse/observation/HealthObservationForm.tsx` | 517 | フォーム肥大化 | medium |
| `src/features/schedules/routes/MonthPage.tsx` | 515 | UI + state 混在 | medium |
| `src/features/users/UsersPanel/UsersList.tsx` | 514 | リスト + 操作 混在 | medium |
| `src/features/schedules/infra/SharePointScheduleRepository.ts` | 514 | リポジトリ肥大化 | low |
| `src/features/schedules/routes/ScheduleCreateDialog.tsx` | 513 | ダイアログ肥大化 | medium |

#### 400–499行 (Moderate) — 主要なもの

| ファイル | 行数 | 問題種別 | リスク |
|---------|------|---------|--------|
| `src/pages/MonthlyRecordPage.tsx` | 504 | ページ肥大化 | medium |
| `src/features/schedules/hooks/useScheduleCreateForm.ts` | 499 | hook 肥大化 | medium |
| `src/lib/mappers/schedule.ts` | 498 | マッパー（許容） | low |
| `src/features/daily/components/split-stream/RecordPanel.tsx` | 491 | パネル + ロジック | medium |
| `src/features/diagnostics/health/checks.ts` | 486 | ヘルスチェック | low |
| `src/pages/IBDDemoSections.tsx` | 480 | セクション混在 | low |
| `src/infra/sharepoint/repos/schedulesRepo.ts` | 480 | リポジトリ（許容） | low |
| `src/pages/DailyRecordMenuPage.tsx` | 474 | ページ肥大化 | medium |
| `src/features/daily/hooks/useTimeBasedSupportPage.ts` | 470 | hook + 操作 | medium |
| `src/features/today/transport/TransportStatusCard.tsx` | 462 | カード + ロジック | medium |
| `src/features/records/monthly/MonthlySummaryTable.tsx` | 460 | テーブル + 集計 | medium |
| `src/app/config/navigationConfig.ts` | 450 | 設定（許容） | low |
| `src/features/attendance/useAttendance.ts` | 436 | hook 肥大化 | medium |
| `src/main.tsx` | 429 | エントリポイント | low |
| `src/features/handoff/components/CompactNewHandoffInput.tsx` | 421 | フォーム肥大化 | low |
| `src/app/ProtectedRoute.tsx` | 409 | 認証 + ルーティング | low |

---

### 3.2 型安全リスク

#### `as any` 使用箇所 (44件)

| 分類 | 件数 | 代表ファイル | リスク |
|------|------|------------|--------|
| Schedule adapter/repo | 19 | `scheduleSpAdapter.ts`, `SharePointScheduleRepository.ts`, `schedulesRepo.ts` | medium-high |
| SP fetch/batch | 6 | `spFetch.ts`, `spPostBatch.ts` | medium |
| SP client config cast | 3 | `spClient.ts` | medium |
| Zod error cast | 6 | `zodErrorUtils.ts` | low |
| Window.__ENV__ access | 5 | `repositoryFactory.ts` | low |
| import.meta.env access | 2 | `useDaily.ts`, `env.ts` | low |
| usePersistedFilters | 2 | `usePersistedFilters.ts` | low |
| SP list field cast | 1 | `schedulesRepo.ts` | low |

#### `unknown as` 使用箇所 (53件)

| 分類 | 件数 | 代表ファイル | リスク |
|------|------|------------|--------|
| React.ElementType cast | 5 | `AppShellSidebar.tsx`, `FooterQuickActions.tsx`, `UserDetailSections` | low |
| Window globals | 8 | `env.schema.ts`, `repositoryFactory.ts`, `diagnostics` | low |
| import.meta polyfill | 3 | `msalConfig.ts`, `env.ts`, `minuteWindow.ts` | low |
| MSAL config/instance | 3 | `azureMsal.ts`, `msalConfig.ts`, `MsalProvider.tsx` | medium |
| SP config cast | 3 | `spClient.ts`, `spFetch.ts` | medium |
| SP List write stubs | 5 | `spListWrite.ts` | medium |
| Field map cast | 4 | `OpeningVerificationPage.tsx` | low |
| Event type cast | 2 | `UsersList.tsx` | low |
| Theme extension | 1 | `WeekView.tsx` | low |
| その他 | 19 | 複数 | low-medium |

#### `: any` パラメータ (6件)

| ファイル | 行 | 内容 | リスク |
|---------|-----|------|--------|
| `schedulesRepo.ts` | 259 | `pickEtag(v: any)` | medium |
| `schedulesRepo.ts` | 364 | `const created: any` | medium |
| `schedulesRepo.ts` | 445 | `const updated: any` | medium |
| `schedulesRepo.ts` | 449 | `const row: any` | medium |
| `spFetch.ts` | 85 | `isInvalidValue(v: any)` | low |
| `spFetch.ts` | 155 | `mockResponse(data: any)` | low |

---

### 3.3 TODO / FIXME

| ファイル | 行 | 内容 |
|---------|-----|------|
| `src/features/today/transport/useTransportStatus.ts` | 190 | `// TODO Phase 3: Fire-and-forget SP save here` |
| `src/features/reports/achievement/AchievementRecordPDF.tsx` | 109 | ハードコードされた事業所番号 (`141XXXXXXX`) |

---

### 3.4 Import/Export 監査

| 観点 | 状況 |
|------|------|
| `import type` 利用率 | 879 / 6,548 = 約13.4% |
| barrel export (`index.ts`) | 多くの feature で使用、概ね整備済み |
| import順序 | **ばらつきあり** — React → external → shared → features → relative の順序が統一されていない |
| 未使用 import | lint で概ね検出済み、手動確認では少数 |

---

### 3.5 Loading / Error UI 監査

#### 既存共通コンポーネント

| コンポーネント | 場所 | 利用数 | 状態 |
|--------------|------|--------|------|
| `Loading` | `src/ui/components/Loading.tsx` | 4 | **最小限の実装** — `<span>Loading...</span>` のみ |
| `ErrorState` | `src/ui/components/ErrorState.tsx` | 1 | **最小限の実装** — `<span style="color:red">` のみ |
| `EmptyState` | `src/ui/components/EmptyState.tsx` | 3 | ダッシュボード系で利用 |
| `SuspenseFallback` | `src/app/SuspenseFallback.tsx` | 2 | Suspense boundary 用、整備済み |
| `ErrorBoundary` | `src/app/ErrorBoundary.tsx` | 1 | グローバル ErrorBoundary |
| `ConfigErrorBoundary` | `src/app/ConfigErrorBoundary.tsx` | 1 | 設定エラー専用 |
| `RouteHydrationErrorBoundary` | `src/hydration/RouteHydrationListener.tsx` | 3 | ルート Hydration 用 |

#### Loading UI の散在

- `CircularProgress` / `LinearProgress` の直接 import: **159 箇所**
- 共通 `Loading` コンポーネントの利用: **4 箇所のみ**
- **問題**: 各ページ/コンポーネントが個別に MUI の Progress をインポートしており、一貫性がない

#### Error UI の散在

- `Alert severity="error"` の直接利用: **20+ 箇所**
- 共通 `ErrorState` の利用: **1 箇所のみ**
- **問題**: エラー表示のスタイルが統一されていない

---

## 4. 優先度付き対応候補

### 安全分割候補 (Issue #838 向け)

| 優先度 | ファイル | 行数 | 推奨アクション | リスク | 触るべきか |
|--------|---------|------|--------------|--------|-----------|
| 🟢 1 | `pages/OpeningVerificationPage.tsx` | 993 | セクション別にコンポーネント分離 | low | ✅ 最優先 |
| 🟢 2 | `features/staff/StaffForm.tsx` | 596 | form logic (hook) ← → UI 分離 | low | ✅ |
| 🟢 3 | `features/users/UserDetailSections/index.tsx` | 595 | セクション別ファイルに分離 | low | ✅ |
| 🟡 4 | `features/users/useUserForm.ts` | 582 | helper 関数の外出し | medium-low | ✅ |
| 🟡 5 | `features/schedules/routes/DayView.tsx` | 578 | hook / sub-component 分離 | medium | △ 慎重に |
| 🟡 6 | `pages/AnalysisDashboardPage.tsx` | 577 | セクション分離 | medium-low | △ |
| 🔴 7 | `features/schedules/infra/SharePointScheduleRepository.ts` | 514 | as any 多数、型改善必要だが構造変更リスク | high | ❌ 見送り |
| 🔴 8 | `features/schedules/data/sharePointAdapter.ts` | N/A | as any 多数、SP 契約変更リスク | high | ❌ 見送り |

### 型安全改善候補 (Issue #839 向け)

| 優先度 | ファイル | 件数 | 推奨アクション | リスク | 触るべきか |
|--------|---------|------|--------------|--------|-----------|
| 🟢 1 | `lib/zodErrorUtils.ts` | 6 | Zod discriminated union 化 | low | ✅ |
| 🟢 2 | `hooks/usePersistedFilters.ts` | 2 | ジェネリック型の改善 | low | ✅ |
| 🟡 3 | `infra/sharepoint/repos/schedulesRepo.ts` | 4 | `: any` → 具体型 | medium | ✅ |
| 🟡 4 | `lib/sp/spFetch.ts` | 2 | パラメータ型の改善 | medium-low | ✅ |
| 🔴 5 | `features/schedules/data/sharePointAdapter.ts` | 12 | adapter 契約型の整備 (大規模) | high | ❌ 見送り |
| 🔴 6 | `features/schedules/infra/SharePointScheduleRepository.ts` | 6 | 同上 | high | ❌ 見送り |

### Loading/Error UI 共通化候補 (Issue #839 向け)

| 優先度 | アクション | リスク |
|--------|----------|--------|
| 🟢 1 | `LoadingState.tsx` を MUI `CircularProgress` ベースに刷新 | low |
| 🟢 2 | `ErrorState.tsx` を MUI `Alert` ベースに刷新 | low |
| 🟡 3 | `PageErrorBoundary.tsx` を新規作成 | low |
| 🟡 4 | touched files で共通入口に置換 | low |

---

## 5. 今夜の推奨対象 Top 5

1. **`pages/OpeningVerificationPage.tsx`** (993行) → セクション分離
2. **`features/staff/StaffForm.tsx`** (596行) → hook 分離
3. **`features/users/UserDetailSections/index.tsx`** (595行) → セクション分離
4. **`lib/zodErrorUtils.ts`** → `as any` 削減（6件）
5. **`LoadingState` / `ErrorState` 共通入口整備** → 刷新して導入例作成

---

## 6. 見送り対象

| ファイル | 理由 |
|---------|------|
| `features/schedules/data/sharePointAdapter.ts` | `as any` 12件だが SP 契約変更リスクが高い |
| `features/schedules/infra/SharePointScheduleRepository.ts` | 同上、リポジトリ契約への影響大 |
| `lib/sp/spPostBatch.ts` | SP通信層、安定稼働優先 |
| `lib/spClient.ts` | config cast が多いが構造的に必要 |
| `auth/azureMsal.ts` | MSAL 型不一致は MSAL 側の問題 |
| `main.tsx` | エントリポイント、リスク大 |
| `lib/env.ts` / `lib/env.schema.ts` | 環境変数処理、既に Zod で型安全 |

---

## 7. 次の Issue への引き継ぎメモ

### Issue #838 (refactor: safely split large files) へ

- 本レポートの「安全分割候補」セクションの 🟢 優先度を先に処理
- `OpeningVerificationPage.tsx` は最大の分割効果が見込める
- Schedule 系ファイルは SP 契約に影響するため見送り推奨
- 分割時は `index.tsx` / `types.ts` / `useXxx.ts` / `helpers.ts` / `components/*` の構成を標準とする

### Issue #839 (chore: tighten type safety) へ

- `zodErrorUtils.ts` は低リスクで即座に改善可能
- `schedulesRepo.ts` の `: any` は具体型への置換が可能
- Loading/Error UI は `src/components/ui/` に新設するか、既存 `src/ui/components/` を刷新
- SP fetch/batch の `as any` は config 型の一元化で解決可能だが中規模作業

### 全般

- `import type` 化率は 13.4% と低め。touched files での適用を推奨
- import 順序は ESLint plugin (`eslint-plugin-import`) による自動整形を長期的に検討
- Schedule 系の `as any` 集中（全体の約43%）は個別 Issue で対応すべき
