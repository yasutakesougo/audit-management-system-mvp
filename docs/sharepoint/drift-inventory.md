# SharePoint drift inventory (docs-only baseline)

## Scope
- 調査対象: `src/sharepoint/**`, `src/lib/**`, `src/domain/**`, `tests/**`, `docs/**`, worker/api/route 周辺
- 実装変更なし、テスト変更なし、環境変数や `.env` への変更なし
- 既存未コミット差分を触らない前提（事前確認: clean state）

## 1. 取得できた SharePoint List 一覧

### Registry 由来（`SP_LIST_REGISTRY`）
- `support_cases`
- `support_case_documents`
- `support_case_documents` の参照/関連項目
- `support_case_events`
- `support_case_restricted_documents`
- `schedule_events`
- `support_procedure_results`
- `approval_logs`
- `survey_tokusei`
- `survey_tokusei_v2`
- `nurse_observations`
- `official_forms`
- `billing_orders`
- `billing_summary`
- `pdf_output_log`
- `call_logs`
- `toilet_records`
- `meeting_sessions`
- `meeting_steps`
- `meeting_minutes`
- `monitoring_meetings`
- `users_master`
- `user_feature_flags`
- `user_transport_settings`
- `user_benefit_profile`
- `user_benefit_profile_ext`
- `staff_master`
- `org_master`
- `holiday_master`
- `daily_attendance`
- `attendance_users`
- `attendance_daily`
- `staff_attendance`
- `transport_log`
- `compliance_check_rules`
- `diagnostics_reports`
- `drift_events_log`
- `remediation_audit_log`
- `support_record_daily`
- `support_procedure_record_daily`
- `support_record_rows`
- `daily_activity_records`
- `service_provision_records`
- `abc_behavior_records`
- `handoff`
- `support_templates`
- `plan_goals`
- `support_plans`
- `iceberg_pdca`
- `iceberg_analysis`
- `isp_master`
- `planning_sheet_master`
- `behavior_monitoring_master`
- `planning_sheet_reassessment_master`

### 補足
- 上記は `spListRegistry` 系で参照されるリストキー集合（`tests/unit/spListHealthCheck.spec.ts` にも長さが固定化）  
- 一部リストは drift 対象外/実験的扱い（`supportCase` 系など）で、運用上の除外ルールあり

## 2. 取得できた Field 一覧（drift 関連）
- 共通: `ID`, `Title`（drift 生成/補完ロジックが `Id`, `Title` を自動付加して比較）
- `supportCaseFields` 系:
  - `support_case_*` 参照で `support_cases` と関連ドキュメント・イベントの整合確認が実装側で利用
- `staffFields` 系:
  - `users_master`, `staff_master` のユーザー系キーと `ID` 系のキー名
- `buildListSpecs` 由来で補完される必須フィールド:
  - `buildListSpecs()` が内部で各 ListSpec に対して必須/比較対象を再構築
  - `skipTitleEssential` の例外扱いあり（特定リストでは Title が未指定時も許容）
- `drift` では “display name がない/曖昧な項目” が増えるため、`InternalName` と `DisplayName` を一致判定せずに運用している箇所がある

## 3. InternalName / DisplayName の揺れ
- `support_case_documents` や診断レポート系で、UI 表示名と OData 対象名の分離（`getFieldInternalName` / `fieldTitleMap` 系）を前提とする実装が散見される
- 既存コード内には日本語 display と内部名が混在しうる想定コメントがあり、同一 List 内でも `internal=title` 系の扱いが一貫しない箇所がある
- 証拠:
  - `src/sharepoint/spListConfig.ts`
  - `src/sharepoint/fields/fieldUtils.ts`
  - `src/sharepoint/fields/staffFields.ts`
  - `src/sharepoint/fields/supportCaseFields.ts`

