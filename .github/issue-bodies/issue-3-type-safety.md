## Dependencies
- blocked by #837
- prefer after #838

---

## 背景
巨大ファイル分割と import 正規化のあと、運用前の最終 hardening として
型安全の弱い箇所と Loading/Error UI の入口を整備したい。

目的は壊れにくさを上げることであり、
仕様変更ではない。

This task must use `docs/reports/pre-operation-repository-audit.md` as the source of truth for risk-aware type/UI cleanup.
If the report does not exist, proceed only with clearly low-risk improvements.

---

## 目的
- unsafe cast を減らす
- `any` 依存を縮小する
- Loading / Error UI の共通入口を整備する
- 運用時の不安定さを減らす

---

## 前提
- audit report が存在すること
- 大きな構造変更は Issue 2 で先に整理してあること
- Users / Schedules / Daily の統一方針を崩さないこと

---

## スコープ
### 含める
- `any` / `as any` / `unknown as` の安全な削減
- ローカル型定義の追加
- schema由来型の活用
- `satisfies` / discriminated union の活用
- 共通 LoadingState / ErrorState / ErrorBoundary 入口の整備
- touched pages/panels/drawers への安全な導入

### 含めない
- 型エラー隠しの cast 追加
- 仕様変更
- UX全面刷新
- SharePoint mapper の意味変更
- repository 契約変更

---

## 完了条件
- [ ] `any` / `as any` / `unknown as` が減っている
- [ ] 型隠しのための cast が追加されていない
- [ ] 共通 Loading UI 入口が整備されている
- [ ] 共通 Error UI 入口または ErrorBoundary が整備されている
- [ ] touched files で使い方が統一されている
- [ ] `npm run typecheck` が通る
- [ ] `npm run lint` が通る
- [ ] `npm run test` が通る

---

## 実施タスク
### 1. Type safety tightening
監査結果から low risk / medium-low risk の対象を選ぶ。

優先対象：
- hooks
- helper transforms
- form helpers
- adapter の軽微な型改善
- page props / component props
- local mapping helpers

禁止：
- 型エラーを隠すだけの `as any`
- `as unknown as X` の乱用
- なんでも `Record<string, unknown>` に逃がすこと

### 2. Shared loading/error entry points
以下のような共通入口を整備する。

例：
- `src/components/ui/LoadingState.tsx`
- `src/components/ui/ErrorState.tsx`
- `src/components/errors/PageErrorBoundary.tsx`

対象：
- page
- panel
- drawer
- detail view

まずは入口統一を優先し、全面置換までは必須にしない。

### 3. Safe integration
導入対象は touched files に限定してよい。
過剰な横展開はしない。

---

## 成果物
- 型安全改善差分
- 共通 Loading/Error 入口
- 導入例
- 検証結果付き PR

---

## PR本文に必ず含めること
1. どの unsafe cast を減らしたか
2. どの型を追加したか
3. どこに Loading/Error 入口を導入したか
4. 見送った項目
5. typecheck/lint/test 結果
6. 残課題

---

## 注意事項
- 型を隠すための修正は禁止
- 共通化しすぎて大差分にしない
- 触った範囲の整合性を重視する
- 既存UXを壊さない

---

## Review guidance
Prefer smaller, reviewable commits over one oversized change.
Be conservative. Structural cleanup is preferred over logic rewrites.
