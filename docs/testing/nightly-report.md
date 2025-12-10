# Nightly / Regression テストレポート

このドキュメントは、E2E テストの「今どこまで守れているか」をざっくり把握するためのハブです。  
詳細なお作法は各モジュールの playbook（`schedule-e2e.md` / `users-e2e.md` / `nurse-e2e.md`）を参照してください。

---

## 1. 現在のカバレッジ概要

| ドメイン       | 対象 spec                          | 実行コマンド例                                                              | 状態                      | 備考                          |
| ------------- | ---------------------------------- | --------------------------------------------------------------------------- | ------------------------- | ----------------------------- |
| Schedule      | `tests/e2e/schedule-*.spec.ts`     | `DEV_SERVER_PORT=5173 npx playwright test tests/e2e/schedule-*.spec.ts`     | ✅ 36 tests passed        | `bootSchedule` + seededフィルター網羅 |
| Users         | `tests/e2e/users*.spec.ts`         | `DEV_SERVER_PORT=5173 npx playwright test tests/e2e/users*.spec.ts`         | ✅ 3 tests passed         | `bootUsersPage` で統一       |
| Dashboard     | `tests/e2e/dashboard*.spec.ts`     | `DEV_SERVER_PORT=5173 npx playwright test tests/e2e/dashboard*.spec.ts`     | ✅ 2 specs / 8 tests passed | `bootAgenda` + agenda seed |
| Nurse Dashboard | `tests/e2e/nurse-dashboard-happy-path.spec.ts` | `DEV_SERVER_PORT=5173 npx playwright test tests/e2e/nurse-dashboard-happy-path.spec.ts` | ✅ 1 spec / 1 test passed | `bootNursePage` + nurse dashboard seed |
| Nurse (BP)    | `tests/e2e/nurse.bp.sync.spec.ts`  | `DEV_SERVER_PORT=5173 npx playwright test tests/e2e/nurse*.spec.ts`         | ✅ BP 同期 3 tests passed | `bootNursePage` 利用         |
| Nurse (legacy)| `tests/e2e/nurse.*.spec.ts` 他     | ↑ と同じ                                                                   | ⏸ `test.skip` で一時退避 | 新 UI 対応後に順次復活予定   |

---

## 2. Boot helper 一覧

各ドメインで「env/localStorage/SP stub 初期化」を 1 箇所に集約しています。

| ドメイン   | Boot helper                               | 主な責務                                               | 詳細ドキュメント                |
| ---------- | ------------------------------------------ | ------------------------------------------------------ | ------------------------------- |
| Schedule   | `tests/e2e/_helpers/bootSchedule.ts`       | Schedule UI の env / localStorage / SP stub の共通化   | `docs/testing/schedule-e2e.md` |
| Users      | `tests/e2e/_helpers/bootUsersPage.ts`      | Users UI の demo/SP モード切り替えと fixture 初期化    | `docs/testing/users-e2e.md`    |
| Dashboard  | `tests/e2e/_helpers/bootAgenda.ts`     | Dashboard の env / handoff ローカルストア / SP stub   | 本ドキュメント（暫定）         |
| Nurse      | `tests/e2e/_helpers/bootNursePage.ts`      | Nurse Shell + BP UI の flags / queue / SP の共通セット | `docs/testing/nurse-e2e.md`    |

新しい spec を書くときは、基本的に **「該当ドメインの boot helper を呼んでから UI 操作に入る」** のが標準パターンです。

---

## 🔒 Shared Env + Seed Pattern (2025-12 Update)

すべての happy-path Playwright spec は、下記 3 ステップで同じ世界線を構築します。

1. **全てのネットワークモック登録**

  Graph / MSAL / SharePoint / REST などを先に差し込む。

1. **テスト環境初期化**

  `await setupPlaywrightEnv(page, { envOverrides, storageOverrides });`

セットするもの:

- localStorage / sessionStorage のリセット
- 共通の `window.__ENV__`
- 追加の feature flag / storage key（overrides 経由）

1. **モジュール固有の boot + seed**

  `await bootXxxPage(page, { seed: { ... } });`

各モジュール例:

- Users → `users.master.dev.v1`
- Nurse → `nurse.dashboard.dev.v1`
- Dashboard / Agenda → handoff / schedules 系 seed

その後に画面操作とアサーションを行う。

### Rules

- Feature flag は必ず `envOverrides` から渡す（`window.__ENV__` を直接書き換えない）
- Boot helper は必ず `setupPlaywrightEnv` の後に seed を注入する
- 各モジュールは「単一 JSON fixture」を真実のソースとし、CI で再現性を担保

このパターンによって、`dashboard-happy-path` / `nurse-dashboard-happy-path` / `users-dashboard-happy-path` など幹ルートのテスト世界線が常に同期されます。

---

## E2E Regression Matrix (smoke)

