# Investigation Findings - 2026-07-14

- 基準コミット: `776335643564b599683fecb3169097e3eb2d7825`
- 調査worktree: `C:\tmp\audit-management-system-mvp-investigation`

## FINDING-001: 月次CSV文書が旧 `MonthlySummaryExcel` 名を参照している

- 分類: 契約差異 C
- 基準コミット: `776335643564b599683fecb3169097e3eb2d7825`
- 対象ファイル: `docs/audit/phase4-monthly-csv-export-contract.md`, `docs/audit/phase4-monthly-billing-flow-boundary.md`, `docs/security/*xlsx*`, `src/features/reports/monthly/MonthlySummaryCsv.ts`
- 現在の挙動: 実装とテストは `MonthlySummaryCsv` だが、複数文書が `MonthlySummaryExcel.ts` と `MonthlySummaryExcel.spec.ts` を根拠としている。
- 期待される挙動: 文書は現行ファイル名 `MonthlySummaryCsv` を参照し、旧名は過去経緯としてのみ残す。
- 証拠: `rg -n "MonthlySummaryExcel|MonthlySummaryCsv" src tests docs`
- 利用者影響: 直接の画面影響なし。
- データ影響: なし。
- CI影響: 調査者が存在しないテストパスを実行する可能性がある。
- 再現手順: `Test-Path src/features/reports/monthly/MonthlySummaryExcel.ts` はfalse、`Test-Path src/features/reports/monthly/MonthlySummaryCsv.ts` はtrue。
- 修正候補: 文書内参照を現行名へ更新し、旧名renameの扱いを「完了済み/履歴」として明記する。
- 修正対象外: CSV出力挙動変更、追加rename。
- 推奨PR境界: docs-only PR。
- 依存する作業: なし。
- 完了判定: `rg "MonthlySummaryExcel" docs src tests` が履歴説明以外で残らない。

## FINDING-002: Route診断リストと実Routeに表現差がある

- 分類: Route/Nav契約差異
- 基準コミット: `776335643564b599683fecb3169097e3eb2d7825`
- 対象ファイル: `src/app/routes/appRoutePaths.ts`, `src/app/routes/*Routes.tsx`, `src/app/hubs/hubDefinitions.ts`, `src/features/nurse/routes/NurseRoutes.tsx`
- 現在の挙動: `appRoutePaths.ts` は `users/new`, `staff/new`, `kiosk-users`, `kiosk-procedures` などを含むが、実Route定義からは同名pathを確認できない。一方で実Routeには `records/quality-review`, `exceptions`, `/nurse/*` など、明示リスト側にない入口がある。
- 期待される挙動: 診断リストは実Route、nested route、Hub動的routeの差分を区別して表示する。
- 証拠: NodeによるRoute抽出で実Route100件、明示リスト102件。差分候補あり。
- 利用者影響: ナビ診断や到達可否調査で誤判定が起きる。
- データ影響: なし。
- CI影響: Router/Nav整合テストがfalse positive/false negativeになり得る。
- 再現手順: `src/app/routes/appRoutePaths.ts` と `path:` 定義を抽出して比較する。
- 修正候補: `appRoutePaths` を単純なpath配列ではなく、`explicit`, `nested`, `hubGenerated`, `legacyAlias` に分類する。
- 修正対象外: 画面遷移挙動変更。
- 推奨PR境界: Route/Nav診断PR。
- 依存する作業: Hub生成routeの許容ルール決定。
- 完了判定: 差分が「未実装」「nested」「hub生成」「legacy alias」のいずれかに分類される。

## FINDING-003: `test:ci` がunhandled errorを成功扱いにできる

