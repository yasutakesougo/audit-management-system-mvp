# PR #2586 支援記録の保存・再取得検証（2026-10-09）

## 判定

- ローカル補強を作成。GitHubへのpush、マージ、デプロイ、本番SharePointへの書き込みは未実施。
- PR #2586: OPEN / DRAFT、head `23134a0ba648fb6c6ddc1cd0f3f24a228c3f6d7c`（作業後のGitHub照会でも同一）。
- 最新の成功したデプロイworkflow: [run 37725222270](https://github.com/yasutakesougo/audit-management-system-mvp/actions/runs/37725222270)、SHA `1dd860e6c9cfc901c367f213a4cd12e833bcd15d`、Deploy job完了 2026-10-08 13:07:48 JST。今回、配信中の実体を再照合したわけではない。
- 本番の実レコード存在・根本原因・修正後の永続化・人による受入: 未確認。MERGE / DEPLOY = HOLD。

## 追加の再現と修正

取得完了前に利用者IDが空から確定値へ変わると、hookの前の `isLoading=false` が新しいidentityの取得完了に見える瞬間があった。詳細フォームが空の内容で初期化を終え、その後に取得された記録は「保存済みの記録内容」に表示されても入力欄へ復元されなかった。

合成SharePoint E2Eで、新規保存の再表示と既存 `1` / `row-1` 読み込みの3ケースが入力欄の期待値で失敗した。hookが取得を完了したidentityを保持し、未取得のidentityについて古いrecordや完了状態を公開しないよう修正したところ、3ケースが通過した。

候補lookupの失敗後に他の候補も空だった場合はエラーを維持する回帰テストも追加した。記録を発見した場合だけ、途中の失敗を解消する既存PRの動作を保っている。

## 自動受入

対象は合成の `Users_Master.Id=6 / UserID=I005`。実在利用者マスタの対応関係を本番で確認した証拠ではない。

全ケースで実UI・hook・SharePoint repositoryを使用し、外部HTTPだけをstub化する。ブラウザ再読み込み時はexecution storageを空に戻す一方、HTTP側の保存状態は維持する。

| 条件 | 新規保存 | 既存 `1` 更新 | 既存 `row-1` 更新 |
|---|---|---|---|
| 一覧から詳細を開き、観察3項目とメモを保存 | PASS | PASS | PASS |
| 「記録を保存しました」後、一覧が「記録済み」で内容表示 | PASS | PASS | PASS |
| 一覧再読み込み後、子行GETから同じ内容を再取得 | PASS | PASS | PASS |
| 詳細を開き直し、さらに再読み込みして入力内容を復元 | PASS | PASS | PASS |
| 隣の手順は未実施のまま | PASS | PASS | PASS |
| 子行が1件のみ、保存要求も1回のみ | PASS | PASS | PASS |
| 既存のId=61をMERGEし、親・子を新規作成しない | 対象外 | PASS | PASS |

テストの初期設定が利用者マスタをデモデータへ差し替える問題を避けるため、Playwright起動時に `VITE_FORCE_DEMO=0` を指定できるようにした。今回のケースでは認証をE2E mockにし、利用者マスタもHTTPから読む。既存のmemory/demoテストは各boot helperの設定を維持する。

## Index Audit

[失敗したCI](https://github.com/yasutakesougo/audit-management-system-mvp/actions/runs/37737912457/job/113182324334)は `VITE_SP_RESOURCE` / `VITE_SP_SITE_RELATIVE` が未設定のため監査開始前に終了していた。workflowのAudit stepへrepository vars（空ならsecrets）を渡す修正を追加した。ダミー接続先で代用せず、接続設定の欠落を成功扱いにしない。

監査スクリプトはHTTP非成功・必須インデックス不足・予期しない例外でも終了コード0になる経路があった。合成HTTPを使った実CLIのテストで失敗を確認し、これらを終了コード1に修正した。正常なインデックス応答は0、drift候補の許容は従来どおり。

新しいCLIテストは `test:ci:required`、hookテストは `test:ci:kiosk-release` に組み込んだ。

既存の制約: advisorのリストにregistryの対応が見つからないと監査がスキップする。したがって終了コード0だけでは全リストの監査実施を証明できない。実CIの応答・対象リスト・スキップ理由・index reportを確認する必要がある。今回、本番の監査やインデックス変更はしていない。

## 検証結果

- 関連Unit + Audit CLI/token: **124 passed**（baselineの関連Unitは115 passed）。
- kiosk home / users / list / detail / toilet E2E: **36 passed**、Chromium、workers=1、retries=0。
- `npm run test:ci:kiosk-release`: exit 0（Node contract 8件、Unit 56件、E2E 21件）。
- `npm run typecheck` / `npm run lint`: exit 0。
- Node 24 workflow guard: 29対象workflow、57 setup-node使用箇所すべて適合。
- 独立エージェントの読み取り専用レビュー: 追加差分に重大・中程度の指摘なし。上記監査スキップの既存制約を確認。
- GitHub Linux CI: 補強差分では未実行。既存PRのDeep E2E失敗も未解消判定。

## 本番受入で残る確認

別段階の実施権限が得られた後、採用する正確なSHAとkiosk scopeのデプロイ結果を照合する。本番SharePoint上の利用者6のidentity、対象日・手順・既存記録の有無を確認する。

`/kiosk/users/6/procedures` → 詳細 → 観察入力 → 保存成功 → 一覧の記録済み・同じ内容 → 一覧再読み込み → 詳細再読み込みを実機で確認する。SharePointの親・子行と保存内容をreadbackし、別手順への誤反映や重複行がないことも確認する。

ローカル自動テストの合格を、本番SharePointへの保存確認や人による受入の代わりにはしない。
