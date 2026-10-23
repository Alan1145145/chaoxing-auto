# Replace real Doubao conversation/message IDs in the test fixture + tests with fake, consistent values.
import re, sys, os, glob, hashlib
d = sys.argv[1]
files = [os.path.join(d, 'fixture_capture.txt')] + glob.glob(os.path.join(d, 'test_*.py'))
texts = {f: open(f, encoding='utf-8').read() for f in files if os.path.exists(f)}
ids = set()
for t in texts.values():
    ids |= set(re.findall(r'(?<![0-9])[0-9]{15,20}(?![0-9])', t))
uuids = set()
for t in texts.values():
    uuids |= set(re.findall(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', t))
idmap = {}
for i, v in enumerate(sorted(ids)):
    fake = ('1' + str(100000 + i)).ljust(len(v), '0')
    idmap[v] = fake
umap = {u: '00000000-0000-4000-8000-%012d' % i for i, u in enumerate(sorted(uuids))}
for f, t in texts.items():
    for a, b in sorted({**idmap, **umap}.items(), key=lambda kv: -len(kv[0])):
        t = t.replace(a, b)
    open(f, 'w', encoding='utf-8', newline='').write(t)
print('ids replaced', len(idmap), 'uuids replaced', len(umap))
