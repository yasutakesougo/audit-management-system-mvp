## Handoff: Monitoring Meeting integration & Schema Stabilization — 2026-04-10

### 1. 完了したこと
- [x] Monitoring Meetings の SharePoint Registry 登録 (`spListRegistry.ts`)
- [x] 30項目以上の provisioningFields（自己修復メタデータ）の定義
- [x] 診断ページ (`HealthPage.tsx`) への `monitoring_meetings` 特化型書き込みテスト（mock）の追加
- [x] `MONITORING_MEETING_ESSENTIALS` の Option A 適応（3点への revert と contract 再整合）
- [x] 関連テスト（drift, schema resolver, governance integration）の Green 確認

### 2. 現在の状態
- ブランチ: N/A (Local edits applied)
- ビルド: ✅ (npm run dev running)
- テスト: ✅ (drift/resolver/integration pass)

### 3. 残課題
| # | 課題 | 優先度 | 見積もり | 備考 |
|---|------|:------:|---------|------|
| 1 | 実環境での `HealthPage` 実行確認 | 高 | 10分 | 現場環境での "Repair" 動作の目視確認 |
| 2 | 監査ダッシュボードへの「未確定モニタリング」シグナルの反映確認 | 中 | 20分 | `auditChecks.ts` との最終連動確認 |

### 4. 次の1手
管理画面の `HealthDiagnosisPage` で `MonitoringMeetings` のステータスを確認し、必要に応じて「Repair」を実行して現場環境を最新スキーマに適合させる。

### 5. コンテキスト（次のAIが知るべきこと）
- **設計判断 (Option A)**: `monitoring_meetings` の `essentialFields` は `recordId / userId / meetingDate` の 3点に限定しています。これは「表示継続可能性」を FAIL 水準とし、その他の項目（status, qualityCheck 等）は WARN 水準で監視するという既存アーキテクチャ契約に基づいています。
- **注意点**: `spListRegistry.ts` の `provisioningFields` は 30項目以上定義されています。Essentials が 3点でも、自己修復機能はこの全項目を対象に動作します。
- **参照ファイル**:
  - `src/sharepoint/spListRegistry.ts`: リスト定義の SSOT
  - `src/sharepoint/fields/monitoringMeetingFields.ts`: フィールド候補と Essentials 契約
  - `src/sharepoint/fields/__tests__/monitoringMeetingFields.drift.spec.ts`: ドリフト耐性テスト

### 6. 関連Issue/PR
| 種別 | # | 状態 |
|------|---|:----:|
| Task | Monitoring Integration | 完了 (schema/infra layer) |
