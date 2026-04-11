
# Nightly Runtime Patrol Report — 2026-04-11

## 📊 Summary
* **Total Raw Events**: 9
* **Bundled Issues**: 8
  * 🔴 **Critical**: 2
  * 🟠 **Action Required**: 1
  * 🟡 **Watch**: 2
  * 🟢 **Silent (Absorbed)**: 3
* 📘 **Drift Log Read**: fallback=no / scanned=0 / filtered=0 / safety=safe


---

## 🧾 Reason Code Summary
| Reason Code | Count | Resources |
| --- | :---: | --- |
| `manual` | 2 | StaffAttendance, UserBenefit_Profile |
| `absorbed_strategy_e` | 1 | UserBenefit_Profile |
| `index_required` | 1 | iceberg_analysis |
| `list_not_found` | 1 | Users_Master |
| `max_size_exceeded` | 1 | UserBenefit_Profile |
| `rate_limit` | 1 | SharePoint_API |
| `unknown_field_added` | 1 | support_record_daily |

## 🔁 Repeated Transient Failures
_No events recorded._


## ♻️ Recovered Transient Failures
_No events recorded._


## 🚨 Requires Attention (Critical & Action Required & Watch)
| Severity | Event Type | Resource | Occurrences | Fingerprint | NextAction |
| --- | --- | --- | :---: | --- | --- |
| 🔴 critical | `http_429` | **SharePoint_API** | 1 | `327f2280` | 【至急】運用管理者にエスカレーションし、システム全体の利用可否を確認してください。 |
| 🔴 critical | `index_pressure` | **iceberg_analysis** | 1 | `e9c83905` | 【至急】[iceberg_analysis] で必須インデックスが不足しています。システム停止を防ぐため、Index Advisor で修復を実行してください。 |
| 🟠 action_required | `remediation` | **UserBenefit_Profile** | 1 | `54d88c74` | 【要確認】インデックス修復 (RecipientCertNumber) に失敗しました。ネットワーク状態や SharePoint 権限を確認してください。 |
| 🟡 watch | `health_fail` | **Users_Master** | 1 | `c52ff402` | [Users_Master] の健全性チェックに失敗しました。SharePoint 管理画面でリストの存在・権限設定を確認してください。 |
| 🟡 watch | `drift` | **support_record_daily** | 1 | `1485a11e` | [support_record_daily] に誰かがフィールドを直接追加・削除した可能性があるため、変更履歴を調査してください。 |


<details>
<summary><b>🟢 Silent / Absorbed Events (3)</b></summary>

_These events were safely absorbed by system resilience features (e.g., Strategy E, 8KB Limits). No action is required._

| Event Type | Resource | Occurrences | Fingerprint | Ref |
| --- | --- | :---: | --- | --- |
| `provision_skipped:block` | **UserBenefit_Profile** | 2 | `f4a385a4` | Prevented creation to avoid 8KB limits. |
| `drift` | **UserBenefit_Profile** | 1 | `0dacad70` | Strategy E absorbed it. |
| `remediation` | **StaffAttendance** | 1 | `40f1542a` | RecordDate のインデックスを作成しました（成功）。 |

</details>
