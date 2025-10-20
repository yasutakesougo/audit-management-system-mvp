# Users_Master Ensure Script
param(
    [Parameter(Mandatory = $true)]
    [string]$SiteUrl,
    [Parameter(Mandatory = $false)]
    [string]$ListTitle = 'Users_Master'
)

$ErrorActionPreference = 'Stop'

$listTitle = $ListTitle

function Write-Info {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Cyan
}

function Write-Warn {
    param([string]$Message)
    Write-Warning $Message
}

try {
    Write-Info "Connecting to $SiteUrl ..."
    Connect-PnPOnline -Url $SiteUrl -Interactive
    Write-Info "Connected."
}
catch {
    Write-Error "Failed to connect to $SiteUrl. $_"
    exit 1
}

try {
    $list = Get-PnPList -Identity $listTitle -ErrorAction Stop
    Write-Info "Found existing list: $listTitle"
}
catch {
    Write-Info "List $listTitle not found. Creating..."
    try {
        $list = Add-PnPList -Title $listTitle -Template GenericList -OnQuickLaunch:$false
        Write-Info "Created list $listTitle"
    }
    catch {
        Write-Warn "Failed to create list Users_Master. $_"
        exit 1
    }
}

# Hide the default Title field and remove from default view
try {
    $titleField = Get-PnPField -List $list -Identity "Title" -ErrorAction Stop
    if (-not $titleField.Hidden -or $titleField.Required) {
        Set-PnPField -List $list -Identity "Title" -Values @{ Hidden = $true; Required = $false }
        Write-Info "Updated Title field: hidden and non-required"
    }

    $defaultView = Get-PnPView -List $list -Identity "All Items" -ErrorAction SilentlyContinue
    if ($null -ne $defaultView -and $defaultView.ViewFields -contains "Title") {
        $newFields = $defaultView.ViewFields | Where-Object { $_ -ne "Title" }
        Set-PnPView -List $list -Identity $defaultView -Fields $newFields
        Write-Info "Removed Title field from default view"
    }
}
catch {
    Write-Warn "Failed to adjust Title field. $_"
}

$fieldsToEnsure = @(
    @{ InternalName = "UserID"; DisplayName = "利用者ID"; Type = "Text"; Required = $true },
    @{ InternalName = "FullName"; DisplayName = "氏名"; Type = "Text"; Required = $true },
    @{ InternalName = "ContractDate"; DisplayName = "契約日"; Type = "DateTime"; Required = $false },
    @{ InternalName = "IsHighIntensitySupportTarget"; DisplayName = "強度行動障害対象"; Type = "Boolean"; Required = $false; DefaultValue = "0" },
    @{ InternalName = "ServiceStartDate"; DisplayName = "利用開始日"; Type = "DateTime"; Required = $false },
    @{ InternalName = "ServiceEndDate"; DisplayName = "利用終了日"; Type = "DateTime"; Required = $false }
)

foreach ($fieldSpec in $fieldsToEnsure) {
    $internalName = $fieldSpec.InternalName
    try {
        $field = Get-PnPField -List $list -Identity $internalName -ErrorAction Stop
        $updates = @{}

        if ($field.Required -ne $fieldSpec.Required) {
            $updates.Required = $fieldSpec.Required
        }

        if ($field.TypeAsString -ne $fieldSpec.Type) {
            Write-Warn "Field $internalName exists with type $($field.TypeAsString); expected $($fieldSpec.Type)."
        }

        if ($fieldSpec.ContainsKey("DefaultValue") -and $field.DefaultValue -ne $fieldSpec.DefaultValue) {
            $updates.DefaultValue = $fieldSpec.DefaultValue
        }

        if ($updates.Count -gt 0) {
            Set-PnPField -List $list -Identity $internalName -Values $updates
            Write-Info "Updated $($fieldSpec.Type): $internalName"
        }
        else {
            Write-Info "No changes needed for $($fieldSpec.Type): $internalName"
        }
    }
    catch {
        try {
            $params = @{
                List         = $list
                DisplayName  = $fieldSpec.DisplayName
                InternalName = $internalName
                Type         = $fieldSpec.Type
            }

            if ($fieldSpec.Type -eq "DateTime") {
                $params += @{ AddToDefaultView = $true }
            }

            if ($fieldSpec.Type -eq "Boolean") {
                $params += @{ AddToDefaultView = $true }
            }

            Add-PnPField @params | Out-Null
            Write-Info "Added $($fieldSpec.Type): $internalName"

            $setValues = @{ Required = $fieldSpec.Required }
            if ($fieldSpec.ContainsKey("DefaultValue")) {
                $setValues.DefaultValue = $fieldSpec.DefaultValue
            }

            Set-PnPField -List $list -Identity $internalName -Values $setValues
        }
        catch {
            Write-Warn "Failed to ensure field $internalName. $_"
        }
    }
}

$additionalTextColumns = @(
    @{ InternalName = 'furigana'; DisplayName = 'ふりがな'; MaxLength = 255 },
    @{ InternalName = 'phone'; DisplayName = '電話番号'; MaxLength = 64 },
    @{ InternalName = 'email'; DisplayName = 'メール'; MaxLength = 255 }
)

foreach ($column in $additionalTextColumns) {
    if (-not (Get-PnPField -List $listTitle -Identity $column.InternalName -ErrorAction SilentlyContinue)) {
        Add-PnPField -List $listTitle -DisplayName $column.DisplayName -InternalName $column.InternalName -Type Text -AddToDefaultView -Values @{ MaxLength = $column.MaxLength } | Out-Null
        Write-Info "Added Text field: $($column.InternalName)"
    }
    else {
        Write-Info "Field already exists: $($column.InternalName)"
    }
}

if (-not (Get-PnPField -List $listTitle -Identity 'isActive' -ErrorAction SilentlyContinue)) {
    Add-PnPField -List $listTitle -DisplayName '有効' -InternalName 'isActive' -Type Boolean -AddToDefaultView -Values @{ DefaultValue = '1' } | Out-Null
    Write-Info 'Added Boolean field: isActive (Default=true)'
}
else {
    Write-Info 'Field already exists: isActive'
}

$items = Get-PnPListItem -List $listTitle -PageSize 2000
foreach ($item in $items) {
    $titleValue = $item['Title']
    $fullNameValue = $item['FullName']
    if ([string]::IsNullOrEmpty($titleValue) -and -not [string]::IsNullOrEmpty($fullNameValue)) {
        Set-PnPListItem -List $listTitle -Identity $item.Id -Values @{ 'Title' = $fullNameValue } | Out-Null
        Write-Info "Backfilled Title for item $($item.Id)"
    }
}

Write-Info 'Users_Master ensure complete.'
