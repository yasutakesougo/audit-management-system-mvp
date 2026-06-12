# Runbooks

運用・改修時に参照する runbook の入口。

## Touchpoints

- [SupportPlanningSheetPage Touchpoints](./support-planning-sheet-touchpoints.md)
- [TodayOpsPage Touchpoints](./today-ops-touchpoints.md)
- [DailyRecordPage Touchpoints](./daily-record-touchpoints.md)
- [CallLogPage Touchpoints](./call-log-touchpoints.md)
- [HandoffTimelinePage Touchpoints](./handoff-touchpoints.md)

## Template

- [Page Touchpoints Template](./page-touchpoints-template.md)
- [SharePoint SSOT Drift PR Template (v1.1)](./sharepoint-ssot-drift-pr-template.md)
- [TransportCourse Fallback Tracking CSV](./templates/transport-course-fallback-tracking.csv)
- [TransportCourse Fallback Removal PR Template](./templates/transport-course-fallback-removal-pr-template.md)
- [Transport Week1 Ops Review Template](./templates/transport-week1-ops-review-template.md)

## Operations

- [Corrective-Action Telemetry Review](./corrective-action-telemetry-review.md)
- [ExceptionCenter Horizontal Rollout](./exception-center-horizontal-rollout.md)
- [ExceptionCenter Priority Week-1 Review](./exception-center-priority-week1-review.md)
- [Transport Assignment Page Spec (Phase 1)](./transport-assignment-page-spec.md)
- [Transport Nightly Critical E2E](./transport-nightly-critical-e2e.md)
- [TransportCourse Migration](./transport-course-migration.md)
- Weekly Review Issue Template: `.github/ISSUE_TEMPLATE/corrective-action-weekly-review.yml`
- Transport Week1 Review Issue Template: `.github/ISSUE_TEMPLATE/transport-week1-review.yml`
- TransportCourse Fallback Removal Issue Template: `.github/ISSUE_TEMPLATE/transport-course-fallback-removal.yml`

### ExceptionCenter 標準化状況

- 横展開完了（実装 + unit/hook/page + E2E）:
  - `corrective-action`
  - `daily-record`
  - `handoff`
- E2E 導線保証 spec:
  - `tests/e2e/exception-center.corrective-child-flow.spec.ts`
  - `tests/e2e/exception-center.daily-child-flow.spec.ts`
  - `tests/e2e/exception-center.handoff-child-flow.spec.ts`

## 使い方

1. まず対象画面の touchpoints を開く。
2. 「画面で確認する場所」で症状を再現する。
3. 「コードで修正する場所」から改修起点を決める。
4. 変更内容に応じて「変更目的ごとの入口」を使う。

## 追加ルール

- 新しい touchpoints を追加するときは `page-touchpoints-template.md` を使う。
- 1画面につき1ファイルで管理する。
- 関連PRを必ず記載し、変更履歴を追えるようにする。
- 画面仕様を変更したPRでは、該当 touchpoints を同PRで更新する。
