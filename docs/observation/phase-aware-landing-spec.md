# Phase-Aware Landing 実装仕様書

> **ステータス**: 観測完了後に着手（2026-03-28 レビュー後）
> **前提条件**: 観測ガイドの 2 週間レビューで対象フェーズの CTR ≥ 50% を確認済みであること

---

## 1. 概要

アプリ起動時に現在のフェーズを判定し、**主役画面に自動着地する**。
ユーザーが毎回手動で遷移していた動線を 3 → 0 クリックに短縮する。

### Before（現状）

```
アプリを開く → /today に着地 → バナーを見る → クリック → /handoff-timeline
```

### After（Phase-Aware Landing）

```
アプリを開く → 朝会フェーズ → /handoff-timeline に自動着地
```

---

## 2. 導入判定基準

2 週間レビューの結果を使って判断する。

| 条件 | アクション |
|---|---|
| CTR ≥ 50% | Phase-Aware Landing 対象に追加 |
| CTR 20〜50% | バナー提案を維持（自動化しない） |
| CTR < 20% | バナー提案の見直し or 非表示 |

### 初回導入の想定対象

| フェーズ | 想定 CTR | 着地先 | 導入フェーズ |
|---|---|---|---|
| `morning_briefing` | 50%+ (想定) | `/handoff-timeline` | Phase 7a |
| `evening_briefing` | 50%+ (想定) | `/handoff-timeline` | Phase 7b |
| その他 | < 50% (想定) | `/today` (従来通り) | 対象外 |

---

## 3. 設計制約（絶対条件）

### 3.1 初回着地のみ

- **セッション開始時の最初の画面遷移だけ** で発動する
- アプリ内でページ遷移した後は発動しない
- ブラウザリロードは新セッション扱い

### 3.2 手動優先

- ユーザーが **明示的に URL を指定** して遷移した場合は自動着地しない
- 発動条件: `pathname === "/"` または **デフォルト landing ルート** のみ

### 3.3 opt-out

- 自動着地後に `/today` に戻るナビゲーションを自然に使える
- 将来的にユーザー設定で「フェーズ着地を無効化」できる拡張ポイントを残す

### 3.4 フォールバック

- 設定ロード未完了 → `/today` にフォールバック
- フェーズ判定失敗 → `/today` にフォールバック
- 対象外フェーズ → `/today` にフォールバック

---

## 4. 実装方針

### 4.1 使用する既存インフラ

```
resolvePhaseFromConfig(now, config)  → 現在フェーズ + 主役画面を返す
useOperationFlowConfig()             → 設定配列を取得
DEFAULT_PHASE_CONFIG                 → フォールバック用
```

**新しい判定ロジックは不要。**

### 4.2 着地判定の擬似コード

```typescript
// AppShell または ランディングルート内で実行

function resolveLandingRoute(
  config: OperationFlowPhaseConfig[],
  now: Date,
  enabledPhases: Set<OperationFlowPhaseKey>,  // Phase-Aware 対象
): string {
  const resolved = resolvePhaseFromConfig(now, config);

  // 対象フェーズかつ /today 以外の主役画面 → 自動着地
  if (
    enabledPhases.has(resolved.phaseKey) &&
    resolved.legacyPrimaryScreen !== '/today'
  ) {
    return resolved.legacyPrimaryScreen;
  }

  // それ以外 → 従来どおり
  return '/today';
}
```

### 4.3 発動タイミング

```
ユーザーが "/" にアクセス
  ↓
useOperationFlowConfig() で config をロード
  ↓
ロード完了？
  NO → /today にフォールバック
  YES → resolveLandingRoute() を実行
    ↓
  結果のパスに navigate()
```

### 4.4 対象フェーズの管理

最初はハードコードで十分:

```typescript
const PHASE_AWARE_ENABLED: Set<OperationFlowPhaseKey> = new Set([
  'morning_briefing',
  // Phase 7b で追加: 'evening_briefing',
]);
```

