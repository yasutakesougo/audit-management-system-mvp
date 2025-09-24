param(
  [Parameter(Mandatory = $true)]
  [Alias('SiteRelativeUrl','SitePath')]
  [string]$SiteUrl,
  [bool]$RecreateExisting = $false,
  [bool]$ApplyFieldUpdates = $true,
  [bool]$ForceTypeReplace = $false,
  [switch]$WhatIfMode,
  [string]$SchemaPath = 'provision/schema.json',
  [string]$ChangesOutPath = 'provision/changes.json',
  [switch]$EmitChanges
)

# ==========================
# SharePoint Provision Script (clean version)
# Adds optional JSON artifact output for WhatIf / audit
# ==========================

$ErrorActionPreference = 'Stop'
$SummaryPath = $env:GITHUB_STEP_SUMMARY
$GLOBAL:Changes = New-Object System.Collections.Generic.List[string]

# WhatIf wiring: local flag and default propagation to cmdlets
$whatIf = $WhatIfMode.IsPresent
$PSDefaultParameterValues["*:WhatIf"] = $whatIf

function Note([string]$msg) {
  Write-Host $msg
  if ($SummaryPath) { Add-Content -Path $SummaryPath -Value $msg }
}

function LogChange([string]$line) {
  $GLOBAL:Changes.Add($line)
  if ($SummaryPath) { Add-Content -Path $SummaryPath -Value $line }
}

. "$PSScriptRoot/provision-choice.ps1"

function ValidateSchema($schema) {
  if (-not $schema.lists) { throw "schema.json: 'lists' missing" }
  foreach ($l in $schema.lists) {
    if (-not $l.title) { throw "schema.json: list.title missing" }
    if (-not $l.fields) { throw "schema.json: list '$($l.title)' fields missing" }
    foreach ($f in $l.fields) {
      if (-not $f.displayName -or -not $f.internalName -or -not $f.type) {
        throw "schema.json: list '$($l.title)' field missing displayName/internalName/type" }
    }
  }
}

function EnsureList {
  param([Parameter(Mandatory = $true)][string]$Title)
  $list = Get-PnPList -Identity $Title -ErrorAction SilentlyContinue
  if ($list -and $RecreateExisting) {
    $msg = "Recreate list: $Title (delete & create)"
    if ($WhatIfMode) { LogChange $msg; return }
    LogChange $msg
  Remove-PnPList -Identity $Title -Force -WhatIf:$WhatIfMode.IsPresent
    $list = $null
  }
  if (-not $list) {
    $msg = "Create list: $Title"
    if ($WhatIfMode) { LogChange $msg; return }
    LogChange $msg
  New-PnPList -Title $Title -Template GenericList -OnQuickLaunch -WhatIf:$WhatIfMode.IsPresent | Out-Null
  } else {
    LogChange ("List exists: {0}" -f $Title)
  }
}

function GetFieldType {
  param([Parameter(Mandatory = $true)][string]$InternalName, [Parameter(Mandatory = $true)][string]$ListTitle)
  $f = Get-PnPField -List $ListTitle -Identity $InternalName -ErrorAction SilentlyContinue
  if ($f) { return $f.TypeAsString }
  return $null
}

