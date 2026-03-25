# TransportCourse 移行 Runbook（Users_Master）

## 0. 概要

- 対象: `Users_Master` の送迎固定コース列
- 正式列名（SSOT）: `TransportCourse`
- 正式値: `isogo` / `kan2` / `kanazawa`
- 目的: 旧キー依存を段階的に解消し、`TransportCourse` へ統一する

---

## 1. 目的

- 送迎固定コースの正式列名を `TransportCourse` に統一する
- 旧キーは「互換読み取りのみ」の一時措置に限定する
- `/transport/assignments` の補完精度を維持しつつ、保守性を高める

---

## 2. 対象旧キー（fallback 読み取りのみ）

- `TransportCourseId`
- `TransportFixedCourse`
- `TransportRouteCourse`
- `Course`
- `course`
- `courseId`
- `transportCourse`
- `transportCourseId`
- `defaultTransportCourse`

注記:
- 実在列は環境ごとに異なる可能性があるため、事前にフィールド一覧で存在確認する

---

## 3. 移行期間（Phase A-D）

### Phase A: 読み替え併用（現行）

- コードは `TransportCourse` を主経路として読む
- 旧キーは fallback 読み取りのみ許可
- 書き込み・新規運用は `TransportCourse` のみ

完了条件:
- `Users_Master` に `TransportCourse` 列が存在
- 既存データ棚卸し（未設定件数・旧キー依存件数）が取得済み

### Phase B: 実データ移送（backfill）

- `TransportCourse` 未設定かつ旧キー値ありのレコードを正規化して移送
- 値は必ず `isogo` / `kan2` / `kanazawa` に正規化

完了条件:
- backfill 実行ログが残っている
- Spot check（最低10件 + サンプル利用者）で一致確認済み

### Phase C: 旧キー更新停止

- 運用上、旧キーは更新しない（読み取りだけ維持）
- 日次/週次で旧キー依存件数を監視

完了条件:
- 2週間連続で「旧キー依存件数 0 件」

### Phase D: fallback 削除

- アプリコードから旧キー fallback を削除
- テストを `TransportCourse` 単独経路へ寄せる

実施条件:
- 「2週間 fallback 依存 0 件」達成
- 直近の運用障害（送迎コース補完関連）なし

---

## 4. 判定条件（KPI）

最低限追う指標:

- `TransportCourse` 未設定件数
- `TransportCourse` 未設定 かつ 旧キー値あり件数（= fallback 依存件数）
- 正規化不能値件数（`isogo` / `kan2` / `kanazawa` に変換できない値）

推奨判定ライン:

- Phase B 完了: 正規化不能値が運用判断済み（0件が理想）
- Phase D 進行可: fallback 依存件数 0 件が 14 日継続

---

## 5. 実施手順

### Step 1: 列存在確認（`TransportCourse`）

```powershell
$siteUrl = "https://<tenant>.sharepoint.com/sites/<site>"
Connect-PnPOnline -Url $siteUrl -DeviceLogin

$field = Get-PnPField -List "Users_Master" -Identity "TransportCourse" -ErrorAction SilentlyContinue
if (-not $field) {
  Add-PnPField -List "Users_Master" -DisplayName "送迎固定コース" -InternalName "TransportCourse" -Type Text -AddToDefaultView
}
Get-PnPField -List "Users_Master" -Identity "TransportCourse" | Select-Object InternalName, Title, TypeAsString
```

### Step 2: 棚卸し（未設定・旧キー依存件数）

```powershell
pwsh ./scripts/transport-course-inventory.ps1 `
  -SiteUrl "https://<tenant>.sharepoint.com/sites/<site>" `
  -OutputDir "./artifacts/transport-course-migration"
```

出力ファイル:
- `transport-course-inventory-<timestamp>.csv`（全件棚卸し明細）
- `transport-course-inventory-summary-<timestamp>.json`（件数サマリ）

件数サマリで最低限確認する項目:
- `TransportCourseUnset`
- `FallbackDependent`
- `FallbackUnmappable`

### Step 3: backfill（Dry-run → 本実行）

```powershell
# 1) Dry-run（対象抽出 + 計画CSV生成）
pwsh ./scripts/transport-course-backfill.ps1 `
  -SiteUrl "https://<tenant>.sharepoint.com/sites/<site>" `
  -DryRun $true `
  -OutputDir "./artifacts/transport-course-migration"

# 2) 本実行（Dry-runで生成した計画CSVを入力）
pwsh ./scripts/transport-course-backfill.ps1 `
  -SiteUrl "https://<tenant>.sharepoint.com/sites/<site>" `
  -DryRun $false `
  -InputCsvPath "./artifacts/transport-course-migration/transport-course-backfill-plan-<timestamp>.csv" `
  -OutputDir "./artifacts/transport-course-migration"
