## Handoff: SharePoint Health Governance (Operational OS) — 2026-04-06

### 1. 完了したこと (Done)
- [x] **Real-time Detection**: `SignalStore` への 429/500/Bootstrap エラーの即時反映ロジック実装
- [x] **Nightly Patrol**: `NightlyRuntimePatrol` による日次ヘルスチェックと `DriftEventsLog` 連携の自動化
- [x] **Health Badge (UI)**: 全画面共通ヘッダーへの「独立動作型ホバーバッジ」の実装
- [x] **Diagnostic Popover**: バッジクリック時の詳細（Index圧力, RowSize, Throttling, Drift）と `occurrenceCount` の表示
- [x] **Admin Status Page**: `/admin/status` での過去ログ閲覧、フィルタリング、重要イベントのハイライト表示
- [x] **Operational Runbook**: 実務者が「迷わず復旧」するための手順書 (`docs/ops/runbook-sharepoint-health.md`) 作定

### 2. 現在の状態 (Current State)
- **ブランチ**: `main` (または最新の統合済みブランチ)
- **実測環境**: SharePoint サイト `welfare` に全管理用リスト（`SignalStore`, `DriftEventsLog`, `Iceberg_Analysis` 等）が配備済み
- **ビルド**: ✅ (Local & Vercel Preview)
- **テスト**: ✅ (Drift想定テスト、Signal反映テスト通過)

### 3. 次フェーズの課題 (Future Roadmap)
| # | 課題 | 優先度 | 見積もり | 備考 |
|---|------|:------:|:-------:|------|
| 1 | **セミオート修復** | 中 | 2d | Index候補・不要列削除をPopoverからワンクリック提示 |
| 2 | **KPI可視化** | 中 | 1d | 制約発生頻度、平均復旧時間のダッシュボード化 |
| 3 | **予測アラート** | 低 | 1d | 「あと何件でLimit到達」の簡易的な事前検知 |

### 4. 次の1手 (Next Action)
> **「運用ルールの徹底」と「Runbookの現場適用」のモニタリング（最初の1週間）**

### 5. コンテキスト（設計判断・注意点）
- **設計思想**: 単なる「エラー表示」ではなく、**システムの“使われ方”を統治する OS** として構築。
- **SignalStore の役割**: 発生したインシデントを「指紋 (Fingerprint)」で集約し、ノイズを極限まで排除。
- **Runbook の重要性**: 開発者以外（運用担当者）が現場で迷わず「actionUrl」へ飛べる導線を重視。
- **注意点**: `occurrenceCount` はデフォルト 3回でアラート。現場の負荷に応じて 2〜4回に微調整を検討。

### 6. 参照ドキュメント
| 種別 | パス | 目的 |
|------|---|---|
| Runbook | `docs/ops/runbook-sharepoint-health.md` | インシデント発生時の対処法 |
| Script | `scripts/ops/nightly-runtime-patrol.ts` | 毎晩の自動巡回ロジック |
| Schema | `src/lib/sharepoint/config/spListRegistry.ts` | インフラ定義の真実 |