function EnsureLookupField {
  param(
    [Parameter(Mandatory=$true)][string]$ListTitle,
    [Parameter(Mandatory=$true)][string]$DisplayName,
    [Parameter(Mandatory=$true)][string]$InternalName,
    [Parameter(Mandatory=$true)][string]$LookupListTitle,
    [string]$LookupField = 'Title',
    [bool]$AllowMultiple = $false,
    [switch]$AddToDefaultView
  )
  $existingType = GetFieldType -InternalName $InternalName -ListTitle $ListTitle
  if (-not (Get-PnPList -Identity $LookupListTitle -ErrorAction SilentlyContinue)) {
    LogChange "  - Lookup target list missing: $LookupListTitle for $InternalName"; return }
  if (-not $existingType) {
    $msg = "  - Add lookup field: $InternalName -> List=$LookupListTitle Field=$LookupField Multi=$AllowMultiple"
    if ($WhatIfMode) { LogChange $msg; return }
    LogChange $msg
    $multiAttr = if ($AllowMultiple) { 'TRUE' } else { 'FALSE' }
    $xml = "<Field Type='Lookup' DisplayName='$DisplayName' Required='FALSE' EnforceUniqueValues='FALSE' List='$LookupListTitle' ShowField='$LookupField' StaticName='$InternalName' Name='$InternalName' AllowMultipleValues='$multiAttr' />"
  Add-PnPFieldFromXml -List $ListTitle -FieldXml $xml -AddToDefaultView:$AddToDefaultView.IsPresent -WhatIf:$WhatIfMode.IsPresent | Out-Null
    return
  }
  if ($existingType -ne 'Lookup') {
    LogChange ("  - Type mismatch: {0} existing={1} desired=Lookup" -f $InternalName, $existingType)
    if ($ForceTypeReplace) {
      $newName = "${InternalName}_v2"
      if ($WhatIfMode) { LogChange ("    - Replacement: {0} (Lookup)" -f $newName); return }
      $multiAttr = if ($AllowMultiple) { 'TRUE' } else { 'FALSE' }
      $xml = "<Field Type='Lookup' DisplayName='$DisplayName' List='$LookupListTitle' ShowField='$LookupField' StaticName='$newName' Name='$newName' AllowMultipleValues='$multiAttr' />"
  Add-PnPFieldFromXml -List $ListTitle -FieldXml $xml -AddToDefaultView:$AddToDefaultView.IsPresent -WhatIf:$WhatIfMode.IsPresent | Out-Null
      LogChange ("    - Replacement added: {0}" -f $newName)
    } else { LogChange '    - Skipped type change (forceTypeReplace=false)' }
  } else {
    $f = Get-PnPField -List $ListTitle -Identity $InternalName -ErrorAction SilentlyContinue
    if ($f) {
      $currentMulti = ($f.SchemaXml -like '*AllowMultipleValues="TRUE"*')
      if ($AllowMultiple -and -not $currentMulti) {
        if ($WhatIfMode) { LogChange ("  - Lookup multi enable: {0}" -f $InternalName) }
        else {
          $xml = $f.SchemaXml -replace 'AllowMultipleValues="FALSE"','AllowMultipleValues="TRUE"'
          Set-PnPField -List $ListTitle -Identity $InternalName -Values @{ SchemaXml = $xml } -WhatIf:$WhatIfMode.IsPresent | Out-Null
          LogChange ("  - Lookup multi enabled: {0}" -f $InternalName)
        }
      } elseif (-not $AllowMultiple -and $currentMulti) {
        LogChange ("  - Lookup multi disable skipped (would be destructive): {0}" -f $InternalName)
      }
    }
  }
}

function EnsureUserField {
  param(
    [Parameter(Mandatory=$true)][string]$ListTitle,
    [Parameter(Mandatory=$true)][string]$DisplayName,
    [Parameter(Mandatory=$true)][string]$InternalName,
    [bool]$AllowMultiple = $false,
    [string]$PrincipalType = 'User',
    [switch]$AddToDefaultView
  )
  $existingType = GetFieldType -InternalName $InternalName -ListTitle $ListTitle
  $peopleAndGroups = $PrincipalType -in @('SecurityGroup','SharePointGroup','All')
  $selectionMode = if ($peopleAndGroups) { 'PeopleAndGroups' } else { 'PeopleOnly' }
  if (-not $existingType) {
    $msg = "  - Add user field: $InternalName Principal=$PrincipalType Multi=$AllowMultiple"
    if ($WhatIfMode) { LogChange $msg; return }
    LogChange $msg
    $multiAttr = if ($AllowMultiple) { 'TRUE' } else { 'FALSE' }
    $xml = "<Field Type='User' DisplayName='$DisplayName' List='UserInfo' ShowField='ImnName' StaticName='$InternalName' Name='$InternalName' UserSelectionScope='0' UserSelectionMode='$selectionMode' AllowMultipleValues='$multiAttr' />"
  Add-PnPFieldFromXml -List $ListTitle -FieldXml $xml -AddToDefaultView:$AddToDefaultView.IsPresent -WhatIf:$WhatIfMode.IsPresent | Out-Null
    return
  }
  if ($existingType -ne 'User') {
    LogChange ("  - Type mismatch: {0} existing={1} desired=User" -f $InternalName, $existingType)
    if ($ForceTypeReplace) {
      $newName = "${InternalName}_v2"
      if ($WhatIfMode) { LogChange ("    - Replacement: {0} (User)" -f $newName); return }
      $multiAttr = if ($AllowMultiple) { 'TRUE' } else { 'FALSE' }
      $xml = "<Field Type='User' DisplayName='$DisplayName' StaticName='$newName' Name='$newName' UserSelectionMode='$selectionMode' AllowMultipleValues='$multiAttr' />"
  Add-PnPFieldFromXml -List $ListTitle -FieldXml $xml -AddToDefaultView:$AddToDefaultView.IsPresent -WhatIf:$WhatIfMode.IsPresent | Out-Null
      LogChange ("    - Replacement added: {0}" -f $newName)
    } else { LogChange '    - Skipped type change (forceTypeReplace=false)' }
  } else {
    $f = Get-PnPField -List $ListTitle -Identity $InternalName -ErrorAction SilentlyContinue
    if ($f) {
      $currentMulti = ($f.SchemaXml -like '*AllowMultipleValues="TRUE"*')
      if ($AllowMultiple -and -not $currentMulti) {
        if ($WhatIfMode) { LogChange ("  - User multi enable: {0}" -f $InternalName) }
        else {
          $xml = $f.SchemaXml -replace 'AllowMultipleValues="FALSE"','AllowMultipleValues="TRUE"'
          Set-PnPField -List $ListTitle -Identity $InternalName -Values @{ SchemaXml = $xml } -WhatIf:$WhatIfMode.IsPresent | Out-Null
          LogChange ("  - User multi enabled: {0}" -f $InternalName)
        }
      } elseif (-not $AllowMultiple -and $currentMulti) {
        LogChange ("  - User multi disable skipped (would be destructive): {0}" -f $InternalName)
      }
    }
  }
}