| Module   | Spec file                      | Seeds / Notes                                                      | Status |
|----------|--------------------------------|--------------------------------------------------------------------|--------|
| Dashboard| `tests/e2e/dashboard.smoke.spec.ts`        | `agenda.dashboard.dev.v1` + `schedules.today.dev.v1` (via `bootAgenda`) | ✅ |
| Schedule | `tests/e2e/schedule-week.edit.aria.spec.ts`| `schedules.today.dev.v1` (via `bootSchedule`)                   | ✅ |
| Agenda   | `tests/e2e/agenda-happy-path.spec.ts`      | `handoff.timeline.dev.v1` + summary + `schedules.today.dev.v1` shared seeds | ✅ |
| Nurse    | `tests/e2e/nurse-dashboard-happy-path.spec.ts` | `nurse.dashboard.dev.v1` (via `bootNursePage`) | ✅ |

### Dashboard spec catalog

| Spec | 目的 / カバレッジ | Seeds | 実行コマンド例 | 備考 |
| ---- | ----------------- | ----- | -------------- | ---- |
| `tests/e2e/dashboard.smoke.spec.ts` | `/`→`/dashboard` の遷移、主要カードのマウント、基本 CTA の生存確認 | `bootAgenda` で agenda dashboard / schedules seed を最小限ロード | `DEV_SERVER_PORT=5173 npx playwright test tests/e2e/dashboard.smoke.spec.ts` | 非決定的 UI（API ランダム要素）があっても落とさない設計 |
| `tests/e2e/dashboard-happy-path.spec.ts` | 共有 seed（hand-off + schedule）を用いた determinisitic snapshot、handoff summary カウントと Schedule CTA を fixture 通りに検証 | `bootAgenda` + `agenda.dashboard.dev.v1` + `schedules.today.dev.v1` | `DEV_SERVER_PORT=5173 npx playwright test tests/e2e/dashboard-happy-path.spec.ts` | Docstring で seed 内容を明示。HUD の期待値が変わったらこの spec を更新 |

### Nurse spec catalog

| Spec | 目的 / カバレッジ | Seeds | 実行コマンド例 | 備考 |
| ---- | ----------------- | ----- | -------------- | ---- |
| `tests/e2e/nurse-dashboard-happy-path.spec.ts` | HealthObservationPage（看護トップ）の vitals/tasks カードを JSON seed と 1:1 で検証 | `bootNursePage` + `nurse.dashboard.dev.v1` | `DEV_SERVER_PORT=5173 npx playwright test tests/e2e/nurse-dashboard-happy-path.spec.ts` | Nurse 朝会の幹ルート。fixture を変えたら spec も更新 |

### Users spec catalog

| Spec | 目的 / カバレッジ | Seeds | 実行コマンド例 | 備考 |
| ---- | ----------------- | ----- | -------------- | ---- |
| `tests/e2e/users-dashboard-happy-path.spec.ts` | UsersPanel のシード済み一覧（Stage 1）と embedded/detail 遷移（Stage 2）を deterministic に確認 | `bootUsersPage` + `users.master.dev.v1` | `DEV_SERVER_PORT=5173 npx playwright test tests/e2e/users-dashboard-happy-path.spec.ts --reporter=line` | Users module seed の第1号。fixture を更新したら spec も合わせて同期 |

---

## 3. Nightly / Regression の想定構成案

> ※ まだ実運用していない場合の「こう組む」目安として記載

### 3.1 Regression CI（PR / main 保護）

- 対象（例）:
  - Schedule フル: `tests/e2e/schedule-*.spec.ts`
  - Users スモーク: `tests/e2e/users*.spec.ts`
  - Nurse BP: `tests/e2e/nurse.bp.sync.spec.ts`
- 目的:
  - 主要導線（スケジュール管理 / 利用者管理 / 看護BP 同期）が壊れていないかを PR 単位で検知

### 3.2 Nightly（より広い網をかける）

- 対象（例）:
  - 上記に加えて Dashboard / Agenda / Records 系のスモーク
- 目的:
  - 「日中は重くて回しづらいが、毎晩は見ておきたい系」spec をまとめて健康チェック

---

## 4. TODO / 今後の拡張メモ

- [x] Schedule: `bootSchedule` 導入 & 36 本フルグリーン + seeded happy-path  
- [x] Users: `bootUsersPage` 導入 & 代表 3 本（詳細 / 支援フロー / 基本情報編集）  
- [x] Nurse: `bootNursePage` 導入 & BP MVP 3 本 + legacy 21 本 `test.skip`  

- [x] Agenda / Dashboard 向け `bootAgenda` 的ヘルパーの追加  
- [ ] Agenda / Dashboard 向け playbook（`agenda-e2e.md`）の作成  
- [ ] `bootAgenda` にスケジュール / モジュールカード向け fixture を足して、無風状態でも HUD ログが出るようにする  
- [ ] Nightly 向け GitHub Actions ワークフローの整備（cron / artifacts / flaky guard など）

---
このファイルは「現状のスナップショット」を残す場なので、  
**テスト追加 or カバレッジ変更があったら、その都度ここも 1 行だけ更新**しておく想定です。
