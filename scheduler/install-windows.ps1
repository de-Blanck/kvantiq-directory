<#
.SYNOPSIS
  Install the weekly Kvantiq Directory runner as a Windows Scheduled Task.

.DESCRIPTION
  Schedules `node scripts\scheduled-run.mjs` for Sundays at 03:00 local time.
  "StartWhenAvailable" makes a missed run fire once the machine is back on.
  Re-run to update the task.

  Prereqs (see docs/scheduled-runner.md): node, npm, gh (authenticated), the
  `claude` CLI, and CLAUDE_CODE_OAUTH_TOKEN in <repo>\.env.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scheduler\install-windows.ps1
#>

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$TaskName = 'KvantiqDirectoryWeekly'

$Node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $Node) {
  Write-Error 'node not found on PATH. Install Node 22+ first.'
  exit 1
}
if (-not (Test-Path (Join-Path $RepoRoot '.env')) -and -not $env:CLAUDE_CODE_OAUTH_TOKEN) {
  Write-Warning "No $RepoRoot\.env and CLAUDE_CODE_OAUTH_TOKEN unset — the run will fail preflight until you add the token."
}

$Action = New-ScheduledTaskAction -Execute $Node `
  -Argument 'scripts\scheduled-run.mjs' -WorkingDirectory $RepoRoot
$Trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 3am
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable `
  -DontStopOnIdleEnd -ExecutionTimeLimit (New-TimeSpan -Hours 2)

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger `
  -Settings $Settings -Description 'Weekly Kvantiq Directory AI content sweep (Max subscription, no GitHub Actions).' `
  -Force | Out-Null

Write-Host "Installed scheduled task: $TaskName"
Write-Host "  schedule : Sundays 03:00 local (missed runs fire when next on)"
Write-Host "  working  : $RepoRoot"
Write-Host "  log      : $RepoRoot\scheduled-run-debug.log"
Write-Host ''
Write-Host 'Test it now without waiting for Sunday:'
Write-Host "  Start-ScheduledTask -TaskName $TaskName"
Write-Host "To remove: Unregister-ScheduledTask -TaskName $TaskName -Confirm:`$false"
