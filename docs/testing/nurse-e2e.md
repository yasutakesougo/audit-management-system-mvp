# Nurse E2E Playbook

Nurse ワークスペース（観察 / BP パネル / バルク入力 / Sync HUD / キュー flush）向けの E2E をまとめて管理するためのガイドです。目的は次の 3 点です。

- すべての spec を `bootNursePage` 経由で起動し、フラグ・localStorage・SharePoint スタブを 1 箇所で統一する
- Nurse queue (`nurse.queue.v2`) や minute basis（UTC/Local）をテストごとに安全に初期化する
- `/api/sp/lists/*` などの外部依存をヘルパー内でモックし、個別 spec では UI 操作と期待値に集中できるようにする

---

## 1. 対象ファイルとユーティリティ

代表的な Nurse 向け Playwright spec:

### 現行 BP MVP で実行している spec

- `tests/e2e/nurse.bp.sync.spec.ts`

### Legacy spec（`test.skip(true, "Legacy nurse UI …")` で退避中）

| File | 備考 |
| --- | --- |
| `tests/e2e/nurse.observation.spec.ts` | 旧 Observation workspace/testid 前提。新 UI 着地後に再設計。 |
| `tests/e2e/nurse.bulk-entry.spec.ts` | `/nurse/bulk` v1 テーブル依存。Bulk v2 実装後に復帰。 |
| `tests/e2e/nurse.bulk.sync.spec.ts` | 同上。Alt+S トースト検証を v2 UI に合わせて更新。 |
| `tests/e2e/nurse.bulk-status.spec.ts` | 同上。row status 表現が v2 で決まり次第。 |
| `tests/e2e/nurse.bulk-partial-error.spec.ts` | 同上。partial/error summary UI 復元後に再開。 |
| `tests/e2e/nurse.medication.spec.ts` | 旧服薬ストック画面依存。Inventory v2 確定後に復帰。 |
| `tests/e2e/nurse.tabs.spec.ts` | 旧タブクエリ→workspace ルーティング依存。 |
| `tests/e2e/nurse.records-export.spec.ts` | `/nurse/records` の v2 UI 復活が条件。 |
| `tests/e2e/nurse.workspace-a11y.spec.ts` | 新ワークスペース UI の ARIA 決定後に更新。 |
| `tests/e2e/nurse.query-normalization.spec.ts` | 旧 query 正規化ロジック依存。v2 で UX が固まったら復活。 |
| `tests/e2e/nurse.roster-handshake.spec.ts` | `/daily/health` → `/nurse/observation` リダイレクトが無効化中。 |
| `tests/e2e/nurse.sync-status.spec.ts` | Sync HUD v1 依存。新 HUD 実装後に戻す。 |

> Legacy spec を再開する際は、先頭にある `test.skip(true, 'Legacy nurse ...')` を削除し、`bootNursePage` オプションや testid を新 UI に合わせて再設計してください。

共通で利用するヘルパー / 定数:

- `tests/e2e/_helpers/bootNursePage.ts`
  - env / localStorage / queue / SharePoint スタブをまとめて初期化
- `tests/e2e/nurse/_helpers/bulk.ts`
  - バルク観察ページへの遷移ヘルパー
- `tests/e2e/utils/nurse.ts`
  - Sync トースト待ち (`waitForSyncFeedback`) などの共通ユーティリティ
- `tests/e2e/utils/enableNurseFlag.ts`
  - `bootNursePage` 内部から呼び出し済み（必要に応じて minute basis や bulk Entry を切り替える）
- `src/testids.ts`
  - Nurse UI 関連の data-testid 一覧（`NURSE_OBS_SAVE`, `NURSE_BULK_TABLE`, など）

> Nurse E2E の基本レシピは **① `bootNursePage` でブート → ② MSAL / Graph / REST を stub → ③ 観察・BP・バルクなど UI 操作 & 状態 assert** の 3 ステップです。

---

## 2. bootNursePage の使い方

```ts
import { bootNursePage } from './_helpers/bootNursePage';

test.beforeEach(async ({ page }) => {
  await bootNursePage(page);
});
```

`bootNursePage(page, options)` がやってくれること:

