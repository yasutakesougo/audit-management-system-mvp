# env.ts の肥大化解消（646行）と環境変数管理の統一

- **対象ファイル**:
  - `src/lib/env.ts`（646行）
  - `src/lib/env.schema.ts`（モジュールレベルキャッシュ: `let cachedParsedEnv`)
  - `src/env.ts`（73行、モジュールレベルキャッシュ: `let cachedEnv`）
- **カテゴリ**: リファクタリング
- **現状の課題**:
  環境変数の管理が 3 つのファイルに分散しています:
  1. **`src/lib/env.ts`**（646行）: アプリケーション設定の主要ファイル。`let appConfigCache` によるモジュールレベルキャッシュを保持
  2. **`src/lib/env.schema.ts`**: Zod スキーマによる環境変数のバリデーション。`let cachedParsedEnv` でパース結果をキャッシュ
  3. **`src/env.ts`**: 別のキャッシュ機構（`let cachedEnv`）を持つ重複ファイル

  問題点:
  - 同じ環境変数を複数の場所からアクセスする方法が存在し、結果の不一致リスク
  - `src/lib/env.ts` が 646 行と肥大化し、feature flags、URL構築、SP設定など多数の責務が混在
  - 2つの `env.ts` のどちらを使うべきか不明確
- **解決策の提案**:
  ```
  src/lib/env/
  ├── index.ts            # re-export barrel
  ├── envSchema.ts        # Zod スキーマのみ (≤120行)
  ├── envReader.ts        # 環境変数の読み込みとキャッシュ (≤100行)
  ├── appConfig.ts        # AppConfig の構築 (≤150行)
  ├── spConfig.ts         # SharePoint 関連の URL/設定構築
  └── featureFlags.ts     # フィーチャーフラグ (既存ファイルと統合)
  ```
  `src/env.ts` は `src/lib/env/envReader.ts` に統合・削除する。
- **見積もり影響度**: Medium
