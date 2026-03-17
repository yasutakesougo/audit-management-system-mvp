# Operations Change Log

> **目的**: 本番環境への変更をすべて記録し、障害時の原因特定を即座に行えるようにする  
> **ルール**: Production 環境に変更を入れたら必ず 1 エントリ追記する  
> **対象**: SharePoint 設定変更 / List 作成・削除 / Index 追加 / Power Automate 変更 / Automation 変更  
> **対象外**: UI 変更 / TypeScript 修正 / テスト追加（これらは PR で追跡）

---

## 記入フォーマット

```
## YYYY-MM-DD

### [変更カテゴリ]

- 変更内容1
- 変更内容2

Operator: [実施者]
Environment: [実施環境]
Issue: [関連Issue番号]
```

---

## 2026-03-17

### SharePoint Provisioning (#973 / #974 / #975)

#### リスト作成 (#973)
- `Holiday_Master` list created (6 columns: Title/Date/Label/Type/FiscalYear/IsActive + Date index)
- `PdfOutput_Log` list created (10 columns + 3 indexes: OutputType/UserCode/OutputDate)

#### インデックス追加 (#974)
- `DailyActivityRecords`: UserCode, RecordDate (2 indexes added)
- `SupportRecord_Daily`: UserId, 記録日 (2 indexes added) ※不要な AM活動/Completed も追加（影響なし）
- `Schedules`: EventDate, MonthKey, ServiceType (3 indexes added)
- **未作成リスト（対象外）**: AttendanceDaily, ServiceProvisionRecords, Transport_Log, SupportProcedureRecord_Daily
  - → SharePoint 上に未プロビジョニングのため、インデックス追加は将来対応
  - → Runbook Section 3.1 に必須設定として記録済み

#### 一意制約 (#975)
- `Users_Master.UserID` duplicate check: passed → unique constraint enabled

#### Holiday_Master 仕上げ
- Title 列 → 「祝日名」に変更: 完了
- 祝日データ 18件投入: 完了

Operator: sougo  
Environment: SharePoint Web UI (manual) + Browser subagent — Tenant: isogokatudouhome / Site: /sites/welfare  
Issue: #973 #974 #975 #976(closed, no target)

---

<!-- 次のエントリはここに追記 -->
