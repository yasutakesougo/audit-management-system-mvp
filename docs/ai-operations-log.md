# 📋 AI Operations Log — イソカツシステム

> **目的**: AI Skill Matrix ワークフローの使用記録を蓄積し、成功パターンを見える化する
> **運用**: 各ワークフロー使用時に1エントリ追加
> **価値**: AI運用ナレッジの蓄積 / 次の開発者への引き継ぎ / DX助成金の実績証拠

---

## エントリテンプレート

```markdown
### YYYY-MM-DD — [タスク名]

**ワークフロー**: `/command1` → `/command2` → ...
**対象**: `path/to/file.tsx` or 機能名

| 判断 | 内容 |
|------|------|
| ✅ 採用 | [AIの提案で採用したもの] |
| ❌ 却下 | [AIの提案で却下したもの] |
| 💡 却下理由 | [なぜ却下したか — これが最も重要] |

**成果**: PR#xxx / commit xxxx / 改善効果
**効果測定**: [テレメトリ数値 or Before/After の差分]
**学び**: [次回に活かすこと — ワークフロー順序、AI の得意不得意 等]
**所要時間**: [実作業時間]
```

---

## 記録ルール

1. **最低5項目** — ワークフロー、対象、採用、却下理由、学び は必須
2. **却下理由が最重要** — AIは何を間違えたか？が最も価値あるナレッジ
3. **1Issue = 1エントリ** — 同じIssueで複数コマンドを使っても1エントリにまとめる
4. **完走後すぐ記録** — 記憶が新鮮なうちに

---

## 集計用タグ（任意）

エントリに以下を付けると月次レビューが楽:

| タグ | 意味 |
|------|------|
| `#ux` | UX改善タスク |
| `#compliance` | 制度整合タスク |
| `#refactor` | リファクタリング |
| `#foundation` | 基盤構築（タグ、テレメトリ等） |
| `#bugfix` | バグ修正 |

---

## 月次レビューテンプレート

```markdown
## YYYY-MM 月次レビュー

### 数量
- 総エントリ数: X
- ワークフロー別: /ux-review: X, /architect: X, /implement: X ...

### 成功パターン
- [最も効果的だったワークフロー組み合わせ]

### 改善点
- [AI が繰り返し間違える領域]
- [ワークフロー順序の改善案]

### 次月の重点
- [翌月に集中するワークフロー or 領域]
```

---

## ログ

<!-- ↓ ここから下に追記していく -->

### 2026-04-21 — Auth Readiness Contract / Types Stabilization Green Recovery 🏁

**内容**: 認証準備状態（Auth Readiness）を前提とした契約の安定化を進め、認証モック・プロバイダー・ドメインテストフィクスチャに起因していた型不整合を解消。

| 判断 | 内容 |
|------|------|
| ✅ 採用 | `isAuthReady` を前提とする制御と周辺の型契約を揃え、Provider/Fixture 間のズレを吸収 |
| ✅ 採用 | `WhatIf` における boolean splatting 不具合の汎用的な修正 |
| ✅ 採用 | `Users_Master` への canonical optional fields の追加（将来のデータ不整合防止） |
| ✅ 採用 | health check probe failure の理由分類（原因特定スピード向上） |

**成果**:
- Branch: `fix/auth-readiness-contract`
- Commit: `b35082bc`
- `npm run typecheck:full` → **PASS** 🟢
- `npm run test:attendance:mini` → **PASS** 🟢 (24 tests)

**運用上の注意**:
- `iceberg_analysis` の必須インデックス不足（Critical）、`support_record_daily` の schema drift（Action Required）は継続監視が必要。

**Assessment**:
今回のセッションにより、開発継続に必要な baseline green を回復。PR作業や追加の実装を安全に再開できる状態になった。

#foundation #auth #stabilization #skill-matrix-20260421


### 2026-03-14 — TodayOps day-closing UX 強化 🏁

**ワークフロー**: `/ux-review` → `/architect` → `/implement`
**対象**: day-closing 場面（16:00〜）の NextActionCard / ProgressStatusBar / UserCompactList

**スコープ（7ファイル）**:
- `src/features/today/domain/buildSceneNextAction.ts`
- `src/features/today/domain/buildSceneNextAction.spec.ts`
- `src/features/today/widgets/ProgressStatusBar.tsx`
- `src/features/today/widgets/ProgressStatusBar.spec.tsx`
- `src/features/today/widgets/UserCompactList.tsx`
- `src/features/today/layouts/TodayBentoLayout.tsx`
- `src/pages/TodayOpsPage.tsx`

| 判断 | 内容 |
|------|------|
| ✅ 採用 | day-closing + 未記録 → priority: `critical`（赤border + 赤背景 + 「残りX名を記録する」） |
| ✅ 採用 | day-closing + 全完了 → 🎉 祝福メッセージ（「本日の業務を完了しました！」） |
| ✅ 採用 | ProgressStatusBar に scene prop 追加 → 終礼時 error 色 |
| ✅ 採用 | UserCompactList 上部に未記録サマリー行（「✏️ 未記録 X名 / 全 Y名」） |
| ❌ 却下 | 終礼専用の新規大型ウィジェットを作る案 |
| 💡 却下理由 | 初回実戦としてはスコープ過大。既存部品の強化で十分効果が出る。新コンポーネントは保守コストが増えるだけ |

