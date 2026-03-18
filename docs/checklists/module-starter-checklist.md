# Module Starter Checklist

福祉OSの新しいモジュール（機能）を開発する着手時から完了までに確認すべき、共通レール準拠のチェックリストです。
開発者（人間）およびAIエージェントの双方が、開発フェーズごとにこのリストをチェックして抜け漏れを防ぎます。

## 1. Domain / Architecture (設計・型定義)
- [ ] ドメインモデル（型定義 `domain/{module}.ts`）を作成したか
- [ ] Repository Port（インターフェース `domain/{module}Repository.ts`）を定義したか
- [ ] 業務上必要な機能（CRUD・検索条件など）が Port に過不足なく定義されているか
- [ ] SharePointの仕様（内部システム列など）が Domain 層に漏れ出していないか確認したか

## 2. Infrastructure (データアクセス実装)
- [ ] SharePoint との Field Map（マッピングロジック `infra/sharepoint/fields/{module}Fields.ts`）を定義したか
- [ ] SharePoint Repository の必要性を判断し、必要なら実装（`infra/sharepoint/repos/sp{Module}Repository.ts`）したか
- [ ] Local (Mock / localStorage) Repository を作成したか
- [ ] どちらの Repository 実装も、Port の定義を完全に満たしているか

## 3. Features Integration (統合・フック)
- [ ] 環境によるモード選択用の Factory (`features/{module}/repositories/create{Module}Repository.ts`) を作成したか
- [ ] Factory は `VITE_SP_ENABLED` 定数を用いて厳密なモード切替が行われるよう接続したか
- [ ] UI からデータを取得・操作するための Custom Hook (`features/{module}/hooks/use{Module}.ts`) を作成したか
- [ ] UI が要求する形にするための Adapter の要否を判断し、必要なら実装 (`adapters/adapt{Module}.ts`) したか

## 4. Runbook & Verification (検証準備)
- [ ] 実装・テスト要件を整理した Verification Checklist（検証観点）を作成したか
- [ ] 本番での実機確認用手順書（Runbook `docs/runbooks/{module}-verification.md`）を作成したか
- [ ] Level 1〜5 のテスト（自動テスト、スキーマテスト、エッジケース）を完了したか
- [ ] Level 6 のテスト（Runbookに沿った手動のブラウザ確認）を完了したか

## 5. Definition of Done (完了確認)
- [ ] `docs/architecture/welfare-os-development-framework.md` に定める「モジュール実装完了の Definition of Done」をすべて満たしたか
