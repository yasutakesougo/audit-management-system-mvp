# 🎯 AI Skill Matrix — イソカツシステム専用

> **目的**: AIに何を任せるかを役割ごとに固定する設計図
> **対象**: audit-management-system-mvp
> **前提**: React + TypeScript + MUI / Zod SSOT / Repository pattern / SharePoint backend
> **作成日**: 2026-03-14

---

## 0. 共通コンテキスト（全AI役割の先頭に付加）

```markdown
このプロジェクトは福祉事業所向けの現場OSです。
単なるCRUDではなく、現場導線・監査性・継続運用を重視します。
最適化基準は「開発者の都合」ではなく「現場で迷わないこと」です。

技術スタック:
- React 18 + TypeScript 5 + MUI v5
- Zod schema を唯一の真実源にする（SSOT）
- Repository pattern（SharePoint REST → domain model）
- MSAL 認証 + Entra ID
- Cloudflare Workers SPA routing
- Vitest + Playwright
```

---

## 1. 8役割の全体像

```text
┌─────────────────────────────────────┐
│         Development Lifecycle       │
│                                     │
│  ① Architect AI ─→ ② Implementer AI│
│        ↓                  ↓         │
│  ③ Reviewer AI    ④ Test AI         │
│        ↓                  ↓         │
│  ⑤ Refactor AI   ⑥ Compliance AI   │
│        ↓                  ↓         │
│  ⑦ UX AI         ⑧ Docs AI         │
└─────────────────────────────────────┘
```

| # | 役割 | 一言定義 | ワークフロー |
|---|------|---------|-------------|
| 1 | **Architect AI** | 構造設計・責務分離の番人 | `.agents/workflows/architect.md` |
| 2 | **Implementer AI** | 設計済みタスクの高速実装 | `.agents/workflows/implement.md` |
| 3 | **Reviewer AI** | 設計逸脱・型崩れ・負債の検知 | `.agents/workflows/review.md` |
| 4 | **Test AI** | 不足テストの洗い出し・追加 | `.agents/workflows/test.md` |
| 5 | **Refactor AI** | 巨大ファイル分割・整理 | `.agents/workflows/refactor.md` |
| 6 | **Compliance AI** | 制度・監査整合の確認 | `.agents/workflows/compliance.md` |
| 7 | **UX AI** | 現場導線の最適化 | `.agents/workflows/ux-review.md` |
| 8 | **Docs AI** | ドキュメント・運用資料の生成 | `.agents/workflows/docs.md` |

---

## 2. 各役割の詳細

### ① Architect AI — 設計担当

| 項目 | 内容 |
|------|------|
| **責務** | 新機能の構造設計 / 責務分離 / ドメイン整理 / SSOT維持確認 |
| **得意** | 新ページ追加前の設計 / schema.ts 起点の構造定義 / module boundary 判断 |
| **禁止** | コードを直接書くこと（設計だけを出力する） |
| **出力** | 変更対象ファイル / 新規作成ファイル / 責務分離方針 / データフロー / リスク |

### ② Implementer AI — 実装担当

| 項目 | 内容 |
|------|------|
| **責務** | 設計済みタスクの実装 / 小〜中規模の機能追加 |
| **得意** | フィールド追加 / UI追加 / hooks追加 / mapper追加 / フォーム改善 |
| **禁止** | 設計を勝手に変えること / 既存命名規約の無視 |
| **出力** | 変更ファイル一覧 / 各ファイルの差分 / テスト追加案 / 影響範囲 |

### ③ Reviewer AI — レビュー担当

| 項目 | 内容 |
|------|------|
| **責務** | PRレビュー / 設計逸脱検知 / 型崩れ検知 / 将来負債の警告 |
| **得意** | 巨大ファイル検査 / any混入確認 / domain⇔infra にじみ検知 |
| **禁止** | スタイル指摘だけで終わること（構造的問題を優先） |
| **出力** | high/medium/low で分類した指摘 / 修正案 |

### ④ Test AI — テスト担当

| 項目 | 内容 |
|------|------|
| **責務** | spec追加 / 境界値テスト / safety-net tests / E2E観点整理 |
| **得意** | pure function specs / hooks unit test / 競合テスト / a11y smoke |
| **禁止** | 実装変更（テストのみ書く） |
| **出力** | 不足テスト一覧 / 優先度付き / Vitest or Playwright の判定 |

### ⑤ Refactor AI — 分割・整理担当

| 項目 | 内容 |
|------|------|
| **責務** | 巨大ファイル分割 / hook抽出 / pure function化 / 重複削減 |
| **得意** | 600行超ファイル分割 / Page→Hook抽出 / mapper切り出し |
| **禁止** | 振る舞いの変更 / 型の変更 / テスト破壊 |
| **出力** | 分割計画 → 変更差分 → 確認観点 |

### ⑥ Compliance AI — 制度・監査担当

