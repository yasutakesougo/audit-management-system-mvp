# Handoff (申し送り) Module Checklist
※ [Module Starter Checklist](./module-starter-checklist.md) ベースの初回適用版

## 0. プロジェクト要件整理 (MVP Scope)
- [x] 対象: 申し送り機能 (Handoff)
- [x] SP_LIST_TITLE: `SupportRecord_Handoff` (仮)
- [x] カラム仕様:
  - `userId` (対象となる利用者ID)
  - `targetDate` (対象日: YYYY-MM-DD)
  - `content` (申し送り本文)
  - `priority` (優先度: Normal / High / Emergency)
  - `status` (ステータス: Unread / Read)
  - `reporterName` (記録者)
  - `recordedAt` (記録日時: ISOString)

## 1. Domain / Architecture (設計・型定義)
- [x] ドメインモデル（型定義 `domain/Handoff.ts`）を作成
- [x] Repository Port（インターフェース `domain/HandoffRepository.ts`）を定義
- [x] 業務要件を満たすCRUD関数（指定日＋対象者での取得、未読のみ取得、作成、ステータス更新など）を網羅

## 2. Infrastructure (データアクセス実装)
- [x] SharePoint Field Map（`infra/sharepoint/fields/handoffFields.ts`）を作成
- [x] SharePoint Repository（`infra/sharepoint/repos/spHandoffRepository.ts`）を作成
- [x] Local Repository（`infra/sharepoint/repos/localHandoffRepository.ts`）を作成

## 3. Features Integration (統合・フック)
- [x] Abstract Factory（`features/handoff/repositories/createHandoffRepository.ts`）を作成し、`VITE_SP_ENABLED` で分岐
- [x] Custom Hook（`features/handoff/hooks/useHandoff.ts`）を作成
- [ ] Adapter（必要に応じて）の判断・作成

## 4. Runbook & Verification (検証準備)
- [x] `docs/runbooks/handoff-verification.md` の作成（Runbook First の実践）
- [ ] Level 1, 2 の自動テスト (`__tests__/`) 作成と実行
- [x] Component UI の作成と結合 (Level 3, 4)
- [ ] Edge Case テスト (Level 5)
- [ ] Manual Browser Verification (Level 6)

## 5. Definition of Done
- [ ] フレームワーク上の完了条件を満たすこと
