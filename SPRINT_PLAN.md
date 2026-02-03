# スプリント計画（2週間単位）

> このドキュメントは Backlog.md の内容を元に、重要度・緊急性・依存関係・リスクを考慮した2週間単位のスプリント計画です。

## 計画の原則

### 優先順位の判断基準

1. **緊急性**: 本番環境への影響度（認証障害は全システム停止）
2. **依存関係**: 他のタスクのブロッカーとなるか
3. **リスク軽減**: セキュリティや安定性への影響
4. **工数**: S工数タスクを優先し、早期フィードバックを得る

### スプリント構成

- **期間**: 2週間（10営業日）
- **工数定義**:
  - S（小）: 1-2日
  - M（中）: 3-5日
  - L（大）: 6-10日
- **キャパシティ**: Sprint 1-2 は S工数タスクを中心に構成

---

## 第1スプリント: 認証E2Eテストと安定性改善

**期間**: Week 1-2  
**主なテーマ**: MSAL認証の自動化とUsers CRUD基本回帰の確立  
**ゴール**: 認証とユーザー管理の最小限の安全網を構築し、破壊的変更を早期検知できる状態にする

### スプリント目標

- MSAL認証フローの自動E2Eテストを導入し、CI/CDで安定稼働させる
- Users CRUD（追加/削除）の基本回帰テストを実装し、主要操作の保護を確立する
- Playwright テスト環境の整備と安定化（リトライ・タイムアウト調整）

### タスク構成（PR分解）

#### PR#1: MSAL認証 E2E スモークテスト + Playwright安定化

**Issue**: [001-msal-login-e2e-smoke.md](./issues/001-msal-login-e2e-smoke.md)

**目的**:
- 認証の致命的バグを自動検知
- ログイン→ログアウト動線の保護
- CI/CDでの安定実行を確立

**受け入れ基準**:
- [ ] `tests/e2e/msal-login.smoke.spec.ts` を作成
- [ ] Playwright で `signIn()` → `/me` レンダリング → `signOut()` の流れを検証
- [ ] CI（GitHub Actions）で緑になる（リトライ設定含む）
- [ ] E2E実行時の環境変数・モック設定をドキュメント化

**工数**: S（1-2日）

**依存関係**: なし（最優先）

**リスク対策**:
- MSAL モックが不安定な場合は `VITE_E2E_MSAL_MOCK=true` で回避
- タイムアウト・リトライ設定を `playwright.config.ts` で調整

**実装ポイント**:
```typescript
// tests/e2e/msal-login.smoke.spec.ts
test('MSAL login → /me → logout', async ({ page }) => {
  await page.goto('/');
  // signIn() helper を使用
  await signIn(page);
  await expect(page.getByTestId('user-profile')).toBeVisible();
  await expect(page.getByTestId('user-email')).toContainText('@');
  // signOut() helper を使用
  await signOut(page);
  await expect(page.getByRole('button', { name: 'ログイン' })).toBeVisible();
});
```

---

#### PR#2: Users CRUD 基本回帰テスト（追加/削除）

**Issue**: [002-users-crud-smoke.md](./issues/002-users-crud-smoke.md)

**目的**:
- Users CRUD の最小限の回帰テストを確立
- ユーザー追加→削除の主要フローを保護
- モックAPIの安定性検証

**受け入れ基準**:
- [ ] `tests/e2e/users-crud-add-delete.smoke.spec.ts` を作成
- [ ] ユーザー追加 → 一覧確認 → 削除 のフローをテスト
- [ ] モックAPI（`VITE_DEMO_MODE=1`）で安定してパス
- [ ] CI で緑になる

**工数**: S（1-2日）

**依存関係**: PR#1完了後（Playwright環境整備後）

**リスク対策**:
- モックデータの初期化が不完全な場合は `beforeEach` でクリーンアップ
- 一時的な削除は skip せず、専用のテストユーザーを使用

**実装ポイント**:
```typescript
// tests/e2e/users-crud-add-delete.smoke.spec.ts
test('Add user → verify in list → delete', async ({ page }) => {
  await page.goto('/dev/users');
  
  // Add user
  await page.getByRole('button', { name: '新規登録' }).click();
  await page.getByLabel('氏名').fill('テスト太郎');
  await page.getByRole('button', { name: '保存' }).click();
  
  // Verify in list
  await expect(page.getByText('テスト太郎')).toBeVisible();
  
  // Delete
  await page.getByRole('button', { name: '削除' }).first().click();
  await page.getByRole('button', { name: '確認' }).click();
  
  // Verify deleted
  await expect(page.getByText('テスト太郎')).not.toBeVisible();
});
```