**成果**:
- 型チェック通過（tsc --noEmit: 0 errors）
- 全テスト 267/267 パス
- 新規テスト 6 件追加（domain 4件 + widget 2件）
- 影響範囲は day-closing 場面のみに限定（後方互換維持）

**効果測定（今後テレメトリで確認）**:
- `today_dayclosing_state` — 終礼突入時の未記録人数
- `today_dayclosing_complete` — 全員記録完了のタイムスタンプ
- 未記録平均人数（Before: 計測なし → After: 取得可能に）
- 完了時刻中央値（Before: 計測なし → After: 取得可能に）
- CTA タップ率（「残りX名を記録する」ボタン）

**学び**:
- `/ux-review` → `/architect` → `/implement` の順が正しい。先にUXで課題と改善案を出してから設計に入ることで、設計の目的が明確になり迷いがない
- `scene` prop を optional にして後方互換を保つ設計は、既存テストを一切壊さないので安全。大規模コードベースでは必須のパターン
- buildSceneNextAction のような pure function は TDD と相性が良い。テスト→実装→テストのサイクルが速い
- day-closing と他の場面が相互排他であることをテストで証明しておくと安心感がある

**所要時間**: 約 15min（/ux-review 5min → /architect 5min → /implement 5min）

#ux #today #skill-matrix-first-run

### 2026-03-14 — ISP/モニタリング 制度整合チェック 🏁

**ワークフロー**: `/compliance` → `/architect` → `/docs`
**対象**: ISP 三層モデル / 支援計画シート / モニタリング証跡 / 同意・交付 UI

**スコープ（調査ファイル）**:
- `src/domain/isp/types.ts` — AuditTrail / ISP 型定義
- `src/domain/isp/schema.ts` — Zod スキーマ（ISP / 支援計画シート / 実施記録）
- `src/features/ibd/plans/support-plan/supportPlanDeadline.ts` — 期限計算
- `src/features/ibd/plans/support-plan/supportPlanAdapter.ts` — データ永続化
- `src/features/ibd/plans/support-plan/monitoringEvidenceAdapter.ts` — モニタリング証跡
- `src/features/support-plan-guide/hooks/useComplianceForm.ts` — 同意バリデーション
- `src/features/support-plan-guide/components/tabs/EditableComplianceSection.tsx` — 同意 UI
- `src/domain/safety/guidelineVersion.ts` — 比較対象（approvedBy 実装あり）
- `src/domain/safety/physicalRestraint.ts` — 比較対象（approvedBy 実装あり）
- `src/domain/support/individual-steps.ts` — 比較対象（approvedBy 実装あり）

| 判断 | 内容 |
|------|------|
| ✅ 健全 | 期限計算（30日 / 6か月）は制度要件に正確に準拠 |
| ✅ 健全 | 同意・交付の UI / バリデーションが充実（ComplianceTab） |
| ✅ 健全 | ISP 三層モデルの型安全性 / ステータス遷移制約が正しい |
| 🔴 Critical | ISP に `approvedBy` / `approvedAt` が未実装（安全ドメインには実装済み） |
| 🟡 Warning | `createdBy` の型が number と string で不統一 |
| 🟡 Warning | モニタリング Evidence に実施者・レビュー者の証跡がない |
| 💡 判断 | Critical は別 Issue に分割し、このレビューでは文書化にとどめる（Issue #2 のスコープ通り） |

**成果**:
- 制度整合レビュー文書: `docs/compliance/isp-compliance-review-2026-03.md`
- 改善 Issue テンプレート: `docs/compliance/isp-improvement-issues.md`
- 3観点 × 15チェック項目で評価完了
- 5つの発見事項（F-1〜F-5）を priority 付きでリストアップ
- 3フェーズの改善ロードマップを策定

**効果測定**:
- 監査指摘リスク: Before=高（承認証跡なし） → After=中（文書化済み・改善計画あり）
- 制度要件カバー率: 15項目中 10項目 ✅ / 3項目 ⚠️ / 2項目 ❌

**学び**:
- `/compliance` で全体を俯瞰してから個別ファイルを調査する順序が正しい。先にチェック項目を定義することで、調査の目的が明確になる
- 安全ドメイン（GuidelineVersion, PhysicalRestraint）に `approvedBy` が先行実装されていることで、ISP への横展開パターンが見える。実装時の設計参考になる
- ISP の型定義が `types.ts`（Interface） と `schema.ts`（Zod）で二重定義されているが、型が微妙に違う（number vs string）。この不一致を早期に発見できたのは良い

**所要時間**: 約 20min（調査 15min + 文書化 5min）