1. `VITE_SKIP_LOGIN`, `VITE_FEATURE_NURSE_UI`, `VITE_NURSE_BULK_ENTRY` などの env を `window.__ENV__` に注入
2. `feature:nurseUI`, `feature:nurseBulkEntry`, `nurse.queue.v2` などの localStorage を初期化
3. `setupNurseFlags` を呼び出し、`__NURSE_MINUTE_BASIS__` を設定
4. `Nurse_Observation` リストを含む SharePoint スタブを `setupSharePointStubs` で登録
5. `/api/sp/lists/*` を既定レスポンス（GET: `[]`, POST: `201`, PATCH: `204`）でモック

### 2-1. オプション例

```ts
await bootNursePage(page, {
  enableBulk: true,            // バルク画面のキーバインドやテーブルを有効化
  minuteBasis: 'local',        // __NURSE_MINUTE_BASIS__ をローカル時間ベースに
  date: '2025-12-01',          // `window.__TEST_NOW__` を固定（日時依存テスト）
  queueSeed: [{ idempotencyKey: 'demo', type: 'observation' }],
  sharePoint: {
    extraLists: [{ name: 'Nurse_QueueAudit', items: [] }],
  },
});
```

- `enableBulk`: `setupNurseFlags` の `bulk` オプションに接続（バルク UI で必要）
- `minuteBasis`: `'utc' | 'local'`。HUD のラベルや同期ログのテキスト検証に利用
- `queueSeed`: `nurse.queue.v2` の初期値（JSON 文字列として保存）
- `stubSpApi`: `false` にすると `/api/sp/lists/*` の自動モックをスキップできる

---

## 3. 代表的なフロー

### 3-1. BP Sync（`nurse.bp.sync.spec.ts`）

- `bootNursePage` → `/nurse/observation?user=I022&tab=bp` に遷移 → VitalCard から値入力
- 保存したキュー (`nurse.queue.v2`) を `page.evaluate` で検証し、`ＮＵＲＳＥ_BP_QUEUE` が更新されることを確認
- `Alt+S` または Sync ボタン実行後、`waitForSyncFeedback` で toasts / live region をアサート

### 3-2. バルク入力（`nurse.bulk-entry.spec.ts`, `nurse.bulk.sync.spec.ts`）

- `bootNursePage(page, { enableBulk: true })` → `gotoNurseBulk(page)` で `/nurse/bulk` をロード
- `NURSE_BULK_TABLE` の列構成やショートカットヒント、`NURSE_BULK_SYNC` のホットキーを検証
- 体重入力の異常値・正常値を切り替えて `aria-invalid` の遷移を assert

### 3-3. Sync Telemetry / HUD（`nurse.sync-status.spec.ts`）

- HUD (`NURSE_SYNC_HUD`, `NURSE_SYNC_MINUTE_LABEL`) が query parameter で有効化されることを確認
- `bootNursePage` が用意した `/api/sp/lists/*` のモックに加え、`/api/users/*` など必要な endpoint だけを個別 stub

---

## 4. SharePoint / API モック

- `bootNursePage` による `setupSharePointStubs` は `Nurse_Observation`（空配列）を標準提供
- 追加リストが必要な場合は `sharePoint.extraLists` を渡す
- `/api/sp/lists/*` を自前でハンドリングしたい場合は `stubSpApi: false` を指定し、spec 内で `page.route` を再定義

---

## 5. テスト追加時のチェックリスト

1. `test.beforeEach` で `bootNursePage` を呼んでいるか？
2. Queue を直接触る spec では `queueSeed` か `page.evaluate` で毎回リセットしているか？
3. バルク系なら `enableBulk: true` をセットし、`gotoNurseBulk` でロード待ちしているか？
4. API (`/api/users/*`, `/api/patients/*`) の追加スタブが必要なら `boot` 後に `page.route` を追加しているか？
5. `TESTIDS` を経由して selector を参照しているか？（文字列直書きの禁止）

---

## 6. 追加ドキュメント

- [Users E2E Playbook](./users-e2e.md)
- [Schedule E2E Playbook](./schedule-e2e.md)

Nurse E2E もこれらと同じ手順で「1 行ブート → ローカル操作 → assert」という流れを守ると、将来の spec 追加・保守が簡単になります。
