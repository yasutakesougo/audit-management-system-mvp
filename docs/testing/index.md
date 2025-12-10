# Testing Docs Index

テスト関連ドキュメントのハブです。E2E / テクニック / ハイドレーション検証などの詳細資料への導線をここに集約します。

## Overview / ハブ

- [Nightly / Regression レポート](./nightly-report.md)
- [Schedule E2E Playbook](./schedule-e2e.md)
- [Users E2E Playbook](./users-e2e.md)
- [Nurse E2E Playbook](./nurse-e2e.md)
- [Dashboard / Agenda Smoke](#dashboard--agenda-smoke-tests)

## Schedule / Calendar E2E Tests

Schedule（Day / Week / Month / Status / Quick Dialog）を扱う E2E テストのガイドラインと共通ヘルパーは以下に集約されています。

👉 **[Schedule E2E Playbook](./schedule-e2e.md)**  
（全テスト共通のブート処理・SharePoint スタブ・`goto*` / `waitFor*`・`scheduleActions` API を網羅）

## Users E2E Tests

Users（一覧・詳細・支援手順タブ）の E2E を追加するときは次のガイドを参照してください。

👉 **[Users E2E Playbook](./users-e2e.md)**  
（`bootUsersPage` の使い方、支援手順タブの検証パターン、よく使う TestID 一覧を収録）

## Nurse E2E Tests

Nurse ワークスペース（Observation / Bulk / Sync HUD / Queue）の E2E はこのガイドに集約されています。

👉 **[Nurse E2E Playbook](./nurse-e2e.md)**  
（`bootNursePage` のレシピ、queue 初期化、SharePoint / `/api/sp` モックの共通設計を解説）

## Dashboard / Agenda Smoke Tests

`tests/e2e/dashboard.smoke.spec.ts` と `tests/e2e/module-cards-navigation.spec.ts` は `bootAgenda` を利用して `/dashboard` を直接ブートします。ハンズオフ導線（申し送りタイムライン）とスケジュール CTA の稼働確認、カード群の hover・遷移ログ収集を担い、Nightly レポートでもダッシュボード健全性の一次指標として扱います。
`tests/e2e/dashboard.smoke.spec.ts` と `tests/e2e/module-cards-navigation.spec.ts` は `bootAgenda` を利用して `/dashboard` を直接ブートします。ハンズオフ導線（申し送りタイムライン）とスケジュール CTA の稼働確認、カード群の hover・遷移ログ収集を担い、Nightly レポートでもダッシュボード健全性の一次指標として扱います。

👉 **[Agenda / Dashboard E2E Playbook](./agenda-e2e.md)**  
（`bootAgenda` の使い方、代表シナリオ、シード戦略、トラブルシュート/TODO をコンパクトに整理）
