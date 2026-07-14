# イソカツシステム完成形ブループリント

> **ドキュメント種別:** 完成形定義 / フェーズ統合メモ
> **ステータス:** Draft
> **初版:** 2026-07-09
> **準拠:** [設計原則 10 箇条](principles.md) / [ロードマップ](roadmap.md) / [Screen Catalog](screen-catalog.md) / [MVP Backlog](mvp-backlog.md)

---

## 完成形の一文定義

イソカツシステムは、**「今日やること」から「個別支援計画」「日々の支援記録」「申し送り」「モニタリング」「請求」「監査説明」までを、SharePoint/Teams と連携しながら一気通貫で扱える生活介護業務 OS** である。

完成形は、単なる記録アプリではない。現場の 1 日を回し、支援の根拠を残し、月末処理と監査時に説明できる業務基盤である。

## 入口と役割

| 入口 | 主な利用者 | 役割 |
|------|------------|------|
| `/today` | 全職員 | 当日の出席、予定、注意事項、申し送り、未完了タスクの管制塔 |
| `/users/:userId` | 全職員、リーダー | 利用者ごとの基本情報、今日の予定、支援手順、申し送り、過去記録、支援計画の集約 |
| `/daily/support` | 現場職員 | 日々の支援記録の入力 |
| `/daily/attendance` | 現場職員、リーダー | 出欠と実績の確認 |
| `/kiosk/toilet` | 現場職員 | トイレ記録の高速入力 |
| `/kiosk/users/:userId/procedures` | 現場職員 | 利用者別の支援手順確認と実施記録 |
| `/handoff-timeline` | 全職員 | 申し送りの時系列確認 |
| `/billing` | 管理者、事務 | 月次実績、請求、販売、加算の確認 |
| `/analysis/*` | リーダー、支援設計者 | ABC、Iceberg、PDCA、記録品質の分析 |
| `/admin/*` | 管理者 | SharePoint、権限、設定、ログ、運用状態の管理 |

## 4 つの完成ライン

| Phase | 完成ライン | 優先する画面・機能 | 完成条件 |
|-------|------------|--------------------|----------|
| Phase 1 | 現場導入できる完成 | `/today`, `/users/:userId`, `/handoff-timeline`, `/daily/support`, `/daily/attendance`, `/kiosk/*` | 紙の代替として最低限回り、未記録・未完了が見え、職員が迷わず入力できる |
| Phase 2 | 支援記録 OS としての完成 | 個別支援計画、支援計画シート、支援手順書、日次記録、ABC、Iceberg、PDCA、Record Quality Review | 「なぜこの支援をしたのか」を記録、根拠、モニタリングから説明できる |
| Phase 3 | 管理・請求・監査の完成 | `/billing`, 月次 CSV 出力、公式帳票 Excel 出力、コーヒー販売集計、重度加算、修正履歴、操作ログ、権限管理 | 日々の入力が月次集計と監査説明につながり、誰がいつ何を直したか追える |
| Phase 4 | 属人化しない運用完成 | Runbook、Nightly Patrol、SharePoint schema 管理、PR 判断テンプレ、障害対応、権限棚卸し | ユーザー本人以外でも、壊さず運用状態を理解し改善できる |

## 推奨ナビゲーション

完成形のグローバルナビは増やしすぎず、次の 8 区分へ集約する。

| ナビ | 対応する既存ルート | 役割 |
|------|--------------------|------|
| 今日 | `/today` | 当日の管制塔 |
| 利用者 | `/users`, `/users/:userId` | 利用者ごとの文脈 |
| 記録 | `/daily/support`, `/daily/attendance`, `/kiosk/toilet`, `/kiosk/users/:userId/procedures`, `/abc-record` | 日次・出欠・トイレ・ABC などの入力 |
| 支援設計 | `/support-plan-guide`, `/support-planning-sheet/:planningSheetId`, `/planning-sheet-list`, `/monitoring-meeting/:userId` | 計画・手順・モニタリング |
| 申し送り | `/handoff-timeline`, `/handoff-analysis` | 注意事項・共有事項 |
| 請求 | `/billing`, `/records/monthly`, `/records/service-provision` | 月次実績・販売・加算 |
| 分析 | `/analysis/*`, `/records/quality-review`, `/support-review` | PDCA・傾向・記録品質 |
| 管理 | `/dashboard`, `/admin/*`, `/exceptions`, `/incidents` | SharePoint・権限・設定・ログ・例外 |

## 優先順位

| 優先 | 内容 | 理由 |
|------|------|------|
| P0 | `/today` と `/users/:userId` の導線完成 | 現場が毎日使うため |
| P0 | SharePoint 接続・権限・保存失敗時の扱い固定 | 本番事故を防ぐため |
| P0 | 記録・申し送り・未記録の見える化 | 紙運用から移行するため |
| P1 | 支援計画・支援手順・日次記録の接続 | 支援の根拠を残すため |
| P1 | 月次集計・請求・月次 CSV | 管理業務で使うため |
| P2 | AI レビュー・PDCA・分析 | 支援の質を上げるため |
| P2 | Nightly Patrol・Runbook 強化 | 属人化を減らすため |

## 完成判定

完成形は、次の状態で判定する。

- 職員は `/today` を見れば、その日の仕事がわかる。
- 利用者ページを見れば、その人の支援文脈がわかる。
- 記録を残せば、支援計画・申し送り・請求・監査につながる。
- 管理者は月次・監査・改善状況を説明できる。
- 開発者であるユーザーが毎回判断しなくても、CI・Runbook・PR 運用で安全に改善できる。

## 変更履歴

| 日付 | バージョン | 変更内容 | 著者 |
|------|------------|----------|------|
| 2026-07-09 | 0.1 | イソカツシステム完成形を生活介護業務 OS として定義 | Codex |
