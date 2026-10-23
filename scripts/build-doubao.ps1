$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$vendorRoot = Join-Path $projectRoot 'packages\app\vendor\doubao'
# Build a standalone Windows runtime. End users do not need Python or pip.
$pythonExecutable = Join-Path $projectRoot '.doubao-venv\Scripts\python.exe'
if (!(Test-Path -LiteralPath $pythonExecutable)) { throw 'Create .doubao-venv and install Flask and PyInstaller first.' }
& $pythonExecutable -m PyInstaller --noconfirm --onedir --name doubao-gateway --collect-submodules app --paths $vendorRoot --distpath (Join-Path $vendorRoot 'runtime') --workpath (Join-Path $projectRoot '.doubao-build') --specpath (Join-Path $projectRoot '.doubao-build') (Join-Path $vendorRoot 'desktop.py')
if ($LASTEXITCODE -ne 0) { throw '豆包网关打包失败' }
