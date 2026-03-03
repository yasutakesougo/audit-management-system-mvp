# icebergStore.ts のモジュールレベル状態と暗号化ヘルパーの分離（364行）

- **対象ファイル**: `src/features/ibd/analysis/iceberg/icebergStore.ts`（364行）
- **カテゴリ**: アーキテクチャ
- **現状の課題**:
  `icebergStore.ts` は 364 行の複雑なストアで、以下の問題があります:

  1. **モジュールレベルの `let state`** (L29): グローバルなミュータブル状態で React の再レンダリングを手動で管理
  2. **`sha256Like` ハッシュ関数の独自実装** (L202-211): `sha256Hex` が `@/lib/hashUtil` に存在するにもかかわらず、ローカルに 10 行の独自ハッシュ関数が実装されている
  3. **永続化ロジック（`saveSnapshot`, `loadLatest`）とUIロジック（ノード移動、リンク作成）の混在**: 単一ファイルに 2 つの関心事
  4. **ConflictError の import**: `SharePointIcebergRepository` から `ConflictError` を直接 import しており、ストアがインフラ層に依存

  特に `sha256Like` の重複は、セキュリティ上のリスクとメンテナンスコストの両面で問題です:
  ```typescript
  // icebergStore.ts L202-211 (独自実装)
  async function sha256Like(input: string): Promise<string> { ... }

  // lib/hashUtil.ts (プロジェクト標準)
  export async function sha256Hex(input: string, crypto?: ...): Promise<string> { ... }
  ```
- **解決策の提案**:
  1. `sha256Like` を `@/lib/hashUtil` の `sha256Hex` に置き換え
  2. 永続化ロジック(`saveSnapshot`, `loadLatest`)を `icebergPersistence.ts` に分離
  3. `ConflictError` をドメイン層の型として定義し、インフラ依存を解消
  4. モジュールレベル状態を Zustand に移行（`cross-module-architecture-module-level-state` Issue と連携）
- **見積もり影響度**: Medium