# Safe setter ensuring Indexed=true before EnforceUniqueValues=true, honoring -WhatIf
function Set-ListFieldSafe {
  param(
    [Parameter(Mandatory=$true)][string]$ListTitle,
    [Parameter(Mandatory=$true)][string]$InternalName,
    [Parameter(Mandatory=$true)][hashtable]$Values,
    [bool]$WhatIf
  )
  $vals = @{}
  $Values.GetEnumerator() | ForEach-Object { $vals[$_.Key] = $_.Value }
  $wif = [bool]$WhatIf
  $wantsUnique = $false
  if ($vals.ContainsKey('EnforceUniqueValues') -and $vals['EnforceUniqueValues'] -eq $true) { $wantsUnique = $true }
  $isIndexedProvided = $vals.ContainsKey('Indexed')
  $isIndexedTrue = $isIndexedProvided -and ($vals['Indexed'] -eq $true)
  if ($wantsUnique -and -not $isIndexedTrue) {
    Write-Host "Indexing field '$InternalName' on list '$ListTitle' before enabling uniqueness..."
    Set-PnPField -List $ListTitle -Identity $InternalName -Values @{ Indexed = $true } -WhatIf:$wif | Out-Null
    $vals['Indexed'] = $true
  }
  Set-PnPField -List $ListTitle -Identity $InternalName -Values $vals -WhatIf:$wif | Out-Null
}

