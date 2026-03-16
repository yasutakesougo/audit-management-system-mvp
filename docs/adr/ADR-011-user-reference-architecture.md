# ADR-011: User 参照アーキテクチャ

## ステータス

**承認済** — 2026-03-16

## コンテキスト

Support Operations OS では、すべてのドメインデータが「誰の」データかという問いに帰着する。
しかし、利用者マスタの参照方法が画面・ドメインごとにバラバラだった。

### 問題

1. **O(n) 線形探索**: `users.find(u => u.UserID === id)` が全画面に散在
2. **曖昧マッチ**: `displayName.includes(personId)` による危険な部分文字列照合
3. **名前直接参照**: 利用者名でリレーション結合するケース
4. **履歴破壊**: マスタ変更（名前変更・退所）が過去記録に波及
5. **識別子混在**: `userId` / `personId` / `UserID` / `userCode` が未整理

### 影響範囲

- 日次記録（DailyRecord）
- 支援計画（ISP）
- 申し送り（Handoff）
- インシデント（HighRiskIncident）
- 行動分析（AnalysisDashboard）
- アセスメント（AssessmentDashboard）
- TodayEngine

## 決定

`src/domain/user/userRelation.ts` に **User 参照解決レイヤー** を導入する。

### 2層の型体系

| 型 | 用途 | 不変性 |
|----|------|--------|
| `UserRef` | リアルタイム表示・選択用の軽量参照 | なし（最新マスタに追従） |
| `UserSnapshot` | 履歴保存用の凍結スナップショット | **保存後は更新しない** |

### 識別子ポリシー

- `userId`: リレーション結合の唯一の基準
- `userCode`: 現場運用・帳票用の業務識別子
- `userName`: 表示専用。結合条件に使用禁止
- `includes` などの曖昧一致で利用者を特定してはならない

### Snapshot 不変原則

`UserSnapshot` は保存時点の事実を凍結したものであり、後から更新しない。
利用者マスタが変更されても、過去レコードに埋め込まれた Snapshot は変更しない。

### 欠損時フォールバック

- リアルタイム解決: userId をそのまま返す
- 履歴保存: 未解決のまま保存しない（バリデーションで防止）

## 段階的適用

| Phase | 内容 | 状況 |
|-------|------|------|
| 1 | `domain/user/userRelation.ts` 基盤作成 | ✅ 完了 |
| 2 | TodayEngine / Handoff / Dashboard 統合 | ✅ 完了 |
| 3 | ISP で `toUserSnapshot` 統合 | ⬜ 次 |
| 4 | DailyRecord / HighRiskIncident に Snapshot | ⬜ |
| 5 | `personId` → `userId` 命名統一 | ⬜ |

## 結果

- 利用者名解決が O(1) に統一
- 曖昧マッチの排除
- 履歴データの利用者変更耐性
- 型安全な参照パスの確立

## 詳細ドキュメント

[User 参照アーキテクチャ 完全版](../architecture/user-reference-architecture.md)
