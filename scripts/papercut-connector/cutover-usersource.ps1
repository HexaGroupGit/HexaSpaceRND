# Hexa PaperCut cutover - part 2: make Hexa the USER SOURCE (user directory).
#
# ASCII ONLY (see cutover.ps1 for why).
#
# WHY THIS EXISTS: PaperCut has TWO custom-program hooks. cutover.ps1 switched
# auth.source (password validation). This switches user-source (who exists).
# Until both point at Hexa, a member created by provision-members.mjs is an
# INTERNAL user the directory has never heard of, and PaperCut refuses the login
# even when the auth provider returns OK - exactly what happened to
# scarlett@hexaspace.com.au on 4 Aug 2026.
#
# THIS SCRIPT ONLY REPOINTS THE KEY. It does NOT run a sync. Trigger that from
# the admin UI (Options -> User/Group Sync) so you can use its Test/preview
# first. Nothing about your users changes until a sync runs.
#
# DRY-RUN RESULTS THAT GATED THIS (4 Aug 2026, against live data):
#   550 records: 467 roster (222 matched to an existing account, 245 new)
#                 + 83 PaperCut users not on the roster, carried through
#   0 duplicate usernames, 0 duplicate emails
#   all 305 existing users present; 0 card numbers wiped, 0 changed
#
# ROLLBACK:  .\cutover-usersource.ps1 -Rollback
#   Restores user-source.custom-program from the snapshot (OfficeRnD's
#   papercutauth.exe). papercutauth.exe is never removed.

[CmdletBinding()]
param([switch]$Rollback)

$ErrorActionPreference = 'Stop'

$Src        = 'C:\Users\61406\HexaSpaceRND\scripts\papercut-connector'
$Dst        = 'C:\Program Files\PaperCut MF\providers\hexa'
$ServerCmd  = 'C:\Program Files\PaperCut MF\server\bin\win\server-command.exe'
$Snapshot   = Join-Path $Src 'cutover-usersource-rollback.json'
$Key        = 'user-source.custom-program'

function Assert-Elevated {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $pr = New-Object Security.Principal.WindowsPrincipal($id)
  if (-not $pr.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Not elevated. Right-click PowerShell, Run as Administrator, then re-run.'
  }
}
function Get-Config([string]$k) { (& $ServerCmd get-config $k 2>&1 | Out-String).Trim() }
function Set-Config([string]$k, [string]$v) {
  $val = $v
  if ([string]::IsNullOrEmpty($val)) { $val = '""' }
  & $ServerCmd set-config $k $val | Out-Null
}

Assert-Elevated

if ($Rollback) {
  if (-not (Test-Path $Snapshot)) { throw "No snapshot at $Snapshot." }
  $snap = Get-Content $Snapshot -Raw | ConvertFrom-Json
  Write-Host 'Restoring the previous user source...' -ForegroundColor Yellow
  Set-Config $Key $snap.userSource
  Write-Host "  $Key is now $(Get-Config $Key)"
  Write-Host 'Rolled back. Run a sync from the admin UI to re-assert it.' -ForegroundColor Green
  return
}

# Pre-flight
$files = @('user-source-provider.mjs','hexa-usersource.cmd','hexa-config.json')
foreach ($f in $files) {
  if (-not (Test-Path (Join-Path $Src $f))) { throw "Missing source file: $Src\$f" }
}
if (-not (Test-Path $Dst)) { throw "$Dst missing - run cutover.ps1 first." }

# hexa-config.json must already carry hexaRosterUrl + hexaSyncToken.
$cfg = Get-Content (Join-Path $Src 'hexa-config.json') -Raw | ConvertFrom-Json
foreach ($field in @('hexaRosterUrl','hexaSyncToken')) {
  if (-not $cfg.$field) { throw "hexa-config.json is missing '$field'." }
}

$before = @{ userSource = Get-Config $Key; takenAt = (Get-Date).ToString('o') }
$before | ConvertTo-Json | Set-Content $Snapshot -Encoding utf8
Write-Host 'Snapshot saved for rollback:' -ForegroundColor Cyan
Write-Host "  $Key = $($before.userSource)"
Write-Host "  -> $Snapshot"
Write-Host ''

Write-Host 'Staging the user-source provider...' -ForegroundColor Cyan
foreach ($f in $files) { Copy-Item (Join-Path $Src $f) (Join-Path $Dst $f) -Force }
Write-Host "  copied $($files -join ', ')"

# hexa-config.json now also holds the Hexa sync token - re-assert the lockdown,
# since Copy-Item -Force replaces the file and its ACL along with it.
$cfgPath = Join-Path $Dst 'hexa-config.json'
$acl = Get-Acl $cfgPath
$acl.SetAccessRuleProtection($true, $false)
foreach ($rule in @($acl.Access)) { $acl.RemoveAccessRule($rule) | Out-Null }
foreach ($who in @('BUILTIN\Administrators','NT AUTHORITY\SYSTEM')) {
  $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($who,'FullControl','None','None','Allow')))
}
Set-Acl $cfgPath $acl
Write-Host "  re-locked $cfgPath to Administrators + SYSTEM"
Write-Host ''

# Prove the provider runs AS THE SERVICE WILL run it, before repointing anything.
Write-Host 'Smoke test (running the wrapper exactly as PaperCut will)...' -ForegroundColor Cyan
$probe = & (Join-Path $Dst 'hexa-usersource.cmd') is-valid-user 'eric@hexaspace.com.au' 2>&1
Write-Host "  is-valid-user eric@hexaspace.com.au -> $probe"
if ("$probe".Trim() -ne 'Y') {
  throw "Smoke test failed (expected Y, got '$probe'). NOT repointing the user source. Check C:\ProgramData\Hexa\papercut-usersource.log"
}
Write-Host ''

Write-Host "Repointing $Key ..." -ForegroundColor Cyan
Set-Config $Key (Join-Path $Dst 'hexa-usersource.cmd')
Write-Host "  $Key = $(Get-Config $Key)"
Write-Host ''

Write-Host 'Done. NOTHING HAS SYNCED YET - your users are untouched.' -ForegroundColor Green
Write-Host 'Next, in the PaperCut admin UI:' -ForegroundColor Yellow
Write-Host '  Options -> User/Group Sync -> check the source shows the Hexa program'
Write-Host '  Use TEST / preview first and read what it reports.'
Write-Host '  Expect ~550 users: 305 existing (unchanged) + ~245 new members.'
Write-Host '  Only then run a real sync.'
Write-Host ''
Write-Host 'Watch: C:\ProgramData\Hexa\papercut-usersource.log (every query PaperCut makes).'
Write-Host 'Roll back any time: .\cutover-usersource.ps1 -Rollback'
