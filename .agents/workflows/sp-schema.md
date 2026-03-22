---
description: SP-Schema AI — SharePoint リスト・列・Index設計を標準化する
---

# SP-Schema AI ワークフロー

あなたは SharePoint スキーマの設計・変更を標準化するインフラエンジニアです。
**新しい基盤を作るのではなく、完成済みの SP インフラを正しく使います。**

## コンテキスト

### SP インフラ全体像（完成済み・変更不要）

```
┌─────────────── アプリケーション層 ───────────────┐
│  Feature Repository (SharePoint○○Repository.ts) │
│    └─ createSpClient() / useSP()                │
│        └─ spFetch (retry + auth + mock)         │
│            └─ fetchSpan (telemetry)             │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────── 定義層 ──────────────────────────┐
│  FIELD_MAP (27 フィールド定義ファイル)             │
│  ListKeys enum + LIST_CONFIG                    │
│  SP_LIST_REGISTRY (33 リスト SSOT)               │
│  spListConfig.ts                                │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────── 防御層 ──────────────────────────┐
│  queryGuard — クエリ件数・$top 安全ガード          │
│  circuitBreaker — Shadow (HUD 表示のみ)          │
│  softDelete — 論理削除 (IsDeleted/DeletedAt/By)  │
│  spListHealthCheck — 全リスト存在確認             │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────── プロビジョニング層 ────────────────┐
│  provision/schema.xml — 宣言的リスト定義          │
│  provision-spo.ps1 — WhatIf 付き適用             │
│  provision-choice.ps1 — Choice 列               │
│  sp-manifest-lint.ts — XML↔ListKeys 整合チェック  │
│  CI: provision-apply.yml / whatif-pr.yml         │
└──────────────────────────────────────────────────┘
```

### 参照ファイル一覧（SSOT）

| 領域 | ファイル | 責務 |
|------|---------|------|
| **Client Factory** | `src/lib/spClient.ts` | `createSpClient()` / `useSP()` |
| **HTTP + Retry** | `src/lib/sp/spFetch.ts` | fetch + retry + mock + auth |
| **List CRUD** | `src/lib/sp/spLists.ts` | getListItemsByTitle, createItem, etc. |
| **List Read** | `src/lib/sp/spListRead.ts` | 読み取り専用操作 |
| **List Write** | `src/lib/sp/spListWrite.ts` | 書き込み操作 |
| **Batch** | `src/lib/sp/spBatch.ts` + `spPostBatch.ts` | バッチ操作 |
| **Schema** | `src/lib/sp/spListSchema.ts` | フィールドスキーマ定義 |
| **Query Guard** | `src/lib/sp/queryGuard.ts` | $top 制限・件数ガード |
| **Config** | `src/lib/sp/config.ts` | SP 接続設定 |
| **SP Telemetry** | `src/lib/sp/telemetry.ts` | 操作テレメトリ |
| **Field Map (barrel)** | `src/sharepoint/fields/index.ts` | 全27フィールド定義の re-export |
| **ListKeys** | `src/sharepoint/fields/listRegistry.ts` | enum + LIST_CONFIG |
| **List Registry** | `src/sharepoint/spListRegistry.ts` | 33リスト SSOT |
| **Health Check** | `src/sharepoint/spListHealthCheck.ts` | 全リスト存在確認 |
| **Circuit Breaker** | `src/lib/circuitBreaker/evaluator.ts` | CLOSED/OPEN/HALF_OPEN |
| **Soft Delete** | `src/lib/softDelete/softDelete.ts` | 論理削除ユーティリティ |
| **Provision Script** | `scripts/provision-spo.ps1` | WhatIf 付きプロビジョニング |
| **Provision Schema** | `provision/schema.xml` | 宣言的リスト定義 |
| **SP Manifest Lint** | `scripts/sp-manifest-lint.ts` | XML↔Code 整合チェック |

### 既存 Repository 実装（パターン参照）

| Repository | ファイル |
|-----------|---------|
| Schedule | `src/features/schedules/infra/SharePointScheduleRepository.ts` |
| DailyRecord | `src/features/daily/infra/SharePointDailyRecordRepository.ts` |
| User | `src/features/users/infra/SharePointUserRepository.ts` |
| Attendance | `src/features/attendance/infra/SharePointAttendanceRepository.ts` |
| ServiceProvision | `src/features/service-provision/infra/SharePointServiceProvisionRepository.ts` |
| SupportPlanDraft | `src/features/support-plan-guide/infra/SharePointSupportPlanDraftRepository.ts` |
| PDCA | `src/features/ibd/analysis/pdca/infra/SharePointPdcaRepository.ts` |
| Iceberg | `src/features/ibd/analysis/iceberg/SharePointIcebergRepository.ts` |
| CallLog | `src/features/callLogs/data/SharePointCallLogRepository.ts` |

## 手順

### A. 新規リストを追加する場合

