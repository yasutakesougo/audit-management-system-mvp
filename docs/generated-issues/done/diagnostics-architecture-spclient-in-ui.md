# HealthDiagnosisPage.tsx における spClient の直接import

- **対象ファイル**: `src/features/diagnostics/health/HealthDiagnosisPage.tsx`（591行）
- **カテゴリ**: アーキテクチャ
- **現状の課題**:
  `HealthDiagnosisPage.tsx` の 17 行目で `import { useSP } from "@/lib/spClient"` と SharePoint クライアントを UI コンポーネント内に直接 import しています。

  ```typescript
  // L17: アーキテクチャ違反
  import { useSP } from "@/lib/spClient";
  ```

  本プロジェクトの設計契約（ARCHITECTURE_GUARDS.md）では、SP 操作は `infra/` 層に閉じ込め、UIコンポーネントからの直接アクセスを禁止しています。この違反により:
  - UIコンポーネントがインフラ層と密結合
  - テスト時に SP モックが必要になりテストが複雑化
  - SP 実装の変更が UI に波及するリスク

  また、このコンポーネント自体も 591 行と大きく、`HealthDiagnosisPage` コンポーネント本体が 422 行を占めています。`handleRecordToSharePoint` 関数内で SP 書き込みを直接行っています。
- **解決策の提案**:
  1. `src/features/diagnostics/infra/diagnosticsRepository.ts` を作成し、SP 操作を分離
  2. カスタムフック `useDiagnosticsPersistence.ts` を作成し、SP ロジックをフックに閉じ込める
  3. `HealthDiagnosisPage` からは repository/hook 経由でのみデータアクセス

  ```typescript
  // diagnosticsRepository.ts
  export class DiagnosticsRepository {
    constructor(private sp: ReturnType<typeof useSP>) {}
    async recordDiagnosis(title: string, report: HealthReport): Promise<void> {
      // SP 操作をここに集約
    }
  }
  ```
- **見積もり影響度**: High
