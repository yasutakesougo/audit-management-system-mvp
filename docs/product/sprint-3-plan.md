# Sprint 3 計画書 — 提案支援と横断連携

> 策定日: 2026-03-18  
> ステータス: Draft

---

## 1. テーマ

**「見える・判断できる」から「提案する・つながる」へ**

### Sprint 1 → Sprint 2 → Sprint 3 の流れ

```
Sprint 1: 操作骨格
  ↓ 現場ループ + 管理入口が成立

Sprint 2: 判断支援の筋肉付け
  ↓ 管理判断 / 現場判断 / 利用者把握 / 優先度制御が揃った

Sprint 3: 提案支援と横断連携
  → 「何をするとよいか」「どこへ飛べばよいか」を各画面が伝える
```

Sprint 2 で各画面が「自立」した。  
Sprint 3 では各画面を「連携させ、提案を出す」段階に入る。

---

## 2. Sprint 2 の学び

### 良かったこと

| 観点 | 学び |
|------|------|
| **Pure function 分離** | ロジックをドメイン層に閉じ込めると UI 変更・テストが高速になる |
| **Optional 拡張** | 既存インターフェースへの `?` 追加で後方互換を保てる |
| **ファクターボーナス設計** | 多要因スコアリングは「加算式」にすると透明性が高く拡張しやすい |
| **テスト速度** | 純粋関数なら境界条件テストが数秒で書けて Lint も清潔に保てる |

### 次でやるべきこと（Sprint 2 で意図的に後回しにしたもの）

- ExceptionCenter → 是正アクション提案（現在は一覧止まり）
- ContextPanel / UserHub → 推奨を「実際に使えるもの」に接続
- Planning / Monitoring への導線（Today / UserHub は点在するだけ）
- 管理者向け運用 KPI（推移・解消率・滞留）の可視化

---

## 3. Sprint 3 の優先度とスコープ

### Priority 1: ExceptionCenter から是正アクション提案

**ゴール**: 例外一覧を「見るだけ」から「是正できる」画面にする

**実装対象**:
- `buildCorrectiveActions(exception)` — 例外種別ごとに是正アクション候補を返す純粋関数
  - 未入力 → `DailyRecord 画面へ誘導`
  - 計画未作成 → `Planning 画面へ誘導`
  - 重要申し送り滞留 → `Handoff 確認へ誘導`
- `ExceptionTable` の各行に「対応する」ボタン/リンクを追加
- `ExceptionCenterPage` の SummaryCard から是正フローへのショートカット

**受け入れ条件**:
- 例外の種類ごとに適切な遷移先が提案される
- 「対応済み」マーク（楽観的 UI）で即座にフィードバックが返る
- pure function テストが境界条件を網羅

---

### Priority 2: ContextPanel / UserHub / Today の推奨連携

**ゴール**: 「推奨プロンプト」を画面横断で一貫した体験にする

**現状の課題**:
- ContextPanel: 推奨プロンプトを生成しているが Daily 入力とのつながりが弱い
- UserHub: 今日スナップショットはあるが「なぜこの推奨か」の説明がない
- Today: 優先度ラベルは表示されるが、UserHub/ContextPanel との連続性がない

**実装対象**:
- `buildUnifiedRecommendation(userId, context)` — 利用者ごとの統合推奨ロジック
  - 入力: UserHub のスナップショット + ContextPanel のアラート + Today のスコア
  - 出力: 「今日この利用者に注意すべき1点」を1文で返す
- UserHub の「今日の次アクション」バナーに ContextPanel の要点を連動
- Today のタスククリック → UserHub → ContextPanel のスムーズな遷移を強化

**受け入れ条件**:
- Today / UserHub / DailyRecord を移動しても文脈が途切れない
- 利用者ごとに「今日の最重要事項」が1箇所に集約される

---

### Priority 3: Planning / Monitoring への導線強化

**ゴール**: 支援計画と記録の蓄積が、現場の次アクションに繋がるようにする

