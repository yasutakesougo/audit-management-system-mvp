# Process Optimization Audit - 2026-07-14

- 基準コミット: `776335643564b599683fecb3169097e3eb2d7825`
- 調査単位: `origin/main` 固定の読み取り中心調査
- 詳細台帳: `docs/audit/investigation-findings-2026-07-14.md`

## 結論

次の開発で最初に分離すべきものは、製品挙動修正ではなく契約とCI信頼性の整理である。現時点で代表テストは通るが、Route診断リスト、月次CSV文書、skip/false green、SharePoint認証・列解決fallbackが混在しており、失敗時に製品不具合と環境不具合を切り分けにくい。

## 優先順位

| ID | 優先度 | 分類 | 推奨PR境界 |
| --- | --- | --- | --- |
| FINDING-001 | P2 | 文書契約差異 | 月次CSV文書の追従のみ。`MonthlySummaryCsv` への実装変更はしない。 |
| FINDING-002 | P2 | Route/Nav契約差異 | `appRoutePaths`、nested route、Hub動的routeの診断ロジック整理。 |
| FINDING-003 | P1 | CI false green | `test:ci` の `--dangerouslyIgnoreUnhandledErrors` をrequired CIから分離。 |
| FINDING-004 | P2 | E2E信頼性 | skip台帳を現行specへ再同期し、skip理由を契約型に分類。 |
| FINDING-005 | P2 | 認証/環境診断 | schedules gateのoptimistic bypassと403/404/timeout分類の運用表示を整理。 |
| FINDING-006 | P2 | 永続化境界 | Billing `PaymentStatus` 未解決時のLocalStorage fallbackを運用チェックとPR境界へ固定。 |
| FINDING-007 | P2 | セキュリティ/依存 | `firebase/undici` と `exceljs/uuid` を到達可能性評価PRとして分離。 |
| FINDING-008 | P1 | 日付境界 | 月次集計が異月混在データをどう扱うかの契約を確定。 |

## CI分類

| テスト/コマンド | 保証している契約 | 失敗時に疑う対象 | 外部依存 | 時刻・日付依存 | 認証依存 | 再実行変動 |
| --- | --- | --- | --- | --- | --- | --- |
| `npm run typecheck` | TS型契約 | 型不整合、import不整合 | なし | 低 | なし | 低 |
| `npm run arch:check` | 依存境界 | 新規境界違反 | なし | 低 | なし | 低 |
| `npm run gen:system-map` | Route/Nav/feature棚卸し | env未設定、route診断差分 | env schema | 低 | なし | 中 |
| `MonthlySummaryCsv.spec.ts` | 月次CSV形式、filename | CSV契約変更 | browser Blob mock | 低 | なし | 低 |
| `aggregate.*.spec.ts` | 月次集計計算 | 日付境界、plannedRows契約 | なし | 高 | なし | 低 |
| `useBillingSummary.spec.ts` | 請求集計、精算永続化fallback | SharePoint列、LocalStorage fallback | mock repo | 中 | auth actor mock | 低 |
| `useKokuhorenMonthlyPreview.spec.tsx` | 月次提供実績 -> 国保連validation | repository error handling | mock repo | 中 | なし | 低 |
| Playwright schedule SP系 | SharePoint実データ/書込契約 | 認証期限、403、リスト未存在、通信 | SharePoint, storageState | 高 | 高 | 高 |
| LHCI | perf予算 | Chromium/LHCI/preview server | Chromium, network | 中 | なし | 中 |

`test:ci` の `--dangerouslyIgnoreUnhandledErrors` は別枠管理が必要。異常終了やunhandled errorを成功扱いにする経路は、required品質保証としては使わない。

## 次の5件

1. `test:ci` false green解消PR: required CI用コマンドから `--dangerouslyIgnoreUnhandledErrors` を外すか、nightly専用に限定する。
2. 月次CSV文書追従PR: `MonthlySummaryExcel` 参照を `MonthlySummaryCsv` に更新し、過去経緯は「rename済み」として残す。
3. 月次日付境界PR: 異月混在データを除外するのか、呼び出し側で対象月filter済みを前提にするのかをテスト名と実装契約で固定する。
4. Route/Nav診断PR: `appRoutePaths` とnested route/hub routeの差分を機械検出し、許容差分を明示する。
5. Billing永続化運用PR: `PaymentStatus/PaidAt/PaidBy` 未解決時のCSV扱い、LocalStorage fallback、List3 envを運用チェックに接続する。

## 対象外

- `MonthlySummaryCsv` の実装renameや追加renameは行わない。
- SharePoint列追加、環境変数変更、Firebase/ExcelJS更新は今回の調査PRに含めない。
- Playwrightの大量skipを一括解除しない。
- 既存の918件のdependency-cruiser known violationsは今回の修正対象にしない。

