# Transform Map（コア変換ロジック一覧）

このドキュメントは、このシステムにおける「真のプロダクト価値（= データ変換のコアロジック）」となる純関数を体系的に可視化した地図です。
UI（表示）はこれらのロジックが吐き出した結果を投影するだけの存在であり、バグ修正や仕様変更を行う際は、まずこのマップ上の該当ロジックと対応するテスト（防波堤）を探して機能保証・修正を行ってください。

---

## 📅 operation-hub（日々の運用・競合判定）
- **`toTimelineEvents`**
  - **役割**: 利用者の1日の予定を表示用タイムラインデータに変換する
  - **使用箇所**: `useOperationHubLogic.ts`
  - **危険度**: 🚨 高（UIの表示崩れに直結。変更時はテスト更新必須）
  - **改善候補**: 複数日跨ぎのイベント対応ロジックの整理
  - **対応テスト**: `src/features/operation-hub/logic/__tests__/useOperationHubLogic.spec.ts`
- **`markConflicts`**
  - **役割**: 同じ時間に複数の予定が被っていないかの重複検知
  - **使用箇所**: `useOperationHubLogic.ts`
  - **危険度**: 🚨 高（業務上の致命的ドロップを引き起こす）
  - **改善候補**: 競合許容ルール（移動と食事が被る等）の設定外部化
  - **対応テスト**: `src/features/operation-hub/logic/__tests__/useOperationHubLogic.spec.ts`

---

## 🚨 exceptions（例外・警告管理）
- **`buildExceptionDisplayRows`**
  - **役割**: UI表示用の行データ構造に整形（例外画面の核心）
  - **使用箇所**: `tableLogic.ts` / `ExceptionTable.tsx`
  - **危険度**: ⚠️ 中（フォーマット変更は全体に影響）
  - **改善候補**: groupingロジックの更なる純関数化・分割
  - **対応テスト**: `src/features/exceptions/components/__tests__/tableLogic.spec.ts`
- **`sortExceptionDisplayRows`**
  - **役割**: 緊急度（Severity）や発生日などに基いた多段ソート
  - **使用箇所**: `tableLogic.ts`
  - **危険度**: 🚨 高（並び順が変わると現場の対応優先度が狂う）
  - **改善候補**: ユーザー定義のソート順追加への拡張性確保
  - **対応テスト**: `src/features/exceptions/components/__tests__/tableLogic.spec.ts`

---

## ✅ compliance-checklist（監査ルール対応）
- **`mapToChecklistItem`**
  - **役割**: 外部データのDTOから内部モデルへの安全な変換層
  - **使用箇所**: `api.ts`
  - **危険度**: ⚠️ 中（型不一致でのクラッシュ要因）
  - **改善候補**: スキーマバリデーション（Zod等）の導入
  - **対応テスト**: `src/features/compliance-checklist/domain/__tests__/checklistLogic.spec.ts`
- **`filterChecklistItems`**
  - **役割**: URLパラメータ等の RuleID に基づくフィルタ処理
  - **使用箇所**: `ChecklistPage.tsx`
  - **危険度**: 🟢 低（純関数として完全に隔離・保護済み）
  - **改善候補**: 複数条件（Severity等）での複合フィルタへの対応
  - **対応テスト**: `src/features/compliance-checklist/domain/__tests__/checklistLogic.spec.ts`
- **`isValidChecklistInsert`**
  - **役割**: チェック項目追加時の入力バリデーション
  - **使用箇所**: `ChecklistPage.tsx`
  - **危険度**: 🟢 低
  - **改善候補**: エラーメッセージの具体的な理由（「名前が空白です」等）の返却
  - **対応テスト**: `src/features/compliance-checklist/domain/__tests__/checklistLogic.spec.ts`

---

## 📈 monitoring（実績・予実モニタリング）
- **`monitoringDailyAnalytics`**（関連関数群）
  - **役割**: その日のKPI計算やトレンド生成
  - **使用箇所**: `domain/analytics.ts`
  - **危険度**: 🚨 高（経営・事業所評価の指標となるため計算ミスは致命的）
  - **改善候補**: キャッシュ戦略の明確化と計算速度の最適化
  - **対応テスト**: `src/features/monitoring/domain/__tests__/analytics.spec.ts`

---

## 🧑‍🤝‍🧑 users（利用者詳細・状態管理）
- **`userDetailHubLogic`**
  - **役割**: Quick Actions や Recommendation（提案）の生成
  - **使用箇所**: `UserDetailPage.tsx`
  - **危険度**: ⚠️ 中
  - **改善候補**: レコメンドルールの更なる抽出とテストカバレッジ向上
  - **対応テスト**: `src/features/users/domain/__tests__/userDetailHubLogic.spec.ts`
