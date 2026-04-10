## Handoff: Monitoring Audit Integration — 2026-04-10

### 1. 完了したこと
- [x] モニタリング会議記録の証跡完全化（draft/finalized 状態管理とロック機構）
- [x] 監査エンジン `auditChecks.ts` へのモニタリング不備検知ルール追加
- [x] `useRegulatoryFindingsRealData` による全利用者モニタリング情報の抽出
- [x] `auditCheckInputBuilder.ts` によるドメイン→監査入力のマッピング
- [x] 制度遵守ダッシュボードへのモニタリング結果表示と是正ナビゲーションの実装
- [x] ダッシュボードのクラッシュ防止（防御的な null チェック追加）
- [x] 現場職員向け・管理者向けドキュメントの作成

### 2. 現在の状態
- ブランチ: `main` (検証済み)
- ビルド: ✅
- テスト: ✅ (ブラウザ実機検証にて、I001〜I002 の検知を確認)

### 3. 残課題
| # | 課題 | 優先度 | 見積もり | 備考 |
|---|------|:------:|---------|------|
| 1 | `any` 型キャストの除去 | 低 | 1h | `DataProviderMonitoringMeetingRepository.ts` 内部 |
| 2 | デモデータの自動生成拡張 | 低 | 0.5h | `demoData.ts` へのモニタリング追加 |
| 3 | 利用者一括 PDF エクスポート | 中 | 2h | 監査時に一括で印刷したいニーズ |

### 4. 次の1手
利用者一括エクスポート機能の実装（ダッシュボードから特定の判定区分を選択して一括 PDF 化）を検討する。

### 5. コンテキスト（次のAIが知るべきこと）
- **設計判断**: モニタリングは「個別支援計画(ISP)」に準ずる重要証跡であり、確定（Finalized）をもって法的効力を持たせています。
- **注意点**: `useRegulatoryFindingsRealData` は重い処理になりやすいため、Phase 1 (User/Staff) → Phase 2 (Sheet) → Phase 3 (Monitoring) と段階的にフェッチするようにしています。
- **構成要素**:
    - `auditChecks.ts`: 判定ロジックの心臓部
    - `auditCheckInputBuilder.ts`: データの橋渡し役
    - `RegulatoryDashboardPage.tsx`: 集計と表示の起点

### 6. 関連ページ
| ページ | URL | 役割 |
|------|---|:----:|
| 監査ダッシュボード | `/admin/regulatory-dashboard` | 全体監視 |
| 会議記録入力 | `/monitoring-meeting/:userId` | 現場入力・是正 |
| 開通確認 | `/admin/status` | データストア健全性 |