#compliance #isp #skill-matrix-issue2

### 2026-03-14 — F-1 ISP 承認フロー（基盤 + 承認UI + PrintView連動）🏁

**ワークフロー**: `/compliance` → `/architect` → `/implement` → `/test` → `/docs`
**対象**: ISP 承認フロー — ドメイン基盤 / 承認UI / 印刷連動

**スコープ（9ファイル）**:
- `src/domain/isp/types.ts` — AuditTrail に approvedBy / approvedAt 追加
- `src/domain/isp/schema.ts` — ispApprovalSchema / approveIsp() / canApproveIsp() 追加
- `src/domain/isp/__tests__/approval.spec.ts` — ドメインロジックテスト
- `src/features/support-plan-guide/hooks/useComplianceForm.ts` — approvalState / performApproval 追加
- `src/features/support-plan-guide/hooks/__tests__/useComplianceForm.spec.ts` — Hook テスト追加
- `src/features/support-plan-guide/components/tabs/ApprovalSection.tsx` — 承認UI新設
- `src/features/support-plan-guide/components/__tests__/ApprovalSection.spec.tsx` — UI テスト
- `src/features/support-plan-guide/components/tabs/ComplianceTab.tsx` — ApprovalSection 統合
- `src/pages/SupportPlanGuidePage.tsx` — approverUpn / approvalState 配線
- `src/features/support-plan-guide/utils/pdfExport.ts` — PrintApprovalInfo / 承認セクション出力
- `src/features/support-plan-guide/components/tabs/PreviewTab.tsx` — approvalState → PrintView 連動

| 判断 | 内容 |
|------|------|
| ✅ 採用 | ComplianceJson に approval を統合（SharePoint 列追加なし） |
| ✅ 採用 | 承認UI は既存 debounce → SharePoint sync フローに統合 |
| ✅ 採用 | 誤操作防止の確認ダイアログ + 「承認後取消不可」メッセージ |
| ✅ 採用 | PrintView は view model（PrintApprovalInfo）経由で連動 |
| ✅ 採用 | 承認セクションは署名欄の直前に配置（紙運用との接続が自然） |
| ❌ 却下 | 承認専用の別保存経路を追加する案 |
| 💡 却下理由 | 既存 debounce → SharePoint sync を壊し、並行保存の競合リスクが発生するため |
| ❌ 却下 | canApproveIsp() を現UIガードに直接適用 |
| 💡 却下理由 | status ライフサイクルがUIに未統合のため、現段階では isAdmin ガードが妥当。次フェーズで正式適用 |

**成果**:
- TypeScript 型チェック通過（tsc --noEmit: 0 errors）
- 全テスト 4911/4911 パス（リグレッションなし）
- ドメインテスト + Hook テスト + UI テストの三層カバー
- 監査説明可能性が大幅改善

**効果測定**:
- 監査説明可能性:
  - Before: 誰が・いつ承認したかを電子的に説明困難
  - After: approvedBy / approvedAt を電子的・印刷上の両方で提示可能
- 制度整合: ISP承認の記録要件を充足（サービス管理責任者の承認証跡）

**学び**:
- F-1 は基盤だけで止めず、UI → PrintView まで一気に閉じたのが正解。「閉じた機能」は即座に監査説明に使える
- `/compliance` で課題発見 → `/architect` で設計 → `/implement` で実装 の流は制度系タスクの黄金パターン
- `openPrintView` に optional 引数で拡張する設計は、既存呼び出し元を壊さないので安全
- View model（PrintApprovalInfo）を挟むことで、ドメイン型が印刷表示に漏れない。型変更の影響が限定される

**所要時間**: 約 30min（基盤 10min + UI 10min + PrintView 10min）

#compliance #isp #approval #print #skill-matrix-f1

### 2026-03-14 — TodayOpsPage 責務分離リファクタリング 🏁

**ワークフロー**: `/refactor` → `/review` → `/test`
**対象**: TodayOpsPage の Layout Props Mapping（213行 useMemo）を専用 hook に抽出

**スコープ（2ファイル）**:
- `src/pages/TodayOpsPage.tsx` — 401行 → 178行（56%削減）
- `src/features/today/hooks/useTodayLayoutProps.ts` — 新設 308行

| 判断 | 内容 |
|------|------|
| ✅ 採用 | 213行 useMemo を `useTodayLayoutProps` hook に全量移行 |
| ✅ 採用 | `TodayLayoutPropsInput` 型を定義し、入力契約を明示 |
| ✅ 採用 | 戻り値は `Omit<TodayBentoProps, 'todayTasks' | 'onPhaseNavigate'>` で Layout 型に準拠 |
| ✅ 採用 | CTA テレメトリ / navigation handler / user list ソートをすべて hook 内に集約 |
| ❌ 却下 | `useLandingTelemetry` の同時抽出 |
| 💡 却下理由 | 16行と小さく、今回の改善効果に対する分割コストが見合わない。最大責務（213行）だけを外す戦略に集中した |
| ❌ 却下 | Layout Props を複数の小さい hook に分割する案 |
| 💡 却下理由 | 過剰分割になり hook 間の依存が増える。1つの useMemo の中身なので、1 hook にまとめるのが自然 |

