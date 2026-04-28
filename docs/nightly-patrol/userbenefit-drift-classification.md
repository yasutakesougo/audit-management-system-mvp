# UserBenefit Profile Schema Drift Classification

Related: #1632

## Scope

- UserBenefit_Profile
- UserBenefit_Profile_Ext

## Classification Policy

| Classification | Meaning | Action |
|---|---|---|
| canonical | 現在の正規フィールド | 維持 |
| accepted_alias | drift吸収のため許容している別名 | FIELD_MAP / resolver に明示 |
| zombie_cleanup_candidate | データなし・利用なしの削除候補 | 別Issueで安全パージ |
| protected_system | SharePoint base/system により削除不可 | Purge対象から除外 |
| ignored_system | SharePoint computed/system field | drift判定から除外 |
| optional_missing_or_provision_candidate | optional列不足・Provision候補 | Provision計画へ分離 |
| needs_manual_review | 判定保留 | 実列・usage確認後に再分類 |

## UserBenefit_Profile

| Field | Current Signal | Classification | Reason | Next Action |
|---|---|---|---|---|
| Title | fuzzy_match (usage: 412) | canonical | Mapped to UserID in registry | None |
| Grant_x0020_Municipality | fuzzy_match (usage: 2) | canonical | Mapped to GrantMunicipality | None |
| Grant_x0020_Period_x0020_Start | fuzzy_match (usage: 2) | canonical | Mapped to GrantPeriodStart | None |
| Grant_x0020_Period_x0020_End | fuzzy_match (usage: 2) | canonical | Mapped to GrantPeriodEnd | None |
| User_x0020_Copay_x0020_Limit | fuzzy_match (usage: 2) | canonical | Mapped to UserCopayLimit | None |
| Meal_x0020_Addition | fuzzy_match (usage: 2) | canonical | Mapped to MealAddition | None |
| Copay_x0020_Payment_x0020_Method | fuzzy_match (usage: 2) | canonical | Mapped to CopayPaymentMethod | None |
| RecipientCertExpiry | optional_missing | optional_missing_or_provision_candidate | Missing in SharePoint | Provision |
| DisabilitySupportLevel | optional_missing | optional_missing_or_provision_candidate | Missing in SharePoint | Provision |
| GrantedDaysPerMonth | optional_missing | optional_missing_or_provision_candidate | Missing in SharePoint | Provision |
| LinkTitle2 | zombie_candidate (usage: 0) | protected_system | SharePoint base/system (`readonly_field`,`canBeDeleted_false`,`fromBaseType_true`) | Exclude from purge |
| SelectTitle | zombie_candidate (usage: 1) | ignored_system | SharePoint computed system field (`SP_SYSTEM_FIELDS`) | Ignore in drift decisions |
| Last_x0020_Modified | zombie_candidate (usage: 1) | ignored_system | SharePoint computed system field (`SP_SYSTEM_FIELDS`) | Ignore in drift decisions |
| Created_x0020_Date | zombie_candidate (usage: 1) | ignored_system | SharePoint computed system field (`SP_SYSTEM_FIELDS`) | Ignore in drift decisions |
| FSObjType | zombie_candidate (usage: 1) | accepted_alias | System field | None |
| PermMask | zombie_candidate (usage: 0) | protected_system | SharePoint base/system (`readonly_field`,`canBeDeleted_false`,`fromBaseType_true`) | Exclude from purge |
| PrincipalCount | zombie_candidate (usage: 0) | protected_system | SharePoint base/system (`readonly_field`,`canBeDeleted_false`,`fromBaseType_true`) | Exclude from purge |
| ProgId | zombie_candidate (usage: 1) | accepted_alias | System field | None |
| LinkFilenameNoMenu | zombie_candidate (usage: 1) | accepted_alias | System field | None |
| LinkFilename | zombie_candidate (usage: 1) | accepted_alias | System field | None |
| LinkFilename2 | zombie_candidate (usage: 0) | protected_system | SharePoint base/system (`readonly_field`,`canBeDeleted_false`,`fromBaseType_true`) | Exclude from purge |
| ServerUrl | zombie_candidate (usage: 1) | accepted_alias | System field | None |
| EncodedAbsUrl | zombie_candidate (usage: 1) | accepted_alias | System field | None |
| BaseName | zombie_candidate (usage: 1) | accepted_alias | System field | None |

## UserBenefit_Profile_Ext

| Field | Current Signal | Classification | Reason | Next Action |
|---|---|---|---|---|
| Title | fuzzy_match (usage: 412) | canonical | Mapped to UserID in registry | None |
| Recipient_x0020_Cert_x0020_Numbe | fuzzy_match (usage: 0) | accepted_alias | Mapped to RecipientCertNumber | Maintain mapping |
| UserID | zombie_candidate (usage: 399) | accepted_alias | Backward-compatible alias for ext join key (canonical is Title) | Keep as accepted alias |
| Recipient_x0020_Cert_x0020_Expir | zombie_candidate (usage: 0) | zombie_cleanup_candidate | No data, no usage | Purge |
| Disability_x0020_Support_x0020_L | zombie_candidate (usage: 0) | zombie_cleanup_candidate | No data, no usage | Purge |
| LinkTitle2 | zombie_candidate (usage: 0) | protected_system | SharePoint base/system (`readonly_field`,`canBeDeleted_false`,`fromBaseType_true`) | Exclude from purge |
| SelectTitle | zombie_candidate (usage: 1) | ignored_system | SharePoint computed system field (`SP_SYSTEM_FIELDS`) | Ignore in drift decisions |
| Last_x0020_Modified | zombie_candidate (usage: 1) | ignored_system | SharePoint computed system field (`SP_SYSTEM_FIELDS`) | Ignore in drift decisions |
| Created_x0020_Date | zombie_candidate (usage: 1) | ignored_system | SharePoint computed system field (`SP_SYSTEM_FIELDS`) | Ignore in drift decisions |
| FSObjType | zombie_candidate (usage: 1) | accepted_alias | System field | None |
| PermMask | zombie_candidate (usage: 0) | protected_system | SharePoint base/system (`readonly_field`,`canBeDeleted_false`,`fromBaseType_true`) | Exclude from purge |
| PrincipalCount | zombie_candidate (usage: 0) | protected_system | SharePoint base/system (`readonly_field`,`canBeDeleted_false`,`fromBaseType_true`) | Exclude from purge |
| ProgId | zombie_candidate (usage: 1) | accepted_alias | System field | None |
| LinkFilenameNoMenu | zombie_candidate (usage: 1) | accepted_alias | System field | None |
| LinkFilename | zombie_candidate (usage: 1) | accepted_alias | System field | None |
| LinkFilename2 | zombie_candidate (usage: 0) | protected_system | SharePoint base/system (`readonly_field`,`canBeDeleted_false`,`fromBaseType_true`) | Exclude from purge |
| ServerUrl | zombie_candidate (usage: 1) | accepted_alias | System field | None |
| EncodedAbsUrl | zombie_candidate (usage: 1) | accepted_alias | System field | None |
| BaseName | zombie_candidate (usage: 1) | accepted_alias | System field | None |
