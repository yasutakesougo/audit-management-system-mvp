# audit-management-system-mvp｜VSC AI自動実装プロンプト（運用〜拡張フェーズ統合版）

> 🧠 使い方：VS Code の Copilot Chat / ChatGPT 拡張にこのブロックをそのまま貼り付けて実行。「次のPhaseまで進めて」と伝えるだけで、AIが順番に CI 整備 → QA 自動化 → 新機能拡張へ進みます。

---

## 🎯 目的

現状の `audit-management-system-mvp` リポジトリを、

- **運用安定**（CI/Nightly/ロールバック）
- **QA自動化**（E2E・Snapshot）
- **新機能追加準備**（月ビュー・通知）

の 3 フェーズが連動する構成へアップグレードする。

---

## 🩵 Phase 1｜運用フェーズの安定化

### 🎯 目標
CI/CD・Nightly Health・タグ管理・環境変数を整備し、ロールバック可能な安定運用体制を完成させる。

### 🪜 手順
1. **環境チェック**
	- `npm run health` を実行し、typecheck / lint / test がグリーンであることを確認。
2. **安定タグ付け**
	```bash
	git add .
	git commit -m "chore(release): stable quality-gates snapshot"
	git tag -a v1.0.0-stable -m "All quality gates passed ✅"
	git push origin main --tags
	```
3. **Nightly Health ワークフローの追加**
	`.github/workflows/nightly-health.yml`
	```yaml
	name: Nightly Health
	on:
	  schedule:
		 - cron: '0 18 * * *' # JST 03:00
	  workflow_dispatch:
	jobs:
	  health:
		 runs-on: ubuntu-latest
		 steps:
			- uses: actions/checkout@v4
			- uses: actions/setup-node@v4
			  with: { node-version: 20 }
			- run: npm ci
			- run: npm run health
	```
4. **通知設定（任意）**
	- GitHub Secrets に `NOTIFY_WEBHOOK_URL` を登録
	- `quality-gates.yml` の末尾に failure 通知ステップを追加
5. **リリースノート自動生成（任意）**
	- `npm i -D changelogithub`
	- `npx changelogithub` でタグごとのリリースノートを生成

---

## 🧪 Phase 2｜QA自動化フェーズ（推奨）

### 🎯 目標
新機能追加に備え、Playwright・Vitest Snapshot を導入して品質ゲートを強化。

### 🪜 手順
1. **QA ブランチ作成**
	```bash
	git switch -c qa-auto
	npm i -D @playwright/test
	npx playwright install --with-deps
	```
2. **E2E スモークテスト追加**
	`tests/e2e/schedule-smoke.spec.ts`
	```ts
	import { test, expect } from "@playwright/test";

	test("Schedule list loads and shows today", async ({ page }) => {
	  await page.goto("http://localhost:5173/schedule");
	  await expect(page.getByText("スケジュール")).toBeVisible();
	});
	```
3. **Vitest Snapshot テスト追加**
	`tests/unit/ui.snapshot.spec.tsx`
	```tsx
	import { render } from "@testing-library/react";
	import AppShell from "@/components/AppShell";

	test("AppShell snapshot", () => {
	  const { container } = render(<AppShell />);
	  expect(container).toMatchSnapshot();
	});
	```
4. **CI 統合**
	- `.github/workflows/quality-gates.yml` に以下を追加：
	  ```yaml
	  - name: Playwright E2E
		 run: npx playwright test --project=chromium --reporter=dot
	  ```
5. **AI タスク登録（VS Code）**
	- VS Code のタスク定義（`tasks.json`）に追加：
	  ```json
	  {
		 "label": "QA Health",
		 "type": "shell",
		 "command": "npm run health && npx playwright test"
	  }
	  ```
6. **実行確認**
	- VS Code で ⇧⌘B → 「QA Health」を実行

---

## ⚙️ Phase 3｜新機能フェーズ（安全拡張）

### 🎯 目標
安定化した基盤上で、安全にスケジュール・支援記録などを拡張する。

### 🪜 手順
1. **ブランチ作成**
	```bash
	git switch -c feat/schedule-month-view
	```
2. **スケジュール月表示ビュー追加**
	- `features/schedule/views/MonthView.tsx` を作成
	- 週/日切替ナビに `<MonthView />` を追加
3. **API 強化**
	- SharePoint から月単位の一覧を取得する SP クエリを追加（`spClient.schedule.ts` に `getMonthlySchedule()` 追加）
4. **Teams 通知連携（任意）**
	- `notice.ts` に `sendTeamsNotice()` を追加して投稿
5. **Unit + E2E テストを追加**
	- `tests/unit/schedule/month.spec.ts`
	- `tests/e2e/schedule-month.spec.ts`

---

## 🧭 Phase 4｜運用自動化の最終仕上げ

### 🎯 目標
安定運用を完全自動化（fail通知・依存更新・ヘルスチェック・ログ集約）。

### 🪜 手順
1. **依存自動更新**
	- Renovate or Dependabot を有効化
	- `.github/renovate.json`
	  ```json
	  { "extends": ["config:base"], "schedule": ["before 3am on Sunday"] }
	  ```
2. **自動 Health 監視**
	- cron で `npm run health` 実行 → Slack 通知
3. **テストカバレッジ閾値**
	- `vitest.config.ts` に追加：
	  ```ts
	  coverage: { thresholds: { lines: 90, branches: 85 } }
	  ```
4. **Audit & Security**
	- 月次で `npm audit --omit=dev` を CI に追加

---

## ✅ フェーズ切替管理（AI向けフラグ）

| 環境変数 | 役割 |
| --- | --- |
| `VITE_APP_ENV=production` | 本番運用 |
| `VITE_FEATURE_SCHEDULES=1` | 新スケジュール機能有効化 |
| `VITE_FLAG_QA=1` | QA自動化ブランチ |
| `VITE_FLAG_NIGHTLY=1` | 夜間Healthモード |

---

## 📘 期待される成果

- 運用フェーズ安定（CI + Nightly）
- QA 自動化（E2E + Snapshot）
- 新機能追加時も安全にリリース
- 自動テスト＋通知＋依存管理が 1 ループで回る

---

## 🔧 VS Code での進め方

1. Copilot Chat / ChatGPT 拡張にこのブロックを貼る
2. メッセージ末尾に「次のPhaseまで進めて」と入力
3. AI が `git switch` / `npm install` / `ファイル生成` / `CI追加` / `テスト実行` を順に提案・実行

---

💡 **保存も自動で行いたい場合**：このファイルを VS Code AI に読み上げて「docs/ai-tasks/vsc-auto-plan.md を更新して」と指示すれば、最新プロンプトが常に反映されます。
