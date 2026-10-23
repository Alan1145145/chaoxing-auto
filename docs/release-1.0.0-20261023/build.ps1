$ErrorActionPreference='Continue'; cd (Split-Path (Split-Path $PSScriptRoot))
"== web $(Get-Date)"; pnpm --filter @ocs-desktop/web build 2>&1 | Select -Last 4; "web exit $LASTEXITCODE"
"== tsc $(Get-Date)"; pnpm --filter @ocs-desktop/app exec tsc 2>&1 | Select -Last 15; "tsc exit $LASTEXITCODE"
"== builder $(Get-Date)"; cd packages\app; pnpm exec electron-builder --config electron.builder.json --publish never --config.directories.output=dist-release-1.0.0 2>&1 | Select -Last 12; "builder exit $LASTEXITCODE"
"== done $(Get-Date)"
