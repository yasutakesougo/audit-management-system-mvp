# 福祉オペレーションOS — Sprint 1 計画

> **Sprint Goal:** Execution Layer の強化と Control Layer 最小版の立ち上げにより、3レイヤすべてに画面が存在する「OS感の最小成立」を達成する  
> **期間:** 2 週間  
> **マイルストーン:** 🏁 MS1: OS感の最小成立  
> **ステータス:** 完了 (2026-03-17) ✅
> **準拠:** [MVPバックログ](mvp-backlog.md) / [Screen Catalog](screen-catalog.md)

---

## Sprint Scope

| ID | Issue | Type | Epic | 見積 |
|----|-------|------|------|------|
| MVP-001 | `feat(ui): EmptyStateAction 共通コンポーネント` | NEW | D | 2h |
| MVP-002 | `feat(today): ActionQueueCard — 未入力キュー` | NEW | A | 4h |
| MVP-003 | `feat(users): UserDetailPage ハブ化再設計` | EXT | A | 6h |
| MVP-004 | `feat(daily): 構造化タグ・次遷移追加` | EXT | A | 4h |
| MVP-005 | `feat(ui): ContextPanel — 同時参照パネル` | NEW | B | 6h |
| MVP-006 | `feat(control): ExceptionTable — 例外一覧` | NEW | C | 4h |
| MVP-007 | `feat(control): ExceptionCenterPage 最小版` | NEW | C | 3h |

**合計:** 7 Issue / 29h

---

## 実装順序

```
Week 1: Execution Layer
─────────────────────────────────────────

Day 1-2:  MVP-001 EmptyStateAction (2h)
          └→ 全画面の空状態UIの基盤

Day 2-3:  MVP-004 DailyRecord 構造化タグ (4h)
          └→ 既存画面の拡張（低リスク）

Day 3-5:  MVP-003 UserDetailPage ハブ化 (6h)
          └→ 利用者起点の導線確立

Day 5:    MVP-002 ActionQueueCard (4h)
          └→ Today にキュー追加


Week 2: Synthesis + Control Layer
─────────────────────────────────────────

Day 6-8:  MVP-005 ContextPanel (6h)
          └→ 支援設計者のUX大幅改善

Day 8-9:  MVP-006 ExceptionTable (4h)
          └→ 例外管理の基盤

Day 9-10: MVP-007 ExceptionCenterPage (3h)
          └→ 管理者画面の最小成立

Day 10:   統合テスト + Nav一貫性テスト
```

---

## 依存関係図

```
MVP-001 (EmptyState)   ← 他全Issueが利用（推奨先行）
    │
    ├──→ MVP-002 (ActionQueueCard)
    ├──→ MVP-003 (UserDetailPage)
    └──→ MVP-006 (ExceptionTable)

MVP-004 (DailyRecord拡張)   ← 独立（並行可能）

MVP-005 (ContextPanel)      ← 独立（並行可能）

MVP-006 (ExceptionTable)
    └──→ MVP-007 (ExceptionCenterPage)
```

---

## DoD (Definition of Done)

各 Issue が「完了」と見なされる条件。

- [ ] 機能が動作する（Acceptance Criteria 全チェック）
- [ ] 既存テストが壊れない（CI green）
- [ ] 新規ロジックにユニットテスト追加
- [ ] モバイル/PC 両方で表示確認
- [ ] Nav↔Router 一貫性テストが通る（新ルート追加時）
- [ ] コンポーネントに JSDoc コメント
- [ ] PR をセルフレビュー

---

## Before / After

### Before（Sprint 1 開始前）

```
Today画面        ✅ あるが未入力キューなし
日次記録          ✅ あるが構造化タグなし
利用者詳細        ⚠️ 編集フォームのみ
コンテキストパネル  ❌ なし
例外管理          ❌ なし
空状態UI          ❌ バラバラ
```

### After（Sprint 1 完了後）

```
Today画面        ✅ + ActionQueueCard（未入力キュー）
日次記録          ✅ + 構造化タグ + 次遷移
利用者詳細        ✅ ハブ画面化（注意事項常時表示 + 3ボタンCTA）
コンテキストパネル  ✅ 支援計画画面に同時参照パネル
例外管理          ✅ ExceptionCenterPage（管理者用）
空状態UI          ✅ 全画面統一
```

**結果:** 記録アプリ → 福祉オペレーションOS（現場版）

---

## リスクと対策

| リスク | 対策 |
|--------|------|
| UserDetailPage 再設計で既存テスト破壊 | 既存編集UIは「編集」ボタンで展開するセカンダリ操作に降格。既存テストは維持 |
| ExceptionTable のデータソースが複雑 | 最小版は未入力+期限超過の2種類のみ。インシデント集中はP1で追加 |
| ContextPanel のレスポンシブ対応 | モバイルはDrawer型で実装。PC版の右固定パネルを先行 |
| Nav一貫性テスト | ExceptionCenterPage 追加時に `appRoutePaths.ts` と `navigationConfig.ts` を同時更新 |

---

## 変更履歴

| 日付 | 変更内容 |
|------|---------|
| 2026-03-17 | 初版作成 |