| 項目 | 内容 |
|------|------|
| **責務** | 制度整合確認 / 監査証跡の不足確認 / 必須記録漏れ警告 |
| **得意** | ISP/モニタリング / 重度加算要件 / 変更履歴・承認履歴の妥当性 |
| **禁止** | 制度解釈の独断（不明点は明示する） |
| **出力** | UI・データ・運用ルールの3観点での改善案 |

### ⑦ UX AI — 現場導線担当

| 項目 | 内容 |
|------|------|
| **責務** | 操作ステップ削減 / 情報優先順位整理 / 現場ストレス低減 |
| **得意** | TodayOps / DayClose / Handoff / Quick actions / ボタン配置 |
| **禁止** | 技術都合のUI提案 |
| **出力** | 迷いポイント / 情報過多ポイント / CTAの明確さ / PC&スマホ改善案 |

### ⑧ Docs AI — ドキュメント担当

| 項目 | 内容 |
|------|------|
| **責務** | README / Runbook / user_guide / ADR / PR説明文 |
| **得意** | 運用マニュアル / Phase完了サマリー / 導入説明資料 |
| **禁止** | 技術用語だらけの現場向けドキュメント |
| **出力** | 現場職員向け + 開発者向けの2種類 |

---

## 3. 日常開発フロー

```text
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ Architect│──▶│Implementer──▶│ Reviewer │──▶│  Test    │──▶│  Docs    │
│    AI    │   │    AI    │   │    AI    │   │    AI    │   │    AI    │
└──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
   設計           実装          差分チェック     テスト追加      PR文章・記録
```

### ワークフロー呼び出し

```bash
# 設計フェーズ
/architect

# 実装フェーズ
/implement

# レビューフェーズ
/review

# テスト追加
/test

# ドキュメント化
/docs
```

---

## 4. タスク種別ごとの最適組み合わせ

### A. 支援記録・Handoff改善

```text
Architect AI → Implementer AI → UX AI → Test AI
```

| ステップ | AI | やること |
|---------|-----|---------|
| 1 | Architect | Handoff Timeline の構造設計 |
| 2 | Implementer | UI・hooks の実装 |
| 3 | UX AI | 現場導線レビュー |
| 4 | Test AI | 回帰テスト追加 |

### B. ISP・モニタリング・加算対応

```text
Architect AI → Compliance AI → Reviewer AI → Docs AI
```

| ステップ | AI | やること |
|---------|-----|---------|
| 1 | Architect | データモデル設計 |
| 2 | Compliance | 制度整合チェック |
| 3 | Reviewer | 設計逸脱なしか確認 |
| 4 | Docs | 制度対応ドキュメント |

### C. 巨大ファイル分割・Fortress化

```text
Refactor AI → Reviewer AI → Test AI
```

| ステップ | AI | やること |
|---------|-----|---------|
| 1 | Refactor | 分割計画と実行 |
| 2 | Reviewer | 責務の正しさ確認 |
| 3 | Test | 回帰テスト追加 |

### D. 新ページ追加

```text
Architect AI → UX AI → Implementer AI → Test AI → Reviewer AI → Docs AI
```

---

## 5. 既存プロトコルとの関係

```text
既存: ai-skills-protocol.md   → Antigravityスキルの"何を使うか"
既存: ai-usage-protocol.md    → フェーズ×スキルの"いつ使うか"
新規: ai-skill-matrix.md      → AIの"誰に任せるか"（本ドキュメント）
```

> 3つは補完関係にある。
> - Skills Protocol = ツールカタログ
> - Usage Protocol = 運用タイミング
> - **Skill Matrix = 役割分担設計図**

---

## 6. 現時点の最優先AI活用

| 優先度 | AI | ターゲット | 理由 |
|:------:|------|-----------|------|
| 🔴 1 | UX AI | Today / DayClose の導線磨き | 現場の日次業務に直結 |
| 🔴 2 | Compliance AI | ISP / モニタリング / 加算要件 | 監査対応の穴を先に塞ぐ |
| 🟡 3 | Refactor AI | 巨大ファイルと責務分離 | 保守性の継続硬化 |
| 🟡 4 | Test AI | safety-net tests 追加 | Fortress化の基盤 |
| 🟢 5 | Docs AI | Runbook / 運用マニュアル | 本番運用の準備 |

---

## 付録: ワークフローファイル一覧

| ファイル | コマンド | 用途 |
|---------|---------|------|
| `.agents/workflows/architect.md` | `/architect` | 設計プロンプト |
| `.agents/workflows/implement.md` | `/implement` | 実装プロンプト |
| `.agents/workflows/review.md` | `/review` | レビュープロンプト |
| `.agents/workflows/refactor.md` | `/refactor` | 分割・整理プロンプト |
| `.agents/workflows/test.md` | `/test` | テスト追加プロンプト |
| `.agents/workflows/compliance.md` | `/compliance` | 制度整合レビュー |
| `.agents/workflows/ux-review.md` | `/ux-review` | UXレビュー |
| `.agents/workflows/docs.md` | `/docs` | ドキュメント生成 |