## 4. OData 利用箇所
- `$select` / `$filter` / `$expand` / `$orderby` の利用箇所:
  - `src/lib/sp/spListRead.ts`
  - `src/sharepoint/query/builders.ts`
  - health/diff 周辺: `src/pages/admin/DataIntegrityPage.tsx`, `src/features/diagnostics/health/*`, `src/pages/HealthPage.tsx`
- `queryGuard` はクエリ安全性を検査しつつ、`throwOnHighRisk` が失敗停止に必ず寄与しない構成（既定 false かつ fail-open 特性の説明が必要）
  - `src/lib/sp/queryGuard.ts`

## 5. 環境変数依存
- 主要:
  - `VITE_SP_LIST_BILLING_ORDERS_SITE_RELATIVE`
  - `VITE_FEATURE_SUPPORT_CASE_SHAREPOINT_DIAGNOSTICS`
  - `VITE_SP_SITE_RELATIVE`, `VITE_SP_SITE_URL`
  - `VITE_SP_BULK_READ_BATCH_SIZE` など読み取り挙動の安全域に効く設定
- 依存箇所:
  - `src/lib/sp/config.ts`
  - `src/lib/sp/spListRead.ts`
  - `src/sharepoint/spListRegistry.ts`
  - `src/sharepoint/spListConfig.ts`
  - `src/pages/admin/DataIntegrityPage.tsx`

## 6. driftProbeTargets / driftProbeRegistry 設計意図
- `getDriftProbeTargets()`:
  - `lifecycle === required | optional` のみを driftProbe 対象に含める設計
  - support_case 系は `experimental` をデフォルト扱い
  - `billing_orders` は site 相対パス差異がある場合は `cross-site` で除外
- `driftProbeRegistry`:
  - 実データ監査に直結する targets 供給を責務
  - `getDriftProbeTargets` の結果を UI 側（DataIntegrity）・診断ページ側で再利用
- 根拠:
  - `src/sharepoint/driftProbeRegistry.ts`
  - `src/sharepoint/supportCaseDiagnosticsPreflight.ts`
  - `src/sharepoint/__tests__/driftProbeRegistry.spec.ts`

## 7. tests で固定された仕様
- `SP_LIST_REGISTRY` 件数固定（`54`）と title/guid 変換仕様のテスト固定
  - `tests/unit/spListHealthCheck.spec.ts`
- `getDriftProbeTargets()` の lifecycle/追加条件
  - `src/sharepoint/__tests__/driftProbeRegistry.spec.ts`
  - `src/sharepoint/__tests__/supportCaseDiagnosticsPreflight.spec.ts`
- `supportCaseFields` と `buildSupportCaseSchema` の形状仕様
  - `src/sharepoint/fields/__tests__/supportCaseFields.spec.ts`
  - `tests/unit/spListConfig.spec.ts`

## 8. 触ってはいけない実装領域（初期方針）
- `src/sharepoint/spListRegistry.ts` / `src/sharepoint/spListConfig.ts` の核ロジック
- `src/lib/sp/spListRead.ts` の Query 生成と safety path
- `src/lib/sp/queryGuard.ts`（リスク扱いの仕様変更は監査対象）
- `src/sharepoint/driftProbeRegistry.ts`（drift 対象定義の挙動）
- `src/pages/admin/DataIntegrityPage.tsx`（運用上の診断 UI）

## 9. 未テストまたは高リスク領域
- `queryGuard` の high-risk 判定と fail-open 挙動の監査
- `display name` と `internal name` の完全一致前提での運用
- environment-based 分岐（site relative）を含む cross-site drift の境界
- List ごとの `select` / `expand` 追加時の権限/パフォーマンス/コスト監査

## 10. 人間確認が必要な事項
- SharePoint 側での実体 list title / field internalName の最終確定照合
- drift 対象 54 リストと実運用環境の差分（特に `support_cases` と `billing_orders`）
- `spListHealthCheck` のコメント「全24リスト」など説明文と実装整合
- `queryGuard` の既定値を継続する判断（fail-open 継続か）
