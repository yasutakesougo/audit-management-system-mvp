# Route Smoke Matrix (Minimum Reachability)

| 画面                | ルート                       | 必須 data-testid        |
|---------------------|------------------------------|-------------------------|
| 日次記録（現場）    | `/records/support-procedures`| `attendance-page`       |
| ダッシュボード      | `/dashboard/records`         | `dashboard-records`     |
| 支援計画（新規）    | `/plans/new`                 | `plan-create-page`      |
| 支援計画（編集）    | `/plans/:planId/edit`        | `plan-edit-page`        |
| ミーティングガイド  | `/dashboard/meeting`         | `meeting-guide`         |
| Catch-all redirect  | `*` → `/plan`                | `/plan` 側の testid     |
