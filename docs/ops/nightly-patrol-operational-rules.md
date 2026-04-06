# Nightly Runtime Patrol — 運用ルール定義書

> **最終更新**: 2026-04-06 (Stage 6 完了時点)
>
> **対象**: Nightly Runtime Patrol が生成する `runtime-summary.md` を受け取る運用管理者

---

## 1. Severity 定義と対応ルール

| Severity | 意味 | 対応期限 | 対応者 | 行動 |
| :---: | --- | --- | --- | --- |
| 🔴 `critical` | **本番稼働に影響するリスクが検知された** | **即日** | 運用管理者 | サマリーの NextAction に従い、即座に調査・対応を開始する |
| 🟠 `action_required` | **自動修復が失敗した、または手動調査が必要** | **翌営業日中** | 運用管理者 | SharePoint 管理画面で権限・設定を確認し、原因を特定する |
| 🟡 `watch` | **計画的な対応で解消可能な最適化候補** | **次回定期メンテナンス** | 開発/運用 | 計画対応キューに登録し、メンテナンス時に対応する |
| 🟢 `silent` | **システムが安全に吸収済み（対応不要）** | — | — | 何もしない。レポートの折りたたみセクションに記録のみ |

---

## 2. Index Advisor シグナルの分類

| イベント | 条件 | Severity |
| --- | --- | --- |
| **必須インデックス不足** | `index_pressure` + メッセージに `(CRITICAL)` を含む | 🔴 `critical` |
| **候補インデックス不足** | `index_pressure` (上記以外) | 🟡 `watch` |
| **インデックス修復失敗** | `remediation` + メッセージに `失敗` or `fail` を含む | 🟠 `action_required` |
| **インデックス修復成功** | `remediation` + メッセージに `成功` or `success` を含む | 🟢 `silent` |

---

## 3. その他のシグナル分類

| イベント | Severity | 根拠 |
| --- | --- | --- |
| SharePoint API 429 (レート制限) | 🔴 `critical` | 全リスト操作が停止するリスク |
| 必須リスト到達不能 (`essential_resource_unavailable`) | 🔴 `critical` | 業務継続不可 |
| プロビジョニング失敗 (`provision_failed`) | 🟠 `action_required` | リスト構造の破損可能性 |
| HTTP 500 エラー | 🟠 `action_required` | SharePoint 側の障害 |
| ドリフト検知（Strategy E 吸収済み） | 🟢 `silent` | 自動吸収完了 |
| プロビジョニングブロック（8KB制限） | 🟢 `silent` | 意図的な防御動作 |

---

## 4. レポートの読み方

### 朝の確認フロー

```
1. runtime-summary.md を開く
2. Summary セクションの Critical / Action Required の数を確認
   → 0 なら「今日は安全」
   → 1以上なら NextAction 列を読んで対応開始
3. Watch は急がない。定期メンテナンスのキューに入れる
4. Silent (折りたたみ) は通常展開不要
```

### NextAction の文言ルール

- **技術詳細ではなく、次の行動が書いてある**
- 管理者は NextAction を読めば、何をすべきかが即座にわかる
- 詳細調査が必要な場合は「管理画面の○○を確認」のように導線が示される

---

## 5. Delete 操作について

> ⚠️ **現時点では凍結中**

Index Delete 機能は実装済みだが、運用安全性の観点から凍結しています。
Index Advisor の Delete ボタンは無効化された状態を維持します。

将来的に Delete を解除する場合は、以下の条件を満たしてから実施してください:

1. Delete 操作の差し戻し手順が文書化されている
2. Delete 前の確認ダイアログが実装されている
3. Delete 操作のテレメトリが DriftEventsLog に記録される

---

## 6. 自動実行 (GitHub Actions)

Nightly Runtime Patrol は GitHub Actions によって毎朝自動的に実行され、結果が Teams へ通知されます。

### 実行スケジュール
- **定期実行**: 毎日 **06:00 JST** (Cron: `0 21 * * * UTC`)
- **手動実行**: GitHub Actions の `Nightly Runtime Patrol` ワークフローから `workflow_dispatch` でいつでも実行可能です。

### 必要なシークレット (GitHub Secrets)
運用を継続するために、以下のシークレットがリポジトリに設定されている必要があります。

| シークレット名 | 用途 | 欠落時の挙動 |
| --- | --- | --- |
| `SP_ACCESS_TOKEN` | SharePoint Telemetry (DriftEventsLog等) へのアクセス | **エラー** (パトロールが失敗します) |
| `SP_SITE_URL` | ターゲットとなる SharePoint サイトの URL | **エラー** (パトロールが失敗します) |
| `TEAMS_WEBHOOK_URL` | Teams チャンネルへの通知用 Webhook | 通知のみスキップ (パトロール自体は成功します) |
| `TEAMS_MENTION_UPN` | 異常検知時のメンション先 (Teams UPN) | メンションのみスキップ |

### Teams 通知の仕様
- Critical または Action Required が 1 件以上ある場合、赤またはオレンジの警告として通知されます。
- 全てが Watch または Silent の場合は、通常のステータスとして通知されます。
- 通知には NextAction (次の行動) が含まれており、モバイルからでも即座に状況を把握できます。

### アーティファクトと履歴
- 実行ごとの詳細な `runtime-summary.md` は、リポジトリ内の `docs/nightly-patrol/` に日付付きで保存されます。
- 過去の履歴を調査する場合は、上記のディレクトリまたは GitHub Actions の Artifacts を参照してください。

---

## 7. 変更履歴

| 日付 | 変更内容 |
| --- | --- |
| 2026-04-06 | Stage 6 完了。初版作成 |
| 2026-04-07 | GitHub Actions による自動実行と Teams 通知の運用ルールを追加 |