function SetFieldMetaSafe {
  param(
    [Parameter(Mandatory = $true)][string]$ListTitle,
    [Parameter(Mandatory = $true)][string]$InternalName,
    [string]$DisplayName,
    [string]$Description,
    [string[]]$Choices,
    [object]$Required,
    [object]$EnforceUnique,
    [object]$MaxLength
  )
  if (-not $ApplyFieldUpdates) { return }
  $f = Get-PnPField -List $ListTitle -Identity $InternalName -ErrorAction SilentlyContinue
  if (-not $f) { return }
  $changed = $false
  if ($DisplayName -and $f.Title -ne $DisplayName) { if ($WhatIfMode) { LogChange ("  - Title: {0} -> {1}" -f $InternalName, $DisplayName); $changed = $true } else { Set-ListFieldSafe -ListTitle $ListTitle -InternalName $InternalName -Values @{ Title = $DisplayName } -WhatIf:$whatIf; $changed = $true } }
  if ($Description -and $f.Description -ne $Description) { if ($WhatIfMode) { LogChange ("  - Description update: {0}" -f $InternalName); $changed = $true } else { Set-ListFieldSafe -ListTitle $ListTitle -InternalName $InternalName -Values @{ Description = $Description } -WhatIf:$whatIf; $changed = $true } }
  if ($Choices -and $f.TypeAsString -eq 'Choice') { if ($WhatIfMode) { LogChange ("  - Choices: {0} -> {1}" -f $InternalName, ($Choices -join ', ')); $changed = $true } else { Set-ListFieldSafe -ListTitle $ListTitle -InternalName $InternalName -Values @{ Choices = $Choices } -WhatIf:$whatIf; $changed = $true } }
  if ($null -ne $Required) { $reqVal = [bool]$Required; if ($WhatIfMode) { LogChange ("  - Required: {0} -> {1}" -f $InternalName, $reqVal); $changed = $true } else { Set-ListFieldSafe -ListTitle $ListTitle -InternalName $InternalName -Values @{ Required = $reqVal } -WhatIf:$whatIf; $changed = $true } }
  if ($null -ne $EnforceUnique -and $f.TypeAsString -in @('Text','Number','URL')) { $uniqVal = [bool]$EnforceUnique; if ($WhatIfMode) { LogChange ("  - EnforceUnique: {0} -> {1}" -f $InternalName, $uniqVal); $changed = $true } else { Set-ListFieldSafe -ListTitle $ListTitle -InternalName $InternalName -Values @{ EnforceUniqueValues = $uniqVal } -WhatIf:$whatIf; $changed = $true } }
  if ($null -ne $MaxLength -and $f.TypeAsString -eq 'Text') { $lenVal = [int]$MaxLength; if ($WhatIfMode) { LogChange ("  - MaxLength: {0} -> {1}" -f $InternalName, $lenVal); $changed = $true } else { Set-ListFieldSafe -ListTitle $ListTitle -InternalName $InternalName -Values @{ MaxLength = $lenVal } -WhatIf:$whatIf; $changed = $true } }
  if ($changed -and -not $WhatIfMode) { LogChange ("  - Field meta updated: {0}" -f $InternalName) }
}

function EnsureField {
  param(
    [Parameter(Mandatory = $true)][string]$ListTitle,
    [Parameter(Mandatory = $true)][string]$DisplayName,
    [Parameter(Mandatory = $true)][string]$InternalName,
    [Parameter(Mandatory = $true)][ValidateSet('Text','Note','DateTime','Number','Boolean','User','URL','Choice')][string]$Type,
    [string]$Description,
    [object]$Required,
    [object]$EnforceUnique,
    [object]$MaxLength,
    [string[]]$Choices,
    [switch]$AddToDefaultView
  )
  $existingType = GetFieldType -InternalName $InternalName -ListTitle $ListTitle
  if (-not $existingType) {
    $msg = ("  - Add field: {0} ({1})" -f $InternalName, $Type)
    if ($WhatIfMode) { LogChange $msg; return }
    LogChange $msg
  Add-PnPField -List $ListTitle -DisplayName $DisplayName -InternalName $InternalName -Type $Type -AddToDefaultView:$AddToDefaultView.IsPresent -WhatIf:$WhatIfMode.IsPresent | Out-Null
    return
  }
  if ($existingType -ne $Type) {
    LogChange ("  - Type mismatch: {0} existing={1} desired={2}" -f $InternalName, $existingType, $Type)
    if ($ForceTypeReplace) {
      $newName = "${InternalName}_v2"
      if ($WhatIfMode) { LogChange ("    - Replacement: {0} ({1}) & migrate" -f $newName, $Type); return }
  Add-PnPField -List $ListTitle -DisplayName $DisplayName -InternalName $newName -Type $Type -AddToDefaultView:$AddToDefaultView.IsPresent -WhatIf:$WhatIfMode.IsPresent | Out-Null
      $items = Get-PnPListItem -List $ListTitle -PageSize 2000
      foreach ($it in $items) {
        $val = $it[$InternalName]
        if ($null -ne $val -and $val -ne '') {
          Set-PnPListItem -List $ListTitle -Identity $it.Id -Values @{ $newName = $val } -WhatIf:$WhatIfMode.IsPresent | Out-Null
        }
      }
      LogChange ("    - Migration done: {0} -> {1}" -f $InternalName, $newName)
    } else { LogChange '    - Skipped type change (forceTypeReplace=false)' }
  } else {
    SetFieldMetaSafe -ListTitle $ListTitle -InternalName $InternalName -DisplayName $DisplayName -Description $Description -Choices $Choices -Required $Required -EnforceUnique $EnforceUnique -MaxLength $MaxLength
  }
}