**現状の課題**:
- Planning は ExceptionCenter や UserHub から参照されていない
- Monitoring データが Today / UserHub に還元されていない
- 「記録 → 分析 → 改善提案」のループが分断されている

**実装対象**:
- UserHub の `planHighlights` を実際の ISP データと接続（Phase 2 TODO の解消）
- `buildProgressAlert(planGoals, recentRecords)` — 目標達成状況から警告を生成
  - 目標達成率が低下している → ExceptionCenter/ContextPanel にアラート連携
- Monitoring → UserHub のリンクカード追加

**受け入れ条件**:
- UserHub の計画ハイライトに実データが表示される
- 目標未達が ContextPanel / ExceptionCenter に浮上する

---

### Priority 4: 運用 KPI の最小可視化

**ゴール**: 管理者が「施設全体の健全度」を1画面で把握できるようにする

**実装対象**:
- `computeOperationKpis(records, exceptions, plans)` — KPI 純粋関数
  - **未入力解消率**: 当日の記録完了 / 在籍人数
  - **申し送り滞留率**: 未対応重要申し送り / 全申し送り
  - **計画未整備率**: ISP 未整備 or 期限超過 / 在籍人数
  - **例外発生率**: 過去7日間の例外件数トレンド
- ExceptionCenterPage または Dashboard に KPI カードを追加
- KPI が閾値を超えたら ExceptionCenter の新しい例外タイプとして浮上

**受け入れ条件**:
- KPI は実データから計算される（モックなし）
- 純粋関数 + ユニットテストで固められている
- 管理者がダッシュボード or ExceptionCenter を開くと今日の健全度がわかる

---

## 4. 技術的な共通方針

### ✅ 継続すること（Sprint 2 から引き継ぐ）

```
pure function 分離 → テスト → UI は受け取るだけ
optional 追加 → 後方互換を守る
Phase 2 TODO は明示して残す（焦らない）
1 PR = 1 機能の原則
```

### ⚠️ Sprint 3 で新たに注意すること

```
横断連携はデータフローが複雑になりやすい
  → 状態を持つ層を増やさず、pure function で計算し直す設計を徹底する

実データ接続が増える (Phase 2 TODO の解消フェーズが来る)
  → adapter/repo を通じてドメイン関数から切り離す

UX の「文脈の途切れ感」が出やすい
  → ページ遷移時のパラメータ引き回しを設計段階で確認する
```

---

## 5. Sprint 3 完了イメージ

Sprint 3 が完走したとき、システムはこうなっている:

```
ExceptionCenter
  ↓ 是正アクション提案
  ↓ 例外カテゴリ別 KPI

Today (ActionQueue)
  ↓ 優先度スコア + 理由ラベル (Sprint 2 ✅)
  ↓ UserHub への1タップ連携

UserHub
  ↓ 今日スナップショット + 統合推奨
  ↓ 実 ISP データの計画ハイライト
  ↓ Daily / Planning / Monitoring への誘導

ContextPanel (DailyRecord)
  ↓ 推奨プロンプト (Sprint 2 ✅)
  ↓ UserHub スナップショットと連動

監理者 Dashboard / ExceptionCenter
  ↓ 運用 KPI (未入力解消率 / 申し送り滞留率 / 計画未整備率)
```

つまり Sprint 3 完了時点で、

> **「見える → 判断できる → 提案される → つながって動ける」**

という福祉オペレーション OS としての核が揃う。

---

## 6. Sprint 3 開始前チェックリスト

- [ ] Sprint 2 全 PR の CI 通過とマージ確認
  - [ ] #1047 MVP-009 ContextPanel 強化
  - [ ] #1049 MVP-010 UserHub 深化
  - [ ] #1050 MVP-011 Today 優先度制御
- [ ] main ブランチの最新化
- [ ] Sprint 3 P1 (ExceptionCenter 是正アクション) のブランチ作成
