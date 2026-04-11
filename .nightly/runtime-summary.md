
# Nightly Runtime Patrol Report — 2026-04-12

## 📊 Summary
* **Total Raw Events**: 5
* **Bundled Issues**: 4
  * 🔴 **Critical**: 1
  * 🟠 **Action Required**: 1
  * 🟡 **Watch**: 2
  * 🟢 **Silent (Absorbed)**: 1

---

## 🚨 Requires Attention (Critical & Action Required & Watch)
| Severity | Event Type | Resource | Occurrences | Fingerprint | NextAction |
| --- | --- | --- | :---: | --- | --- |
| 🔴 critical | `index_pressure` | **iceberg_analysis** | 1 | `e9c83905` | 【至急】[iceberg_analysis] で必須インデックスが不足しています。管理画面 (/admin/status) で具体的な解除コマンドを確認してください。 |
| 🟠 action_required | `drift` | **support_record_daily** | 1 | `1485a11e` | [support_record_daily] でスキーマドリフトを検知しました。管理画面 (/admin/status) で提示されている修正コマンドを実行してください。 |
| 🟡 watch | `index_pressure` | **Approval_Logs** | 1 | `7d2f9a1b` | [Approval_Logs] でインデックスの最適化が可能です。管理画面 (/admin/status) で具体的な解除コマンドを確認してください。 |
| 🟡 watch | `health_fail` | **Users_Master** | 1 | `c52ff402` | [Users_Master] の健全性チェックに失敗しました。管理画面 (/admin/status) で詳細を確認してください。 |

> [!TIP]
> **Operational OS Update**: 本日より、パトロール結果の `NextAction` が管理画面 (/admin/status) の **Remediation Card** と連動するようになりました。
> これにより、管理者はレポートから直接修復コマンドを取得し、数秒で復旧作業を完了できます。

<details>
<summary><b>🟢 Silent / Absorbed Events (1)</b></summary>

_These events were safely absorbed by system resilience features (e.g., Strategy E, 8KB Limits). No action is required._

| Event Type | Resource | Occurrences | Fingerprint | Ref |
| --- | --- | :---: | --- | --- |
| `drift` | **UserBenefit_Profile** | 1 | `0dacad70` | Strategy E absorbed it. |

</details>

---

## 🛠️ Infrastructure Improvements (2026-04-12)
- **Remediation Integration**: Nightly Patrol が生成する NextAction 文言を、新設された `/admin/status` の修復カードに誘導するように刷新。
- **Actionable Signals**: ドリフト検知およびインデックス圧迫時に、具体的な復旧手順（m365 CLI コマンド等）が提示される導線を確立。
- **Safety Guarantee**: 破壊的な操作を伴う推奨アクションには、自動的に `dry-run` 推奨ラベルが付与される仕組みを導入。
