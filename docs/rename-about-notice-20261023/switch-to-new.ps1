$log = Join-Path $PSScriptRoot 'switch.log'
"start $(Get-Date)" | Out-File $log -Encoding UTF8
Get-Process 'OCS Desktop' -EA SilentlyContinue | ? { $_.MainWindowHandle -ne 0 } | % { $null = $_.CloseMainWindow() }
for ($i = 0; $i -lt 25; $i++) { if (-not (Get-Process 'OCS Desktop' -EA SilentlyContinue)) { break }; Start-Sleep 1 }
$left = Get-Process 'OCS Desktop' -EA SilentlyContinue
"graceful remaining: $($left.Count)" | Out-File $log -Append -Encoding UTF8
if ($left) { $left | Stop-Process -Force -EA SilentlyContinue; Start-Sleep 2 }
Get-Process doubao-gateway -EA SilentlyContinue | Stop-Process -Force -EA SilentlyContinue
"old remaining: $((Get-Process 'OCS Desktop' -EA SilentlyContinue).Count)" | Out-File $log -Append -Encoding UTF8
Start-Process -FilePath (Join-Path (Split-Path (Split-Path $PSScriptRoot)) '启动新版.cmd') -WindowStyle Hidden
"launched via cmd $(Get-Date)" | Out-File $log -Append -Encoding UTF8
