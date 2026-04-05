
# Nightly Runtime Patrol Report — 2026-04-05

## 📊 Summary
* **Total Raw Events**: 7
* **Bundled Issues**: 6
  * 🔴 **Critical**: 1
  * 🟠 **Action Required**: 1
  * 🟡 **Watch**: 2
  * 🟢 **Silent (Absorbed)**: 2

---

## 🚨 Requires Attention (Critical & Action Required & Watch)
| Severity | Event Type | Resource | Occurrences | Fingerprint | NextAction |
| --- | --- | --- | :---: | --- | --- |
| 🔴 critical | `http_429` | **SharePoint_API** | 1 | `327f2280` | 【至急】運用管理者にエスカレーションし、システム全体の利用可否を確認してください。 |
| 🟠 action_required | `http_500` | **Staff_Attendance** | 1 | `2ff10a86` | [Staff_Attendance] の保存フローに関するログを確認し、SharePointのリスト設定と実データの整合性を調査してください。 |
| 🟡 watch | `health_fail` | **Users_Master** | 1 | `c52ff402` | 次回のNightly Patrolまで傾向を様子見（継続監視） |
| 🟡 watch | `drift` | **support_record_daily** | 1 | `1485a11e` | [support_record_daily] に誰かがフィールドを直接追加・削除した可能性を調査してください。 |


<details>
<summary><b>🟢 Silent / Absorbed Events (2)</b></summary>

_These events were safely absorbed by system resilience features (e.g., Strategy E, 8KB Limits). No action is required._

| Event Type | Resource | Occurrences | Fingerprint | Ref |
| --- | --- | :---: | --- | --- |
| `provision_skipped:block` | **UserBenefit_Profile** | 2 | `f4a385a4` | Prevented creation to avoid 8KB limits. |
| `drift` | **UserBenefit_Profile** | 1 | `0dacad70` | Strategy E absorbed it. |

</details>