function DumpListFields([string]$ListTitle) {
  $fields = Get-PnPField -List $ListTitle -ErrorAction SilentlyContinue
  if (-not $fields) { return }
  LogChange ("Existing fields snapshot: {0}" -f $ListTitle)
  foreach ($f in $fields) {
    LogChange ("  - {0} (Type={1}, Req={2}, Unique={3}, Title='{4}')" -f $f.InternalName, $f.TypeAsString, $f.Required, $f.EnforceUniqueValues, $f.Title)
  }
}

Note '# SharePoint Provision Summary'
Note ''
Note "Site: $SiteUrl"
Note "Flags: RecreateExisting=$RecreateExisting ApplyFieldUpdates=$ApplyFieldUpdates ForceTypeReplace=$ForceTypeReplace WhatIf=$($WhatIfMode.IsPresent)"
Note "Schema: $SchemaPath"
Note ''

if (-not (Test-Path $SchemaPath)) { throw "Schema file not found: $SchemaPath" }
$schemaJson = Get-Content -Path $SchemaPath -Raw | ConvertFrom-Json
ValidateSchema $schemaJson

foreach ($listDef in $schemaJson.lists) {
  $title = $listDef.title
  if (-not $title) { continue }
  EnsureList -Title $title
  if ($WhatIfMode) { DumpListFields -ListTitle $title }
  foreach ($f in $listDef.fields) {
    if (-not $f.internalName -or -not $f.type) { continue }
    $dn = $f.displayName
    $in = $f.internalName
    $ty = $f.type
    $add = $false
    if ($null -ne $f.addToDefaultView -and [bool]$f.addToDefaultView) { $add = $true }
    $desc = $null; if ($f.PSObject.Properties.Match('description').Count -gt 0) { $desc = $f.description }
    $req = $null; if ($f.PSObject.Properties.Match('required').Count -gt 0) { $req = $f.required }
    $uniq = $null; if ($f.PSObject.Properties.Match('enforceUnique').Count -gt 0) { $uniq = $f.enforceUnique }
    $max = $null; if ($f.PSObject.Properties.Match('maxLength').Count -gt 0) { $max = $f.maxLength }
    $ch = $null; if ($f.PSObject.Properties.Match('choices').Count -gt 0) { $ch = [string[]]$f.choices }
    if ($ty -eq 'Lookup') {
      $lkList = if ($f.PSObject.Properties.Match('lookupListTitle').Count -gt 0) { $f.lookupListTitle } else { $null }
      $lkField = if ($f.PSObject.Properties.Match('lookupField').Count -gt 0) { $f.lookupField } else { 'Title' }
      $lkMulti = $false; if ($f.PSObject.Properties.Match('allowMultiple').Count -gt 0) { $lkMulti = [bool]$f.allowMultiple }
      if (-not $lkList) { LogChange ("  - Lookup missing lookupListTitle: {0}" -f $in) }
      else { EnsureLookupField -ListTitle $title -DisplayName $dn -InternalName $in -LookupListTitle $lkList -LookupField $lkField -AllowMultiple:$lkMulti -AddToDefaultView:([switch]$add) }
    } elseif ($ty -eq 'User') {
      $uMulti = $false; if ($f.PSObject.Properties.Match('allowMultiple').Count -gt 0) { $uMulti = [bool]$f.allowMultiple }
      $princip = 'User'; if ($f.PSObject.Properties.Match('principalType').Count -gt 0) { $princip = $f.principalType }
      EnsureUserField -ListTitle $title -DisplayName $dn -InternalName $in -AllowMultiple:$uMulti -PrincipalType $princip -AddToDefaultView:([switch]$add)
    } else {
      EnsureField -ListTitle $title -DisplayName $dn -InternalName $in -Type $ty -Description $desc -Required $req -EnforceUnique $uniq -MaxLength $max -Choices $ch -AddToDefaultView:([switch]$add)
    }
    if ($ApplyFieldUpdates -and $ty -eq 'Choice' -and $ch) {
      $policy = if ($f.PSObject.Properties.Match('choicesPolicy').Count -gt 0) { $f.choicesPolicy } else { 'additive' }
      try {
        if ($policy -eq 'additive') {
          $lines = Update-ChoiceFieldAdditive -ListTitle $title -InternalName $in -DesiredChoices $ch -WhatIfMode:$WhatIfMode
          foreach ($l in $lines) { LogChange ("  - {0}" -f $l) }
        } elseif ($policy -eq 'replace') {
          $lines = Update-ChoiceFieldReplace -ListTitle $title -InternalName $in -DesiredChoices $ch -WhatIfMode:$WhatIfMode
          foreach ($l in $lines) { LogChange ("  - {0}" -f $l) }
        } else { LogChange ("  - Unknown choicesPolicy '{0}' for {1}" -f $policy, $in) }
      } catch {
        LogChange ("  - Error applying choicesPolicy for {0}: {1}" -f $in, $_.Exception.Message)
      }
    }
  }
}

