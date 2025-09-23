param(
  [Parameter(Mandatory=$true)][string]$SiteUrl,
  [Parameter(Mandatory=$false)][switch]$WhatIfMode,
  [Parameter(Mandatory=$false)][int]$BatchSize = 50,
  [Parameter(Mandatory=$false)][int]$PageSize = 1000,
  [Parameter(Mandatory=$false)][switch]$VerboseMetrics
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-MetricJson {
  param([hashtable]$m, [string]$Path = 'artifacts/backfill-metrics.json')
  try {
    $dir = Split-Path -Parent $Path
    if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    ($m | ConvertTo-Json -Depth 6) | Set-Content -Encoding UTF8 -Path $Path
    Write-Host ("Metrics JSON written: $Path") -ForegroundColor DarkCyan
  } catch {
    Write-Warning "Write-MetricJson failed: $($_.Exception.Message)"
  }
}

<#!
.SYNOPSIS
  Backfill empty entry_hash values in Audit_Events list.
.DESCRIPTION
  Computes canonical JSON (subset of fields) and SHA-256 to populate entry_hash
  for existing items where it is null or empty. Supports WhatIf (no write).
.NOTES
  Requires: PnP.PowerShell module and connected context (Connect-PnPOnline performed prior or run inside provisioning workflow).
#>

## legacy line replaced above

# Ensure connected
try {
  Get-PnPContext | Out-Null
} catch {
  throw 'Not connected. Run Connect-PnPOnline before executing.'
}

$listTitle = 'Audit_Events'
Write-Host "Scanning list (CAML filtered): $listTitle" -ForegroundColor Cyan

$viewXml = @"
<View>
  <Query>
    <Where>
      <Or>
        <IsNull><FieldRef Name='entry_hash' /></IsNull>
        <Eq><FieldRef Name='entry_hash' /><Value Type='Text'></Value></Eq>
      </Or>
    </Where>
  </Query>
  <ViewFields>
    <FieldRef Name='ID' />
    <FieldRef Name='Title' />
    <FieldRef Name='Action' />
    <FieldRef Name='User' />
    <FieldRef Name='Timestamp' />
    <FieldRef Name='Details' />
    <FieldRef Name='entry_hash' />
  </ViewFields>
  <RowLimit Paged='TRUE'>$PageSize</RowLimit>
</View>
"@

$query = @{ query = @{ __metadata = @{ type = 'SP.CamlQuery' }; ViewXml = $viewXml } } | ConvertTo-Json -Depth 6

$restEndpoint = "$SiteUrl/_api/web/lists/getbytitle('$listTitle')/GetItems"
$headers = @{ 'Accept' = 'application/json;odata=nometadata'; 'Content-Type' = 'application/json;odata=verbose' }

$allToProcess = New-Object System.Collections.Generic.List[object]
$pageIndex = 0
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

while ($true) {
  $pageIndex++
  $resp = Invoke-RestMethod -Method POST -Uri $restEndpoint -Headers $headers -Body $query
  $rows = @()
  if ($resp.value) { $rows = $resp.value } elseif ($resp.d -and $resp.d.results) { $rows = $resp.d.results }
  if (-not $rows -or $rows.Count -eq 0) { break }
  foreach ($r in $rows) { $allToProcess.Add($r) }
  if ($VerboseMetrics) { Write-Host ("Page $pageIndex fetched: $($rows.Count) (accum=$($allToProcess.Count))") }
  # CAML paging next page: REST GetItems does not auto-provide nextLink in classic; break to avoid infinite loop
  if ($rows.Count -lt $PageSize) { break }
  # Adjust RowLimit for next page by using ListItemCollectionPosition if needed (omitted for simplicity)
  if ($PageSize -eq 0) { break }
}

if ($allToProcess.Count -eq 0) {
  Write-Host 'No items require backfill (filtered).' -ForegroundColor Green
  return
}

Write-Host ("Items needing backfill (filtered): {0}" -f $allToProcess.Count) -ForegroundColor Yellow

function Get-CanonicalJson($item) {
  # Must mirror frontend canonicalization order/fields
  $obj = [ordered]@{
    Title     = $item['Title']
    Action    = $item['Action']
    User      = $item['User']
    Timestamp = $item['Timestamp']
    Details   = $item['Details']
  }
  return ($obj | ConvertTo-Json -Compress)
}

function Get-Sha256([string]$text) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
  $hash = $sha.ComputeHash($bytes)
  return -join ($hash | ForEach-Object { $_.ToString('x2') })
}

int $updated = 0
int $skipped = 0
int $conflict409 = 0
$failures = New-Object System.Collections.Generic.List[object]
$runId = [guid]::NewGuid().ToString()
$startedAt = (Get-Date)
$pending = @()
foreach ($t in $allToProcess) {
  $canon = Get-CanonicalJson $t
  $hash  = Get-Sha256 $canon
  $pending += [pscustomobject]@{ Id=$t.Id; Hash=$hash }
  if ($pending.Count -ge $BatchSize) {
    if (-not $WhatIfMode) {
      foreach ($p in $pending) { Set-PnPListItem -List $listTitle -Identity $p.Id -Values @{ entry_hash = $p.Hash } | Out-Null }
    }
    $updated += $pending.Count
    if ($VerboseMetrics) { Write-Host ("Updated chunk: +$($pending.Count) total=$updated") }
    $pending = @()
  }
}
if ($pending.Count -gt 0) {
  if (-not $WhatIfMode) { foreach ($p in $pending) { Set-PnPListItem -List $listTitle -Identity $p.Id -Values @{ entry_hash = $p.Hash } | Out-Null } }
  $updated += $pending.Count
  if ($VerboseMetrics) { Write-Host ("Updated final chunk: +$($pending.Count) total=$updated") }
}

$stopwatch.Stop()
Write-Host "SUMMARY" -ForegroundColor Cyan
Write-Host ("  Needed (filtered): {0}" -f $allToProcess.Count)
Write-Host ("  Updated:          {0}" -f ($WhatIfMode ? 0 : $updated))
Write-Host ("  Skipped:          {0}" -f $skipped)
Write-Host ("  Conflict409:      {0}" -f $conflict409)
Write-Host ("  Duration:         {0}" -f $stopwatch.Elapsed.ToString())
Write-Host ("  Mode:             {0}" -f ($WhatIfMode ? 'WHATIF' : 'APPLY'))

$finishedAt = Get-Date
$metricsObj = [ordered]@{
  runId       = $runId
  startedAt   = $startedAt.ToString('o')
  finishedAt  = $finishedAt.ToString('o')
  durationSec = [math]::Round(($finishedAt - $startedAt).TotalSeconds,3)
  total       = $allToProcess.Count
  created     = 0  # backfill inserts none
  updated     = ($WhatIfMode ? 0 : $updated)
  skipped     = $skipped
  conflict409 = $conflict409
  failures    = @($failures)
}
if ($WhatIfMode -or $VerboseMetrics) { Write-MetricJson -m $metricsObj }
