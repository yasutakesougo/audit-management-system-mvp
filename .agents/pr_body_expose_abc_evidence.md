# Description

本PRは、**Dedicated ABC 記録（`AbcBehaviorRecords`）**を、L2 支援計画シートの **「§9 評価欄（モニタリング欄）」** において、職員が評価を決定するための客観的な根拠候補として画面上に表示する機能（PR 1）を実装するものです。

北極星（プロダクト原則）に従い、この機能は職員が確認した上で引用・修正されるためのものであり、直接的・自動的に個別支援計画（L1）に反映されるものではありません。

---

## 🎯 今回のスコープ (PR 1)
- [x] 評価期間（モニタリング開始日起点〜サイクル日数分）内の `AbcBehaviorRecords` を取得するカスタムフック `useMonitoringAbcEvidence` の実装。
- [x] 表示用コンポーネント `AbcEvidenceListPanel` の実装（MUI Card ベースの美しく客観的なエビデンスリスト）。
- [x] 支援計画新規作成/編集画面への表示統合。
- [x] 期間内の `IsDeleted=true` である記録の完全除外。
- [x] `slotId` が未定義の記録も、その他の記録として綺麗にフォールバックして表示し、データの漏れを防止。
- [x] 由来コンテキスト (`sourceContext`) の厳格な識別と、`DailyActivityRecords` と混同させないラベル表現の実装。
- [x] `Support Date Governance` と `MonitoringCycleDays` の尊重、および `appliedFrom provisional fallback` に基づく「暫定期間」表示の実装。

⚠️ **本PRのスコープ外（PR 2 / PR 3 で実施予定）**:
- 評価欄への自動転記、ドラフト（下書き）テキスト生成。
- `PlanningJson.monitoringEvidenceLinks[]` への引用元リンクの保存。
- `DailyActivityRecords` への同期・参照・結合。
- 個別支援計画（L1）への直接的な書き込み。

---

## 🛣️ 今後のロードマップ
- **PR 1 (本PR)**: Dedicated ABC 記録を、L2 支援計画シート §9 評価欄の客観的根拠候補として画面上に「表示」する。
- **PR 2**: `AbcRecordEvidenceBridge.ts` の pure function を構築し、`improvementResult` / `nextSupport` / `evaluationMethod` 用の評価ドラフトを自動生成する。
- **PR 3**: 「評価欄へ引用」ボタンと、`PlanningJson.monitoringEvidenceLinks[]` への `evidenceLink` 保存を実装する。

---

## 🛡️ ガードレール & コンプライアンス遵守チェック
- **読み取り専用**: 評価欄（`evaluationIndicator`, `evaluationMethod`, `improvementResult`, `nextSupport`）への書き込みや自動マージは一切おこないません。
- **データ分離の維持**: `DailyActivityRecords` への同期・参照・結合は一切おこなっていません。
- **スキーマ変更なし**: SharePoint リストへの列追加やプロビジョニング設定の変更はありません。
- **確実な監査性**: 削除済みレコードを確実に除外し、`appliedFrom fallback` を利用している場合は暫定期間（監査上の確認が必要）であることをUI上で明示します。
- **表記の厳格性**: `DailyActivityRecords` ととの混同を完全に避けるため、「日次支援由来」といった不適切な文言を排除し、**「支援手順起点」「キオスク・支援手順起点」「専用ABC画面起点」「由来不明/旧データ」** に統一しました。

---

## 🧪 テスト・検証状況
### 1. ユニットテスト
新設したカスタムフックおよびUIコンポーネントに対する網羅的な単体テストを記述し、完全に合格しています。

- **カスタムフックテスト**: `useMonitoringAbcEvidence.spec.tsx`（日付境界条件、fallback 優先度、userId による早期リターン、サイクル日数（デフォルト90日）の計算を検証）
- **コンポーネントテスト**: `AbcEvidenceListPanel.spec.tsx`（空のメッセージ、暫定期間バッジ、由来ラベルの厳密なテキストマッピング、強度別カラースキーマのレンダリングを検証）

```bash
Test Files  39 passed (39)
     Tests  533 passed (533)
  Duration  6.18s
```
- `src/features/monitoring` 配下の全テスト、SharePoint リポジトリのテスト、`src/features/planning-sheet` 配下の全テストが完全に合格しています。

### 2. 静的解析
- `npm run typecheck`: コンパイルエラーなし。
- `npm run lint`: 変更ファイル（`AbcEvidenceListPanel.tsx`, `useMonitoringAbcEvidence.ts`, `FormSections.tsx`, `NewPlanningSheetForm.tsx`）における ESLint エラー・警告は完全に 0 です。
