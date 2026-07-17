# Monthly PDF Current Contract

- Date: 2026-07-15
- Baseline: `5001f233a6900aa6458f50b734f17a2daf957f26`
- Scope: docs-only contract freeze for the current monthly PDF behavior

## Conclusion

月次PDFは、現行実装では実PDF生成機能ではなく、`/records/monthly?tab=pdf` のPDFタブ、出力対象サマリー表示、生成ボタン、認可境界を提供する開発中の入口として扱う。

この契約では、PDF本文、ダウンロードファイル、SharePoint保存、Power Automate実行、`PdfOutput_Log` への監査ログ記録は保証しない。

## User Flow

```text
User
-> /records/monthly?tab=pdf
-> MonthlyRecordPage
-> RequireAudience requiredRole="reception"
-> monthly-pdf-generate-btn
-> handleGenerateMonthlyPdf
-> mock delay only
```

## Current Implementation Contract

| Area | Current behavior | Contract status |
| --- | --- | --- |
| Route | `/records/monthly` の `tab=pdf` でPDFタブを表示する | guaranteed |
| Page | `MonthlyRecordPage` が `summary`, `user-detail`, `pdf` の3タブを持つ | guaranteed |
| Authorization | PDFタブ本文は `RequireAudience requiredRole="reception"` 配下 | guaranteed |
| Action guard | `handleGenerateMonthlyPdf` は `canAccess(role, 'reception')` で早期returnする | guaranteed |
| Button | `monthly-pdf-generate-btn` を表示し、対象データ0件または権限不足ではdisabled/非表示になる | partially guaranteed |
| Target summary | 対象月、対象利用者数、絞り込み条件、平均完了率を画面表示する | guaranteed |
| PDF generation | `setTimeout(2000)` のモック遅延のみ | not implemented |
| Download | 実ファイルのダウンロードは行わない | not guaranteed |
| API call | `**/api/monthly-records/pdf**` への実リクエストは確認できない | not implemented |
| SharePoint write | `PdfOutput_Log` への書き込みは接続されていない | not implemented |
| Power Automate | UI上は連携予定を表示するが、フロー呼び出しは未接続 | not implemented |

## Evidence

- `src/pages/MonthlyRecordPage.tsx`
  - `handleGenerateMonthlyPdf` はreception未満をreturnし、実処理はモック遅延。
  - PDFタブは `RequireAudience requiredRole="reception"` 配下。
  - 画面文言で「Power Automate ワークフロー」と「現在は開発中」を表示。
- `tests/e2e/authz.reception-monthly-pdf-action.spec.ts`
  - viewerはPDF操作に到達できない。
  - reception/adminは生成ボタンを表示・操作可能。
- `tests/e2e/monthly.pdf-tab.spec.ts`
  - PDFタブ表示、ボタン存在、最低限のクリック後状態を確認する。
  - ダウンロードは発生しない構成を許容している。
  - `**/api/monthly-records/pdf**` のroute mockはあるが、現行UIからそのAPI呼び出しが発生する契約ではない。
- `src/data/pdfOutputLog/pdfOutputLogRepository.ts`
  - `monthly-report` 用の出力ログRepositoryは存在する。
  - `MonthlyRecordPage` からは呼び出されていない。
- `src/sharepoint/fields/pdfOutputLogFields.ts`
  - `PdfOutput_Log` の列定義は存在する。
  - 月次PDFタブからの保存契約は未接続。

## Test Contract

現行E2Eが保証しているのは次の範囲に限る。

| Test | Guaranteed contract | Not guaranteed |
| --- | --- | --- |
| `monthly.pdf-tab.spec.ts` | PDFタブ表示、生成ボタン表示、クリック後に画面が破綻しないこと | PDF本文、実ダウンロード、API成功/失敗ハンドリング |
| `authz.reception-monthly-pdf-action.spec.ts` | viewer/reception/admin の操作境界 | Repository側の書き込み権限、Power Automate権限 |

`monthly.pdf-tab.spec.ts` はoptional assertionとcatchを多く含むため、PDF生成機能の品質保証として扱わない。これはUI smokeであり、本文照合や保存確認ではない。

## Out Of Scope For This Contract

- PDF本文レイアウト
- PDFファイル名
- PDFダウンロードイベント
- PDF保存先
- Power AutomateフローID、HTTP endpoint、実行履歴
- `PdfOutput_Log` への成功/失敗ログ記録
- 月次支援実績と請求注文の接続
- `MonthlySummaryCsv` の出力契約

## Follow-up PR Boundaries

1. docs-only: Power Automate未接続の運用注記を追加する。
2. product: `handleGenerateMonthlyPdf` から実APIまたはPower Automate endpointを呼び出す。
3. product: 成功/失敗/処理中状態をUIに追加する。
4. product: `PdfOutput_Log` へ出力ログを記録する。
5. test: PDF本文またはダウンロードファイル名を検証するE2E/contract testを追加する。

これらは一括PRにしない。現行契約の文書化と実装変更は分離する。