---

### スプリント1の成果物

1. **E2Eテストスイート**:
   - `tests/e2e/msal-login.smoke.spec.ts`
   - `tests/e2e/users-crud-add-delete.smoke.spec.ts`

2. **CI/CD設定**:
   - GitHub Actions ワークフローの安定化（リトライ・タイムアウト調整）
   - `.github/workflows/e2e-smoke.yml` の更新

3. **ドキュメント**:
   - `docs/E2E_BEST_PRACTICES.md` の更新（認証・CRUD テストパターン）
   - `issues/001-msal-login-e2e-smoke.md`
   - `issues/002-users-crud-smoke.md`

4. **メトリクス**:
   - E2Eテストカバレッジ: 認証フロー（100%）、Users CRUD（追加/削除のみ）
   - CI実行時間: +2-3分（許容範囲内）

---

## 第2スプリント: 品質CI統合

**期間**: Week 3-4  
**主なテーマ**: アクセシビリティ自動チェックとMSAL設定健全性ガード  
**ゴール**: 品質を自動で保証する仕組みを確立し、開発速度と品質を両立させる

### スプリント目標

- アクセシビリティ違反を自動検知し、UI品質を維持
- MSAL設定ミスを起動時に検知し、環境差異による事故を防ぐ
- CI/CDパイプラインに品質チェックを統合

### タスク構成

#### PR#3: a11y 自動チェック（jest-axe 単体導入）

**Issue**: [003-a11y-unit-checks.md](./issues/003-a11y-unit-checks.md)

**目的**:
- 初期段階でアクセシビリティ違反を検知
- RecordList・UsersPanel の a11y 品質を保証
- CI で自動実行し、違反をブロック

**受け入れ基準**:
- [ ] `jest-axe` をインストール（`npm install --save-dev jest-axe`）
- [ ] `tests/unit/a11y.RecordList.spec.ts` を作成
- [ ] `tests/unit/a11y.UsersPanel.spec.ts` を作成
- [ ] axe 違反がゼロであることを確認
- [ ] CI で自動実行

**工数**: S（1-2日）

**依存関係**: なし（並行実施可能）

**実装ポイント**:
```typescript
// tests/unit/a11y.RecordList.spec.ts
import { axe, toHaveNoViolations } from 'jest-axe';
import { render } from '@testing-library/react';
import RecordList from '@/components/RecordList';

expect.extend(toHaveNoViolations);

test('RecordList has no a11y violations', async () => {
  const { container } = render(<RecordList records={[]} />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

---

#### PR#4: MSAL 設定健全性ガード（env schema）

**Issue**: [004-msal-env-guard.md](./issues/004-msal-env-guard.md)

**目的**:
- Redirect URI や Authority などの設定ミスを起動時に検知
- 環境差異による認証エラーを未然に防ぐ
- 開発者体験の向上（明確なエラーメッセージ）

**受け入れ基準**:
- [ ] `zod` を使って env 変数を検証（`src/config/envSchema.ts`）
- [ ] 不正値があると `npm start` 時にエラーで停止
- [ ] エラーメッセージに修正方法を含める
- [ ] `.env.example` を更新

**工数**: S（1-2日）

**依存関係**: なし（並行実施可能）

**実装ポイント**:
```typescript
// src/config/envSchema.ts
import { z } from 'zod';

const envSchema = z.object({
  VITE_MSAL_CLIENT_ID: z.string().min(1, 'MSAL Client ID is required'),
  VITE_MSAL_TENANT_ID: z.string().min(1, 'MSAL Tenant ID is required'),
  VITE_MSAL_REDIRECT_URI: z.string().url('Invalid redirect URI'),
});

