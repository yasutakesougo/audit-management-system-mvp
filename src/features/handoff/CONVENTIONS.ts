/**
 * Handoff Feature Module — 設計規約
 *
 * Phase 3 (C-3): 構造規約を文書化
 *
 * このファイルは handoff feature module の構造・命名・責務分離の
 * 規約を定義する。新規コード追加時に必ず参照すること。
 *
 * ===== 更新日: 2026-03-15 =====
 */

// ────────────────────────────────────────────────────────────
// 1. ディレクトリ構造
// ────────────────────────────────────────────────────────────
//
// src/features/handoff/
// ├── domain/              # Pure functions (ビジネスルール、計算)
// │   ├── handoffActions.ts
// │   ├── filterHandoffsByStatus.ts
// │   ├── groupHandoffsByUser.ts
// │   └── HandoffRepository.ts
// ├── hooks/               # Custom hooks (state 管理、副作用)
// │   ├── useHandoffDayViewState.ts
// │   ├── useHandoffDateNav.ts
// │   ├── useNewHandoffForm.ts
// │   └── useAuditFailureObserver.ts
// ├── components/          # UI コンポーネント (描画専用)
// │   ├── HandoffItem.tsx
// │   ├── HandoffItemHeader.tsx
// │   ├── HandoffItemTags.tsx
// │   ├── HandoffWorkflowActions.tsx
// │   └── CompactNewHandoffInput.tsx
// ├── views/               # ページレベル View (オーケストレーター)
// │   └── HandoffDayView.tsx
// ├── actions/             # Logger / side-effect 関数
// │   └── handoffActions.logger.ts
// └── __tests__/           # テスト

// ────────────────────────────────────────────────────────────
// 2. コンポーネントサイズ上限
// ────────────────────────────────────────────────────────────
//
// | 種別            | 推奨上限 | 強制上限 | 超過時のアクション       |
// |-----------------|---------|---------|-------------------------|
// | components/     | 150行   | 300行   | サブコンポーネントに分割  |
// | views/          | 200行   | 350行   | Hook に state を分離     |
// | hooks/          | 150行   | 300行   | 責務で分割              |
// | domain/ (Pure)  | 100行   | 200行   | 関数を別ファイルに分離   |
//
// ※ 行数はコメント・空行を含む。import 行は除く。

// ────────────────────────────────────────────────────────────
// 3. Hook 分離基準
// ────────────────────────────────────────────────────────────
//
// コンポーネントから Hook に分離すべきケース:
//
// (a) useState が 3 つ以上ある
// (b) useEffect で副作用を管理している
// (c) useCallback / useMemo が複数あり、依存関係が複雑
// (d) テスト時にコンポーネントをマウントせずロジックを検証したい
//
// 命名規則:
//   use{Feature}{View}State  — View 固有の状態管理
//   use{Feature}{Entity}Form — フォーム状態管理
//   use{Feature}{Concern}    — 汎用フック

// ────────────────────────────────────────────────────────────
// 4. domain/ と hooks/ の責務境界
// ────────────────────────────────────────────────────────────
//
// domain/ に置くもの:
//   - Pure function（引数 → 戻り値のみ、副作用なし）
//   - 型定義（ビジネスモデル）
//   - 遷移ルール、フィルタ関数、集計関数
//   - テスト: describe + it のみでカバー可能
//
// hooks/ に置くもの:
//   - React hook（useState, useEffect, useRef, ...）
//   - API 呼び出しの抽象化
//   - URL パラメータの管理
//   - テスト: renderHook が必要

// ────────────────────────────────────────────────────────────
// 5. EntryMode パターン
// ────────────────────────────────────────────────────────────
//
// 画面への遷移経路を表すとき、boolean (fromXxx) ではなく
// 文字列リテラル型の EntryMode を使う:
//
//   type EntryMode = 'from-today' | 'direct';
//
// 理由:
//   - boolean は意味が曖昧（false = 何？）
//   - 将来の経路追加に拡張可能（'from-daily' 等）
//   - switch/case でハンドリングしやすい

// ────────────────────────────────────────────────────────────
// 6. メモ化ガイドライン
// ────────────────────────────────────────────────────────────
//
// React.memo を使うべきケース:
//   - リスト内の個別アイテム（HandoffItem, HandoffItemHeader, ...）
//   - props が shallow-equal で変わらないことが多いコンポーネント
//
// React.memo を使わないケース:
//   - View コンポーネント（毎レンダーで state が変わる）
//   - 子が 1〜2 個しかないラッパー

// ────────────────────────────────────────────────────────────
// 7. テスト規約
// ────────────────────────────────────────────────────────────
//
// | 対象         | テスト種別     | 配置                    |
// |-------------|---------------|-------------------------|
// | domain/     | Unit          | __tests__/*.spec.ts     |
// | hooks/      | renderHook    | __tests__/*.spec.ts     |
// | components/ | snapshot/DOM  | components/__tests__/   |
// | views/      | Integration   | 必要に応じて            |
//
// カバレッジ目標:
//   - domain/: 90%+
//   - hooks/: 80%+
//   - components/: 主要インタラクションのみ

export {};
