$log = Join-Path $PSScriptRoot 'switch.log'
$name = '超星自动机'
"start $(Get-Date)" | Out-File $log -Encoding UTF8
Get-Process $name -EA SilentlyContinue | ? { $_.MainWindowHandle -ne 0 } | % { $null = $_.CloseMainWindow() }
for ($i = 0; $i -lt 25; $i++) { if (-not (Get-Process $name -EA SilentlyContinue)) { break }; Start-Sleep 1 }
$left = Get-Process $name -EA SilentlyContinue
"graceful remaining: $($left.Count)" | Out-File $log -Append -Encoding UTF8
if ($left) { $left | Stop-Process -Force -EA SilentlyContinue; Start-Sleep 2 }
Get-Process doubao-gateway -EA SilentlyContinue | Stop-Process -Force -EA SilentlyContinue
Start-Sleep 1
"old remaining: $((Get-Process $name -EA SilentlyContinue).Count) gateway: $((Get-Process doubao-gateway -EA SilentlyContinue).Count)" | Out-File $log -Append -Encoding UTF8
New-Item (Join-Path $PSScriptRoot 'closed.flag') -Force | Out-Null
# wait while the non-elevated installer test runs (max 30 min)
for ($i = 0; $i -lt 1800; $i++) { if (Test-Path (Join-Path $PSScriptRoot 'go.flag')) { break }; Start-Sleep 1 }
"go flag: $(Test-Path (Join-Path $PSScriptRoot 'go.flag')) $(Get-Date)" | Out-File $log -Append -Encoding UTF8
Start-Process -FilePath (Join-Path (Split-Path (Split-Path $PSScriptRoot)) '启动新版.cmd') -WindowStyle Hidden
"launched via cmd $(Get-Date)" | Out-File $log -Append -Encoding UTF8
