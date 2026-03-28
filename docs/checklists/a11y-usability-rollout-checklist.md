# A11y / Usability 横展開チェックリスト

Users・`/today`・`/schedules/week` で実績が出た改善手順を、他画面へ再利用するための運用チェックリスト。

## 0. 目的

- a11y/usability 改善を「都度調査」ではなく「実装タスク」に変換する
- 改善後に gate を段階的に復帰して回帰を防止する
- light/dark を同時に扱い、片モードだけの解消で止めない

## 1. 標準プロセス（固定手順）

1. Baseline を取る（axe で違反ノードを収集）
2. 残件を backlog 化する（`画面 × 系統 × 最小修正単位`）
3. 親玉（複数ノードに効く主因）から最小修正する
4. 再スキャンして残件数を更新する
5. `color-contrast` gate を段階的に戻す
6. smoke を light/dark で通してクローズする

## 2. 実装チェック項目

### 2.1 Navigation（キーボード導線）

- [ ] 先頭 Tab で skip link に到達できる
- [ ] skip link で `#app-main-content` にフォーカス移動できる
- [ ] 主要操作まで 10 Tab 以内を目安に到達できる
- [ ] `:focus-visible` が消えていない

実装/テスト例:
- [AppShell.tsx](/Users/yasutakesougo/audit-management-system-mvp/src/app/AppShell.tsx)
- [users.usability.spec.ts](/Users/yasutakesougo/audit-management-system-mvp/tests/e2e/users.usability.spec.ts)

### 2.2 State Integrity（到達可能状態 = 描画可能状態）

- [ ] 認可なしで到達できる UI 導線を閉じる（hidden/disabled）
- [ ] URL 直打ち・内部状態直指定でも不正状態を安全に補正する
- [ ] 空白画面を作らない（fallback を明示）
- [ ] サインイン導線の文言を統一する

実装例:
- [UsersPanel/index.tsx](/Users/yasutakesougo/audit-management-system-mvp/src/features/users/UsersPanel/index.tsx)
- [UsersMenu.tsx](/Users/yasutakesougo/audit-management-system-mvp/src/features/users/UsersPanel/UsersMenu.tsx)

### 2.3 Contrast（light/dark 両方）

- [ ] `color-contrast` を light/dark で計測する
- [ ] `text.secondary` / `text.disabled` / `alpha()` / 継承色を優先確認する
- [ ] `caption` / `overline` / `small button` の低コントラストを優先修正する
- [ ] 共通トークンで直せる箇所を先に直す

実装例:
- [WeekPage.tsx](/Users/yasutakesougo/audit-management-system-mvp/src/features/schedules/routes/WeekPage.tsx)
- [WeekTimeGrid.tsx](/Users/yasutakesougo/audit-management-system-mvp/src/features/schedules/routes/WeekTimeGrid.tsx)
- [HeroActionCard.tsx](/Users/yasutakesougo/audit-management-system-mvp/src/features/today/components/HeroActionCard.tsx)
- [TodayBentoLayout.tsx](/Users/yasutakesougo/audit-management-system-mvp/src/features/today/layouts/TodayBentoLayout.tsx)
- [ProgressRings.tsx](/Users/yasutakesougo/audit-management-system-mvp/src/features/today/components/ProgressRings.tsx)

### 2.4 Mobile Readability（崩れ防止）

- [ ] テーブル見出しを `nowrap` にする
- [ ] 列ごとに `minWidth` を持たせる
- [ ] コンテナに `overflowX: auto` を設定する
- [ ] 1文字折り返し（縦書き化）が起きないことを確認する

実装/テスト例:
- [UsersList.tsx](/Users/yasutakesougo/audit-management-system-mvp/src/features/users/UsersPanel/UsersList.tsx)
- [UsersList.layout.test.tsx](/Users/yasutakesougo/audit-management-system-mvp/src/features/users/UsersPanel/UsersList.layout.test.tsx)

### 2.5 Feedback / Copy

- [ ] 状態表示が色だけに依存していない
- [ ] empty/error 文言が同じ意味で揺れていない
- [ ] サインイン文言（日英混在など）が統一されている

### 2.6 Regression Guard

- [ ] まず `aria-roles` / `button-name` を smoke gate 化する
- [ ] 既知違反が減ってから `color-contrast` を gate に戻す
- [ ] light/dark の 2 モードで gate を回す
- [ ] 認証差分が重要な画面は signed-in/signed-out も固定する

テスト例:
- [today.a11y-smoke.spec.ts](/Users/yasutakesougo/audit-management-system-mvp/tests/e2e/today.a11y-smoke.spec.ts)
- [schedules.a11y-smoke.spec.ts](/Users/yasutakesougo/audit-management-system-mvp/tests/e2e/schedules.a11y-smoke.spec.ts)
- [users.color-contrast.spec.ts](/Users/yasutakesougo/audit-management-system-mvp/tests/e2e/users.color-contrast.spec.ts)

## 3. コマンド（運用用）

```bash
# Users: contrast gate
npx playwright test tests/e2e/users.color-contrast.spec.ts --project=chromium --reporter=line

# Users: usability gate
npx playwright test tests/e2e/users.usability.spec.ts --project=chromium --reporter=line

# Today / Schedules: smoke gate (aria/button/contrast)
npx playwright test tests/e2e/today.a11y-smoke.spec.ts tests/e2e/schedules.a11y-smoke.spec.ts --project=chromium --reporter=line
```

## 4. Backlog テンプレート

| ID | Screen | Mode | System | Axe target | Likely source | Suggested fix (smallest unit) | Priority | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C-XXX-01 | `/example` | dark | Helper text | `.MuiTypography-caption` | `Example.tsx` | dark 時のみ文字色を高コントラスト化 | P1 | Open |

## 5. Definition of Done

- [ ] P0/P1 残件がない
- [ ] light/dark の gate が両方通る
- [ ] keyboard/mobile/state-integrity の主要項目がテストで固定されている
- [ ] backlog が最終状態に更新されている

## 6. 参考（今回の実績）

- [contrast-backlog-today-schedules-2026-03-28.md](/Users/yasutakesougo/audit-management-system-mvp/docs/qa/contrast-backlog-today-schedules-2026-03-28.md)
- [users.usability.spec.ts](/Users/yasutakesougo/audit-management-system-mvp/tests/e2e/users.usability.spec.ts)
- [users.color-contrast.spec.ts](/Users/yasutakesougo/audit-management-system-mvp/tests/e2e/users.color-contrast.spec.ts)
- [today.a11y-smoke.spec.ts](/Users/yasutakesougo/audit-management-system-mvp/tests/e2e/today.a11y-smoke.spec.ts)
- [schedules.a11y-smoke.spec.ts](/Users/yasutakesougo/audit-management-system-mvp/tests/e2e/schedules.a11y-smoke.spec.ts)
