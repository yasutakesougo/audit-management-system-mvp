## Dependencies
- blocked by #837

---

## 背景
pre-operation audit の結果を踏まえ、巨大ファイルのうち
低リスクで安全に分割できるものを先に整理したい。

目的は「読みやすくすること」であり、
仕様変更やロジック変更は行わない。

This task must use `docs/reports/pre-operation-repository-audit.md` as the source of truth for candidate selection.
If the report does not exist, generate a minimal candidate list first and proceed conservatively.

---

## 目的
- 巨大ファイルの責務を分離する
- touched files の import/export を正規化する
- 今後の AI / 人手作業をしやすくする

---

## 前提
- 監査結果: `docs/reports/pre-operation-repository-audit.md`
- 監査で high risk と判定されたものは無理に触らない
- Users / Schedules / Daily の Design Contract を崩さない

---

## スコープ
### 含める
- 安全な large file split
- hook / types / helpers / components の分離
- import順序の統一
- `import type` への置換
- 未使用 import の削除
- barrel export の最低限整理

### 含めない
- 新機能追加
- state machine 再設計
- API / repository 契約変更
- UI仕様変更
- SharePoint 連携ロジックの意味変更

---

## 完了条件
- [ ] 監査結果をもとに対象ファイルを選定している
- [ ] 最低2件、可能なら3〜4件の安全分割を実施している
- [ ] 挙動変更なしで責務分離されている
- [ ] touched files の import順序が統一されている
- [ ] `import type` が適用されている
- [ ] 未使用 import が削除されている
- [ ] `npm run typecheck` が通る
- [ ] `npm run lint` が通る

---

## 実施タスク
### 1. Split candidates selection
監査レポートから low risk / medium-low risk の対象を選ぶ。

優先候補：
- page component が肥大化しているもの
- detail sections を多く抱える component
- UI / state / helper / type が1ファイルに混在しているもの
- 既に分割方針が明確なもの

### 2. Safe file split
推奨構成：
- `index.tsx`
- `types.ts`
- `useXxx.ts`
- `helpers.ts`
- `components/*`

重要：
- ロジック変更はしない
- export surface を必要以上に広げない
- 相対importを深くしすぎない

### 3. Import normalization
touched files に対して以下を実施：
1. React
2. external packages
3. shared/lib/config/constants
4. features/*
5. relative imports

さらに：
- `import type` 化
- 未使用 import 削除
- barrel export の最低限整理

---

## 成果物
- 安全分割されたファイル群
- 整理後の import/export
- PRで「何を分割し、何を見送ったか」の説明

---

## PR本文に必ず含めること
1. 分割対象
2. 分割理由
3. 挙動変更なしの根拠
4. import/export 正規化内容
5. 見送った候補
6. typecheck/lint 結果

---

## 注意事項
- 1本の巨大PRにしすぎない
- 触った範囲だけ綺麗にする
- ロジック改善に見える変更は避ける
- レビューしやすさを最優先する

---

## Review guidance
Prefer smaller, reviewable commits over one oversized change.
Be conservative. Structural cleanup is preferred over logic rewrites.