export function validateEnv() {
  const result = envSchema.safeParse(import.meta.env);
  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.format());
    throw new Error('Environment validation failed. Check .env.example for reference.');
  }
  return result.data;
}
```

---

### スプリント2の成果物

1. **品質チェックスイート**:
   - `tests/unit/a11y.RecordList.spec.ts`
   - `tests/unit/a11y.UsersPanel.spec.ts`
   - `src/config/envSchema.ts`

2. **CI/CD設定**:
   - `.github/workflows/quality.yml` の追加/更新
   - a11y チェックの自動実行

3. **ドキュメント**:
   - `docs/ACCESSIBILITY_GUIDE.md` の更新
   - `docs/ENV_SETUP_GUIDE.md` の追加
   - `.env.example` の更新

4. **メトリクス**:
   - a11y カバレッジ: RecordList（100%）、UsersPanel（100%）
   - env 検証エラー: 起動時 100% 検出

---

## 次フェーズ候補（Sprint 3以降）

### M工数タスク（基盤整備後）

#### 1. Users CRUD 統合テスト（4ステップ網羅）

**目的**: 追加 → 一覧 → 編集 → 削除のユーザーフロー全体を自動保証

**工数**: M（3-5日）

**受け入れ基準**:
- モックAPIとDBリセット機構を併用
- 4ステップを通しで自動化して安定パス
- CI で緑になる

**依存関係**: Sprint 1 PR#2 完了後

---

#### 2. a11y CI 統合（複合ページ）

**目的**: RecordList と UsersPanel を組み合わせた画面でも a11y 違反ゼロを維持

**工数**: M（3-5日）

**受け入れ基準**:
- axe レポートを CI で保存
- 違反ゼロのときにジョブが成功
- `artifacts/axe-report.json` として保存

**依存関係**: Sprint 2 PR#3 完了後

---

#### 3. HTTPS 復帰（RSA + TLS1.2/1.3）

**目的**: Entra/MSAL の本番挙動に近い HTTPS 動作を開発環境でも再現

**工数**: M（3-5日）

**受け入れ基準**:
- mkcert で発行した証明書を使用
- Vite dev server が TLS1.2/1.3 で安定稼働
- MSAL 認証が HTTPS 環境で正常動作

**依存関係**: なし（独立タスク）

---

## リスクと対策

### Sprint 1 リスク

| リスク | 発生確率 | 影響度 | 対策 |
|--------|----------|--------|------|
| MSAL モックが不安定 | 中 | 高 | `VITE_E2E_MSAL_MOCK=true` で回避、リトライ設定 |
| CI タイムアウト | 中 | 中 | `playwright.config.ts` でタイムアウト調整 |
| モックデータ初期化失敗 | 低 | 中 | `beforeEach` でクリーンアップ |

### Sprint 2 リスク

| リスク | 発生確率 | 影響度 | 対策 |
|--------|----------|--------|------|
| axe 違反の発見 | 高 | 低 | 既存コンポーネントの修正（別PR） |
| env 検証の false positive | 低 | 中 | スキーマの調整、必須/任意の見直し |

---

## 進捗管理

### Sprint 1 チェックリスト

- [ ] PR#1: MSAL認証 E2E スモークテスト + Playwright安定化
  - [ ] Issue 作成
  - [ ] テスト実装
  - [ ] CI 設定
  - [ ] ドキュメント更新
  - [ ] PR マージ
- [ ] PR#2: Users CRUD 基本回帰テスト（追加/削除）
  - [ ] Issue 作成
  - [ ] テスト実装
  - [ ] CI 設定
  - [ ] ドキュメント更新
  - [ ] PR マージ

### Sprint 2 チェックリスト

- [ ] PR#3: a11y 自動チェック（jest-axe 単体導入）
  - [ ] Issue 作成
  - [ ] jest-axe インストール
  - [ ] テスト実装
  - [ ] CI 設定
  - [ ] ドキュメント更新
  - [ ] PR マージ
- [ ] PR#4: MSAL 設定健全性ガード（env schema）
  - [ ] Issue 作成
  - [ ] env スキーマ実装
  - [ ] バリデーション組み込み
  - [ ] .env.example 更新
  - [ ] ドキュメント更新
  - [ ] PR マージ

---

## メトリクス目標

### Sprint 1

- **E2E テストカバレッジ**: 認証フロー 100%、Users CRUD 50%（追加/削除のみ）
- **CI 成功率**: 90% 以上
- **CI 実行時間**: ベースライン + 3分以内

### Sprint 2

- **a11y カバレッジ**: RecordList・UsersPanel 100%
- **env 検証カバレッジ**: MSAL関連変数 100%
- **CI 成功率**: 95% 以上

---

## 参考

- [Backlog.md](./Backlog.md)
- [E2E_BEST_PRACTICES.md](./docs/E2E_BEST_PRACTICES.md)
- [E2E_TEST_STRATEGY.md](./docs/E2E_TEST_STRATEGY.md)
- [プロジェクトボード自動連携](./docs/project-auto-integration.md)