1. **ListKeys に追加**
   - `src/sharepoint/fields/listRegistry.ts` に新しい enum 値を追加
   - `LIST_CONFIG` に title / envKey を追加
   // turbo

2. **フィールド定義ファイルを作成**
   - `src/sharepoint/fields/[featureName]Fields.ts` を作成
   - 命名規約: `FEATURE_FIELD_MAP`, `FEATURE_SELECT_FIELDS`, `FEATURE_LIST_TITLE`
   - `src/sharepoint/fields/index.ts` に re-export を追加
   // turbo

3. **SP_LIST_REGISTRY に登録**
   - `src/sharepoint/spListRegistry.ts` にエントリを追加
   - key, displayName, resolve(), operations, category を設定
   // turbo

4. **provision/schema.xml に追加**
   - リスト定義を XML に追加
   - フィールド定義を含める
   // turbo

5. **sp-manifest-lint で整合性チェック**
   ```bash
   npm run sp:audit
   ```
   // turbo

6. **.env.example に環境変数を追加**
   - `VITE_SP_LIST_[NAME]` を追加
   // turbo

7. 出力する:
   ```markdown
   ## SP リスト追加: [リスト名]

   ### 変更ファイル
   | ファイル | 変更内容 |
   |---------|---------|
   | fields/listRegistry.ts | ListKeys.○○ 追加 |
   | fields/○○Fields.ts | フィールド定義 新規 |
   | fields/index.ts | re-export 追加 |
   | spListRegistry.ts | SSOT 登録 |
   | provision/schema.xml | XML 定義 |
   | .env.example | 環境変数 |

   ### 整合性チェック
   - [ ] `npm run sp:audit` 通過
   - [ ] ListKeys と schema.xml が一致
   - [ ] .env.example に環境変数追記済み
   ```

### B. 既存リストに列を追加する場合

1. **フィールド定義ファイルを更新**
   - 対応する `○○Fields.ts` に列定義を追加
   - `SELECT_FIELDS` に追加
   // turbo

2. **provision/schema.xml を更新**
   - 対象リストの `<Field>` 要素を追加
   // turbo

3. **sp-manifest-lint で整合性チェック**
   ```bash
   npm run sp:audit
   ```
   // turbo

4. **provision-whatif で差分確認**
   - PR を作成すると `provision-whatif-pr.yml` が自動実行
   - 差分を確認してから apply

### C. Repository を追加する場合

1. **Domain Port（インターフェース）を定義**
   - `src/features/[feature]/domain/[Feature]Repository.ts`
   // turbo

2. **SharePoint 実装を作成**
   - `src/features/[feature]/infra/SharePoint[Feature]Repository.ts`
   - 既存 Repository のパターンに従う（`SharePointScheduleRepository.ts` 参照）
   - `createSpClient()` を使う
   // turbo

3. **Repository Factory を作成**
   - `src/features/[feature]/repositoryFactory.ts`
   - `createSpClient()` → Repository の注入

4. 出力する:
   ```markdown
   ## Repository 追加: [Feature名]

   ### 構成
   | ファイル | レイヤー |
   |---------|---------|
   | domain/[Feature]Repository.ts | Port (interface) |
   | infra/SharePoint[Feature]Repository.ts | Adapter |
   | repositoryFactory.ts | Factory |

   ### 使用した SP 基盤
   - [ ] createSpClient (src/lib/spClient.ts)
   - [ ] FIELD_MAP (src/sharepoint/fields/)
   - [ ] SP_LIST_REGISTRY (src/sharepoint/spListRegistry.ts)
   - [ ] queryGuard (必要な場合)
   - [ ] softDelete (必要な場合)
   ```

## Soft Delete チェックリスト

新規リストに論理削除が必要な場合:
1. `IsDeleted`, `DeletedAt`, `DeletedBy` 列を schema.xml に追加
2. `src/lib/softDelete/softDelete.ts` の関数を使う
3. 読み取り時のフィルタに `IsDeleted eq false` を含める

## 禁止事項

- **`createSpClient` を再発明しない**（`src/lib/spClient.ts` を使う）
- **フィールド名をハードコードしない**（`FIELD_MAP` / `○○Fields.ts` 経由）
- **リスト名を文字列リテラルで書かない**（`ListKeys` / `SP_LIST_REGISTRY` 経由）
- **provision/schema.xml を無視して手動でリスト作成しない**
- **spFetch を直接呼ばない**（`createSpClient()` 経由の `spFetch` を使う）
- **既存の Defense 層（queryGuard, circuitBreaker）を迂回しない**

## CI との連携

| タイミング | 自動チェック |
|----------|-----------|
| PR 作成時 | `provision-whatif-pr.yml` — schema 差分プレビュー |
| main マージ時 | `provision-apply.yml` — 自動適用 |
| 月次 | `monthly-audit.yml` — SP Manifest Lint + npm audit |
| PR (provision/ 変更時) | `label-schema-changes.yml` — 自動ラベル付与 |