**成果**:
- TypeScript 型チェック通過（tsc --noEmit: 0 errors）
- 全テスト 4911/4911 パス（リグレッションなし）
- TodayOpsPage が「巨大ページ」から「構成を司るオーケストレーター」に復帰
- useTodayLayoutProps が「契約を持つ専任 hook」として確立

**効果測定**:
- ファイルサイズ: 401行 → 178行（-223行、56%削減）
- 責務明確度: Before=Page 内に 5つの責務が混在 → After=Page は hook 呼び出し + JSX に集中
- 保守性: Layout Props の変更が TodayOpsPage.tsx の diff に現れなくなる

**学び**:
- 「最大の責務だけを先に切り出す」戦略が正解。小さい責務まで一緒にやると、レビュー範囲が広がって効果検証が難しくなる
- 入力型（`TodayLayoutPropsInput`）と戻り値型を先に定義してから中身を移す順序がスムーズ。移行中に型エラーが即座にフィードバックされる
- useMemo の依存配列をそのまま hook の依存配列に移行できたので、動作に変化がない（pure refactoring を保証）
- Page が薄くなると、次に追加する widget や機能が「どこに足すか」を迷わなくなる

**所要時間**: 約 15min（設計 5min + 抽出 5min + 検証 5min）

#refactor #today #architecture #skill-matrix-issue3

### 2026-03-14 — 行動タグ基盤 Phase 1 🏁

**ワークフロー**: `/architect` → `/ux-review` → `/implement` → `/test`
**対象**: 日次記録の行動タグシステム — ドメイン定数 / Schema / UI / テーブル統合

**スコープ（11ファイル）**:
- `src/features/daily/domain/behaviorTag.ts` — 12タグ × 4カテゴリの SSOT 定義（新規）
- `src/features/daily/domain/__tests__/behaviorTag.spec.ts` — ドメインテスト 14件（新規）
- `src/features/daily/schema.ts` — DailyRecordUserRowSchema に behaviorTags 追加
- `src/features/daily/hooks/useTableDailyRecordForm.ts` — UserRowData 型・公開 API 拡張
- `src/features/daily/hooks/useTableDailyRecordRowHandlers.ts` — handleBehaviorTagToggle 追加
- `src/features/daily/components/BehaviorTagChips.tsx` — 折りたたみ式タグ選択 UI（新規）
- `src/features/daily/components/TableDailyRecordTable.tsx` — BehaviorTagChips 統合
- `src/features/daily/forms/TableDailyRecordForm.tsx` — props 配線
- `src/features/daily/infra/InMemoryDailyRecordRepository.ts` — デモデータ型互換
- `src/features/daily/__tests__/useTableDailyRecordViewModel.spec.ts` — テストデータ型互換
- `tests/unit/DailyTableSupportHint.spec.tsx` — テストデータ型互換

| 判断 | 内容 |
|------|------|
| ✅ 採用 | `string[]` ではなく `BehaviorTagKey[]` (z.enum) で型安全なタグ配列 |
| ✅ 採用 | `UserRowData` を SSOT として全 UI（Table / Drawer / 保存）で一貫 |
| ✅ 採用 | SharePoint 列追加なし — `UserRowsJSON` の中身だけを拡張 |
| ✅ 採用 | 問題行動チップ直下に折りたたみ式 UI（テーブル密度を維持） |
| ❌ 却下 | `problemBehavior` と `behaviorTags` を統合する案 |
| 💡 却下理由 | 問題行動は「有無の記録」、行動タグは「観察の補足」で性質が違う。統合すると監査上の問題行動判定と観察記録が混濁する。分離により、将来 AI 分析で「問題行動に先行する行動パターン」のクロス集計が可能になる |
| ❌ 却下 | QuickRecord 専用データとして持つ案 |
| 💡 却下理由 | UserRowData を SSOT にしたほうが Table / Drawer / 保存の流れが一本化される。QuickRecord 専用にすると二重管理になる |

**成果**:
- TypeScript 型チェック通過（tsc --noEmit: 0 errors）
- 全テスト 4925/4925 パス（リグレッションなし）
- 新規ドメインテスト 14件追加
- カテゴリ別色分け・選択数バッジ・a11y 対応の実用 UI

**効果測定（今後確認）**:
- よく使われるタグ / ほとんど使われないタグの傾向
- 1記録あたりの平均タグ数
- タグ付与率（タグが1つ以上ある記録の割合）

