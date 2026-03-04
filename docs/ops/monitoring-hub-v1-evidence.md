# Monitoring Hub v1 — Evidence Pack

> **目的:** v1 アンカーの検証結果と契約の不変条件を証跡として固定する
>
> **タグ:** `monitoring-hub-hardened-v1`
> **コミット:** `876e741` (`refactor(dashboard): Monitoring Hub Hardening (Unified 5-PR Series)`)

## 1. アンカー情報

| 項目 | 値 |
|------|-----|
| Git タグ | `monitoring-hub-hardened-v1` |
| コミット SHA | `876e741` |
| コミットメッセージ | `refactor(dashboard): Monitoring Hub Hardening (Unified 5-PR Series)` |
| 作成日 | 2026年2月末 |
| ブランチ | `main` |

### タグの検証

```bash
git tag -v monitoring-hub-hardened-v1
git log --oneline monitoring-hub-hardened-v1 -1
# 期待: 876e741 (tag: monitoring-hub-hardened-v1) refactor(dashboard): Mo...
```

## 2. 検証結果

### 2.1 TypeCheck

```bash
npx tsc --noEmit --pretty
# 結果: exit code 0（エラーなし）
```

### 2.2 Unit Tests (Vitest)

```bash
npx vitest run src/features/schedules/components/__tests__/SchedulesSpLane.spec.tsx
# 結果: 全テスト pass
```

テストカバー範囲:
- `data-state` の各状態 (`disabled`, `idle`, `active`, `error`)
- `data-source` 表示
- `data-version` 表示
- `data-error-kind` 表示
- リトライボタンの表示/非表示
- 詳細ダイアログの表示

### 2.3 Dashboard Integration

```bash
npx vitest run src/features/dashboard/sections/impl/__tests__/ScheduleSection.spLane.spec.tsx
# 結果: pass
```

## 3. 契約の不変条件（Invariants）

### 3.1 Constant Frame

`SchedulesSpLane` は以下の構造を常に維持する:

1. **ルート要素** (`Paper`):
   - `data-testid="schedules-sp-lane"` — 常に存在
   - `data-state` — 必ず `disabled | idle | active | error` のいずれか
   - `data-source` — `sp | polling | demo | undefined`
   - `data-version` — 正の整数（単調増加）
   - `data-error-kind` — エラー時のみ設定

2. **タイトル** (`Typography variant="subtitle2"`):
   - 常に `model.title` を表示

3. **コンテンツ領域**:
   - `state` に応じた1つのレンダリングパスのみ実行（switch文）

### 3.2 Pure Mapping

`SchedulesSpLane` は **純粋なマッピングコンポーネント**:

- Props (`SpLaneModel`) を受け取り、UI に変換するだけ
- 副作用なし（`useEffect` を持たない）
- 状態は `detailsOpen` (ダイアログ表示)のみ（ローカルUI状態）
- `onRetry` コールバックは親から注入

### 3.3 Version Policy

- `data-version` は同期ごとに単調増加
- バージョンのリセットは Hub の再マウント時のみ
- テストで `data-version` の値を検証可能

### 3.4 State Machine

```
             ┌──────────┐
             │ disabled │ ← VITE_SKIP_SHAREPOINT=true
             └──────────┘

             ┌──────────┐
             │   idle   │ ← 初期状態（接続待ち）
             └────┬─────┘
                  │ 接続成功
                  ▼
             ┌──────────┐
      ┌──────│  active  │──────┐
      │      └──────────┘      │
      │ エラー発生              │ 再同期成功
      ▼                        │
 ┌──────────┐                  │
 │  error   │──────────────────┘
 └──────────┘
      │ リトライ → 成功
      └────────────────────────┘
```

## 4. 観測ポイント（data属性）

| 属性 | 型 | 説明 | テスト検証 |
|------|-----|------|-----------|
| `data-testid` | `string` | 固定値 `schedules-sp-lane` | ✅ |
| `data-state` | `disabled\|idle\|active\|error` | Hub の状態 | ✅ |
| `data-source` | `string\|undefined` | データソース | ✅ |
| `data-busy` | `"1"\|undefined` | 同期中フラグ | ✅ |
| `data-version` | `number` | 同期バージョン | ✅ |
| `data-error-kind` | `string\|undefined` | エラー種別 | ✅ |
| `data-can-retry` | `"1"\|"0"` | リトライ可能か | ✅ |
| `data-cooldown-until` | `string\|undefined` | 再試行禁止期限 | ー |
| `data-failure-count` | `number\|undefined` | 連続失敗回数 | ー |
| `data-retry-after` | `number\|undefined` | 次回リトライまで秒 | ー |

## 5. 関連ドキュメント

| ドキュメント | パス |
|------------|------|
| Monitoring Hub Runbook | [docs/ops/monitoring-hub-v1-runbook.md](../ops/monitoring-hub-v1-runbook.md) |
| Schedules Reliability Walkthrough | [docs/walkthrough/schedules-reliability.md](../walkthrough/schedules-reliability.md) |
| Contract Tests | [tests/unit/contracts/contract.spec.ts](../../tests/unit/contracts/contract.spec.ts) |
| Hub Type Definitions | [src/features/dashboard/types/hub.ts](../../src/features/dashboard/types/hub.ts) |

## 6. 静置期間ルール

- **期間:** タグ作成から 2週間
- **目標:** 「何も起きないこと」を運用で証明
- **判定基準:**
  - Hub 関連の Sentry エラー: 0件
  - `data-state="error"` の持続報告: 0件
  - コード変更: Hub コンポーネント本体への変更なし
- **終了条件:** 静置期間中に上記が維持されれば、v1 を安定版として確定
