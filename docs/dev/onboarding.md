# Developer Onboarding Guide

> **Support Operations OS — 開発者オンボーディング**  
> **最終更新:** 2026-03-16

---

## 目次

- [1. プロジェクトの目的](#1-プロジェクトの目的)
- [2. アーキテクチャ概要](#2-アーキテクチャ概要)
- [3. ドキュメント体系](#3-ドキュメント体系)
- [4. 開発環境セットアップ](#4-開発環境セットアップ)
- [5. コード構造ガイド](#5-コード構造ガイド)
- [6. 開発ルール](#6-開発ルール)
- [7. 新機能追加の手順](#7-新機能追加の手順)
- [8. PR ルール](#8-pr-ルール)
- [9. よくある質問](#9-よくある質問)

---

## 1. プロジェクトの目的

### 一言でいうと

> **障害福祉サービスの支援業務を PDCA サイクルとしてコード化した判断補助 OS**

### このシステムは

- ❌ 単なる記録アプリではない
- ❌ AI が自動で判断するシステムではない
- ✅ **人がより良く支援判断を行うための基盤**

### 評価基準

| # | 基準 |
|---|------|
| 1 | 現場で自然に使われるか |
| 2 | 判断の質を上げるか |
| 3 | 組織の知識として残るか |

> 📖 詳細: [設計原則 10 箇条](../product/principles.md)

---

## 2. アーキテクチャ概要

### 7 層パイプライン

```
① Observation   ← 現場の記録を集める（Daily / ABC / Handoff）
     ↓
② Normalization ← データを整理・構造化する
     ↓
③ Insight       ← パターン・傾向を発見する
     ↓
④ Proposal      ← 見直し候補を生成する
     ↓
⑤ Operational UI ← 現場が毎日使う画面（表はシンプル）
     ↓
⑥ Execution     ← 人が判断し、反映する
     ↓
⑦ Knowledge     ← 判断を組織知として蓄積する
```

### ISP 三層モデル

```
L1: ISP（Why — 生活全体の方向性）
 → Bridge 1 →
L2: 支援計画シート（How — 行動設計）
 → Bridge 2 →
L3: 手順書兼記録（Do + Record — 手順化・実施記録）
 → Bridge 3（Monitor → L2）→ 次サイクルへ
```

### Human-in-the-Loop（最重要原則）

```
System が候補を出す → 人が確認 → 人が採用/却下 → 履歴が残る
```

> 📖 詳細: [OS Architecture](../product/support-operations-os-architecture.md)

---

## 3. ドキュメント体系

開発前に以下のドキュメントを読むことを推奨する。

| 優先度 | ドキュメント | 内容 | 読了時間 |
|--------|------------|------|---------|
| ⭐⭐⭐ | [principles.md](../product/principles.md) | 設計原則 10 箇条 | 10 分 |
| ⭐⭐⭐ | [architecture.md](../product/support-operations-os-architecture.md) | 7 層パイプライン + コード対応 | 20 分 |
| ⭐⭐ | [ui-conventions.md](../product/ui-conventions.md) | 提案 UI の共通ルール | 15 分 |
| ⭐⭐ | [roadmap.md](../product/roadmap.md) | フェーズと優先順位 | 10 分 |
| ⭐ | [ADR Index](../adr/README.md) | 設計判断の一覧 | 5 分 |

```
docs/product/
 ├── principles.md          ← 憲章（Why）
 ├── ui-conventions.md      ← UI 規約（How UI）
 ├── architecture.md        ← アーキテクチャ（How System）
 └── roadmap.md             ← ロードマップ（When）

docs/adr/
 └── README.md              ← 設計判断の索引

docs/dev/
 └── onboarding.md          ← 本ドキュメント
```

---

## 4. 開発環境セットアップ

### 前提条件

- Node.js 18+
- npm 9+
- Git

### クイックスタート

```bash
git clone https://github.com/yasutakesougo/audit-management-system-mvp.git
cd audit-management-system-mvp
npm install
npm run dev
```

http://localhost:5173 → デモモードで全機能を試せます。

### デモモード（SharePoint 接続なし）

```bash
VITE_FORCE_DEMO=1 VITE_SKIP_LOGIN=1 npm run dev
```

### 開発ショートカット

| コマンド | 画面 | ポート |
|---------|------|--------|
| `npm run dev` | フル | 5173 |
| `npm run dev:schedules` | スケジュール | 5175 |
| `npm run dev:attendance` | 出欠管理 | 5176 |
| `npm run dev:daily` | 日次記録 | 5177 |
| `npm run dev:users` | 利用者マスタ | 5178 |
| `npm run dev:nurse` | バイタル・投薬 | 5179 |

### テスト実行

```bash
npm run test           # Unit テスト
npm run typecheck      # 型チェック（本番コードのみ）
npm run typecheck:full # 型チェック（テスト・ストーリー含む）
npm run lint           # ESLint
```

---

## 5. コード構造ガイド

### ディレクトリ構造

```
src/
├── domain/          # ドメイン層 ← Pure Function のみ、副作用ゼロ
│   ├── isp/         #   ISP 三層モデル（スキーマ・ポート・分析）
│   ├── regulatory/  #   制度遵守チェックエンジン
│   ├── safety/      #   安全管理ドメイン
│   ├── abc/         #   ABC 記録型定義
│   ├── behavior/    #   行動記録スキーマ
│   ├── bridge/      #   クロスドメインブリッジ
│   └── daily/       #   日次記録型定義
│
├── features/        # Feature 層 ← UI + UseCase
│   ├── today/       #   Today 画面（場面推定・次アクション）
│   ├── handoff/     #   Handoff（申し送り + 分析エンジン）
│   ├── daily/       #   Daily 記録（テーブル・ウィザード）
│   ├── planning-sheet/  # 支援計画シート（ブリッジ・Provenance）
│   ├── monitoring/  #   モニタリング（推奨・ドラフト生成）
│   ├── safety/      #   安全管理 UI
│   └── ...          #   40+ features
│
├── infra/           # Infrastructure 層 ← 永続化アダプター
│   ├── localStorage/  # 開発/デモ用
│   ├── sharepoint/    # 本番データ
│   └── firestore/     # 認証基盤
│
├── lib/             # 共通基盤ライブラリ
│   ├── env.ts       #   環境設定（必ずここ経由で読む）
│   ├── spClient.ts  #   SharePoint クライアント
│   └── audit.ts     #   監査ログ基盤
│
└── app/             # アプリケーションシェル
```

### 層間ルール

| ルール | 説明 |
|--------|------|
| `domain/` は純粋関数のみ | React / 副作用 / import に依存しない |
| `features/` は `domain/` に依存 | 逆は禁止 |
| `infra/` は `domain/` の Port を実装 | Port (Interface) → Adapter パターン |
| `lib/` はどこからでも参照可能 | ただし feature 固有ロジックを入れない |

### Ports & Adapters パターン

```
Domain (Pure)  ←→  Port (Interface)  ←→  Adapter (Infrastructure)
                                              │
                                    ┌─────────┼──────────┐
                                    │         │          │
                                LocalStorage  SharePoint  InMemory
                                 (開発/デモ)   (本番)     (テスト)
```

新しいドメインモデルには `port.ts`（interface）を定義し、`infra/` にアダプターを実装する。

---

## 6. 開発ルール

### コーディング規約

| ルール | 説明 |
|--------|------|
| TypeScript strict | `strict: true` でコンパイル |
| Zod スキーマ | ドメイン型には Zod バリデーションを付ける |
| 環境変数 | `getAppConfig()` 経由で読む。`import.meta.env` 直接参照は禁止 |
| 日付処理 | `date-fns-tz` の `fromZonedTime` を使用。`Date#setHours` は禁止 |
| テスト | ドメインロジックには必ず Vitest テストを書く |
| Pure Function | `domain/` 内は副作用ゼロ。IO・状態変更は `infra/` で |

### 禁止事項

- ❌ `domain/` に React hook や UI コードを入れない
- ❌ `import.meta.env` を feature コードから直接読まない
- ❌ `Date#setHours` でタイムゾーン依存の丸めをしない
- ❌ AI 提案を人の確認なしに自動反映しない（原則 5）
- ❌ 入力項目を分析のために増やさない（原則 2）

---

## 7. 新機能追加の手順

### ステップ 1: 設計原則の確認

[principles.md](../product/principles.md) の 10 原則を確認し、新機能がどの原則に対応するかを明記する。

### ステップ 2: ロードマップの位置づけ

[roadmap.md](../product/roadmap.md) のどのフェーズに該当するかを確認する。

### ステップ 3: ドメイン設計

1. `src/domain/` に型定義とスキーマを作成する
2. Pure Function として分析ロジックを実装する
3. テストを書く

### ステップ 4: 永続化

1. `port.ts` にリポジトリ Interface を定義する
2. `src/infra/localStorage/` にローカルアダプターを実装する
3. 必要に応じて `src/infra/sharepoint/` に本番アダプターを実装する

### ステップ 5: Feature 実装

1. `src/features/<feature>/` にコンポーネント・フック・ストアを作成する
2. 提案 UI には共通の `<ProposalCard>` を使用する（[ui-conventions.md](../product/ui-conventions.md)）
3. Provenance Badge を適切に付与する

### ステップ 6: テスト & レビュー

1. `npm run test` + `npm run typecheck` が通ることを確認する
2. PR を作成し、10 原則チェックリストで確認する

### 追加チェックリスト

- [ ] 共通の `<ProposalCard>` を使用しているか（原則 9）
- [ ] 提案に「提案 + 根拠 + 参照元」の 3 点セットがあるか（原則 4）
- [ ] AI 提案に人の承認ステップがあるか（原則 5）
- [ ] 採用/却下の履歴が保存されるか（原則 8）
- [ ] 用語が統一されているか（原則 9）

---

## 8. PR ルール

### ブランチ命名

```
feat/<feature-name>       # 新機能
fix/<issue-description>   # バグ修正
refactor/<target>         # リファクタリング
docs/<topic>              # ドキュメント
```

### PR テンプレート

PR には以下を含める。

1. **概要** — 何を変更したか
2. **対応原則** — 設計原則 10 箇条のどれに対応するか
3. **スクリーンショット** — UI 変更がある場合
4. **テスト** — 追加・変更したテストの概要

### マージ条件

- [ ] CI が通っている（Quality Gate + Lint + TypeCheck）
- [ ] レビュー承認あり（or セルフレビュー記録あり）
- [ ] 破壊的変更がある場合は ADR を記録する

> 📖 詳細: [PR Merge Checklist](pr-merge-checklist.md)

---

## 9. よくある質問

### Q: デモモードで動かすには？

```bash
VITE_FORCE_DEMO=1 VITE_SKIP_LOGIN=1 npm run dev
```

### Q: SharePoint に接続するには？

`.env.local` を設定してください。詳細は README の [Environment Variables](../../README.md#environment-variables-env) を参照。

### Q: 新しいドメインモデルを追加するには？

1. `src/domain/<model>/` にディレクトリを作成
2. `schema.ts` に Zod スキーマを定義
3. `port.ts` にリポジトリ Interface を定義
4. `src/infra/localStorage/` にローカルアダプターを実装
5. テストを書く

### Q: AI 提案を追加するには？

1. `src/features/handoff/analysis/` のパターンに従って分析ロジックを実装
2. `proposalBundle.ts` のアダプタースタイルで `PlanningProposalBundle` に変換（[ADR-010](../adr/ADR-010-proposal-integration-layer.md)）
3. 共通の `<ProposalCard>` で表示（[ui-conventions.md](../product/ui-conventions.md)）
4. 必ず人の承認ステップを入れる（原則 5）

### Q: ドキュメントはどこに書けば？

| 種類 | 場所 |
|------|------|
| 設計判断 | `docs/adr/ADR-NNN-*.md` |
| プロダクト文書 | `docs/product/` |
| 運用手順 | `docs/runbook/` or `docs/ops/` |
| 開発ガイド | `docs/dev/` |
| 仕様書 | `docs/specs/` |

---

## 関連文書

| ドキュメント | 内容 |
|-------------|------|
| [principles.md](../product/principles.md) | プロダクト憲章 |
| [ui-conventions.md](../product/ui-conventions.md) | UI 設計規約 |
| [architecture.md](../product/support-operations-os-architecture.md) | OS Architecture |
| [roadmap.md](../product/roadmap.md) | ロードマップ |
| [ADR Index](../adr/README.md) | 設計判断一覧 |
| [PR Merge Checklist](pr-merge-checklist.md) | マージ条件 |