**学び**:
- `/architect` → `/ux-review` → `/implement` の順が基盤系に正しい。先にデータモデルを固めてから UI に入ることで、型安全性が壊れない
- `z.array(z.enum(...)).default([])` パターンは既存データとの後方互換に極めて有効。SharePoint 列追加なしで拡張できる
- `handleProblemBehaviorChange` と同じパターンで `handleBehaviorTagToggle` を追加すると、チーム理解が速い。既存パターンへの乗せ方がアーキテクチャ維持の鍵
- 折りたたみ式 UI はテーブル密度と入力オプション数のバランスが良い。12タグを常時表示すると行が膨らむが、折りたたみ + バッジで情報密度を維持できる
- SSOT（`behaviorTag.ts`）→ schema → 型 → UI の一方向流が確立できると、タグ追加が1行で全体反映される保守性の高い設計になる

**所要時間**: 約 20min（/architect 5min + /ux-review 3min + /implement 10min + 検証 2min）

#foundation #behavior-tags #daily #skill-matrix-issue4

### 2026-03-14 — Behavior Tag Insight 🏁

**ワークフロー**: `/architect` → `/implement` → `/test`
**対象**: 行動タグの使用状況可視化 — pure 集計関数 + Insight bar UI

**スコープ（4ファイル、うち新規3）**:
- `src/features/daily/domain/behaviorTagInsights.ts` — pure 集計関数 + 型定義（新規）
- `src/features/daily/domain/__tests__/behaviorTagInsights.spec.ts` — ドメインテスト 9件（新規）
- `src/features/daily/components/BehaviorTagInsightBar.tsx` — Insight bar UI（新規）
- `src/features/daily/forms/TableDailyRecordForm.tsx` — テーブル直前に統合（+5行）

| 判断 | 内容 |
|------|------|
| ✅ 採用 | 集計ロジックを UI ではなく domain の pure function に配置 |
| ✅ 採用 | `visibleRows` 基準で現在表示中の行のみ集計（フィルタ連動） |
| ✅ 採用 | タグ0件時は `null` を返して Insight bar を非表示（ノイズ防止） |
| ✅ 採用 | 未知タグへのフォールバック — key をそのまま label に使う |
| ❌ 却下 | Insight bar を常時表示する案 |
| 💡 却下理由 | タグ導入初期は全行タグ0件になる可能性が高い。空の Insight bar は「使われていない」印象を与え、現場のモチベーションを下げる |

**成果**:
- TypeScript 型チェック通過（tsc --noEmit: 0 errors）
- 全テスト 4934/4934 パス（リグレッションなし）
- 新規ドメインテスト 9件追加
- 契約テスト通過（`contract:allow-interface` 対応）
- 変更規模: 新規3ファイル + 修正5行 = 合計 ~170行

**効果測定（今後確認）**:
- Insight bar の表示頻度 = タグ付与率の間接指標
- Top タグの変遷（週次で見ると現場の観察傾向が分かる）
- 平均タグ数の推移（観察の密度が上がっているか）

**学び**:
- pure function + `useMemo` の組み合わせは Insight 系 UI の黄金パターン。テストが軽く、UI の再レンダリング制御も自然にできる
- 「表示しない」判断を設計段階で入れておくと、導入初期のUXが守られる。機能は入っているがノイズにならない、という状態が理想
- 契約テストが `export type` を検出して警告してくれたのは良い。`contract:allow-interface` アノテーションでドメインヘルパー型を明示的に許可する運用が確立された
- foundation → insight の流れで実装すると、前の Issue の設計判断（SSOT, BehaviorTagKey, getTagLabel）がそのまま活きる。積み上げの効果が大きい

**所要時間**: 約 10min（/architect 3min + /implement 5min + 検証 2min）

#insight #behavior-tags #daily #skill-matrix-issue5

### 2026-03-14 — QuickRecord 行動タグ入力導線 🏁

**ワークフロー**: `/architect` → `/implement` → `/test`
**対象**: QuickRecord の1名記録時にテーブル上部へ Quick Tag Area を追加し、タグ入力を3ステップ→1ステップに短縮

**スコープ（2ファイル、うち新規1）**:
- `src/features/daily/components/QuickTagArea.tsx` — Top5候補 + カテゴリ別全タグ展開（新規）
- `src/features/daily/forms/TableDailyRecordForm.tsx` — 条件付き表示（+10行修正）

| 判断 | 内容 |
|------|------|
| ✅ 採用 | `variant="content" && visibleRows.length === 1` に限定して表示 |
| 💡 採用理由 | 複数行表示時は既存テーブル内タグで十分。1名記録時だけが「タグに気付かない・到達しにくい」ボトルネック |
| ✅ 採用 | Top5 計算に `computeBehaviorTagInsights` を再利用 |
| 💡 採用理由 | Issue #5 の Insight ロジックと同一基盤に乗せることで「可視化」と「入力補助」の一貫性を確保。新規ロジック不要 |
| ✅ 採用 | `QuickTagArea` を dumb component（ステートレス）にする |
| 💡 採用理由 | `selectedTags` / `onToggleTag` を props で受けるだけなので、テスト・再利用・責務分離すべてに有利 |
| ❌ 却下 | QuickRecord 専用の新しい保存ロジックを作る案 |
| 💡 却下理由 | 既存 `handleBehaviorTagToggle → draft更新 → 保存時commit` の流れに乗せれば、回帰リスクゼロで済む。二重の保存経路は運用負荷 |
| ❌ 却下 | 既存 `BehaviorTagChips` を再利用する案 |
| 💡 却下理由 | BehaviorTagChips は折りたたみ式（テーブルセル内密度優先）。Quick Tag Area は展開済み＋Top5フィルタ（1タップ優先）で、レイアウトと初期状態が異なる |
| ❌ 却下 | テレメトリ埋め込み |
| 💡 却下理由 | Phase 2 送り。タグ入力率は Insight bar の tagUsageRate 上昇で間接測定可能 |

