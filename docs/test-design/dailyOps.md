# test design: dailyOps

> 対象: `src/features/dailyOps/`  
> 更新: 2026-03-18

---

## 1. scope

| 層 | 対象ファイル | 責務 |
|----|-------------|------|
| ドメイン型 | `data/port.ts` | `DailyOpsSignal` / `UpsertDailyOpsSignalInput` / `DailyOpsSignalsPort` インターフェース |
| アダプター | `data/sharePointAdapter.ts` | SP 列マッピング・upsert ロジック・compositeKey 重複排除 |
| ファクトリ | `data/dailyOpsSignalsFactory.ts` | 環境判定 (SP / demo) |
| フック | `data/useDailyOpsSignals.ts` | React Query ラッパー (query + mutation × 2) |

テスト対象外（今回）: `dev/` モックデータ、UI コンポーネント

---

## 2. critical flows

```
1. 当日シグナル一覧取得
   date: string → SP listByDate → DailyOpsSignal[]

2. 新規シグナル登録
   UpsertDailyOpsSignalInput → [存在確認] → CREATE → 登録済みシグナル返却

3. 既存シグナル更新（upsert)
   同一複合キー (date, targetType, targetId, kind, time) の再登録
   → UPDATE → 更新済みシグナル返却

4. ステータス変更
   itemId + 'Resolved' → PATCH → キャッシュ無効化

5. デモモード切替
   shouldSkipSharePoint() = true → demo port → 空配列返却
```

---

## 3. risk points

| # | リスク | 説明 |
|---|--------|------|
| R1 | 複合キー重複判定 | `buildCompositeFilter` の `time = null` 分岐が壊れると二重登録が発生する |
| R2 | `toIsoDateOnly` の切り捨て | DateTime 型の SP 値（`2026-03-18T00:00:00Z`）が正しく `2026-03-18` になるか |
| R3 | `mapFromSp` のキャスト | `kind` / `targetType` / `status` は string→union なのでバリデーションなし |
| R4 | upsert フォールバック | created?.Id が取れない場合 id=-1 で返却されるが、後続処理が id を信頼すると壊れる |
| R5 | staleTime=5s | 同一 date を複数タブで開くと古いデータが短時間残存する |
| R6 | エラー時の挙動 | SP がエラーを返した場合 React Query は error 状態になるが、UI の fallback がないと白画面 |

---

## 4. recommended test layers

### Layer A — Pure Functions (Vitest, no mock)

対象: `sharePointAdapter.ts` 内の純関数

```
- toIsoDateOnly
- makeTitle
- buildCompositeFilter
- mapFromSp
```

これらは副作用ゼロで**最もリターンが高い**。

### Layer B — Port mock test (Vitest + mock)

対象: `useDailyOpsSignals.ts` を `renderHook` でテスト  
Port を jest.fn() で差し替え、React Query の動作を確認。

```
- 初期ローディング状態
- 成功時のデータ取得
- upsert 成功後のキャッシュ無効化
```

### Layer C — Adapter integration (Vitest + SP mock client)

対象: `makeSharePointDailyOpsSignalsPort` のユースケース検証

```
- listByDate → filter 文字列が正しく組み立てられるか
- upsert: 新規 → CREATE が呼ばれるか
- upsert: 重複 → UPDATE が呼ばれるか
```

---

## 5. first test targets（実装候補 Top5）

```typescript
// Target: sharePointAdapter.ts

// T1: 複合キー重複判定 — time が null の場合
it('should include null-check clause when time is undefined', () => {
  const filter = buildCompositeFilter({ date: '2026-03-18', targetType: 'User', targetId: 'U001', kind: 'Absent', time: undefined });
  expect(filter).toContain("(OpsTime eq null or OpsTime eq '')");
});

// T2: 複合キー重複判定 — time が値を持つ場合
it('should include exact time clause when time is provided', () => {
  const filter = buildCompositeFilter({ date: '2026-03-18', targetType: 'User', targetId: 'U001', kind: 'Late', time: '09:30' });
  expect(filter).toContain("OpsTime eq '09:30'");
});

// T3: toIsoDateOnly — DateTime 入力
it('should strip time portion from datetime string', () => {
  expect(toIsoDateOnly('2026-03-18T09:00:00Z')).toBe('2026-03-18');
});

// T4: mapFromSp — status フィールド欠損時のデフォルト
it('should default status to Active when field is missing', () => {
  const signal = mapFromSp({ Id: 1, OpsDate: '2026-03-18' });
  expect(signal.status).toBe('Active');
});

// T5: Factory — デモモード時に demo port を返す
it('should return demo port when shouldSkipSharePoint is true', () => {
  // shouldSkipSharePoint をモック → true
  const port = createDailyOpsSignalsPort(async () => null);
  const result = await port.listByDate('2026-03-18');
  expect(result).toEqual([]);
});
```

---

## 6. deferred

| 項目 | 理由 |
|------|------|
| React Query キャッシュ統合テスト | セットアップコストが高い。Layer B が安定してから |
| E2E: 当日画面フルフロー | 画面が固まったタイミングで |
| staleTime=5s のタイムアウトテスト | vitest fake timers で可能だが優先度低 |
| UI コンポーネント (dev/) | スキャフォールドなので後回し |
