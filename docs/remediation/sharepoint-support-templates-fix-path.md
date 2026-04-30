# Remediation Path: Resolving SupportTemplates Provisioning and 403 Forbidden

This guide provides the necessary steps to resolve the infrastructure drift (missing `SupportTemplates` list) and the access control error (403 Forbidden) identified in the production SharePoint environment.

## 1. Resolve 403 Forbidden (Admin Access)
If you are seeing a "Permission Denied" or "403 Forbidden" error on `/admin/status`, follow these steps:

1. **Verify Runtime Configuration**:
   Check the `env.runtime.json` file in your production environment (or `env.runtime.local.json` for local tests).
   Ensure `VITE_SCHEDULE_ADMINS_GROUP_ID` is set to the correct Microsoft Entra (Azure AD) Group ID.

2. **Verify Group Membership**:
   Confirm that your current user account is a member of the group specified in `VITE_SCHEDULE_ADMINS_GROUP_ID`.

3. **Check the Improved Error Message**:
   The `RequireAudience` component has been updated to display the "Expected Group ID". Use this to verify if the application is reading the correct configuration value.

## 2. Provision Missing SupportTemplates List
The `SupportTemplates` list is required for the system but was found to be missing from the site.

### Steps to Provision:
Run the following PowerShell command from the project root. This will identify missing lists/fields and create them automatically.

> [!IMPORTANT]
> This command requires **PnP.PowerShell** module. If not installed, run: `Install-Module PnP.PowerShell -Scope CurrentUser`.

```powershell
# Dry Run (Verification Only)
.\scripts\sp-preprod\provision-missing-lists.ps1 `
    -SiteUrl "YOUR_SHAREPOINT_SITE_URL" `
    -ManifestPath ".\scripts\sp-preprod\lists.manifest.json" `
    -InteractiveLogin `
    -WhatIfMode

# Actual Provisioning
.\scripts\sp-preprod\provision-missing-lists.ps1 `
    -SiteUrl "YOUR_SHAREPOINT_SITE_URL" `
    -ManifestPath ".\scripts\sp-preprod\lists.manifest.json" `
    -InteractiveLogin
```

### Verified Schema (from `lists.manifest.json`):
- **Internal Name**: `SupportTemplates`
- **Fields with '0' Suffix**: `UserCode0`, `RowNo0`, `TimeSlot0`, `Activity0`, `PersonManual0`, `SupporterManual0`

## 3. Verify Resolution
After provisioning, navigate back to the **Admin Status Hub** (`/admin/status`) and click **"再実行" (Re-run)**.

- **Lists Status**: `SupportTemplates` should now report **PASS**.
- **Schema Status**: Field names like `UserCode0` will be validated against the registry.

---
**Status Update (2026-04-30)**:
- [x] Registry Definition Updated (`spListRegistry.definitions.ts`)
- [x] Auth Failure Feedback Improved (`useUserAuthz.ts`, `RequireAudience.tsx`)
- [ ] List Provisioning Execution (Manual Action Required)
