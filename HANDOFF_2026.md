## Handoff: Schedules Domain Hardening — 2026-03-30
 
### 1. 完了したこと
- [x] **Resilient Ingestion Pipeline への進化**: `spRowSchema.ts` において、単一列依存から複数候補解決 (`pickFirstValue`) への移行を完了。
- [x] **Fault Isolation (Per-row parsing)**: `parseSpScheduleRows` を `safeParse` ループに変更し、破損行が1件あっても全件失敗しないように改善。
- [x] **Localization 対応**: 日本語カテゴリ・ステータス（利用者, 予定どおり, 延期等）の正規化マッピングを追加。
- [x] **Observability 統合**: `spTelemetry.ts` に `sp:row_skipped` と `sp:fetch_fallback_success` イベントを追加し、ドメイン層から発火。
- [x] **回帰テスト拡充**: [`spRowSchema.spec.ts`](file:///Users/yasutakesougo/audit-management-system-mvp/src/features/schedules/data/spRowSchema.spec.ts) を新規作成し、日本語値・旧Outlook形式・混在ID・破損行スキップのテストを完了。
 
### 2. 現在の状態
- ブランチ: `main` (Working directly in workspace)
- 最新変更: Schedules ドメインの取り込み層の硬化完了
- ビルド: ✅ (Verified via runtime)
- テスト: ✅ (New regression tests pass)
 
### 3. 残課題
| # | 課題 | 優先度 | 見積もり | 備考 |
|---|------|:------:|---------|------|
| 1 | `DevPanel` への Telemetry 可視化 | 中 | 20m | `useDataProviderObservabilityStore` に skipped 数を保持 |
| 2 | `Users_Master` 削減/正規化の着手 | 高 | 60m | 分割移行ツールの本番適用と repo 差し替え |
| 3 | Ingestion Pipeline への他ドメイン横展 | 中 | 45m | Monitoring や Attendance への共通化適用 |
 
### 4. 次の1手
`useDataProviderObservabilityStore` にイベントカウンターを追加し、`DevPanel` の Health タブで「何件の破損データが吸収されたか」を可視化する。
 
### 5. コンテキスト（次のAIが知るべきこと）
- **設計判断**: Schedules では `strict schema` を捨て、`tolerant ingestion` を採用。`z.unknown()` で広く受け、mapper (`pickFirstValue`) で意味決定を行っている。これは SharePoint のテナント差分（列名の揺れ）をコード側で吸収するための戦略的判断。
- **注意点**: 書き込み (Write) 側はまだこの "Loose" な仕組みに完全に対応していないため、更新時は `SCHEDULES_FIELDS` のプライマリ列が使われる。
- **参照ファイル**:
  - [`spRowSchema.ts`](file:///Users/yasutakesougo/audit-management-system-mvp/src/features/schedules/data/spRowSchema.ts) (Ingestion 核)
  - [`scheduleSpHelpers.ts`](file:///Users/yasutakesougo/audit-management-system-mvp/src/features/schedules/data/scheduleSpHelpers.ts) (Fetch fallback 制御)
  - [`spTelemetry.ts`](file:///Users/yasutakesougo/audit-management-system-mvp/src/lib/telemetry/spTelemetry.ts) (イベント定義)
 
### 6. 関連Issue/PR
| 種別 | # | 状態 |
|------|---|:----:|
| Task | - | 完了 (Schedules Hardening) |
