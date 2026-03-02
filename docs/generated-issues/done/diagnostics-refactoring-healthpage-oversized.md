# HealthDiagnosisPage.tsx の肥大化解消（591行）

- **対象ファイル**: `src/features/diagnostics/health/HealthDiagnosisPage.tsx`（591行）
- **カテゴリ**: リファクタリング
- **現状の課題**:
  `HealthDiagnosisPage.tsx` のコンポーネント `HealthDiagnosisPage()` が 422 行（L168-L590）を占めています。
  以下の責務が混在:
  1. 診断レポートの生成・表示
  2. `toAdminSummary()` — レポートのテキスト変換（96行の巨大関数、L24-L119）
  3. `copyToClipboard()` — クリップボード操作（L121-L145）
  4. SharePoint への記録保存（`handleRecordToSharePoint`、SP直接操作）
  5. 折りたたみ UI の状態管理
  6. ステータスチップ表示コンポーネント（`StatusChip`）

  `toAdminSummary` は 96 行の純粋関数であり、テスト可能だが現状ではコンポーネントファイル内に埋もれてテストされていません。
- **解決策の提案**:
  ```
  src/features/diagnostics/health/
  ├── HealthDiagnosisPage.tsx      # UI (≤250行)
  ├── toAdminSummary.ts            # レポート変換 (純粋関数、テスト可能)
  ├── toAdminSummary.spec.ts       # ユニットテスト
  ├── components/
  │   ├── StatusChip.tsx           # ステータス表示
  │   └── DiagnosticSection.tsx    # セクション表示
  └── hooks/
      └── useDiagnosticsActions.ts # コピー・SP記録アクション
  ```
- **見積もり影響度**: Medium
