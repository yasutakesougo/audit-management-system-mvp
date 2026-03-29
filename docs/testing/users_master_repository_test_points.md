# Repository テスト観点一覧 (Users_Master 分割対応)

`DataProviderUserRepository` の分割統治（Split Architecture）が正しく機能し、既存機能に影響を与えていないことを検証するためのテスト観点です。

## 1. 読み取り (Read) の検証

### 1-1. セレクトモード別の参照範囲
*   [ ] **Mode: `core` / `minimal`**
    *   `Users_Master` のみに対してクエリが蓄積・実行されていること。
    *   分離先リスト（Transport/Benefit）への追加リクエストが発生していないこと。
    *   一覧画面の表示速度に悪影響がないこと。
*   [ ] **Mode: `detail` / `full`**
    *   `Users_Master` 取得後に、分離先リストへの Join リクエストが並列 (`Promise.all`) で実行されていること。
    *   `UserID` をキーとして正しくマージされ、UI にすべてのフィールド（送迎・支給量）が渡されること。

### 1-2. Join 失敗・データ欠損時の挙動
*   [ ] **分離先レコード不在**
    *   `Users_Master` には存在するが、`UserTransport_Settings` 等にレコードがない場合、ドメインオブジェクトの該当フィールドが `null` またはデフォルト値になり、エラーで停止しないこと。
*   [ ] **分離先リストのアクセスエラー (404/403)**
    *   分離先リストの設定ミスや権限不足で Join に失敗しても、監査ログ (`lazy_join_failed`) を出力した上で、Core データのみで返却を継続すること（疎結合の維持）。

## 2. 書き込み (Write) の検証

### 2-1. ペイロード分割 (Split Write)
*   [ ] **新規作成 (create)**
    *   `Users_Master` に基本情報が作成された後、その `UserID` を用いて 2つの分離先リストに新規レコードが挿入されること。
*   [ ] **更新 (update)**
    *   更新ペイロードに含まれるフィールドに応じて、適切なリストのみに `updateItem` が発行されること。
    *   例：氏名のみ更新なら `Users_Master` のみ、送迎設定のみなら `UserTransport_Settings` のみが更新対象。

### 2-2. 分離先リストの Upsert 整合性
*   [ ] **初回 Upsert**
    *   `Users_Master` にはデータがあるが、分離先リストにまだレコードがない状態で詳細更新を行った場合、分離先に `createItem` が発行され、データが紐付くこと。
*   [ ] **重複回避**
    *   `UserID` による検索が正確に行われ、同じ利用者の設定が重複して作成されないこと。

## 3. 止血・フォールバックの検証

### 3-1. 列サイズ超過時の動作
*   [ ] **500 エラーの受容**
    *   何らかの理由で `Users_Master` への列追加が試行され 500 エラーが発生しても、`schema_limit_exceeded` として処理が継続され、アプリがクラッシュしないこと。
*   [ ] **緊急フォールバック (CORE/MINIMAL)**
    *   `detail` 取得が `Users_Master` 本体のスキーマエラー（列削除など）で失敗した場合、自動的に `core` モードのリトライトライが行われ、氏名等の最低限の情報が表示されること。

## 4. データ整合性 (Identity Integration)

### 4-1. UserID の一貫性
*   [ ] **不変性の確認**
    *   分離先リストの結合キーである `UserID` が、書き込みやマージの過程で書き換わったり、大文字・小文字の差異で不一致にならないこと。
*   [ ] **空文字・不正値ハンドリング**
    *   `UserID` が空のレコードが `Users_Master` に混入していても、安全にスキップまたは警告されること。

## 5. 推奨されるテスト実装形態
*   **Unit Test (Vitest)**: `DataProviderUserRepository` に `InMemoryDataProvider` を注入し、モックデータを用いた分割・結合ロジックの網羅的検証。
*   **Integration Test (Playwright)**: 開発環境の SharePoint 実機（または LocalStorage）を用いて、実際に 3つのリスト間をまたぐ CRUD 操作の完遂を確認。