- 分類: CI false green
- 基準コミット: `776335643564b599683fecb3169097e3eb2d7825`
- 対象ファイル: `package.json`
- 現在の挙動: `test:ci` に `--dangerouslyIgnoreUnhandledErrors` が含まれる。
- 期待される挙動: required CIはunhandled errorを失敗として扱う。例外的な吸収はnightly診断などに分離する。
- 証拠: `package.json` script `test:ci`。
- 利用者影響: 品質保証済みと見えるPRにランタイム異常が残る。
- データ影響: 間接的。保存系のunhandled rejectionを見逃す可能性がある。
- CI影響: P1。false greenの直接要因。
- 再現手順: `rg -n "dangerouslyIgnoreUnhandledErrors" package.json vitest.config.ts`
- 修正候補: required用scriptを `test:ci:required` へ寄せ、dangerous optionはnightly/diagnostic名に限定する。
- 修正対象外: 失敗テストの個別修正。
- 推奨PR境界: CIコマンド整理PR。
- 依存する作業: required checksの実際のGitHub設定確認。
- 完了判定: required CIでdangerous optionが使われない。

## FINDING-004: E2E skipが機能未完成・環境差分・データ不足を混在している

- 分類: CI/テスト信頼性
- 基準コミット: `776335643564b599683fecb3169097e3eb2d7825`
- 対象ファイル: `tests/e2e/*`, `docs/CATEGORY_C_SKIPS.md`, `docs/E2E_SKIP_INVENTORY.md`
- 現在の挙動: `test.skip(true, ...)`, 無条件 `test.skip()`, env依存skip、SharePoint実環境skipが混在する。
- 期待される挙動: skip理由を「未実装」「環境未接続」「データなし」「一時flaky」「意図的対象外」に分類する。
- 証拠: `rg -n "test\\.skip|describe\\.skip|test\\.fixme" tests docs/CATEGORY_C_SKIPS.md docs/E2E_SKIP_INVENTORY.md`
- 利用者影響: E2E greenから機能完成度を判断しにくい。
- データ影響: なし。
- CI影響: P2。false greenの補助要因。
- 再現手順: skip検索を実行し、スケジュール・nurse・monthly・usersで分類する。
- 修正候補: skip台帳を現行specに再同期し、無条件skipはIssue/契約名を必須にする。
- 修正対象外: skip解除。
- 推奨PR境界: E2E skip台帳PR。
- 依存する作業: `test:ci` false green整理。
- 完了判定: 各skipが分類と再実行条件を持つ。

## FINDING-005: schedules gateは403/timeout後に楽観的に画面到達を許可する

- 分類: 認証・環境診断境界
- 基準コミット: `776335643564b599683fecb3169097e3eb2d7825`
- 対象ファイル: `src/app/ProtectedRoute.tsx`, `src/features/schedules/errors.ts`
- 現在の挙動: schedules list checkで401/403/429/5xx/timeoutをretry後、非404はoptimistic readinessに進む。7秒escape hatchもある。
- 期待される挙動: 画面到達許可とデータ操作可否を分け、403/timeout/404を運用診断で明確に分類する。
- 証拠: `ProtectedRoute.tsx` の list check retry、`sp_gate_escape_hatch` health event。
- 利用者影響: 画面は開くが、保存・読取で後続エラーになる場合がある。
- データ影響: 操作失敗の扱い次第。
- CI影響: SharePoint連携E2Eで環境不具合と製品不具合の判別が難しくなる。
- 再現手順: `ProtectedRoute` の `flag === 'schedules'` list check分岐を確認する。
- 修正候補: Route guardは到達可否、Repositoryは操作可否、UIは環境診断をそれぞれ別表示にする。
- 修正対象外: schedules UIの機能改善。
- 推奨PR境界: 認証/SharePoint診断PR。
- 依存する作業: SP 403/404分類の受け入れ基準。
- 完了判定: CIログとUI上で403、404、timeout、auth expiredが区別できる。

## FINDING-006: Billing精算状態はSharePoint列未解決時にLocalStorage fallbackへ落ちる

