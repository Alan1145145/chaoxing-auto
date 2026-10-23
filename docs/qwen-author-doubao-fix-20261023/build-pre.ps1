$ErrorActionPreference='Continue'; cd (Split-Path (Split-Path $PSScriptRoot))
"== build:doubao $(Get-Date)"; pnpm build:doubao 2>&1 | Select -Last 15; "doubao exit $LASTEXITCODE"
"== web $(Get-Date)"; pnpm --filter @ocs-desktop/web build 2>&1 | Select -Last 8; "web exit $LASTEXITCODE"
"== tsc $(Get-Date)"; pnpm --filter @ocs-desktop/app exec tsc 2>&1 | Select -Last 15; "tsc exit $LASTEXITCODE"
"== done $(Get-Date)"
