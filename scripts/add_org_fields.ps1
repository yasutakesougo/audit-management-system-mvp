# PnP PowerShell script to add Org lookup and duplicated fields to Schedules list
# Usage:
# pwsh
# Install-Module PnP.PowerShell -Scope CurrentUser
# Connect-PnPOnline -Url "https://isogokatudouhome.sharepoint.com/sites/welfare" -Interactive
# ./scripts/add_org_fields.ps1

# Add Lookup field to Org_Master Title
Add-PnPField -List "Schedules" `
    -DisplayName "OrgLookup" `
    -InternalName "OrgLookup" `
    -Type Lookup `
    -LookupList "Org_Master" `
    -LookupField "Title" `
    -AddToDefaultView

# Add duplicated columns
Add-PnPField -List "Schedules" -DisplayName "OrgCode" -InternalName "OrgCode" -Type Text
Add-PnPField -List "Schedules" -DisplayName "OrgType" -InternalName "OrgType" -Type Choice -Choices "internal", "external", "partner"
Add-PnPField -List "Schedules" -DisplayName "Audience" -InternalName "Audience" -Type Choice -Choices "user", "staff", "both"
Add-PnPField -List "Schedules" -DisplayName "LocationName" -InternalName "LocationName" -Type Text

Write-Host "Fields added. Verify in SharePoint list settings."