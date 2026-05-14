# PR: fix(daily): restore unsent record sync for monthly KPI evidence

## Root cause
石渡さん I005 の completedRows が月次KPIに反映されなかった主因は、月次KPIロジックではなく、17行証跡が DailyRecordRows へ到達していなかったこと。

その原因は、親リスト `SupportRecord_Daily` の日付列 internal name が環境により `RecordDate` ではなく `Date` 等になっており、保存処理が `RecordDate` 固定で POST して 400 Bad Request になっていたこと。

SharePoint throttling は、未送信データの再試行や一括同期によって発生した二次症状として扱う。

---

## Scope
- SupportRecord_Daily parent schema drift handling
- Unsent daily table recovery visibility
- Kiosk / execution record parent creation
- DailyRecordRows 到達性の回復
- No plannedRows formula changes
- No Daily_Attendance date-field fix
- No billing/addition decision changes
- No Business Journal Preview changes

---

## 修正内容

### 1. 親リストスキーマの動的解決 (`SchemaResolver.ts`, `Saver.ts`, `SharePointDailyRecordRepository.ts`)
- `DailyRecordSchemaResolver` に `resolveParentFields` を実装し、リストの `fields` API から取得した実際のスキーマと照合して、日付列やタイトル列などの内部名を動的にマッピングするよう改修。
- `DailyRecordSaver` の `save()` メソッドにて、ハードコードされていた `RecordDate` を廃止し、`resolvedParentFields.recordDate` を使用してペイロードを構築するよう修正。

### 2. Kiosk実行記録リポジトリの改修 (`SharePointExecutionRecordRepository.ts`)
- 実行記録作成時の親レコード存在確認・作成処理（`ensureParentRecord`）において、動的解決された日付列およびタイトル列を使用するよう修正し、`400 Bad Request` の発生を根本から防止。

### 3. 未送信行の表示フィルタ補正 (`useTableDailyRecordRowHandlers.ts`)
- `showUnsentOnly` 状態の際、まだコンテンツが入力されていない行であっても、未送信状態として正しく画面に表示（フォールバック表示）されるようロジックを修正。これにより「未送信バッジ数はあるのに画面は空っぽ」というUI不整合を解消。

---

## 追加・拡張したテスト仕様

本PRの品質と後方互換性を担保するため、以下の5つの要件に対する単体テストを追加し、既存のテストとともに全件 PASS することを確認しました。

1. **SchemaResolver 動的解決の検証** (`DailyRecordSchemaDrift.spec.ts`)
   - `SupportRecord_Daily` の日付列が `RecordDate` ではなく `Date` の場合でも、`resolveParentFields` が正しく内部名を解決できることを検証。
2. **Saver リポジトリの動的ペイロード検証** (`DailyRecordSchemaDrift.spec.ts`)
   - 保存リクエストの POST/MERGE ペイロードにおいて、`RecordDate` ではなく `Date` が使用されることを検証。
3. **ExecutionRecord 親レコード作成の検証** (`SharePointExecutionRecordRepository.spec.ts`)
   - `ensureParentRecord` が解決済みの親日付フィールド（`Date`）を使用して正しく親レコードを生成することを検証。
4. **未送信表示モードのフォールバック検証** (`useTableDailyRecordRowHandlers.spec.ts`)
   - `showUnsentOnly=true` のとき、未送信対象の行が正しく `visibleRows` に出力され、画面に表示されることを検証。
5. **400 Bad Request 再発防止の回帰テスト** (`SharePointExecutionRecordRepository.spec.ts` / `DailyRecordSchemaDrift.spec.ts`)
   - `RecordDate` が存在しない環境においてもエラーを再発させず、正常にアイテム処理が完結することを検証。

---

## マージ後確認 (Post-Merge Verification)
1. /admin/status が PASS
2. /daily/table で未送信行が表示される
3. 未送信保存を1回実行
4. 未送信件数が減る、または0になる
5. DailyRecordRows に I005 / 2026-05 の行が作成される
6. /records/monthly で再集計
7. I005 の completedRows が増える
