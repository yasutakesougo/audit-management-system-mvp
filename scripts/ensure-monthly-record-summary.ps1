# MonthlyRecord_Summary Ensure Script
# 月次集計記録リストの自動作成・列定義スクリプト
param(
    [Parameter(Mandatory = $true)]
    [string]$SiteUrl,
    [Parameter(Mandatory = $false)]
    [string]$ListTitle = 'MonthlyRecord_Summary'
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

function Write-Success {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Green
}

try {
    Write-Info "Connecting to $SiteUrl ..."
    Connect-PnPOnline -Url $SiteUrl -Interactive
    Write-Success "Connected to SharePoint site."
}
catch {
    Write-Error "Failed to connect to $SiteUrl. $_"
    exit 1
}

# リスト存在確認・作成
try {
    $list = Get-PnPList -Identity $listTitle -ErrorAction Stop
    Write-Info "Found existing list: $listTitle"
}
catch {
    Write-Info "List $listTitle not found. Creating..."
    try {
        $list = Add-PnPList -Title $listTitle -Template GenericList -OnQuickLaunch:$false
        Write-Success "Created list: $listTitle"
    }
    catch {
        Write-Error "Failed to create list $listTitle. $_"
        exit 1
    }
}

# デフォルトTitle列の非表示化
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

# 月次記録サマリー用フィールド定義
$fieldsToEnsure = @(
    # ユーザー識別
    @{ InternalName = "UserCode"; DisplayName = "利用者コード"; Type = "Text"; Required = $true; MaxLength = 50; Indexed = $true },
    @{ InternalName = "DisplayName"; DisplayName = "表示名"; Type = "Text"; Required = $true; MaxLength = 255 },

    # 集計期間
    @{ InternalName = "YearMonth"; DisplayName = "年月"; Type = "Text"; Required = $true; MaxLength = 7; Indexed = $true; Description = "YYYY-MM形式" },

    # 集計KPI
    @{ InternalName = "TotalDays"; DisplayName = "対象日数"; Type = "Number"; Required = $true; Description = "月内の営業日数" },
    @{ InternalName = "PlannedRows"; DisplayName = "予定行数"; Type = "Number"; Required = $true; Description = "計画された記録行数" },
    @{ InternalName = "CompletedRows"; DisplayName = "完了行数"; Type = "Number"; Required = $true; Description = "実際に記録された行数" },
    @{ InternalName = "CompletionRate"; DisplayName = "完了率"; Type = "Number"; Required = $true; Description = "完了率（0.0-1.0）" },
    @{ InternalName = "SpecialNotesCount"; DisplayName = "特記事項数"; Type = "Number"; Required = $false; Description = "特記事項が記録された件数" },

    # 期間情報
    @{ InternalName = "FirstEntryDate"; DisplayName = "初回記録日"; Type = "DateTime"; Required = $false; Description = "月内で最初に記録された日" },
    @{ InternalName = "LastEntryDate"; DisplayName = "最終記録日"; Type = "DateTime"; Required = $false; Description = "月内で最後に記録された日" },

    # システム管理
    @{ InternalName = "LastUpdated"; DisplayName = "最終更新"; Type = "DateTime"; Required = $true; Description = "UTC時刻" },
    @{ InternalName = "IdempotencyKey"; DisplayName = "冪等キー"; Type = "Text"; Required = $true; MaxLength = 128; Indexed = $true; EnforceUnique = $true; Description = "UserCode_YearMonth" },
    @{ InternalName = "AggregationSource"; DisplayName = "集計ソース"; Type = "Text"; Required = $false; MaxLength = 50; Description = "UI/PowerAutomate/Batch" }
)

# フィールド作成・更新
foreach ($fieldSpec in $fieldsToEnsure) {
    $internalName = $fieldSpec.InternalName
    try {
        # 既存フィールドの確認・更新
        $field = Get-PnPField -List $list -Identity $internalName -ErrorAction Stop
        $updates = @{}

        if ($field.Required -ne $fieldSpec.Required) {
            $updates.Required = $fieldSpec.Required
        }

        if ($field.TypeAsString -ne $fieldSpec.Type) {
            Write-Warn "Field $internalName exists with type $($field.TypeAsString); expected $($fieldSpec.Type). Skipping type change."
        }

        # Number型の場合、小数点設定
        if ($fieldSpec.Type -eq "Number" -and $internalName -eq "CompletionRate") {
            # 完了率は小数点2桁まで表示
            if ($field.SchemaXml -notmatch 'Decimals="2"') {
                Write-Info "Completion rate field needs decimal precision adjustment"
            }
        }

        if ($updates.Count -gt 0) {
            Set-PnPField -List $list -Identity $internalName -Values $updates
            Write-Info "Updated field: $internalName"
        }
        else {
            Write-Info "No changes needed for field: $internalName"
        }
    }
    catch {
        # 新規フィールド作成
        try {
            $params = @{
                List             = $list
                DisplayName      = $fieldSpec.DisplayName
                InternalName     = $internalName
                Type             = $fieldSpec.Type
                AddToDefaultView = $true
            }

            # フィールドタイプ別の追加パラメータ
            if ($fieldSpec.ContainsKey("MaxLength")) {
                $params.Values = @{ MaxLength = $fieldSpec.MaxLength }
            }

            if ($fieldSpec.ContainsKey("Description")) {
                if (-not $params.ContainsKey("Values")) { $params.Values = @{} }
                $params.Values.Description = $fieldSpec.Description
            }

            # インデックス設定
            if ($fieldSpec.ContainsKey("Indexed") -and $fieldSpec.Indexed) {
                if (-not $params.ContainsKey("Values")) { $params.Values = @{} }
                $params.Values.Indexed = $true
            }

            # ユニーク制約
            if ($fieldSpec.ContainsKey("EnforceUnique") -and $fieldSpec.EnforceUnique) {
                if (-not $params.ContainsKey("Values")) { $params.Values = @{} }
                $params.Values.EnforceUniqueValues = $true
            }

            # Number型の小数点設定
            if ($fieldSpec.Type -eq "Number" -and $internalName -eq "CompletionRate") {
                if (-not $params.ContainsKey("Values")) { $params.Values = @{} }
                $params.Values.Decimals = 2
                $params.Values.Min = 0
                $params.Values.Max = 1
            }

            Add-PnPField @params | Out-Null
            Write-Success "Added $($fieldSpec.Type) field: $internalName"

            # フィールド作成後の追加設定
            $setValues = @{ Required = $fieldSpec.Required }
            Set-PnPField -List $list -Identity $internalName -Values $setValues
        }
        catch {
            Write-Warn "Failed to ensure field $internalName. $_"
        }
    }
}

# デフォルトビューの調整（主要列のみ表示）
try {
    $defaultView = Get-PnPView -List $list -Identity "All Items" -ErrorAction SilentlyContinue
    if ($null -ne $defaultView) {
        $primaryFields = @(
            "DisplayName",
            "YearMonth",
            "CompletionRate",
            "TotalDays",
            "CompletedRows",
            "LastUpdated"
        )

        Set-PnPView -List $list -Identity $defaultView -Fields $primaryFields
        Write-Info "Updated default view with primary fields"
    }
}
catch {
    Write-Warn "Failed to update default view. $_"
}

# リスト権限の設定（管理者グループのみ書き込み可能）
try {
    # サイト管理者グループを取得
    $adminGroup = Get-PnPGroup | Where-Object { $_.Title -like "*Owner*" -or $_.Title -like "*管理*" } | Select-Object -First 1

    if ($null -ne $adminGroup) {
        # 継承を切断して独自権限を設定
        Set-PnPList -Identity $list -BreakRoleInheritance:$true -CopyRoleAssignments:$false

        # 管理者グループにフルコントロール権限
        Set-PnPListPermission -Identity $list -Group $adminGroup.Title -AddRole "Full Control"

        # 全員に読み取り権限
        Set-PnPListPermission -Identity $list -Group "Everyone" -AddRole "Read" -ErrorAction SilentlyContinue

        Write-Success "Set list permissions: Admin write, Everyone read"
    }
}
catch {
    Write-Warn "Failed to set list permissions. $_"
}

# 成功メッセージとサマリー
Write-Success "`n=== MonthlyRecord_Summary List Setup Complete ==="
Write-Info "List Title: $listTitle"
Write-Info "Site URL: $SiteUrl"
Write-Info "Key Features:"
Write-Info "  ✓ User identification (UserCode, DisplayName)"
Write-Info "  ✓ Monthly aggregation period (YearMonth)"
Write-Info "  ✓ KPI metrics (completion rates, planned vs actual)"
Write-Info "  ✓ Temporal tracking (FirstEntry, LastEntry, LastUpdated)"
Write-Info "  ✓ Idempotency support (IdempotencyKey with unique constraint)"
Write-Info "  ✓ Indexed fields for performance (UserCode, YearMonth, IdempotencyKey)"
Write-Info "  ✓ Admin-only write permissions"

Write-Success "`nReady for Power Automate integration and aggregate.ts upsert operations!"