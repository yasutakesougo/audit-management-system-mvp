# fix(sharepoint): stabilization and drift resistance for daily / operational lists

## 概要
E2Eテストの安定化、SharePoint 通信のハードニング（Fail-Open/Lane-Isolation）、および主要な運用リストへのスキーマドリフト耐性（Drift Resilience）の横展開を統合しました。

これにより、SharePoint 側の内部名変更（サフィックス付与等）への耐性を高めつつ、高負荷時や遅延時にもシステムが停止しない堅牢な基盤を実現しました。

## 変更内容
### ハードニング & E2E 安定化
- **SharePoint 通信の堅牢化:** Fail-Open 設計に基づくエラーハンドリングとレーン割り当ての最適化
- **E2E テストの安定化:** セレクタのスコープ限定によるロケータの安定化、および重複検出の解消
- `artifacts/stabilization_7day_field_check_sheet.md`: 運用移行後の 7日間健全性確認シートを追加
- `tests/e2e/dump-health.spec.ts`: 診断結果のエビデンス取得用テストを追加

### スキーマドリフト耐性 (Drift Resilience)
- **ドリフト耐性定義の横展開 (CANDIDATES / ESSENTIALS):**
  - `meeting_minutes` (議事録)
  - `handoff` (引き継ぎ)
  - `meeting_sessions` (会議セッション)
  - `nurse_observations` (看護観察)
  - `daily_activity_records` (日次活動記録)
- **新規ドリフト検証テスト (29件):** 
  - `meetingMinutesFields.drift.spec.ts` 等を追加、計145件のテストで物理名の揺れをカバー

### 修正・調整
- `HealthPage.tsx`: 主要運用リストを診断レジストリ `DRIFT_CANDIDATES_BY_KEY` に追加
- `DataProviderDailyRecordRepository.ts`: `washRow` / `washRows` による動的解決の適用

## テスト
- [x] 既存 E2E テスト通過 (`daily.records-flow.spec.ts`)
- [x] ドリフト検証テスト通過 (145/145 pass)
- [x] 型チェック & ESLint 通過

## 影響範囲
- DailyRecord 機能の表示・保存処理（堅牢化と名前解決の両面で強化）
- 管理画面の診断機能（すべての主要リストが監視対象に）
