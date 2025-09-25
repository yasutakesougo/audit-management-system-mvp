function Get-ArrayDiff {
  param(
    [string[]]$Current = @(),
    [string[]]$Desired = @()
  )
  $cur = @($Current | Where-Object { $_ -ne $null } | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" } | Select-Object -Unique)
  $des = @($Desired | Where-Object { $_ -ne $null } | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" } | Select-Object -Unique)
  $add = @($des | Where-Object { $cur -notcontains $_ })
  $remove = @($cur | Where-Object { $des -notcontains $_ })
  return [pscustomobject]@{ Add=$add; Remove=$remove; Current=$cur; Desired=$des }
}

function Update-ChoiceFieldAdditive {
  param(
    [string]$ListTitle,
    [string]$InternalName,
    [string[]]$DesiredChoices,
    [switch]$WhatIfMode
  )
  $field = Get-PnPField -List $ListTitle -Identity $InternalName -ErrorAction Stop
  $current = @($field.Choices)
  $diff = Get-ArrayDiff -Current $current -Desired $DesiredChoices
  # Explicit no-op usage to satisfy static analyzer
  $null = $diff.Add.Count + $diff.Remove.Count
  if ($diff.Add.Count -eq 0 -and $diff.Remove.Count -eq 0) {
    return @("No choice changes for '$InternalName'")
  }
  $log = @()
  if ($diff.Add.Count -gt 0) {
    $log += ("+ Add choices to '{0}': {1}" -f $InternalName, ("'" + ($diff.Add -join "', '") + "'"))
    if (-not $WhatIfMode) {
      $newChoices = @($current + $diff.Add | Select-Object -Unique)
      Set-PnPField -List $ListTitle -Identity $InternalName -Choices $newChoices | Out-Null
      $log += ("  -> Applied ({0} → {1})" -f $current.Count, $newChoices.Count)
    }
  }
  if ($diff.Remove.Count -gt 0) {
    $log += ("! Keep existing (not removing) on '{0}': {1}" -f $InternalName, ("'" + ($diff.Remove -join "', '") + "'"))
    $log += "  (Policy=additive: removals are NOT applied; edit schema or use replace policy in future)"
  }
  return $log
}

function Update-ChoiceFieldReplace {
  param(
    [string]$ListTitle,
    [string]$InternalName,
    [string[]]$DesiredChoices,
    [switch]$WhatIfMode
  )
  $field = Get-PnPField -List $ListTitle -Identity $InternalName -ErrorAction Stop
  $current = @($field.Choices)
  $diff = Get-ArrayDiff -Current $current -Desired $DesiredChoices
  $log = @(
    "! choicesPolicy=replace requested for '{0}' (not applied in this version; using additive semantics)" -f $InternalName,
    ("  (Would remove: {0}; Would add: {1})" -f (
        if ($diff.Remove.Count -gt 0) { ("'" + ($diff.Remove -join "', '") + "'") } else { 'none' }
      ), (
        if ($diff.Add.Count -gt 0) { ("'" + ($diff.Add -join "', '") + "'") } else { 'none' }
      )
    ),
    ("  (Summary counts -> Add:{0} Remove:{1})" -f $diff.Add.Count, $diff.Remove.Count)
  )
  $log += Update-ChoiceFieldAdditive -ListTitle $ListTitle -InternalName $InternalName -DesiredChoices $DesiredChoices -WhatIfMode:$WhatIfMode
  return $log
}

function Invoke-ProvisionTemplateIfXml {
  param(
    [Parameter(Mandatory = $true)][string]$SchemaPath,
    [switch]$WhatIfMode
  )

  $ext = [IO.Path]::GetExtension($SchemaPath)
  if ($ext -ieq '.xml') {
    $resolved = Resolve-Path -Path $SchemaPath -ErrorAction SilentlyContinue
    if (-not $resolved) {
      throw "Schema file not found: $SchemaPath"
    }

    Note "Applying PnP XML template: $SchemaPath"
    if ($WhatIfMode) {
      LogChange "Would apply XML template: $SchemaPath"
    }
    else {
      $schemaPathResolved = $resolved.Path
      $patchedPath = Join-Path -Path (Split-Path -Parent $schemaPathResolved) -ChildPath 'schema.withids.xml'

      [xml]$doc = Get-Content -LiteralPath $schemaPathResolved -Raw
      $ns = New-Object System.Xml.XmlNamespaceManager($doc.NameTable)
      $ns.AddNamespace('pnp', 'http://schemas.dev.office.com/PnP/2021/03/ProvisioningSchema')

      function New-DeterministicGuid([string]$seed) {
        $md5 = [System.Security.Cryptography.MD5]::Create()
        try {
          $bytes = [System.Text.Encoding]::UTF8.GetBytes($seed)
          $hash = $md5.ComputeHash($bytes)
        }
        finally {
          $md5.Dispose()
        }
        return [Guid]::new($hash)
      }

      $added = 0
      $nodes = $doc.SelectNodes("//pnp:ListInstance/pnp:Fields/pnp:Field[not(@ID)]", $ns)
  foreach ($f in $nodes) {
    $list = $f.SelectSingleNode("ancestor::pnp:ListInstance[1]", $ns)
    $listTitle = $list.GetAttribute('Title')
    $fn = if ($f.HasAttribute('Name')) { $f.GetAttribute('Name') } elseif ($f.HasAttribute('StaticName')) { $f.GetAttribute('StaticName') } else { $null }
    if (-not $fn) { continue }

    $guidSeed = '{0}|{1}' -f $listTitle, $fn
    $guid = (New-DeterministicGuid $guidSeed).ToString()
    $attr = $doc.CreateAttribute('ID')
    $attr.Value = "{$guid}"
    $null = $f.Attributes.Append($attr)
    $added++
  }

      $boolAttrs = @('Indexed', 'EnforceUniqueValues', 'Required', 'EnableVersioning')
      foreach ($fieldNode in $doc.SelectNodes("//pnp:Field", $ns)) {
        foreach ($attrName in $boolAttrs) {
          if ($fieldNode.HasAttribute($attrName)) {
            $normalized = $fieldNode.GetAttribute($attrName).ToLower() -replace '^(true|false).*', '$1'
            $fieldNode.SetAttribute($attrName, $normalized)
          }
        }
      }

      $doc.Save($patchedPath)
      Note "Auto-assigned $added Field IDs → $patchedPath"

      Invoke-PnPSiteTemplate -Path $patchedPath -ErrorAction Stop
      LogChange "Applied XML template: $SchemaPath"
    }
    return $true
  }

  return $false
}