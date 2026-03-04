# Architecture: Daily Module Repository Layer

> **最終更新:** 2026-03-04 — Phase 1〜3 完了時点

## 概要

`daily` モジュールにおけるデータアクセス層は、**Ports & Adapters (Hexagonal Architecture)** パターンを採用しています。
これにより、UI コンポーネント（React / Hooks）はデータがどこに保存されているか（InMemory / localStorage / SharePoint API 等）を一切意識することなく、ビジネスロジックの描画に専念できます。

バックエンド API が完成した際には、**UI 側のコードを一行も変更することなく**、`infra/` ディレクトリに新しい Adapter を追加するだけで移行が完了します。

---

## ディレクトリ構成

```
src/features/daily/
├── domain/                          # 📋 Ports (Interfaces)
│   ├── DailyRecordRepository.ts     #   日誌記録の CRUD
│   ├── BehaviorRepository.ts        #   行動観察の CRUD
│   ├── ProcedureRepository.ts       #   手順（時間割）の取得・保存
│   ├── ExecutionRecordRepository.ts  #   実施記録の取得・Upsert
│   └── executionRecordTypes.ts      #   Execution ドメイン型 + Zod スキーマ
│
├── infra/                           # 🔌 Adapters & Factories
│   ├── repositoryFactory.ts         #   DailyRecord Factory
│   ├── behaviorRepositoryFactory.ts #   Behavior Factory
│   ├── procedureRepositoryFactory.ts#   Procedure Factory
│   ├── executionRepositoryFactory.ts#   Execution Factory
│   ├── InMemoryDailyRecordRepository.ts
│   ├── InMemoryBehaviorRepository.ts
│   ├── SharePointDailyRecordRepository.ts
│   └── SharePointBehaviorRepository.ts
│
├── hooks/                           # 🪝 Factory-Aware Hooks
│   ├── useBehaviorData.ts           #   → behaviorRepositoryFactory
│   ├── useProcedureData.ts          #   → procedureRepositoryFactory
│   ├── useExecutionData.ts          #   → executionRepositoryFactory
│   └── useExecutionRecord.ts        #   B-Layer: 単一スロットの操作を抽象化
│
└── stores/                          # 📦 Zustand Stores (localStorage 永続化)
    ├── behaviorStore.ts
    ├── procedureStore.ts
    └── executionStore.ts
```

---

## 完成度マトリクス (Maturity: 100%)

全 4 リポジトリにおいて Port と Adapter の分離が完了しています。

| Repository | Port (Interface) | Adapter(s) | Factory | Hook |
| :--- | :--- | :--- | :--- | :--- |
| **DailyRecord** | `DailyRecordRepository` | SharePoint, InMemory | `repositoryFactory.ts` | `useDailyRecordRepository()` |
| **Behavior** | `BehaviorRepository` | SharePoint, InMemory | `behaviorRepositoryFactory.ts` | `useBehaviorData()` |
| **Procedure** | `ProcedureRepository` | localStorage | `procedureRepositoryFactory.ts` | `useProcedureData()` |
| **Execution** | `ExecutionRecordRepository` | localStorage | `executionRepositoryFactory.ts` | `useExecutionData()` |

---

## データフロー

```
┌─────────────────────────────────────────────────────────────┐
│  UI Layer (Pages / Components)                              │
│  TimeBasedSupportRecordPage, AnalysisDashboardPage, ...     │
└───────────┬──────────────┬──────────────┬───────────────────┘
            │              │              │
            ▼              ▼              ▼
┌───────────────┐ ┌────────────┐ ┌─────────────┐
│ useBehavior   │ │ useProcedure│ │ useExecution │  ← Factory-Aware Hooks
│ Data()        │ │ Data()      │ │ Data()       │
└───────┬───────┘ └──────┬─────┘ └──────┬───────┘
        │                │              │
        ▼                ▼              ▼
┌───────────────┐ ┌────────────┐ ┌─────────────┐
│ get*Repository│ │ get*Repo   │ │ get*Repo    │  ← Factory (環境判定)
│ Factory()     │ │ Factory()  │ │ Factory()   │
└───────┬───────┘ └──────┬─────┘ └──────┬───────┘
        │                │              │
   ┌────┴────┐      ┌────┴────┐    ┌────┴────┐
   ▼         ▼      ▼         ▼    ▼         ▼
┌──────┐ ┌──────┐ ┌──────┐ ┌────┐┌──────┐ ┌────┐
│SP API│ │InMem │ │local │ │ SP ││local │ │ SP │  ← Adapters
│      │ │      │ │Strage│ │(将来)│Strage│ │(将来)
└──────┘ └──────┘ └──────┘ └────┘└──────┘ └────┘
```

---

## 重要な設計方針（Architectural Decision Records）

将来の負債を防ぐため、本モジュールの Adapter および Factory 実装においては以下のルールを適用しています。