**成果**:
- TypeScript 型チェック通過（tsc --noEmit: 0 errors）
- 全テスト 4934/4934 パス（リグレッションなし）
- 変更規模: 新規1ファイル（~170行）+ 修正+10行 = 合計 ~180行

**到達点（Issue #4〜#6 の積み上げ）**:
```
Issue #4: 記録できる（タグ基盤）
Issue #5: 見える（Insight bar）
Issue #6: 入れやすい（Quick Tag Area） ← 今ここ
Issue #7: 分析できる（クロス集計） ← 次
```

**学び**:
- 「可視化」→「入力率向上」→「分析」の順で進めると、各 Issue が前の Issue の設計資産をそのまま使える。今回は Issue #5 の `computeBehaviorTagInsights` を Top5 決定に再利用できた
- dumb component パターン（props のみ、状態なし）はクロスコンテキスト再利用に強い。QuickTagArea は将来別の画面から呼ぶこともできる
- 新しい保存ロジックを作らない判断は、福祉システムで特に重要。保存経路が複数あると「どこから保存した記録が正」か分からなくなり、監査上のリスクになる
- 条件付き表示の条件を **受け側（TableDailyRecordForm）に寄せる** 設計にしたことで、QuickTagArea 自体は配置場所を問わない汎用コンポーネントになった

**所要時間**: 約 8min（/architect 3min + /implement 3min + 検証 2min）

#ux #behavior-tags #quickrecord #input-rate #skill-matrix-issue6

### 2026-03-14 — 行動タグ × 問題行動 × 時間帯 簡易クロス集計 🏁

**ワークフロー**: `/architect` → `/implement` → `/test`
**対象**: behaviorTags / problemBehavior / amActivity・pmActivity の3軸を掛け合わせた共起分析。Phase 1 は因果推定・予測なし

**スコープ（3ファイル新規 + 1ファイル修正）**:
- `src/features/daily/domain/behaviorTagCrossInsights.ts` — pure function: 3軸クロス集計（新規）
- `src/features/daily/domain/__tests__/behaviorTagCrossInsights.spec.ts` — 11テストケース（新規）
- `src/features/daily/components/BehaviorTagCrossInsightPanel.tsx` — 折りたたみ式UIパネル（新規）
- `src/features/daily/forms/TableDailyRecordForm.tsx` — パネル統合（+6行修正）

| 判断 | 内容 |
|------|------|
| ✅ 採用 | 分析単位 = 1行の UserRowData = 1件 |
| 💡 採用理由 | 新しい分析用スキーマを作らず SSOT に乗せる。Phase 1 として最も軽い |
| ✅ 採用 | problemBehavior を **有無の2値** に落とす |
| 💡 採用理由 | 5種類 × 12タグ = 60組み合わせは行数不足で統計的に無意味。有無だけで十分な傾向が出る |
| ✅ 採用 | amActivity/pmActivity の入力有無を **活動スロットプロキシ** にする |
| 💡 採用理由 | 新フィールド追加なし。既存運用語彙をそのまま流用。後方互換ゼロリスク |
| ✅ 採用 | AM/PM 両方に値がある行は **両方にカウント** |
| 💡 採用理由 | 厳密な時系列分析ではなく出現傾向を見るフェーズ。ユーザーからの指摘で契約を明示化 |
| ✅ 採用 | UI をデフォルト折りたたみ（閉じ）にする |
| 💡 採用理由 | Insight bar（常時）→ Quick Tag（1名時）→ Cross Insight（折りたたみ）と関心レベルに応じた段階設計 |
| ✅ 採用 | 3行未満は非表示 |
| 💡 採用理由 | 統計的に意味ある結果が出るまでノイズを抑制 |
| ❌ 却下 | 問題行動の種類別内訳（selfHarm × panic 等） |
| 💡 却下理由 | Phase 2 送り。現段階のデータ量では組み合わせ爆発で無意味 |
| ❌ 却下 | 因果推定・先行パターン断定 |
| 💡 却下理由 | Phase 1 は共起分析のみ。「X が起きたから Y になった」は推定不可 |

**3指標**:
- A. タグ別 問題行動併発率（rate 降順、50%以上は warning 色）
- B. AM/PM 別 Top3 タグ（活動スロットプロキシ）
- C. 問題行動あり/なし × 平均タグ数

