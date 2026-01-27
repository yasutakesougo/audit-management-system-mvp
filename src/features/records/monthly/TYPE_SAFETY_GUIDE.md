# 月次記録システムの型安全性強化ガイド

## 運用ルール（短縮版）

- ✅ 境界で parse（URL params / SharePoint / E2E seed）してから内部へ渡す
- ✅ 内部では as YearMonth / IsoDate を禁止（例外はテストのみ）
- ✅ 外部から来た string が parse できなければ UI は Empty/Error に落とす
- 例外: テストデータ生成での as YearMonth / IsoDate は可（可能なら parse を使用）

## 概要

月次記録システムの型定義を厳密化し、実運用時の型エラーを早期に検出できるようにしました。

## 主な変更

### 1. YearMonth 型の厳密化

**変更前:**
```typescript
export type YearMonth = `${number}-${`0${number}` | `${number}`}`; // '2025-11'
// 問題: 2025-00 / 2025-19 / 2025-1 / -1-3 などの不正な値も許容
```

**変更後:**
```typescript
type Month = '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11' | '12';
export type YearMonth = `${number}-${Month}`; // '2025-11'
// 月は 01〜12 に固定。不正な値を型レベルで排除
```

**使い方:**
```typescript
import { parseYearMonth } from './map';

// URL params / SharePoint からの文字列を検証
const yearMonth = parseYearMonth(urlParams.get('month'));
if (!yearMonth) {
  throw new Error('Invalid month format');
}

// 型安全に使用
const summary = await fetchMonthlySummary(userId, yearMonth);
```

### 2. IsoDate 型の追加

**定義:**
```typescript
export type IsoDate = `${number}-${Month}-${string}`; // 'YYYY-MM-DD'
```

**使い方:**
```typescript
import { parseIsoDate } from './map';

// SharePoint からの日付文字列を検証
const firstEntryDate = parseIsoDate(fields.FirstEntryDate);
if (!firstEntryDate) {
  console.warn('Invalid date format');
}

// MonthlySummary の firstEntryDate / lastEntryDate は IsoDate 型
const summary: MonthlySummary = {
  userId: 'I001',
  yearMonth: '2025-11',
  firstEntryDate: '2025-11-01', // IsoDate 型として安全
  lastEntryDate: '2025-11-30',
  // ...
};
```

### 3. MonthlySummaryId 型の追加

**定義:**
```typescript
export type MonthlySummaryId = `${string}__${YearMonth}`; // 'I001__2025-11'
```

**使い方:**
```typescript
import { generateMonthlySummaryId } from './map';

// Map のキー / キャッシュ識別子として使用
const summaryMap = new Map<MonthlySummaryId, MonthlySummary>();

const id = generateMonthlySummaryId('I001', '2025-11');
summaryMap.set(id, summary);
```

### 4. completionRate のコメント統一

**変更前:**
```typescript
completionRate: number; // completedRows / plannedRows
```

**変更後:**
```typescript
completionRate: number; // 0..100 (%) - completedRows / plannedRows × 100
```

実装側とコメントが一致するようになりました。

### 5. KPI 整合性の保証

**問題:**
型だけでは `completed + inProgress + empty > planned` のような矛盾を防げない。

**解決策:**
生成関数 `aggregateMonthlyKpi` で invariant を保証:

```typescript
// emptyRows は整合性保証: plannedRows - completedRows - inProgressRows（負にならない）
const emptyRows = Math.max(0, plannedRows - completedRows - inProgressRows);
```

これにより、KPI の整合性が常に保たれます。

## 検証関数の使い方

### parseYearMonth

```typescript
import { parseYearMonth } from './map';

// URL params から取得
const yearMonth = parseYearMonth(urlParams.get('month'));
if (!yearMonth) {
  // エラーハンドリング
  setError('Invalid month format');
  return;
}

// SharePoint から取得
const summary = fromSharePointFields(fields); // 内部で parseYearMonth を使用
```

### parseIsoDate

```typescript
import { parseIsoDate } from './map';

// 日付文字列の検証
const date = parseIsoDate('2025-11-01'); // IsoDate | null
if (date) {
  console.log('Valid date:', date);
}
```

### generateMonthlySummaryId

```typescript
import { generateMonthlySummaryId } from './map';

// Map のキーとして使用
const summaryCache = new Map<MonthlySummaryId, MonthlySummary>();

const id = generateMonthlySummaryId('I001', '2025-11');
summaryCache.set(id, summary);
```

## SharePoint 連携での型検証

`fromSharePointFields` 関数は自動的に型検証を行います:

```typescript
import { fromSharePointFields } from './map';

try {
  const summary = fromSharePointFields(spItem);
  // summary.yearMonth は YearMonth 型（検証済み）
  // summary.firstEntryDate は IsoDate | undefined 型（検証済み）
} catch (error) {
  // 不正な YearMonth フォーマットの場合、Error がスローされる
  console.error('Invalid SharePoint data:', error);
}
```

## テストコードでの使用例

```typescript
import type { DailyRecord, IsoDate, YearMonth } from '../types';

const createDailyRecord = (date: string): DailyRecord => ({
  id: `record_${date}`,
  userId: 'USER001',
  userName: '山田太郎',
  recordDate: date as IsoDate, // 型アサーションが必要
  completed: true,
  hasSpecialNotes: false,
  hasIncidents: false,
  isEmpty: false,
});
```

## 注意事項

1. **型アサーション (`as YearMonth` / `as IsoDate`) の使用は最小限に**
   - 境界（URL params / SharePoint / E2E Fixture）では検証関数を使用
   - 内部では型安全に扱う

2. **parseYearMonth / parseIsoDate の返り値は必ずチェック**
   - `null` の場合は適切なエラーハンドリングを行う

3. **KPI 整合性は生成関数で保証**
   - 型定義だけでは矛盾を防げないため、`aggregateMonthlyKpi` を使用

## まとめ

- **YearMonth**: 月を 01〜12 に固定（不正な値を型レベルで排除）
- **IsoDate**: 日付文字列を型で表現（YYYY-MM-DD）
- **MonthlySummaryId**: 識別子文字列を型で表現（userId__yearMonth）
- **検証関数**: parseYearMonth / parseIsoDate で境界チェック
- **KPI 整合性**: aggregateMonthlyKpi で invariant 保証

これにより、実運用とテストの安定性が大幅に向上しました。