- 分類: 永続化境界
- 基準コミット: `776335643564b599683fecb3169097e3eb2d7825`
- 対象ファイル: `src/features/billing/hooks/useBillingSummary.ts`, `src/features/billing/ui/BillingPage.tsx`, `docs/ops/billing-local-payment-state-runbook.md`
- 現在の挙動: `PaymentStatus` 未解決時は `app:billing:payment_states` を読み書きし、CSV出力前に警告を出す。
- 期待される挙動: 正式な請求CSVとして扱える条件が、SharePoint列解決状態と明確に紐づく。
- 証拠: `useBillingSummary.spec.ts` の fallback/SharePoint正本テスト、代表Vitest 54 passed。
- 利用者影響: 警告を無視すると端末依存の精算状態をCSVに出せる。
- データ影響: 請求精算状態の正本誤認。
- CI影響: mockでは保証できるが、本番列存在は別検証が必要。
- 再現手順: `getPersistenceDiagnostics` が `missing_payment_status` を返すmockで `useBillingSummary` を実行する。
- 修正候補: 本番運用チェックに `PaymentStatus/PaidAt/PaidBy` 解決を必須化し、CSV正式出力条件を明文化する。
- 修正対象外: Billing UI redesign。
- 推奨PR境界: Billing永続化運用PR。
- 依存する作業: `/sites/2` List3の列確認。
- 完了判定: `env_fallback_list3`, `missing_payment_status`, `missing_audit_fields`, `resolved` が運用手順とCI/診断に接続される。

## FINDING-007: 本番依存のaudit残件は破壊的更新を伴う

- 分類: 依存関係・セキュリティ
- 基準コミット: `776335643564b599683fecb3169097e3eb2d7825`
- 対象ファイル: `package.json`, `package-lock.json`
- 現在の挙動: `npm audit --omit=dev --json` は12件を報告する。主経路は `firebase -> undici` と `exceljs -> uuid`。
- 期待される挙動: 件数ではなく、到達可能性、browser/Node実行、外部入力制御、破壊的変更を評価してからPR化する。
- 証拠: `npm audit --omit=dev --json`
- 利用者影響: 未評価。
- データ影響: 未評価。
- CI影響: audit gateを入れると現状失敗する。
- 再現手順: `npm audit --omit=dev --json`
- 修正候補: Firebase major update評価PR、ExcelJS/uuid到達可能性評価PRを分ける。
- 修正対象外: `npm audit fix --force` の一括実行。
- 推奨PR境界: セキュリティ評価PR。
- 依存する作業: Firebase利用箇所とExcel出力利用箇所の実行環境確認。
- 完了判定: 各脆弱性に「到達可能/未到達/保留」と更新方針が付く。

## FINDING-008: 月次集計の異月混在データ契約が曖昧

- 分類: 日付境界契約
- 基準コミット: `776335643564b599683fecb3169097e3eb2d7825`
- 対象ファイル: `src/features/records/monthly/__tests__/aggregate.holiday.spec.ts`, `src/features/records/monthly/aggregate.ts`
- 現在の挙動: テスト名に「異なる月の記録が混在 → 現在の実装は全記録をカウント」とある。対象月filter済み入力を前提にするのか、関数側で除外するのかが契約として弱い。
- 期待される挙動: 月次集計関数の入力契約か、呼び出し側filter契約を明示する。
- 証拠: 代表Vitestで該当テストを含む月次集計テストはPASS。
- 利用者影響: 呼び出し側が異月データを渡した場合、誤集計になり得る。
- データ影響: 月次KPI、請求前確認、CSV/PDFの前提に影響。
- CI影響: 現状は「全記録をカウント」を固定しているため、仕様変更時にテスト名と期待値を更新する必要がある。
- 再現手順: `npx vitest run src/features/records/monthly/__tests__/aggregate.holiday.spec.ts --reporter=verbose`
- 修正候補: `aggregateMonthlyKpi` の入力を「対象月filter済み」にするか、関数に `targetMonth` を渡して除外するかを決める。
- 修正対象外: CSV/PDF出力の同時変更。
- 推奨PR境界: 月次日付境界PR。
- 依存する作業: 月次CSV/PDF契約の入力範囲確定。
- 完了判定: 異月混在ケースの期待値が仕様文書、実装、unitで一致する。

