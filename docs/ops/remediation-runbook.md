# 修復ガバナンス運用マニュアル (Remediation Governance Runbook)

このドキュメントは、監査管理システムの「自己修復ガバナンス（Guarded Auto Execution）」を安全に運用するためのガイドラインです。

## 1. 運用サイクル (Management Cycle)

システムは毎晩 **Signal → Plan → Audit → Metrics → Policy → Auto Execute → Alert** のループを自動で回します。

### 毎朝のチェック (Morning Routine)
管理者（運用責任者）は毎朝以下の 2 点を確認してください。
1.  **Teams 通知レポート**: `[INFO]` なら正常です。`[CRITICAL]` または `[WARNING]` が出ている場合は内容を確認してください。
2.  **診断ダッシュボード**: `/admin/status` を開き、現在の「SLO 遵守状況」が `Compliant`（青/緑）であることを確認してください。

---

## 2. アラートへの対応 (Incident Response)

通知レポートのレベルに応じた対応手順です。

### 🚨 [CRITICAL] SLO SERVICE BREACH
*   **状態**: 修復成功率の低下などにより、システムが **「安全のために自動修復機能を緊急停止（Kill-Switch）」** した状態です。
*   **原因**: 直近の自動修復が失敗し続けている、または深刻な MTTR 悪化。
*   **アクション**:
    1.  ダッシュボードの「監査ログ」から、直近の `executed (failed)` エントリの詳細を確認してください。
    2.  失敗の原因（API権限不足、リソースロック、スキーマ不整合等）を特定し、手動で修正してください。
    3.  品質が回復すれば、システムは翌晩から自動実行を再開します。

### ⚠️ [WARNING] 運用品質低下 / バックログ増加
*   **状態**: SLO 違反には至っていませんが、未対応のプランが溜まっている（Backlog 増加）か、MTTR が悪化しています。
*   **アクション**:
    1.  プラン一覧を確認し、`Manual Review Required` となっている案件を手動で処理してください。
    2.  滞留が解消されれば、アラートは自動的に消えます。

---

## 3. 安全性の検証 (Failsafe Exercise)

実運用開始前や、定期的な監査の際に、安全装置（キルスイッチ）が正しく機能することを証明するための手順です。

### フェイルセーフ演習の実行
以下のコマンドを実行し、システムが「SLO 違反を検知して正しく止まるか」を確認してください。

```bash
# SLO 違反をシミュレートし、レポートを生成する
node scripts/ops/nightly-remediation-audit.mjs --webUrl "YOUR_SITE_URL" --force-slo-breach
```

**期待される結果**:
*   コンソールに `🛑 SLO BREACH DETECTED` と表示される。
*   SharePoint ログに `skipped` フェーズが書き込まれる（理由：SIMULATED SLO BREACH）。
*   Teams に `🚨 SLO SERVICE BREACH` レポートが届く。

---

## 4. ガバナンス設定の調整 (Configuration)

運用品質目標（SLO）は、`src/features/sp/health/remediation/policy.ts` で調整可能です。

*   **mttrGoalMs**: プロジェクトのフェーズに合わせて目標修復時間を調整します。
*   **successRateMin**: 運用の習熟度に合わせて、自動化を止める基準（デフォルト 80%）を調整します。
*   **maxExecutionsPerDay**: 大規模改修時は一時的にこの値を増やして消化スピードを上げることが可能です。
