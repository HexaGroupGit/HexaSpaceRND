# Hexa PaperCut cutover - Phase 1 + Phase 5, in one elevated run.
#
# ASCII ONLY, deliberately. Windows PowerShell 5.1 reads a BOM-less UTF-8 file as
# cp1252, and a stray byte from a dash or arrow can close a string mid-line and
# break the parse. Keep it that way.
#
# WHAT IT DOES (docs/papercut-cutover.md):
#   Phase 1  stop + disable PaperCutCA (the OfficeRnD agent whose nightly ~21:32
#            prune deletes non-OfficeRnD users - it must be off before any live
#            provisioning, or the accounts vanish overnight).
#   Phase 5  stage the Hexa auth provider into providers\hexa, point PaperCut's
#            custom-auth keys at it, restart the app server. After this, print
#            sign-in (Mobility Print first-run, the :9191 web portal) validates
#            against each member's HEXA PORTAL email + password.
#   Phase 6  (partial) lock hexa-config.json down to Administrators + SYSTEM -
#            it holds the Supabase anon key and the PaperCut Web Services token.
#
# MUST RUN ELEVATED - service changes, Program Files writes and server-command
# all require it. The script refuses to run otherwise.
#
# ROLLBACK:  .\cutover.ps1 -Rollback
#   Restores the previous auth keys from the snapshot this script writes, puts
#   PaperCutCA back to Automatic + Running, and restarts the app server.
#   papercutauth.exe is left in place throughout, so rollback is one command.
#
# PRE-FLIGHT ALREADY VERIFIED (4 Aug 2026, unelevated):
#   - All 19 members who printed in the last 31 days have a portal password
#     (POST /api/papercut/has-password returned missing = []). That is the
#     runbook's flip condition for Phase 5.
#   - auth-provider.mjs answers ERROR and exits 0 on every failure path.
#   - node is in the MACHINE PATH, so LocalSystem (PCAppServer) resolves it.

[CmdletBinding()]
param([switch]$Rollback)

$ErrorActionPreference = 'Stop'

$Src         = 'C:\Users\61406\HexaSpaceRND\scripts\papercut-connector'
$Dst         = 'C:\Program Files\PaperCut MF\providers\hexa'
$ServerCmd   = 'C:\Program Files\PaperCut MF\server\bin\win\server-command.exe'
$Snapshot    = Join-Path $Src 'cutover-rollback.json'
$AppService  = 'PCAppServer'
$OrndService = 'PaperCutCA'

function Assert-Elevated {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $pr = New-Object Security.Principal.WindowsPrincipal($id)
  if (-not $pr.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Not elevated. Right-click PowerShell, Run as Administrator, then re-run this script.'
  }
}

function Get-Config([string]$key) {
  # server-command echoes the value on stdout; trim its trailing newline.
  (& $ServerCmd get-config $key 2>&1 | Out-String).Trim()
}

function Set-Config([string]$key, [string]$value) {
  # An empty value must be passed explicitly as "" or server-command rejects it.
  $v = $value
  if ([string]::IsNullOrEmpty($v)) { $v = '""' }
  & $ServerCmd set-config $key $v | Out-Null
}

Assert-Elevated

# ---- Rollback --------------------------------------------------------------
if ($Rollback) {
  if (-not (Test-Path $Snapshot)) { throw "No snapshot at $Snapshot, nothing to roll back to." }
  $snap = Get-Content $Snapshot -Raw | ConvertFrom-Json
  Write-Host 'Restoring previous auth configuration...' -ForegroundColor Yellow
  Set-Config 'auth.source.custom-program' $snap.customProgram
  Set-Config 'auth.source.env-vars'       $snap.envVars
  Write-Host "  auth.source.custom-program is now $(Get-Config 'auth.source.custom-program')"
  Write-Host "  auth.source.env-vars       is now $(Get-Config 'auth.source.env-vars')"

  Write-Host "Re-enabling $OrndService..." -ForegroundColor Yellow
  Set-Service $OrndService -StartupType Automatic
  Start-Service $OrndService

  Write-Host "Restarting $AppService..." -ForegroundColor Yellow
  Restart-Service $AppService -Force
  Write-Host 'Rolled back. Print sign-in is back on OfficeRnD (papercutauth.exe).' -ForegroundColor Green
  return
}

