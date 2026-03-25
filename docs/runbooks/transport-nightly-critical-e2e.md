# Transport Nightly Critical E2E Runbook

`nightly-health` で毎日実行する transport クリティカル導線の簡易 runbook。

## 1. 目的

- 送迎運用の主要ループが壊れていないことを、4本の E2E で毎日確認する。
- 対象コマンド:

```bash
npm run test:e2e:transport:critical
```

## 2. 何を保証しているか（4本）

1. `tests/e2e/transport-assignments-save-reflects-in-today.spec.ts`
   - 配車表の保存/解除が `/today` 車両ボードに反映されること。
2. `tests/e2e/transport-assignments-week-bulk-apply-reflects-in-today.spec.ts`
   - 週一括適用が `/today` に反映され、既存割当を壊さないこと。
3. `tests/e2e/exception-center.transport-missing-driver-flow.spec.ts`
   - `missing-driver` の検知/child/deep-link 導線が成立すること。
4. `tests/e2e/transport-course-users-update-reflects-in-transport-assignments.spec.ts`
   - `/users` で更新した `TransportCourse` が配車表補完に反映されること。

## 3. 失敗時の一次切り分け

1. `transport-assignments-save-reflects-in-today` が失敗
   - まず確認: 配車保存 payload 生成と `/today` 読み取りロジック。
   - 主な確認箇所:
     - `src/features/transport-assignments/domain/transportAssignmentDraft.ts`
     - `src/features/today/transport/transportAssignments.ts`
2. `transport-assignments-week-bulk-apply-reflects-in-today` が失敗
   - まず確認: 同曜日デフォルト適用と「未設定のみ補完」の条件分岐。
   - 主な確認箇所:
     - `src/features/transport-assignments/domain/transportAssignmentDraft.ts`
     - `src/pages/TransportAssignmentPage.tsx`
3. `exception-center.transport-missing-driver-flow` が失敗
   - まず確認: `missing-driver` の child 生成と deep-link 先タブ復元。
   - 主な確認箇所:
     - `src/features/exceptions/**`
     - `src/features/today/transport/**`
4. `transport-course-users-update-reflects-in-transport-assignments` が失敗
   - まず確認: `/users` 保存 DTO と fixed-course 解決ロジック。
   - 主な確認箇所:
     - `src/features/users/useUserFormHelpers.ts`
     - `src/features/transport-assignments/domain/userTransportCourse.ts`
     - `src/pages/TransportAssignmentPage.tsx`

## 4. 再現コマンド（ローカル）

1. まず4本まとめて確認

```bash
npm run test:e2e:transport:critical
```

2. 失敗 spec を単体再現（trace付き）

```bash
npx playwright test <failed-spec-path> --project=chromium --workers=1 --trace=retain-on-failure
```

3. 画面キャプチャ/trace で失敗ステップを特定し、上の「一次切り分け」に沿って修正範囲を絞る。

## 5. 運用メモ

- CI 側では `--workers=1` 固定で実行し、並列由来の揺れを避ける。
- 本 runbook は「早い切り分け」のための簡易版。深掘りは各機能 runbook を参照する。

## 6. Week1 運用レビュー（推奨）

機能追加より先に、以下 2 点だけを 1 週間レビューする。

1. ExceptionCenter priority 指標
   - 参照: `docs/runbooks/exception-center-priority-week1-review.md`
2. nightly transport critical 4本の安定性
   - 対象 workflow: `Nightly Health`
   - 対象 step: `E2E (nightly transport critical)`

### 記録テンプレート

- `docs/runbooks/templates/transport-week1-ops-review-template.md`

### 週次判定（最小）

1. `ExceptionCenter priority` の主要指標が前週比で悪化していない
2. `nightly transport critical` が連続で安定（大きな再現失敗がない）
3. 失敗がある場合、spec 名単位で原因カテゴリを記録できている

この 3 条件を満たせば、transport 領域は「実装済み」ではなく「回る運用」へ移行できる。
