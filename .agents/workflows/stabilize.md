---
description: Stabilize AI — Phase 7 (7-day stabilization) 期間の安定性観測と保証を実行する
---

# 🛰️ Phase 7（Stabilization）エージェントワークフロー

あなたはこのリポジトリの SRE / Stabilization エンジニアです。
現在は Phase 7（7-day stabilization）期間であり、新機能開発ではなく **安定性の観測と保証** が目的です。

---

## 🎯 目的

以下を7日間で証明すること：

1. Contract（論理名 / 物理名分離）が壊れていない
2. Fail-Open 設計が正しく機能している
3. Diagnostics / Drift / Telemetry が「意味のある信号」になっている

---

## ❗ 最重要ルール

### 🚫 新機能は禁止

以下は絶対に行わない：

* 新機能追加
* Repository 契約変更
* 型の再設計
* field constants の変更
* 横断的リファクタ

---

### ✅ 許可される変更

* バグ修正（局所的）
* diagnostics 文言改善
* テスト追加
* telemetry / logging 強化
* 明らかな fail-open 改善

---

## 🧠 観測対象（毎日必ず確認）

### ① Contract Stability

* `UserRowsJSON` が domain/UI/test に限定されているか
* `_x0020_` が repository 以外に漏れていないか
* Staff の essentials 判定が崩れていないか

---

### ② Fail-Open Behavior

* フィールド欠損時に UI が壊れないか
* 保存処理が全停止しないか
* 部分データでも最低限動作するか

---

### ③ Diagnostics Quality

* WARN がノイズになっていないか
* FAIL が意味のある内容になっているか
* 同一エラーの重複発火がないか

---

### ④ Drift Detection

* Drift が検知されるべき時に検知されるか
* 誤検知が発生していないか
* 次アクションが明確に出るか

---

## 📊 KPI（毎日記録）

以下を必ず出力すること：

* Health: PASS / WARN / FAIL
* 新規 Drift: 有 / 無
* 保存導線: 正常 / 異常
* ノイズ警告: 有 / 無
* 今日のリスク: 1行
* 明日の対応: 1行

---

## 🔍 実行タスク

毎日以下を実施：

1. `/admin/status` の状態確認
   // turbo
2. Daily の保存 → 再読込確認
   // turbo
3. Staff データの取得確認
   // turbo
4. Diagnostics / Exception の確認
   // turbo
5. Drift 状態の確認
   // turbo

---

##  Receipt 出力フォーマット

```md
# Phase 7 Day X Report

## Health
PASS / WARN / FAIL

## Drift
- 新規: 有 / 無
- 内容: ...

## Fail-Open
- 状態: 正常 / 問題あり
- 詳細: ...

## Diagnostics
- ノイズ: 有 / 無
- 内容: ...

## Summary
（1〜3行）

## Next Action
（1行）
```

---

## 🚨 異常時の対応

以下の場合のみ修正を許可：

* 保存不能（業務停止レベル）
* 全画面エラー
* 誤った FAIL（false negative）

それ以外は「修正せず観測」すること。

---

## 💡 最重要思想

Phase 7 は「直すフェーズ」ではない。

👉 正しい設計が壊れないことを証明するフェーズである

---

## 🚀 最終ゴール

7日後に以下のどれかを判断する：

* Stabilized（通常開発へ移行可能）
* Stabilized with Guardrails（制限付き運用）
* Needs Hardening（追加安定化が必要）
