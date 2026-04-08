# ナビゲーションOS設計書 (Navigation IA)

本システムのサイドメニューは、単なるリンク集ではなく、ユーザーの役割や業務状況（キオスク、フォーカスなど）に応じて最適な業務面を提示する「ナビゲーションOS」として設計されています。

## 1. 情報設計 (7-Group IA)

ナビゲーション項目は必ず以下の7つのグループのいずれかに属します。順番は業務フローに沿っています。

| グループキー | 表示名 | 設計意図・対象業務 |
| :--- | :--- | :--- |
| `today` | Today | **現場の当日実行**: スケジュール確認、送迎、日中の記録、申し送り等 |
| `records` | Records | **記録・振り返り**: 過去の記録の閲覧、サマリー確認、月次業務日誌等 |
| `planning` | Planning | **支援計画・評価**: アセスメント、ISP（個別支援計画）の作成・更新、分析等 |
| `operations` | Operations | **拠点運営**: 請求、勤怠管理、コンプライアンス報告、リソース管理等 |
| `billing` | Billing | **請求**: 請求処理に特化したワークスペース |
| `master` | Master | **マスタ管理**: 利用者マスタ、職員マスタ等 |
| `platform` | Platform | **管理基盤**: システム設定、自己点検、ログ確認等の管理機能 |

## 2. 表示制御のエントリポイント (Navigation Contract)

ナビゲーションの表示判定は、UIコンポーネント内で行わず、必ず `src/app/config/navigationConfig.helpers.ts` の **`buildVisibleNavItems`** を通すこと。これが Navigation OS の唯一の実行契約（Contract）である。

## 3. 表示制御の5層フィルター

サイドメニューの項目は、以下の順序でフィルタリング（`buildVisibleNavItems` 内で実行）され、最終的な露出が決定されます。

1. **Role フィルター (`audience`)**: 利用者の権限（Admin, Staff, Reception）に基づいて項目を絞り込む。
2. **Feature Tier (`tier`)**: `Core` (常時), `More` (トグル内), `Admin` (管理者エリア) に分類。
3. **Kiosk モード**: 現場端末（キオスク）では `today` グループ以外を非表示にし、誤操作を防止する。
4. **Focus モード**: 全画面表示が必要な場合、サイドメニュー全体を一時的に隠蔽する。
5. **User Preference**: ユーザーが設定画面から特定のグループや項目を個別に非表示にできる。

## 3. 変更・追加ルール

新規画面を追加する際は、以下のチェックリストを遵守してください。

- [ ] **グループの選定**: 上記7グループのどこに属すべきか？（「とりあえず末尾」は禁止）
- [ ] **権限の設定**: 誰が見るべきか？ (`all`, `staff`, `admin`, `reception`)
- [ ] **ティアの選定**: 頻繁に使う `core` か、たまに使う `more` か？
- [ ] **検索性の確保**: `label` が直感的か？（メニュー検索でヒットするか）
- [ ] **回帰テストの更新**: `tests/unit/app/config/navigationConfig.spec.ts` にテストを追加したか。

## 開発フロー

1. **ルーター登録**: `src/app/router.tsx`
2. **ナビ構成登録**: `src/app/config/navigationConfig.ts` の `createNavItems()`
3. **アイコン対応**: `src/app/navIconMap.ts`
4. **テスト作成**: `tests/unit/app/config/navigationConfig.spec.ts`
