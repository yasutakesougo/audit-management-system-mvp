# モジュールレベル let 変数による状態管理の Zustand 移行

- **対象ファイル**:
  - `src/features/users/usersStoreDemo.ts` (L29-30: `let users`, `let nextId`)
  - `src/features/assessment/stores/assessmentStore.ts` (L49: `let assessments`, L25: `let debounceTimer`)
  - `src/features/nurse/state/useLastSync.ts` (L29: `let state`)
  - `src/features/ibd/analysis/iceberg/icebergStore.ts` (L29: `let state`)
  - `src/features/auth/store.ts` (L28: `let state`)
  - `src/features/daily/stores/procedureStore.ts` (L75: `let store`, L51: `let debounceTimer`)
  - `src/features/daily/stores/executionStore.ts` (L60: `let store`, L36: `let debounceTimer`)
  - `src/features/org/store.ts` (L18: `let orgLoadPromise`, L24: `let orgCachedOptions`)
  - `src/features/nurse/telemetry/telemetry.ts` (L10: `let transport`)
  - `src/features/analysis/stores/interventionStore.ts` (L30: `let debounceTimer`)
- **カテゴリ**: アーキテクチャ
- **現状の課題**:
  プロジェクト全体で 10 以上のファイルが、`let` によるモジュールレベル変数で状態を管理しています。`useSyncExternalStore` と手動の `Set<Listener>` パターンが繰り返し実装されています。

  この問題:
  1. **ボイラープレートの重複**: emit/subscribe/snapshot パターンが各ストアで手動実装（各ファイルに約 20 行のボイラープレート）
  2. **SSR 非安全**: モジュールレベル変数はサーバー/クライアント間で共有され、クロスリクエスト汚染のリスク
  3. **テストの分離困難**: `__resetStore()` のような手動リセット関数が必要で、テスト間の状態漏洩リスク
  4. **DevTools 未対応**: Zustand なら DevTools で状態の変化を追跡可能だが、手動実装では不可

  例（`assessmentStore.ts`より）:
  ```typescript
  let assessments: Record<string, UserAssessment> = loadFromStorage();
  const listeners = new Set<() => void>();
  const emit = () => { listeners.forEach((listener) => listener()); };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  ```
- **解決策の提案**:
  Zustand（既にプロジェクトの依存関係に含まれている）に統一する。各ストアを以下のパターンに移行:

  ```typescript
  // assessmentStore.ts (Zustand版)
  import { create } from 'zustand';
  import { persist } from 'zustand/middleware';

  interface AssessmentState {
    assessments: Record<string, UserAssessment>;
    save: (data: UserAssessment) => void;
    clearDraft: (userId: string) => void;
  }

  export const useAssessmentStore = create<AssessmentState>()(
    persist(
      (set) => ({
        assessments: {},
        save: (data) => set((state) => ({
          assessments: { ...state.assessments, [data.userId]: { ...data, updatedAt: new Date().toISOString() } }
        })),
        clearDraft: (userId) => set((state) => {
          const { [userId]: _, ...rest } = state.assessments;
          return { assessments: rest };
        }),
      }),
      { name: ASSESSMENT_DRAFT_KEY }
    )
  );
  ```

  **段階的移行**: 影響の少ない `auth/store.ts`（90行）から着手し、パターン確立後に他のストアに展開。
- **見積もり影響度**: High
