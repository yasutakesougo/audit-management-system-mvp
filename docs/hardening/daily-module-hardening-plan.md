# Daily Module Hardening Plan

> **Target:** `src/features/daily` (177 files)
> **Goal:** 巨大化した Execution Layer の中核機能（日常支援記録）の責務分離と安全確保。
> **Strategy:** 画面分割ではなく、アーキテクチャレイヤー（Orchestration / Form State / Repository / Pure Domain）の境界を明確にする。

---

## 1. 現状の責務一覧 (Scope)

### 同居している機能群
- **Time Based Support (TBS)**: 時間単位の支援入力
- **Wizard**: ステップバイステップの記録入力
- **Table**: 表形式での一括入力
- **Split Stream**: 活動と支援記録の並行入力系
- **Time Flow**: タイムライン形式の入力系
- **Procedure**: 手順書ベースの記録

### 問題のある結合点 (Pain Points)
1. **Zustandストアへの過度な依存**: `executionStore`, `procedureStore` などが UI と密結合している。
2. **UIとデータフェッチの混在**: `hooks/` に単なるデータ取得フックと、Zustand操作や複雑な状態遷移を伴う Orchestrator フックが混在している。
3. **入力パラダイムの乱立**: TBS, Wizard, Table, Time Flow などの入力系が平積みされており、認知負荷が高い。
4. **暗黙の展開ロジック**: 計画（ISP）から当日の手順への展開（Bridge）が UI や Hook に漏れ出している。

---

## 2. アーキテクチャ再設計 (Architecture Layering)

### 分割後のレイヤー定義（ゴール）

| レイヤー | 役割 | 許容される依存 |
|:---|:---|:---|
| **UI (Components)** | 状態を持たない表示・入力コンポーネント | `domain/` (型), UIKit |
| **Orchestrator** | UIとDomainの橋渡し。状態遷移と保存の制御 | `domain/`, `repositoryFactory`, `stores/` |
| **Domain (Pure)** | ビジネスルール（バリデーション、差分計算、展開） | 他の Domain、外部依存ゼロ |
| **Adapter/Repo** | SharePoint や LocalStorage との I/O | `domain/` (型) |

### 先に固定すべき Pure Function (分離候補)
- **`planningToProcedureBridge.ts`**: 個別支援計画から当日の支援手順セットを生成する純粋関数。
- **Payload Builder**: フォームの State（Zustand等）から SharePoint 保存用の DTO へ変換するヘルパー。
- **Validation**: 必須項目チェック、時間の整合性（開始・終了時刻など）のドメインルール。

---

## 3. 影響範囲 (Blast Radius)

- **Routes**: `/daily/*`, `/dailysupport` (`dailyRoutes.tsx`)
- **Stores**: `executionStore.ts`, `procedureStore.ts`
- **Repositories**: `SupportRecord_Daily`, `ActivityDiary` （SharePoint）
- **連携先**: `today` (実行の司令塔), `handoff` (申し送りへの還元), `audit` (ログ出力)

---

## 4. 実行計画：PRの刻み方 (Execution Phases)

巨大モジュールを一度にリファクタリングすると事故が起きるため、以下の **4段階の PR** で漸進的かつ安全に処理します。

### PR 1: 構造の可視化とフォルダ整理 (Visibility)
- 実装を変えずに、既存のファイルを `components/tbs`, `components/wizard`, `components/table` など、パラダイムごとにサブディレクトリへ移動（平積みの解消）。
- 各モジュール内の依存関係（import）の向きを整理する。
- **DoD**: 機能は一切変わらず、ファイルの参照関係だけが整理されている。

### PR 2: Pure Domain の抽出とテスト追加 (Pure extraction)
- UIコンポーネントや Hook 内に散在している「データ変換」「バリデーション」「計算ロジック」を `domain/` の純関数（Pure Functions）として抽出する。
- 抽出した関数に対して高いカバレッジ（可能なら100%）の **Unit Test** を書く。
- **DoD**: ビジネスロジックがフレームワークから独立し、テストで保護されている。

### PR 3: Orchestrator / Hook の抽出 (Orchestrator extraction)
- コンポーネント内での `useEffect` や複雑なステート管理を、専用の Custom Hook（オーケストレーター層）に抽出する。
- データの `fetch` と `mutate`（Zustandへの同期、SPへの送信）のフローを一元化する。
- **DoD**: UI が「データのライフサイクル」を一切管理しなくなる。

### PR 4: UI の薄化とプレゼンテーショナル化 (UI thinning)
- UIコンポーネントが Props と Event ハンドラのみを受け取る「Dumb Component」になるようにリファクタリングする。
- Nightly Patrol などの既存 E2E テストが GREEN であることを最終確認。
- **DoD**: プレゼンテーション層とコンテナ層の完全な分離が達成される。
