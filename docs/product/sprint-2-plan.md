# 福祉オペレーションOS — Sprint 2 計画

> **Sprint Goal:** Sprint 1で成立した「現場の操作ループ」に対して、「見える化」と「判断支援」を足し、運用強度を一段上げるフェーズ。  
> **期間:** 2 週間  
> **マイルストーン:** 🏁 MS2: 運用強度の向上  
> **ステータス:** 計画済  
> **準拠:** [MVPバックログ](mvp-backlog.md) / [Screen Catalog](screen-catalog.md)

---

## 🚀 Sprint 1 からの学び (Retrospective)

Sprint 1 では、以下の中核価値が確立されました：
1. **現場操作ループの成立**: `Today → UserHub → DailyRecord → ContextPanel ↔ ExceptionCenter` という、福祉現場の記録・確認フローがコード上で完全に繋がりました。
2. **Pure Function 分離の成功**: UIとドメインロジック（`buildQuickActions`, `buildContextAlerts`, `detectMissingRecords` 等）を分離したことで、テスト容易性が劇的に向上し、今後の別画面（ダッシュボード等）での再利用が可能になりました。
3. **EmptyStateAction の再利用**: 共通コンポーネントによる「ゼロ件」時の体験統一が、システム全体に安心感とOS感をもたらしました。

Sprint 1 は「骨格」を作るフェーズでした。Sprint 2 ではこの骨格の上に「筋肉」となる**実際の運用に耐えうる情報量とナビゲーション**を追加します。

---

## 🎯 Sprint 2 テーマ: 「見える化と判断支援」

### A. Control Layer 強化 (ExceptionCenter 生存力)
ExceptionCenter を「単なる入口」で終わらせず、管理者が即座にアクションを取れるようにする。
* 絞り込み / 並び替え強化
* Drilldown (詳細表示への遷移)
* リスクスコアや優先度によるソート

### B. Context の質向上 (ContextPanel 進化)
ContextPanel を「単なる過去記録の参照」から、支援者の気づきを促すものへ。
* 推奨アクション・プロンプトの表示
* より強固な注意喚起
* 関連履歴（申し送り/記録）の簡潔な要約表示

### C. UserHub 深化 (UserDetailPage 完全体化)
UserDetailPage を「本当の利用者起点のハブ」にする。
* 直近記録・直近申し送りのプレビュー表示
* 本日の予定（スケジュール）の統合
* 注意事項・支援計画（ISP）の要点ブレイクダウン

---

## 📋 Sprint Scope (Issue 候補と優先順位)

私たちがSprint 1の勢いのまま取り組むべき優先順位です。

| 順位 | Issue | Type | Layer | 概要 / 最小着地点 |
|------|-------|------|-------|-------------------|
| **1** | `feat(control): ExceptionCenter 強化` | ENH | Control | Filter/Sort追加、対象レコードへの直接Drilldown実装、優先度バッジ |
| **2** | `feat(context): ContextPanel 強化` | ENH | Context | 過去記録の要約表示、支援方針に基づく「推奨プロンプト」のテスト実装 |
| **3** | `feat(users): UserHub 深化` | ENH | Execution | UserHub に直近記録/申し送り/スケジュール等の Summary ウィジェットを追加 |
| **4** | `feat(today): Today の優先度制御` | ENH | Execution | (※必要なら) ActionQueue の優先度付き表示、AIサジェストの片鱗の導入 |

---

## 🚧 実装順序イメージ

```text
Week 1: Control & Context 強化
─────────────────────────────────────────
Day 1-3:  ExceptionCenter 強化 (Priority 1)
          └→ 現場の「見落とし」を管理者が効率的に拾えるようにする
Day 4-5:  ContextPanel 強化 (Priority 2)
          └→ 入力業務の品質アップ（参照する情報の質を上げる）

Week 2: Execution 強化 & 統合
─────────────────────────────────────────
Day 6-8:  UserHub 深化 (Priority 3)
          └→ 支援員が「この人今日はどうだっけ？」を1画面で完全に把握する
Day 9:    Today キュー優先度制御 (Priority 4)
          └→ 業務開始時の迷いをなくす
Day 10:   結合テスト / 振り返り
```

---

## ✅ DoD (Definition of Done)

* [ ] 各強化機能が実装され、実際の運用フロー（モックデータ含む）で価値が確認できること
* [ ] Sprint 1 で構築した Pure Function の拡張によってロジックが実装されていること
* [ ] 新規/拡張ロジックに対するユニットテストが追加・パスしていること（CI Green）
* [ ] UI/UX が「OS感（統一された手触り、滑らかな遷移）」を損なわないこと

---

## 💡 次のステップ
Sprint 2 第一歩として、**Priority 1: `ExceptionCenter 強化`** の要件定義（フィルタ・ソート・Drilldownの具体化）からスタートします。