### ADR-1: Adapter は Class ではなく Plain Object で実装する

**ステータス:** 採用済
**背景:** Class メソッドを用いた Adapter 実装は、利用側で destructuring（分割代入）をした際に `this` コンテキストが失われる（`undefined` になる）致命的なバグを引き起こします。
**決定:** Factory 関数内でクロージャを利用して Store の参照をキャプチャし、Plain Object としてメソッドを返すファクトリパターンを採用。

```typescript
// ❌ 避けるべき実装 (Class)
class ExecutionAdapter implements ExecutionRecordRepository {
  constructor(private store: ExecutionStoreHooks) {}
  getRecord(date: string, userId: string, id: string) {
    return this.store.getRecord(date, userId, id);
    //     ^^^^ destructuring 後は undefined になる
  }
}
const { getRecord } = new ExecutionAdapter(store);
getRecord('2025-04-01', 'U-001', 'slot-1'); // 💥 TypeError

// ✅ 推奨する実装 (Plain Object + Closure)
function createExecutionAdapter(
  store: ExecutionStoreHooks
): ExecutionRecordRepository {
  return {
    getRecord: (date, userId, id) => store.getRecord(date, userId, id),
    //                                ^^^^^ クロージャで安全に参照
  };
}
const { getRecord } = createExecutionAdapter(store);
getRecord('2025-04-01', 'U-001', 'slot-1'); // ✅ 正常動作
```

**影響範囲:** `procedureRepositoryFactory.ts`, `executionRepositoryFactory.ts`

---

### ADR-2: Store-backed Adapter は Singleton Cache せず、React の `useMemo` に委任する

**ステータス:** 採用済
**背景:** Zustand ストアの `useCallback` は、内部の `snapshot` が更新されるたびに新しい関数参照を返します。モジュールレベルの Singleton 変数にキャッシュされた Adapter は、古い snapshot への参照（Stale Closure）を保持し続け、読み取りが陳腐化するバグの原因になります。
**決定:** Store-backed Adapter のメモ化は React のライフサイクル（`useMemo`）に委任し、依存配列に Store の参照を含めることで、常に最新の状態を安全に取得する。

```typescript
// ❌ Singleton Cache — Stale Closure を引き起こす
let cached: ExecutionRecordRepository | null = null;
export const getRepo = (hooks: StoreHooks) => {
  if (cached) return cached;         // ← hooks が変わっても古い adapter を返し続ける
  cached = createAdapter(hooks);
  return cached;
};

// ✅ useMemo — React のレンダリングサイクルに同期
export function useExecutionData(): ExecutionRecordRepository {
  const storeHooks = useExecutionStore();
  return useMemo(
    () => getExecutionRepository(storeHooks),
    [storeHooks],  // ← snapshot 更新時に adapter が再生成される
  );
}
```

**補足:** 将来の SharePoint / REST API Adapter は React State に依存しないため、Singleton Cache を安全に使用可能。

---

### ADR-3: UI 向け Hook からインフラの用語を排除する

**ステータス:** 採用済
**背景:** UI コンポーネントが `useInMemoryBehaviorRepository()` のような名前の Hook を呼び出してしまうと、インフラ実装（InMemory）に対する意味的な依存が生まれ、移行時に全呼び出し元の修正が必要になります。
**決定:** Hook 名から `InMemory`, `LocalStorage` 等のインフラ用語を排除し、中立的な命名とする。

| Before | After |
|---|---|
| `useInMemoryBehaviorRepository()` | `useBehaviorData()` |
| `useInMemoryProcedureRepository()` | `useProcedureData()` |
| `useExecutionStore()` (直接参照) | `useExecutionData()` |

---

## 新しい Adapter を追加するには（Phase 4 ガイド）

バックエンド API が完成した際の追加手順：

1. **Adapter 作成:** `infra/RestApiExecutionRepository.ts` を作成し、`ExecutionRecordRepository` インターフェースを実装
2. **Factory 拡張:** `executionRepositoryFactory.ts` の `resolveKind()` に `'api'` を追加し、`switch` 文に新しい `case` を追加
3. **環境判定更新:** `shouldUseLocalRepository()` の条件を調整
4. **UI 変更:** **不要** ✅ — Hook / Page / Component は一切触れない

```typescript
// infra/executionRepositoryFactory.ts に追加するだけ
case 'api': {
  return createRestApiExecutionAdapter({
    baseUrl: getEnv('VITE_API_BASE_URL'),
    token: getAuthToken(),
  });
}
```

---

## テスト方針

- **Store テスト** (`stores/__tests__/`): Zustand + localStorage の動作を直接テスト
- **Hook テスト** (`hooks/__tests__/`): Factory-Aware Hook 経由でのデータフローをテスト
- **Component テスト** (`components/__tests__/`): 実際の Store を使用した統合テスト（Mock 不要）

現在の検証結果: **23 files / 193 tests — All Passed** ✅