**成果**:
- TypeScript 型チェック通過（tsc --noEmit: 0 errors）
- 全テスト 4945/4945 パス（+11 テスト、リグレッションなし）
- 変更規模: 新規3ファイル（~370行）+ 修正+6行 = 合計 ~376行

**到達点（Issue #4〜#7 の積み上げ）**:
```
Issue #4: 記録できる（タグ基盤）
Issue #5: 見える（Insight bar）
Issue #6: 入れやすい（Quick Tag Area）
Issue #7: 分析できる（クロス集計） ← 今ここ
Issue #8: 気づける（ルールベース提案） ← 次
```

**学び**:
- 「共起分析」と明言してスコープを切ると、因果推定への暴走を防げる。analysis ≠ prediction の線引きが福祉領域では特に重要
- プロキシ設計（amActivity/pmActivity → 時間帯）は「契約を明示する」ことが必須。AM/PM 両方カウントのルールをテストケースで固定した
- pure function + useMemo + 折りたたみ Panel のパターンが Issue #5 から3連続で再利用されている。このパターンは「Insight系UI」の共通手法として確立された
- 3行未満非表示は「表示しない」判断を設計段階で入れるパターンの延長。Issue #5 の「タグなしなら非表示」と同じ考え方

**所要時間**: 約 12min（/architect 5min + /implement 5min + 検証 2min）

#analysis #cross-tabulation #behavior-tags #daily #skill-matrix-issue7

### 2026-03-14 — ルールベース行動パターン提案パネル 🏁

**ワークフロー**: `/architect` → `/implement` → `/test`
**対象**: Issue #7 のクロス集計結果を入力にした、ルールベース示唆エンジン + 表示パネル

**スコープ（3ファイル新規 + 1ファイル修正）**:
- `src/features/daily/domain/behaviorPatternSuggestions.ts` — pure function: 4ルールのルールエンジン（新規）
- `src/features/daily/domain/__tests__/behaviorPatternSuggestions.spec.ts` — 11テストケース（新規）
- `src/features/daily/components/BehaviorPatternSuggestionPanel.tsx` — Alert ベース提案UI（新規）
- `src/features/daily/forms/TableDailyRecordForm.tsx` — パネル統合 + SuggestionPanelMemo（+18行修正）

| 判断 | 内容 |
|------|------|
| ✅ 採用 | 「断定しない」語法を設計段階で明示定義 |
| 💡 採用理由 | 福祉記録では提案エンジンが強く言いすぎるとリスク。「傾向」「可能性」「確認してみてください」に留める |
| ✅ 採用 | 高併発率ルールの文言強度を件数で分岐（total 2-3 vs 4+） |
| 💡 採用理由 | total=2 で 1件ぶれると印象が強く出すぎる。件数少ない場合は「件数はまだ少ないですが」と前置き |
| ✅ 採用 | positive-signal を「保護因子」「支援上の手がかり」ニュアンスに |
| 💡 採用理由 | 「褒める」ではなく「機能している可能性がある」= 支援現場で受け入れやすい |
| ✅ 採用 | `evidence` フィールドを PatternSuggestion 型に追加 |
| 💡 採用理由 | 「なぜこの提案が出たか」が見えると現場の信頼性が上がる |
| ✅ 採用 | Suggestion パネルをデフォルト展開（閉じない） |
| 💡 採用理由 | Insight は「見たい人が開く」、Suggestion は「読ませたい」— 役割分離 |
| ✅ 採用 | 最大3件の表示上限 |
| 💡 採用理由 | 提案が多すぎると現場で無視される |
| ❌ 却下 | AI / LLM による示唆生成 |
| 💡 却下理由 | Phase C 送り。ルールベースで十分な価値が出る段階 |
| ❌ 却下 | 行動指示（「〜すべき」「〜を止める」） |
| 💡 却下理由 | 福祉記録での断定・指示はリスク |

**4ルール**:
1. `highCoOccurrence` — タグ別問題行動併発率 ≥ 50%（total ≥ 2）
2. `slotBias` — AM/PM の Top1 タグが異なる（各2行以上）
3. `tagDensityGap` — 問題行動あり/なし × 平均タグ数の差 ≥ 1.0
4. `positiveSignal` — positive カテゴリのタグが存在、併発率 < 30%

**severity 体系**:
- `info` 🔵 — 情報（slotBias）
- `notice` 🟡 — 注目（highCoOccurrence, tagDensityGap）
- `highlight` 🟢 — 良いニュース（positiveSignal）

**成果**:
- TypeScript 型チェック通過（tsc --noEmit: 0 errors）
- 全テスト 4956/4956 パス（+11 テスト、リグレッションなし）
- 変更規模: 新規3ファイル（~470行）+ 修正+18行 = 合計 ~488行

**所要時間**: 約 8min（/architect 3min + /implement 4min + 検証 1min）

#suggestion #rule-engine #behavior-tags #daily #skill-matrix-issue8

---

### 行動タグシリーズ 総括（Issue #4〜#8）

