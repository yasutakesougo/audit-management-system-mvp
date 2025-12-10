param(
    [Parameter(Mandatory = $true)]
    [string]$SiteUrl,
    [string]$ListTitle = "FormsResponses_Tokusei",
    [Parameter(Mandatory = $true)]
    [string]$ExcelPath
)

Import-Module PnP.PowerShell -ErrorAction Stop
Import-Module ImportExcel   -ErrorAction Stop

# Converts Excel serial/date strings into DateTime objects that SharePoint accepts.
function Convert-ExcelDate {
    param($Value)

    if (-not $Value) {
        return $null
    }

    if ($Value -is [DateTime]) {
        return $Value
    }

    if ($Value -is [double] -or $Value -is [int]) {
        return [DateTime]::FromOADate([double]$Value)
    }

    try {
        return [DateTime]::Parse($Value)
    }
    catch {
        Write-Host "[WARN] Could not parse '$Value' as DateTime" -ForegroundColor Yellow
        return $null
    }
}

Write-Host "Connecting to $SiteUrl ..." -ForegroundColor Cyan

Write-Host "Reading Excel: $ExcelPath" -ForegroundColor Cyan
$data = Import-Excel -Path $ExcelPath

$index = 0
foreach ($row in $data) {
    $index++
    $title = $row.'対象者の名前'

    $values = @{
        "Title"                    = if ($title) { $title } elseif ($row.ID) { "Tokusei-$($row.ID)" } else { "Tokusei-$index" }
        "FormRowId"                = $row.ID
        "StartTime"                = Convert-ExcelDate $row.'開始時刻'
        "EndTime"                  = Convert-ExcelDate $row.'完了時刻'
        "ResponderEmail"           = $row.'メール'
        "ResponderName"            = $row.'名前'
        "FillDate"                 = Convert-ExcelDate $row.'記入日'
        "TargetUserName"           = $row.'対象者の名前'
        "RelationalDifficulties"   = $row.'人や集団との関係に難しさがある'
        "SituationalUnderstanding" = $row.'状況の理解が難しい'
        "Hearing"                  = $row.'聴覚'
        "Vision"                   = $row.'視覚'
        "Touch"                    = $row.'触覚'
        "Smell"                    = $row.'嗅覚（臭覚）'
        "Taste"                    = $row.'味覚'
        "SensoryMultiSelect"       = $row.'該当するもの'
        "SensoryFreeText"          = $row.'記述式回答欄'
        "DifficultyWithChanges"    = $row.'変化への対応が困難'
        "InterestInParts"          = $row.'物の一部に対する強い興味'
        "RepetitiveBehaviors"      = $row.'同じ行動を繰り返す'
        "FixedHabits"              = $row.'特定の習慣に固執する'
        "ComprehensionDifficulty"  = $row.'理解が難しい'
        "ExpressionDifficulty"     = $row.'発信が難しい'
        "InteractionDifficulty"    = $row.'やり取りが難しい'
        "BehaviorMultiSelect"      = $row.'以下の具体的な行動例について、該当するものをすべて選択してください。'
        "BehaviorEpisodes"         = $row.'該当する行動について具体的なエピソードや詳細をご記入ください。（任意）'
        "Strengths"                = $row.'対象者の得意なこと・強み・できること・好きなことなど'
        "Notes"                    = $row.'その他特記事項'
    }

    Write-Host "[$index] Adding item for $title ..." -ForegroundColor Green
    try {
        Add-PnPListItem -List $ListTitle -Values $values | Out-Null
    }
    catch {
        Write-Host "[ERROR] Failed to add item for $title (row $index)" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Yellow
        if ($_.Exception.InnerException) {
            Write-Host $_.Exception.InnerException.Message -ForegroundColor Yellow
        }
        throw
    }
}

Write-Host "Import completed. Total rows: $index" -ForegroundColor Cyan
