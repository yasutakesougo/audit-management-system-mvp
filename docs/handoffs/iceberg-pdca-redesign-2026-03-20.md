# Handoff: Iceberg PDCA Page Redesign

**Date**: 2026-03-20
**Branch**: `feat/abc-support-integration-mvp`
**Scope**: `/analysis/iceberg-pdca` ページの全面再設計

---

## 概要

氷山分析ページを「情報置き場」から「判断の流れを持つ運用画面」に再設計。
3フェーズに分けて段階的に実装し、最後に Kanban フェーズ遷移と停滞フィルタを追加。

---

## 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `IcebergPdcaPage.tsx` | 3タブ構成（傾向 / 氷山構造 / 改善サイクル）、URL同期、handleAdvancePhase |
| `IcebergPdcaFormSection.tsx` | onAdvancePhase prop 透過 |
| `PdcaCycleBoard.tsx` | **新規** — Kanban 4列ボード + インラインフェーズ遷移 + 停滞フィルタ |
| `IcebergStructureTab.tsx` | **新規** — SVG 氷山ビジュアライゼーション + 層別サマリ |

---

## Phase 1: 3タブ構成 + レイアウト再設計

### やったこと
- 長い縦スクロールを 3 タブに分解
  - **傾向**: 月次推移・重み分布（既存チャート再配置）
  - **氷山構造**: 3層可視化 + 層別サマリ
  - **改善サイクル**: PDCA Kanban + KPI
- URL パラメータ `?tab=trend|iceberg|pdca` で同期
- KPI（完了率・リードタイム）を改善サイクルタブへ移動

### 設計判断
- タブ名は **機能名** ではなく **行動意図名**（見る / 気づく / 変える）
- URL 同期により共有・再訪・検証が可能

---

## Phase 2: 氷山構造ビジュアライゼーション

### やったこと
- SVG で 3 層（行動・場面・背景）を台形で描画
- 各層クリックで選択 → 詳細展開
- 非選択層は薄めて焦点を作る
- 「読み方」ガイドを InfoChip で表示
- 場面層では強度分布まで表示
- 旧実装を削除し座標計算を一本化

### 設計判断
- Canvas ではなく SVG を選択 → 構造が読みやすく保守・微調整しやすい
- アニメーションは CSS transition で軽量に

---

## Phase 3: PDCA Kanban ボード

### やったこと
- Plan / Do / Check / Act の 4 列 Kanban 表示
- 停滞バッジ（7日以上未更新 → 赤 `停滞` チップ）
- 列ヘッダーに件数バッジ
- ACT 列に「支援計画に反映」ボタン
- `highlightPdcaId` で新規作成時のスクロール＆ハイライト

### インラインフェーズ遷移（Phase 3 強化）
- Plan→Do / Do→Check / Check→Act のワンクリック進行ボタン
- ボタン色は **次フェーズの色** に合わせ、`outlined` で目立たせ
- ACT は最終段階のため進行ボタンなし
- 遷移成功後にスナックバー通知（`「〇〇」を Do へ移動しました`）

### 停滞フィルタ
- 停滞アイテムが 1 件以上ある場合のみ `停滞のみ表示 (N)` チップを表示
- トグル ON → 停滞アイテムだけに絞り込み
- ON 時 `filled` / OFF 時 `outlined`（色で状態が分かる）
- 空列は「停滞なし」表示（通常時は「項目なし」）

### 設計判断
- **片方向のみ**: 戻しは編集フォーム経由（誤操作防止）
- **確認ダイアログなし**: PDCA フェーズ変更は取り消し可能な軽い操作
- **DnD 見送り**: 実装コスト・誤操作リスクに対して現段階では見合わない
- 進行ボタンを `outlined`、編集・削除を `text` に → **進行促進を最優先**

---

## 依存関係

- `@mui/material`, `@mui/icons-material`: UI コンポーネント
- `@tanstack/react-query`: `useUpdatePdca` ミューテーション
- 既存の `useIcebergPdcaList`, `IcebergPdcaItem`, `IcebergPdcaPhase` 型

---

## テスト状況

| 項目 | 結果 |
|---|---|
| `npx tsc --noEmit` | ✅ Pass |
| 画面確認: 3タブ切替 | ✅ |
| 画面確認: SVG氷山描画 | ✅ |
| 画面確認: Kanban表示 | ✅ |
| 画面確認: フェーズ遷移 | ✅ |
| 画面確認: 停滞フィルタ | ✅（停滞なし時は非表示を確認） |
| 画面確認: スナックバー通知 | ✅ |

---

## 残タスク / 次の一手

### 優先度高
1. **Phase 変更の監査トレース**
   - 誰が・いつ・どこから進めたかの軽い履歴
   - まずは更新日時 + 最終変更者 + 直近フェーズ変更 1 件

### 優先度中
2. **フィルタ拡張**
   - 自分担当のみ / 特定利用者のみ / ABC 由来のみ
3. **Act 列の強化**
   - 反映済み / 未反映 / 反映日の可視化

### 優先度低
4. **DnD によるフェーズ変更**
   - ユーザー要望が明確になってから
5. **氷山構造タブの分析深化**
   - 時系列変化 / 相関分析

---

## アーキテクチャメモ

```
IcebergPdcaPage.tsx
├── TrendTab (既存チャート再配置)
├── IcebergStructureTab.tsx  ← Phase 2 新規
│   ├── SVG Iceberg Visualization
│   └── LayerSummaryCards
└── IcebergPdcaFormSection.tsx
    ├── CreateForm
    └── PdcaCycleBoard.tsx  ← Phase 3 新規
        ├── Stalled Filter Chip
        ├── Column Headers (Plan/Do/Check/Act)
        └── PdcaCard (edit / delete / advance / monitor)
```

handleAdvancePhase の流れ:
```
PdcaCard [→ Doへ進める] click
  → PdcaCycleBoard.onAdvancePhase(item, 'DO')
    → IcebergPdcaFormSection.onAdvancePhase(item, 'DO')
      → IcebergPdcaPage.handleAdvancePhase(item, 'DO')
        → updateMutation({ ...item, phase: 'DO' })
        → snackbar「〇〇を Do へ移動しました」
```