```

出力ファイル:
- `transport-course-backfill-plan-<timestamp>.csv`（backfill 対象計画）
- `transport-course-backfill-results-<timestamp>.csv`（実行結果）
- `transport-course-backfill-rollback-<timestamp>.csv`（rollback 用入力）
- `transport-course-backfill-summary-<timestamp>.json`（件数サマリ）

補足:
- `TransportCourse` に既存値がある行は上書きしない
- 正規化不能値は `SKIP_INVALID_PROPOSED` として結果CSVに残る

### Step 4: Spot check

- SharePoint 上で更新済みレコードを目視確認
- `/transport/assignments` で「同曜日デフォルト適用」後、想定コースが自動補完されることを確認
- `/today` 車両ボードでコースChip表示が一致することを確認

### Step 5: fallback 維持期間の監視

最短実行（初回ループ一括）:

```powershell
pwsh ./scripts/transport-course-initial-loop.ps1 `
  -SiteUrl "https://<tenant>.sharepoint.com/sites/<site>"
```

補足:
- 上記1コマンドは `inventory -> backfill(dry-run) -> append-tracking` を順に実行する
- `-Comment` / `-NextAction` を指定すると tracking CSV の同列へそのまま保存される

- 日次 or 週次で Step 2 を再実行
- fallback依存件数を記録（運用台帳/チケット）
- テンプレート: `docs/runbooks/templates/transport-course-fallback-tracking.csv`

```powershell
pwsh ./scripts/transport-course-append-tracking.ps1 `
  -InventorySummaryPath "./artifacts/transport-course-migration/transport-course-inventory-summary-<timestamp>.json" `
  -BackfillSummaryPath "./artifacts/transport-course-migration/transport-course-backfill-summary-<timestamp>.json" `
  -TrackingCsvPath "./docs/runbooks/templates/transport-course-fallback-tracking.csv" `
  -RecordDate "2026-03-25" `
  -Comment "weekly inventory + dry-run" `
  -NextAction "rerun inventory in 1 day"
```

初回ループの固定実行例（inventory -> dry-run -> append）:

```powershell
$dir = "./artifacts/transport-course-migration"

pwsh ./scripts/transport-course-inventory.ps1 `
  -SiteUrl "https://<tenant>.sharepoint.com/sites/<site>" `
  -OutputDir $dir

pwsh ./scripts/transport-course-backfill.ps1 `
  -SiteUrl "https://<tenant>.sharepoint.com/sites/<site>" `
  -DryRun $true `
  -OutputDir $dir

$inv = (Get-ChildItem "$dir/transport-course-inventory-summary-*.json" | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
$bf  = (Get-ChildItem "$dir/transport-course-backfill-summary-*.json"  | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName

pwsh ./scripts/transport-course-append-tracking.ps1 `
  -InventorySummaryPath $inv `
  -BackfillSummaryPath $bf `
  -TrackingCsvPath "./docs/runbooks/templates/transport-course-fallback-tracking.csv" `
  -RecordDate "2026-03-25"
```

記録する最小項目:
- `record_date`
- `inventory_total_items`
- `inventory_unset_count`
- `backfill_target_count`
- `fallback_hit_count`
- `comment`
- `next_action`

項目マッピング:
- `inventory_total_items` <- `transport-course-inventory-summary-*.json` の `TotalItems`
- `inventory_unset_count` <- `transport-course-inventory-summary-*.json` の `TransportCourseUnset`
- `fallback_hit_count` <- `transport-course-inventory-summary-*.json` の `FallbackDependent`
- `backfill_target_count` <- `transport-course-backfill-summary-*.json` の `TargetRows`

### Step 6: fallback 削除PR

- 条件: fallback依存件数 0 件が14日継続
- 実施内容:
  - 旧キー読み取りコード削除
  - fallback前提テスト削除/更新
  - docs の「互換ポリシー」を終了状態へ更新
- PRテンプレート: `docs/runbooks/templates/transport-course-fallback-removal-pr-template.md`

---

## 6. 失敗時の戻し方（Rollback）

- backfillで誤更新が疑われる場合:
  - 旧キー fallback 読み取りは維持されているため、即時サービス停止は不要
  - `transport-course-backfill-rollback-<timestamp>.csv` を入力にして `TransportCourse` を再修正
- 原則:
  - 既存の `TransportCourse` 値は上書きしない運用で実施し、誤更新リスクを最小化する

```powershell
# rollback 入力CSVを使って元値へ戻す例
$rows = Import-Csv "./artifacts/transport-course-migration/transport-course-backfill-rollback-<timestamp>.csv"
foreach ($row in $rows) {
  Set-PnPListItem -List "Users_Master" -Identity ([int]$row.Id) -Values @{ TransportCourse = $row.RollbackTransportCourseRaw } | Out-Null
}
```

---

## 7. 完了判定（DoD）

- `TransportCourse` が正式列として運用文書に明記済み
- backfill 完了後、fallback依存件数が継続的に減少し、最終的に 0 件
- 削除条件（14日ゼロ）を満たした後に fallback 削除PRを実施済み
