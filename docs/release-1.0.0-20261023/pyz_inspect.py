import re, sys, marshal, zlib
from PyInstaller.archive.readers import CArchiveReader
exe = sys.argv[1]
c = CArchiveReader(exe)
names = list(c.toc.keys())
print('carchive entries:', len(names), [n for n in names if not n.startswith('pyi') ][:15])
pyz_name = [n for n in names if n.endswith('.pyz')][0]
pyz = c.open_embedded_archive(pyz_name)
mods = sorted(pyz.toc.keys())
print('pyz modules:', len(mods))
print('app modules:', [m for m in mods if m == 'app' or m.startswith('app.')])
print('test-like:', [m for m in mods if 'test' in m.lower() and not m.startswith(('unittest','test.','email','http','distutils'))][:20])
bad = []
def walk(co, m):
    if re.match(r'^[A-Za-z]:[\\/]', co.co_filename) or 'doubao-venv' in co.co_filename: bad.append((m, co.co_filename)); return True
for m in mods:
    try:
        co = pyz.extract(m)
    except Exception as e:
        continue
    if co is None or not hasattr(co,'co_filename'): continue
    walk(co, m)
print('dev-path co_filename:', len(bad), bad[:5])
for m in ['app.qrlogin','app.tls']:
    co = pyz.extract(m); print(m, co.co_filename)