Note ''
Note 'Changes:'
if ($GLOBAL:Changes.Count -eq 0) { Note '- No changes (already up-to-date)' }

function Get-ChangeKind([string]$line) {
  if ($line -match '^(Create list:)') { return 'CreateList' }
  if ($line -match '^(Recreate list:)') { return 'RecreateList' }
  if ($line -match 'Add lookup field') { return 'EnsureField' }
  if ($line -match 'Add user field') { return 'EnsureField' }
  if ($line -match 'Add field') { return 'EnsureField' }
  if ($line -match 'Type mismatch') { return 'TypeMismatch' }
  if ($line -match 'Field meta updated') { return 'MetaUpdate' }
  if ($line -match 'Title: ') { return 'MetaUpdate' }
  if ($line -match 'Description update') { return 'MetaUpdate' }
  if ($line -match 'Choices: ') { return 'MetaUpdate' }
  if ($line -match 'multi enabled') { return 'MetaUpdate' }
  if ($line -match 'Error applying choicesPolicy') { return 'Warning' }
  return 'Info'
}

if ( ($WhatIfMode -or $EmitChanges) -and $GLOBAL:Changes.Count -gt 0 ) {
  try {
    $counts = @{}
    foreach ($c in $GLOBAL:Changes) {
      $k = Get-ChangeKind $c
      if (-not $counts.ContainsKey($k)) { $counts[$k] = 0 }
      $counts[$k]++
    }
    $byKind = @(); foreach ($k in $counts.Keys) { $byKind += [pscustomobject]@{ kind = $k; count = $counts[$k] } }
    $structured = [pscustomobject]@{}
    $structured | Add-Member -NotePropertyName timestamp -NotePropertyValue ((Get-Date).ToString('o'))
    $structured | Add-Member -NotePropertyName site -NotePropertyValue $SiteUrl
  $structured | Add-Member -NotePropertyName whatIf -NotePropertyValue ([bool]$WhatIfMode.IsPresent)
    $structured | Add-Member -NotePropertyName recreate -NotePropertyValue ([bool]$RecreateExisting)
    $structured | Add-Member -NotePropertyName applyMeta -NotePropertyValue ([bool]$ApplyFieldUpdates)
    $structured | Add-Member -NotePropertyName forceType -NotePropertyValue ([bool]$ForceTypeReplace)
    $summaryObj = [pscustomobject]@{ total = $GLOBAL:Changes.Count; byKind = $byKind }
    $structured | Add-Member -NotePropertyName summary -NotePropertyValue $summaryObj
    $structured | Add-Member -NotePropertyName changes -NotePropertyValue $GLOBAL:Changes
    $outDir = Split-Path -Parent $ChangesOutPath
    if ($outDir -and -not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }
    $structured | ConvertTo-Json -Depth 6 | Out-File -FilePath $ChangesOutPath -Encoding utf8
    Write-Host "::notice:: Changes JSON written to $ChangesOutPath"
    if ($env:GITHUB_STEP_SUMMARY) {
      $jsonPreview = $structured | ConvertTo-Json -Depth 3
      $lines = @(
        '### Provision WhatIf Changes',
        "- Written: `$ChangesOutPath",
        "- Total: $($GLOBAL:Changes.Count)",
        '',
        '```json',
        $jsonPreview,
        '```'
      )
      $lines -join "`n" | Out-File -FilePath $env:GITHUB_STEP_SUMMARY -Encoding utf8 -Append
    }
  } catch {
    Write-Warning "Failed to write changes JSON: $($_.Exception.Message)"
  }
}