# ---- Pre-flight ------------------------------------------------------------
$files = @('auth-provider.mjs','hexa-auth.cmd','hexa-config.json')
foreach ($f in $files) {
  if (-not (Test-Path (Join-Path $Src $f))) { throw "Missing source file: $Src\$f" }
}
if (-not (Test-Path $ServerCmd)) { throw "server-command not found at $ServerCmd" }

# Snapshot BEFORE touching anything, so -Rollback always has a target.
$before = @{
  customProgram = Get-Config 'auth.source.custom-program'
  envVars       = Get-Config 'auth.source.env-vars'
  takenAt       = (Get-Date).ToString('o')
}
$before | ConvertTo-Json | Set-Content $Snapshot -Encoding utf8
Write-Host 'Snapshot saved for rollback:' -ForegroundColor Cyan
Write-Host "  auth.source.custom-program = $($before.customProgram)"
Write-Host "  auth.source.env-vars       = $($before.envVars)"
Write-Host "  -> $Snapshot"
Write-Host ''

# ---- Phase 1: stop the OfficeRnD prune -------------------------------------
Write-Host 'Phase 1: stopping the OfficeRnD agent (nightly prune)...' -ForegroundColor Cyan
$ornd = Get-Service $OrndService -ErrorAction SilentlyContinue
if ($ornd) {
  if ($ornd.Status -ne 'Stopped') { Stop-Service $OrndService -Force }
  Set-Service $OrndService -StartupType Disabled
  Write-Host "  $OrndService is now $((Get-Service $OrndService).Status) / Disabled"
} else {
  Write-Host "  $OrndService not present, nothing to stop."
}
Write-Host ''

# ---- Phase 5: stage the Hexa auth provider ---------------------------------
Write-Host 'Phase 5: staging the auth provider...' -ForegroundColor Cyan
if (-not (Test-Path $Dst)) { New-Item -ItemType Directory -Path $Dst -Force | Out-Null }
foreach ($f in $files) { Copy-Item (Join-Path $Src $f) (Join-Path $Dst $f) -Force }
Write-Host "  copied $($files -join ', ') to $Dst"

# hexa-config.json holds the Supabase anon key + the PaperCut Web Services token.
# Only Administrators and SYSTEM (which PCAppServer runs as) need to read it.
$cfgPath = Join-Path $Dst 'hexa-config.json'
$acl = Get-Acl $cfgPath
$acl.SetAccessRuleProtection($true, $false)   # drop inheritance, keep nothing
foreach ($rule in @($acl.Access)) { $acl.RemoveAccessRule($rule) | Out-Null }
foreach ($who in @('BUILTIN\Administrators','NT AUTHORITY\SYSTEM')) {
  $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule(
    $who, 'FullControl', 'None', 'None', 'Allow')))
}
Set-Acl $cfgPath $acl
Write-Host "  locked $cfgPath to Administrators + SYSTEM"
Write-Host ''

# ---- Flip the auth keys ----------------------------------------------------
# Order matters: the files above are already in place, so there is no window
# where PaperCut points at a provider that does not exist yet.
Write-Host 'Pointing PaperCut at the Hexa auth provider...' -ForegroundColor Cyan
Set-Config 'auth.source.custom-program' (Join-Path $Dst 'hexa-auth.cmd')
Set-Config 'auth.source.env-vars'       "HEXA_AUTH_CONFIG=$cfgPath"
Write-Host "  auth.source.custom-program = $(Get-Config 'auth.source.custom-program')"
Write-Host "  auth.source.env-vars       = $(Get-Config 'auth.source.env-vars')"
Write-Host ''

# ---- Restart + verify ------------------------------------------------------
Write-Host "Restarting $AppService (print queues pause briefly)..." -ForegroundColor Cyan
Restart-Service $AppService -Force
Start-Sleep -Seconds 20
Write-Host "  $AppService is $((Get-Service $AppService).Status)"
Write-Host ''

Write-Host 'Cutover applied.' -ForegroundColor Green
Write-Host 'NOW TEST A REAL LOGIN (you type your own portal password):' -ForegroundColor Yellow
Write-Host "  cd $Src"
Write-Host '  $c = Get-Credential      # username = your portal EMAIL'
Write-Host "  `$env:HEXA_AUTH_CONFIG = '$cfgPath'"
Write-Host '  "$($c.UserName)`n$($c.GetNetworkCredential().Password)" | node auth-provider.mjs'
Write-Host '  expect: OK followed by the PaperCut username. ERROR means stop and run -Rollback.'
