# feat: サービス提供実績記録（MVP0）

## 概要

利用者×日付のサービス提供実績を **新規SPリスト `ServiceProvisionRecords`** へ 1日1件 upsert 保存する機能。
既存 Daily / Attendance 無改変。将来の国保連CSV連携（返戻ゼロ）に拡張可能な設計。

## Key Design

| 項目 | 内容 |
|---|---|
| **EntryKey** | `${UserCode}\|${RecordDateISO}` で同日1件 upsert |
| **Date** | SharePoint Date only / `toSpDateOnlyValue` でTZ事故防止 |
| **更新** | ETag付きPATCH（attendanceDailyRepository と同一パターン） |
| **切替** | repositoryFactory で demo(InMemory) / SharePoint 自動判定 |
| **UI** | `/daily/provision` — Autocomplete利用者選択 + toast通知 |

## 変更ファイル

### 新規（12ファイル）

**ドメイン層**
- `src/features/service-provision/domain/types.ts` — 型 + `makeEntryKey`
- `src/features/service-provision/domain/schema.ts` — Zod バリデーション
- `src/features/service-provision/domain/ServiceProvisionRepository.ts` — interface

**インフラ層**
- `src/features/service-provision/infra/SharePointServiceProvisionRepository.ts`
- `src/features/service-provision/infra/InMemoryServiceProvisionRepository.ts`

**Factory / Hook / Barrel**
- `src/features/service-provision/repositoryFactory.ts`
- `src/features/service-provision/useServiceProvisionSave.ts`
- `src/features/service-provision/index.ts`

**UI**
- `src/pages/ServiceProvisionFormPage.tsx`

**運用**
- `docs/runbooks/service-provision-list-setup.md`

**テスト**
- `tests/unit/service-provision/schema.spec.ts` — 13ケース
- `tests/unit/service-provision/repository.spec.ts` — 10ケース

### 変更（2ファイル）
- `src/sharepoint/fields.ts` — `SERVICE_PROVISION_*` 定数追加
- `src/app/router.tsx` — `daily/provision` ルート追加

## テスト結果

- ✅ **23/23 テスト成功**
- ✅ **tsc --noEmit** — 新規エラー 0件

## 運用手順

SP リスト作成は `docs/runbooks/service-provision-list-setup.md` 参照。

> **注意**: Title必須解除・Choice完全一致・RecordDate は Date only。

## 検証ケース（手動）

| # | 操作 | 期待結果 |
|---|---|---|
| 1 | I022 + 今日 + 提供 → 保存 | リストに1件作成 |
| 2 | 同条件で欠席に変更 → 保存 | 件数増えず更新 |
| 3 | I023 で保存 | 2件になる |
| 4 | 昨日の日付で保存 | 日付別で別件 |
