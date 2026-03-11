# Night Run 13 — BulkDailyRecordList Flaky Timeout 修正

**Date:** 2026-03-11
**Status:** ✅ 修正完了・全テスト pass
**Typecheck:** ✅ Pass
**Lint:** ✅ Pass (0 warnings)
**Tests:** ✅ 3,230 passed (no regression)

---

## 問題概要

### Flaky テストの症状

`src/features/daily/__tests__/BulkDailyRecordList.test.tsx` の以下のテストが CI 環境で intermittently timeout していた：

```
BulkDailyRecordList > 行ごと保存のインターフェース > onSaveRowが未提供の場合、モックが使用される
```

**実測タイム（ローカル）：1056ms**
**元の waitFor timeout：1000ms**
**マージン：わずか -56ms（CI では容易に超過）**

---

## 根本原因

### アーキテクチャ上の問題

`useBulkDailyRecordState.ts` の `saveRow` 内にプロダクションコードとして 500ms の timer が埋め込まれていた：

```typescript
// Before — プロダクションコードに mock delay が混在 ❌
} else {
  await new Promise((resolve) => setTimeout(resolve, 500));
}
```

**問題点：**

1. **テスト不可能な遅延**：`onSaveRow` 未提供時の fallback が常に 500ms 待機する real timer に依存
2. **CI flakiness**：`waitFor({ timeout: 1000 })` はローカルでギリギリ通るが、低スペック CI runner では setup/import オーバーヘッドで 1000ms を超過
3. **Mock/production 混在**：fallback ロジックはプロダクションコードに混入すべきでない（テスト側で注入すべき）

---

## 修正内容

### 1. `useBulkDailyRecordState.ts` — injectable delay オプション追加

```typescript
export interface UseBulkDailyRecordStateOptions {
  onSave?: (records: BulkDailyRow[]) => Promise<void>;
  onSaveRow?: (row: BulkDailyRow) => Promise<void>;
  /**
   * Milliseconds to wait in the fallback mock save (when onSaveRow is not provided).
   * Override with 0 in tests to avoid real-time waits and eliminate flakiness.
   * @default 500
   */
  mockSaveDelay?: number;
}
```

```typescript
// After — 注入可能になり fallback delay を外から制御できる ✅
} else {
  await new Promise((resolve) => setTimeout(resolve, mockSaveDelay));
}
```

- **プロダクション**: `mockSaveDelay` 省略 → デフォルト 500ms（動作変化なし）
- **テスト**: `mockSaveDelay={0}` 渡す → 即時解決

### 2. `BulkDailyRecordList.tsx` — props に `mockSaveDelay` を追加

```tsx
interface BulkDailyRecordListProps {
  selectedDate?: string;
  onSave?: (records: BulkDailyRow[]) => Promise<void>;
  onSaveRow?: (row: BulkDailyRow) => Promise<void>;
  /** @see UseBulkDailyRecordStateOptions.mockSaveDelay */
  mockSaveDelay?: number;
}
```

コンポーネント経由でテスト注入を可能にする。

### 3. テストを deterministic に修正

| 変更点 | Before | After |
|--------|--------|-------|
| render 時 | delay なし | `mockSaveDelay={0}` |
| waitFor timeout | `1000ms` | `2000ms` |
| テストタイム | 1056ms ⚠️ | 643ms ✅ |
| フォールバックテスト名 | `モックが使用される` | `フォールバックが使用される` |

---

## 修正ファイル一覧

| File | Change |
|------|--------|
| `src/features/daily/lists/useBulkDailyRecordState.ts` | `mockSaveDelay` オプション追加・fallback delay を injectable に |
| `src/features/daily/lists/BulkDailyRecordList.tsx` | `mockSaveDelay` prop 追加・hook に threading |
| `src/features/daily/__tests__/BulkDailyRecordList.test.tsx` | `mockSaveDelay={0}` 注入・timeout 拡大・テスト名改善 |

---

## 検証結果

### フォールバックテスト実行時間

| Run | Before | After |
|-----|--------|-------|
| Run 1 | 1056ms | 643ms |

### 全テストスイート

```
Test Files: 390 passed | 4 skipped (394)
     Tests: 3,230 passed | 38 skipped | 1 todo (3,269)
Exit code: 0
```

**Regression なし。**

---

## 設計上の決断

### なぜ `vi.useFakeTimers()` を使わなかったか

`vi.useFakeTimers()` も有効な手段だが、以下の理由で選択しなかった：

1. **設定の複雑さ**：`fakeTimers` は MUI + `@testing-library/react` 環境で `act()` との相互作用が予測しにくい
2. **他のテストへの影響リスク**：`afterEach(() => vi.useRealTimers())` の書き忘れで隣接テストが影響を受ける
3. **より自然な解決策**：`mockSaveDelay=0` で「即時完了」を表現する方が意図が明確で読みやすい
4. **プロダクションコードへの恩恵**：`mockSaveDelay` は将来 feature flag で実際の delay を調整する際にも再利用できる

### `timeout: 2000` の根拠

- `mockSaveDelay=0` で実際の待機はなくなる
- しかし CI runner の負荷・GC・環境変動に対する defense-in-depth として 2000ms を設定
- 「遅すぎて気づかない」レベルではなく「偽陰性を防ぐ」のに十分な値

---

## Night Run 累計状態

| # | 内容 | 結果 |
|---|------|------|
| NR 1–3 | インフラ / 型安全強化 | ✅ |
| NR 4 | useUserForm.ts 4分割 | ✅ |
| NR 5 | useUserFormHelpers 30 unit tests | ✅ |
| NR 6 | parseTransportSchedule Array.isArray guard | ✅ |
| NR 7 | pipeline round-trip tests | ✅ |
| NR 8 | serializeTransportSchedule guard | ✅ |
| NR 9 | serviceProvisionFormHelpers 31 tests | ✅ |
| NR 10 | StaffForm 597→149 lines | ✅ |
| NR 11 | useStaffForm + sections 80 tests | ✅ |
| NR 12 | StaffForm Playwright E2E 12 tests | ✅ |
| **NR 13** | **BulkDailyRecordList flaky timeout 修正** | **✅** |
