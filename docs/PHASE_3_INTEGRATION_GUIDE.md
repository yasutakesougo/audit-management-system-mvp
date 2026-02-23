# Phase 3: DashboardPage.tsx 統合ガイド

## 背景

Phase 3A では、DashboardPage.tsx の 7 つの useMemo をまとめて `useDashboardSummary` フックに移動します。

**今の状態**:
- useDashboardSummary.ts は **完成状態** ✅
- 次: DashboardPage.tsx に統合

---

## 実装ステップ

### 1️⃣ Import 追加

`src/pages/DashboardPage.tsx` の先頭に以下を追加:

```typescript
import { useDashboardSummary } from '@/features/dashboard/useDashboardSummary';
import type { DashboardSummary } from '@/features/dashboard/useDashboardSummary';
```

---

### 2️⃣ Hook呼び出しを追加

現在のこの行の **直後**:
```typescript
const attendanceCounts = useAttendanceCounts(today);
```

以下を追加:

```typescript
const summary = useDashboardSummary({
  users,
  today,
  currentMonth,
  visits,
  staff,
  attendanceCounts,
  generateMockActivityRecords,
});

const {
  activityRecords,
  usageMap,
  stats,
  attendanceSummary,
  dailyRecordStatus,
  scheduleLanesToday,
  scheduleLanesTomorrow,
  prioritizedUsers,
  intensiveSupportUsers,
} = summary;
```

---

### 3️⃣ 元の useMemo ブロックを削除

以下の 7 つのブロックを削除:

1. **Line ~292** - `const activityRecords = useMemo(...)`
2. **Line ~317** - `const usageMap = useMemo(...)`
3. **Line ~359** - `const stats = useMemo(...)`
4. **Line ~401** - `const attendanceSummary = useMemo(...)`
5. **Line ~461** - `const dailyRecordStatus = useMemo(...)`
6. **Line ~501** - `const [scheduleLanesToday, scheduleLanesTomorrow] = useMemo(...)`
7. **Line ~573** - `const prioritizedUsers = useMemo(...)`

---

### 4️⃣ Verification

```bash
npm run typecheck
npm run build
npm run test:e2e:smoke -- --grep dashboard
```

---

### 5️⃣ Commit & Push

```bash
git add -A
git commit -m "refactor(dashboard): consolidate useMemo into useDashboardSummary hook

- Extract 7 useMemo blocks into single hook
- Reduce DashboardPage lines (~400 lines savings)
- Consolidate summary calculation logic
- Zero behavior change (ロジックは移動のみ)
"
git push -u origin refactor/dashboard-summary-hook
```

---

## 注意点

### ⚠️ intensiveSupportUsers の二重定義

現在 DashboardPage に以下がある場合:
```typescript
const intensiveSupportUsers = users.filter(user => user.IsSupportProcedureTarget);
```

この行は **削除してください**（hook から分割代入します）

### ⚠️ vm assignment の確認

`useDashboardViewModel` に渡す場合は以下を確認:
```typescript
const vm = useDashboardViewModel({
  // ... 既存の引数 ...
  stats,           // ← fフックから取得
  attendanceSummary,
  dailyRecordStatus,
  // ...
});
```

すべて summary から分割代入されているので、 OK です。

---

## Risk Mitigation

### 🛡️ Rollback
```bash
git revert HEAD
```

### 🛡️ 依存性チェック
- ✅ useMemo 各ブロックの依存配列は hook 内で正確に指定済み
- ✅ 型チェック通す (TypeScript 厳密)

---

## 次のステップ（Phase 3B 以降）

### Phase 3B: Hook 引数の最小化

```typescript
// 現在: 7個の単独引数
useDashboardSummary({ users, today, currentMonth, visits, staff, ... })

// 次: State object に集約
useDashboardSummary({
  state: { users, today, currentMonth, visits, staff, ... },
  generateMockActivityRecords,
})
```

（ただしこれは **次の PR**）

---

**Status**: 実装準備完了 ✅  
**Next**: Phase 2B PR が green になったら実行
