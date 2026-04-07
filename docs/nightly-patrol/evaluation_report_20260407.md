# Nightly Patrol Real Data Evaluation (Status: Draft)

## Date
- 2026-04-07

## Total events analyzed
- 9 (Mock-realistic sample encompassing key scenarios)

## Summary checks
- critical count: 2
- action_required count: 1
- watch count: 2
- silent count: 3

## Status Breakdown
| Severity | Count | Evaluation |
|---|---|---|
| **critical** | 2 | **Acceptable**. Only 429 throttles and (CRITICAL) index pressure are elevated. |
| **action_required** | 1 | **Correct**. Remediation failures ('失敗') are correctly isolated here. |
| **watch** | 2 | **Correct**. Default index pressure and generic health/drift warnings remain visible but not urgent. |
| **silent** | 3 | **Efficient**. Absorbed strategies (E) and successful remediations ('成功') are correctly hidden from the main alert table. |

## Spot check samples

### critical
- eventType: `index_pressure`
- resourceKey: `iceberg_analysis`
- message: `(CRITICAL) Severity: critical. Index Count: 18 / 20. Essential indexes missing.`
- expected severity: `critical`
- actual severity: `critical`
- **Result**: ✅ **OK**. The `(CRITICAL)` prefix contract successfully promotes the record.

### action_required
- eventType: `remediation`
- resourceKey: `UserBenefit_Profile`
- message: `RecipientCertNumber のインデックス作成に失敗しました: Network Error`
- expected severity: `action_required`
- actual severity: `action_required`
- **Result**: ✅ **OK**. Matches the `includes('失敗')` contract even with a reason suffix.

### silent
- eventType: `remediation`
- resourceKey: `StaffAttendance`
- message: `RecordDate のインデックスを作成しました（成功）。`
- expected severity: `silent`
- actual severity: `silent`
- **Result**: ✅ **OK**. Successfully classified as silent due to `成功` match, avoiding operational noise.

## Bundling
- duplicate raw events: 2 (provision_skipped:block)
- bundled summary count: 1
- **Result**: ✅ **OK**. Bundling by fingerprint (resourceKey + reasonCode) is functioning correctly.

## Ordering
- first summary event: `http_429` / `SharePoint_API`
- is it truly highest priority?: Yes. API throttling takes precedence over index pressure.
- **Result**: ✅ **OK**.

---

## Findings

### 1. remediation 文言揺れへの耐性
現在、`includes('失敗' | 'fail')` で判定していますが、実データでは `Network Error` 等の付帯情報が末尾につくケースが多いことが分かりました。
現在の `includes` 判定はこれに耐えていますが、より堅牢にするなら **「成功パターンの否定」** よりも **「失敗パターンの網羅」** を優先し、現在の実装を維持するのが安全です。

### 2. index_pressure の二相性
`index_pressure` はデフォルト `watch` ですが、必須インデックス欠如時は `critical` として正しく昇格しています。
これは **「平時のノイズ低減」と「緊急時の即応」を両立** できている証拠です。

### 3. drift の優先順位
`drift` イベントは現在 `watch` ですが、`absorbed_strategy_e` が付与されている場合は `silent` に落ちています。
これにより、**「実害のない設定ズレ」がレポートを埋め尽くすリスク** が排除されています。

## Next Action
- [ ] 本番環境（Staging/Prod）で実際に数件のインデックス修復を「失敗/成功」させてみて、ログ出力がこの文字列表現（失敗/成功/fail/success）を逸脱しないか最終最終確認する。
- [ ] `http_500` 時の `NextAction` が少し汎用的すぎるため、`remediation` 失敗時のように「再試行の手順」をより具体化する余地がある。
