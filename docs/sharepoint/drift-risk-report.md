# SharePoint drift risk report (High/Medium/Low)

## High
- Query guard の fail-open 特性
  - 根拠: `src/lib/sp/queryGuard.ts`, `src/lib/sp/spListRead.ts`
  - 概要: high-risk クエリに対し例外が上位で致命扱いしない運用
  - 影響: 大量取得・権限超過・意図外リスト参照の潜在的増大
  - 対応: docs-only では監査対象を明示し、実装変更は次イテレーションへ

- `DisplayName` / `InternalName` 混在
  - 根拠: `src/sharepoint/fields/fieldUtils.ts`, `src/sharepoint/fields/supportCaseFields.ts`, `src/lib/sp/spListRead.ts`
  - 概要: 表示名と内部名の混在により OData 指定が想定外に失敗し得る
  - 影響: false negative / false positive 的な drift 検知
  - 対応: field-mapping を固定表化し、docs に drift 判定前提を明示

- 環境変数依存の境界分岐
  - 根拠: `src/lib/sp/config.ts`, `src/sharepoint/spListConfig.ts`, `src/sharepoint/spListRegistry.ts`
  - 概要: `VITE_SP_LIST_BILLING_ORDERS_SITE_RELATIVE` 分岐により drift 対象可否が変化
  - 影響: 監査結果の再現性低下（環境差）
  - 対応: 人間レビュー項目として環境値の運用合意を docs 化

## Medium
- drift対象リスト説明と実体実装の乖離
  - 根拠: `src/sharepoint/spListHealthCheck.ts`, `tests/unit/spListHealthCheck.spec.ts`
  - 根拠コメントと実装対象範囲の一致性確認が必要
  - 影響: 意図と実装のずれによる監査運用誤解

- support case の実験的扱い
  - 根拠: `src/sharepoint/driftProbeRegistry.ts`, `src/sharepoint/supportCaseDiagnosticsPreflight.ts`
  - 概要: opt-in フラグに依存した取り込み条件
  - 影響: 本番で drift が観測されても対象外扱いとなる場合がある

- `skipTitleEssential` の例外
  - 根拠: `src/sharepoint/spListConfig.ts`, `tests/unit/spListConfig.spec.ts`
  - 概要: list により Title 補完を省く例外分岐が存在
  - 影響: drift 判定で必須比較が漏れる可能性

## Low
- ドキュメント内説明文の断片（既知リスク）
  - 既存 docs と実装整合の観点で説明更新のみで低リスク
  - 根拠: `docs/sharepoint/*` 既存資料

- UI 警告表示の閾値固定
  - 根拠: `src/pages/admin/DataIntegrityPage.tsx`
  - 影響: 上限到達時の表示だけで、core drift ロジック自体を変えない

## 触ってはいけない実装領域（初期運用）
- `src/sharepoint/spListRegistry.ts`
- `src/sharepoint/spListConfig.ts`
- `src/lib/sp/queryGuard.ts`
- `src/lib/sp/spListRead.ts`
- `src/sharepoint/driftProbeRegistry.ts`
- `src/pages/admin/DataIntegrityPage.tsx`
- `src/features/diagnostics/health/*`

## 監査根拠（path list）
- `src/sharepoint/__tests__/driftProbeRegistry.spec.ts`
- `src/sharepoint/__tests__/supportCaseDiagnosticsPreflight.spec.ts`
- `src/sharepoint/fields/__tests__/supportCaseFields.spec.ts`
- `tests/unit/spListHealthCheck.spec.ts`
- `tests/unit/spListConfig.spec.ts`
- `src/sharepoint/spListHealthCheck.ts`
- `src/pages/HealthPage.tsx`
- `src/features/diagnostics/health/useHealthChecks.ts`
- `src/sharepoint/query/builders.ts`

## 人間レビューで確定すべき項目
- `queryGuard` の high-risk 取扱いを監査方針として固定するか
- `supportCases` / `billingOrders` の対象外条件を運用ポリシーとして承認するか
- `drift` の対象リスト定義を環境ごとに freeze するか
- SharePoint 側の実体スキーマを基準版として `field-mapping-notes` を更新するか
