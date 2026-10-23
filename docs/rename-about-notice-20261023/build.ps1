$ErrorActionPreference='Continue'
Set-Location (Split-Path (Split-Path $PSScriptRoot))
"=== web build $(Get-Date)"
pnpm --filter @ocs-desktop/web build 2>&1
if ($LASTEXITCODE -ne 0) { "WEB_BUILD_FAILED $LASTEXITCODE"; exit 1 }
"=== app tsc $(Get-Date)"
pnpm --filter @ocs-desktop/app exec tsc 2>&1
if ($LASTEXITCODE -ne 0) { "APP_TSC_FAILED $LASTEXITCODE"; exit 1 }
"=== electron-builder $(Get-Date)"
Set-Location (Join-Path (Split-Path (Split-Path $PSScriptRoot)) 'packages\app')
pnpm exec electron-builder --config electron.builder.json --publish never --config.directories.output=dist-chaoxing-release 2>&1
if ($LASTEXITCODE -ne 0) { "BUILDER_FAILED $LASTEXITCODE"; exit 1 }
"=== BUILD_DONE $(Get-Date)"