将来的には `/settings/operation-flow` に「自動着地を有効化」チェックボックスを追加。

---

## 5. テレメトリ

### 5.1 追加イベント

| イベント | 意味 | 項目 |
|---|---|---|
| `phase-landing-auto` | Phase-Aware Landing で自動遷移した | `phase`, `screen`, `landingTarget` |
| `phase-landing-fallback` | フォールバックで /today に着地した | `phase`, `reason` |

### 5.2 観測指標

```
自動着地率 = phase-landing-auto / (phase-landing-auto + phase-landing-fallback) × 100
```

| 判定 | 自動着地率 | アクション |
|---|---|---|
| 🟢 健全 | > 80% | 安定稼働 |
| 🟡 要注意 | 50〜80% | config ロード速度を確認 |
| 🔴 危険 | < 50% | フォールバックが多すぎる → 設定を見直す |

---

## 6. 段階導入スケジュール

### Phase 7a: morning_briefing のみ（レビュー直後）

```
対象: morning_briefing
着地先: /handoff-timeline
条件: CTR ≥ 50% を確認済み
```

**やること:**
1. `resolveLandingRoute()` を実装
2. `PHASE_AWARE_ENABLED` に `morning_briefing` を追加
3. テレメトリ `phase-landing-auto` / `phase-landing-fallback` を追加
4. 1 週間観測

**確認項目:**
- [ ] 朝 09:00〜09:15 に自動着地が発生しているか
- [ ] フォールバック率が 20% 以下か
- [ ] 現場から「勝手に飛ばされた」という声がないか

### Phase 7b: evening_briefing 追加（Phase 7a 安定後）

```
対象: morning_briefing + evening_briefing
着地先: /handoff-timeline
条件: Phase 7a が 1 週間安定
```

**やること:**
1. `PHASE_AWARE_ENABLED` に `evening_briefing` を追加
2. 1 週間観測

### Phase 7c: 管理設定化（任意）

```
対象: 全フェーズ（管理者が選択）
条件: Phase 7b が安定し、他フェーズも CTR が高い場合
```

**やること:**
1. `/settings/operation-flow` に「自動着地」列を追加
2. フェーズごとに ON/OFF を管理者が切り替え可能にする

---

## 7. ロールバック手順

問題が出た場合の即座の無効化:

```typescript
// 全フェーズの自動着地を無効化するには:
const PHASE_AWARE_ENABLED: Set<OperationFlowPhaseKey> = new Set([
  // すべてコメントアウト
]);
```

全フェーズで `/today` にフォールバックし、従来動作に戻る。
コード変更 1 行、デプロイのみ。

---

## 8. 実装チェックリスト

### 着手前

- [ ] 2 週間レビュー完了
- [ ] `morning_briefing` の CTR ≥ 50% を確認
- [ ] 現場リーダーに「朝会時は自動で申し送り画面に着地します」と事前説明

### 実装

- [ ] `resolveLandingRoute()` 純粋関数を作成
- [ ] 純粋関数テストを作成（全フェーズ × 対象/対象外 × フォールバック）
- [ ] AppShell のランディング判定に組み込み
- [ ] テレメトリ `phase-landing-auto` / `phase-landing-fallback` を追加
- [ ] `PHASE_AWARE_ENABLED` に `morning_briefing` を設定

### 検証

- [ ] `/` にアクセスして `morning_briefing` 時間帯に `/handoff-timeline` に着地するか
- [ ] `/today` を明示的に開いたときにリダイレクトされないか
- [ ] 設定ロード前にアクセスしたとき `/today` にフォールバックするか
- [ ] 対象外フェーズで `/today` に着地するか
- [ ] typecheck / vitest / eslint が通るか

### 導入後

- [ ] 1 日目: fallback 率を確認
- [ ] 3 日目: 自動着地率 80% 以上か
- [ ] 1 週間後: 現場フィードバックを収集
- [ ] 問題なければ Phase 7b に進む
