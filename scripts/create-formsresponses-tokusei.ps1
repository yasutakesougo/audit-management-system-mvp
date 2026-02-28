param(
    [Parameter(Mandatory = $true)]
    [string]$SiteUrl,
    [string]$ListTitle = "FormsResponses_Tokusei"
)

Import-Module PnP.PowerShell -ErrorAction Stop

Write-Host "Connecting to $SiteUrl ..." -ForegroundColor Cyan

$list = Get-PnPList -Identity $ListTitle -ErrorAction SilentlyContinue
if (-not $list) {
    Write-Host "Creating list '$ListTitle' ..." -ForegroundColor Cyan
    New-PnPList -Title $ListTitle -Template GenericList -OnQuickLaunch | Out-Null
}
else {
    Write-Host "List '$ListTitle' already exists. Skipping creation." -ForegroundColor Yellow
}

function Set-TextField {
    param(
        [string]$DisplayName,
        [string]$InternalName,
        [string]$Type = "Text"
    )

    $exists = Get-PnPField -List $ListTitle -Identity $InternalName -ErrorAction SilentlyContinue
    if ($exists) {
        Write-Host "Field '$InternalName' already exists. Skipping." -ForegroundColor Yellow
        return
    }

    Write-Host "Adding field '$InternalName' ($DisplayName) Type=$Type ..." -ForegroundColor Green
    Add-PnPField -List $ListTitle -DisplayName $DisplayName -InternalName $InternalName -Type $Type | Out-Null
}

Set-TextField -DisplayName "FormRowId (Excel ID)" -InternalName "FormRowId" -Type "Number"
Set-TextField -DisplayName "開始時刻" -InternalName "StartTime" -Type "DateTime"
Set-TextField -DisplayName "完了時刻" -InternalName "EndTime" -Type "DateTime"
Set-TextField -DisplayName "メール" -InternalName "ResponderEmail" -Type "Text"
Set-TextField -DisplayName "回答者名" -InternalName "ResponderName" -Type "Text"
Set-TextField -DisplayName "記入日" -InternalName "FillDate" -Type "DateTime"
Set-TextField -DisplayName "対象者の名前" -InternalName "TargetUserName" -Type "Text"
Set-TextField -DisplayName "回答ID" -InternalName "ResponseId" -Type "Text"
Set-TextField -DisplayName "保護者名" -InternalName "GuardianName" -Type "Text"
Set-TextField -DisplayName "続柄" -InternalName "Relation" -Type "Text"
Set-TextField -DisplayName "身長(cm)" -InternalName "HeightCm" -Type "Number"
Set-TextField -DisplayName "体重(kg)" -InternalName "WeightKg" -Type "Number"
Set-TextField -DisplayName "人や集団との関係に難しさがある" -InternalName "RelationalDifficulties" -Type "Note"
Set-TextField -DisplayName "状況の理解が難しい" -InternalName "SituationalUnderstanding" -Type "Note"
Set-TextField -DisplayName "聴覚" -InternalName "Hearing" -Type "Note"
Set-TextField -DisplayName "視覚" -InternalName "Vision" -Type "Note"
Set-TextField -DisplayName "触覚" -InternalName "Touch" -Type "Note"
Set-TextField -DisplayName "嗅覚（臭覚）" -InternalName "Smell" -Type "Note"
Set-TextField -DisplayName "味覚" -InternalName "Taste" -Type "Note"
Set-TextField -DisplayName "該当するもの（感覚）" -InternalName "SensoryMultiSelect" -Type "Note"
Set-TextField -DisplayName "記述式回答欄（感覚）" -InternalName "SensoryFreeText" -Type "Note"
Set-TextField -DisplayName "変化への対応が困難" -InternalName "DifficultyWithChanges" -Type "Note"
Set-TextField -DisplayName "物の一部に対する強い興味" -InternalName "InterestInParts" -Type "Note"
Set-TextField -DisplayName "同じ行動を繰り返す" -InternalName "RepetitiveBehaviors" -Type "Note"
Set-TextField -DisplayName "特定の習慣に固執する" -InternalName "FixedHabits" -Type "Note"
Set-TextField -DisplayName "理解が難しい（コミュニケーション）" -InternalName "ComprehensionDifficulty" -Type "Note"
Set-TextField -DisplayName "発信が難しい" -InternalName "ExpressionDifficulty" -Type "Note"
Set-TextField -DisplayName "やり取りが難しい" -InternalName "InteractionDifficulty" -Type "Note"
Set-TextField -DisplayName "具体的な行動（選択）" -InternalName "BehaviorMultiSelect" -Type "Note"
Set-TextField -DisplayName "行動のエピソード" -InternalName "BehaviorEpisodes" -Type "Note"
Set-TextField -DisplayName "得意なこと・強み等" -InternalName "Strengths" -Type "Note"
Set-TextField -DisplayName "その他特記事項" -InternalName "Notes" -Type "Note"

Write-Host "List schema ensured." -ForegroundColor Cyan
