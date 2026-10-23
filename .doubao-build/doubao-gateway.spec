# -*- mode: python ; coding: utf-8 -*-
import os
from PyInstaller.utils.hooks import collect_submodules

# 路径相对于本 spec 所在目录（项目根目录/.doubao-build）
VENDOR = os.path.join(SPECPATH, '..', 'packages', 'app', 'vendor', 'doubao')

hiddenimports = []
hiddenimports += collect_submodules('app')


a = Analysis(
    [os.path.join(VENDOR, 'desktop.py')],
    pathex=[VENDOR],
    binaries=[],
    datas=[],
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='doubao-gateway',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='doubao-gateway',
)
