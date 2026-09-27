# Starts everything: routing services in WSL, then the app server. Safe to run twice.
# Phone URL (Tailscale, HTTPS): https://<your-pc>.<your-tailnet>.ts.net   (tailscale serve --bg 3000 persists across reboots)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$wslRoot = '/mnt/' + $PSScriptRoot.Substring(0, 1).ToLower() + $PSScriptRoot.Substring(2).Replace('\', '/')
wsl -d Ubuntu -- bash "$wslRoot/wsl/start.sh"
if ($LASTEXITCODE -ne 0) { throw 'WSL services did not start; see ~/dpd/logs in WSL' }

if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) {
  Write-Host 'app server already running on :3000'
} else {
  Start-Process node -ArgumentList 'server/main.mjs' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
  Write-Host 'app server started on :3000 (logs: data/logs/)'
}