**期間**: 2026-03-14（1セッション内で完結）
**合計変更規模**: 新規15ファイル + 修正5ファイル

```
Issue #4  記録できる   → タグ基盤（SSOT + schema + UI）
Issue #5  見える       → Insight bar（使用頻度の可視化）
Issue #6  入れやすい   → Quick Tag Area（QuickRecord入力導線）
Issue #7  分析できる   → クロス集計（3軸共起分析）
Issue #8  気づける     → ルールベース提案（4ルール + evidence）
```

**アーキテクチャパターンの確立**:
- `pure function` → `useMemo` → `折りたたみ/展開 Panel` → `Form 統合` のパイプライン
- Issue #5 で確立し、#7, #8 で3回連続再利用。Insight系UIの標準手法として定着

**設計原則の確立**:
- SSOT（behaviorTag.ts を起点に全レイヤーに流す）
- 共起分析 ≠ 因果推定（Phase 1 の明確な線引き）
- 断定しない語法（福祉領域の提案システムにおける安全設計）
- データ不足時の非表示（3行未満、タグなし、Suggestion 0件）

**次フェーズへの接続点**:
- Phase 2A: 提案精度向上（閾値調整、時間帯粒度改善）
- Phase 2B: 提案を運用につなぐ（メモ転記、支援計画連携）← **推奨**
- Phase C: AI / LLM 統合（ルールベースから学習ベースへ）

#behavior-tags #series-complete #milestone

### 2026-04-30 — Local runtime switched to production SharePoint
2026-04-30: Local runtime switched from demo/mock mode to production SharePoint mode.
Verified via UI `SP Connected`, console `Active backend: sharepoint`, MSAL login, and live SharePoint list data rendering.

### 2026-04-30 — /today 実データ検証 PASS 🏁
- **UI:** `SP Connected` バッジ点灯を確認
- **データ:** 固定モックではなく実運用データ（日本人名など）が正常にロードされ描画されることを確認
- **コンソール:** `Active backend: sharepoint` 確認。demo/mock のフォールバックなし。
- **安定性:** 画面クラッシュ、無限レンダーループ、認証ループは発生せず、安定して稼働。
※ 一部 `DriftEventsLog_v2` への 400 エラーは観測されたが、/today ダッシュボード自体の機能（スケジュール・利用者・例外表示）には影響なし。

### 2026-04-30 — 通所管理 実データ検証 PASS 🏁
- **UI:** 画面右上に `SP Connected` 相当の状態を維持してレンダリング完了。
- **データ:** 利用者数30名、ならびに「秋山 竜二（I001）」などの実運用データ一覧が正確に描画されていることを確認。
- **操作性:** 「再読込」などの読み取り操作において崩れや無限ロードはなし。
- **安定性:** 画面クラッシュなし、認証ループなし、SharePoint 400/429/500 等の深刻なAPIエラーなし。
- **制約準拠:** 書き込み操作は行わず、実データからの読み取り検証のみで安全に完了。

### 2026-04-30 — Health 実データ検証 PASS 🏁
- **UI:** 画面右上に `SP Connected` バッジ点灯を確認。
- **データ:** 利用者選択プルダウンに「阿部 如斗（I003）」等の実在の日本人名リストがロードされ、バイタル（体温、脈拍、血圧等）の各フィールドが正常に表示されていることを確認。
- **コンソール:** `Active backend: sharepoint` 確認。demo/mock のフォールバックなし。
- **安定性:** 画面クラッシュ、無限レンダーループ、認証ループは発生せず、深刻な SharePoint API エラー（400/429/500等）もなし。
- **制約準拠:** 書き込み操作は行わず、実データの読み取り表示検証のみで安全に完了。

### 2026-04-30 — Nightly telemetry 実データ検証 PASS / Watch 🏁
- **実行:** `nightly-patrol.mjs` および `nightly-apply.mjs` を `--apply` なし（DRY-RUN）で実行し、正常終了を確認。
- **品質ガード作動:** `any-regression` (Critical) に対して、`GUARD FAILED: Critical/High issue lacks score/status or rationale in body` のガードが発動し、スコア・根拠の伴わない低品質な自動起票が完全にブロック（Skipping issue creation）されることを確認。
- **Telemetry Watch:** `DriftEventsLog_v2` リストに対する 400 エラーは、主要画面（`/today`, 通所管理, Health）の機能レンダリングや操作に波及せず、画面UIへの影響ゼロ（完全分離）であることを確認。
- **成果物:** `docs/nightly-patrol/*` の生成と結果の隔離保存を検証済み。実環境の GitHub Repository への意図しない起票は発生せず安全。

### 2026-04-30 — MonthlyRecord_Summary Phase 3 Legacy Isolation complete
PR #1730 was configured for auto-merge. MonthlyRecord_Summary is now in a 7-day stability monitoring window before any physical legacy field deletion. Legacy fields `TotalDays`, `Total_x0020_Days`, and `Key` remain visible/tolerated until Phase 4 criteria are met.
