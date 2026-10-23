# Scan a packaged app tree for personal data / secrets / dev-machine leftovers.
import os, re, sys, zipfile, json
root = sys.argv[1]
out = []
PAT = {
 'devpath': re.compile(rb'(?i)([A-Z]:[\\/]+Users[\\/]|\.doubao-venv|\.chrome-temp|\.doubao-build)'),
 'cookie_kv': re.compile(rb'(?i)\b(sessionid|sessionid_ss|sid_tt|sid_guard|uid_tt|ttwid|passport_csrf_token|odin_tt|s_v_web_id)\s*[=:]\s*["\']?[A-Za-z0-9%|._-]{12,}'),
 'apikey': re.compile(rb'\b(sk-[A-Za-z0-9]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{30,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})'),
 'bearer': re.compile(rb'Bearer\s+[A-Za-z0-9._-]{24,}'),
 'phone': re.compile(rb'(?<![0-9A-Za-z])1[3-9][0-9]{9}(?![0-9A-Za-z])'),
 'password_kv': re.compile(rb'(?i)"(password|passwd|pwd)"\s*:\s*"[^"]{3,}"'),
 'privkey': re.compile(rb'-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----'),
}
SUSPECT_NAMES = re.compile(r'(?i)(\.log$|\.sqlite$|\.db$|\.env$|cookies?$|cookie.*\.(txt|json)$|local storage|leveldb|\.pem$|\.key$|\.pfx$|\.p12$|fixture|capture|config\.json$|history$|login data$|web data$|\.har$|questions?.*\.(json|xlsx|csv)$|question-bank)')
counts = {}
def note(kind, path, detail=''):
    counts[kind] = counts.get(kind, 0) + 1
    out.append(f'{kind}\t{os.path.relpath(path, root)}\t{detail}')
def scan_bytes(path, data, inside=''):
    for kind, pat in PAT.items():
        for m in pat.finditer(data):
            if kind == 'phone':
                ctx = data[max(0,m.start()-40):m.end()+40]
                if b'node_modules' in path.encode() : continue
                if not re.search(rb'(?i)(phone|tel|mobile|\xe6\x89\x8b\xe6\x9c\xba|\xe7\x94\xb5\xe8\xaf\x9d|account|user)', ctx): continue
            s = data[max(0,m.start()-30):m.end()+30].decode('utf-8','replace').replace('\n',' ').replace('\t',' ')
            note(kind, path, (inside + ' | ' if inside else '') + s[:200])
            break
total=0
for dp, dns, fns in os.walk(root):
    for fn in fns:
        p = os.path.join(dp, fn); total+=1
        rel = os.path.relpath(p, root)
        if SUSPECT_NAMES.search(fn) or SUSPECT_NAMES.search(rel.replace('\\','/')):
            note('suspect_name', p, str(os.path.getsize(p)))
        try:
            sz = os.path.getsize(p)
            if fn.lower().endswith('.zip'):
                with zipfile.ZipFile(p) as z:
                    names = z.namelist()
                    note('zip_listing', p, f'{len(names)} entries; top: ' + ', '.join(sorted({n.split("/")[0] for n in names})[:10]))
                    for n in names:
                        if SUSPECT_NAMES.search(n.split('/')[-1]) and not n.endswith('/'):
                            note('suspect_name_in_zip', p, n)
                continue
            if sz > 60*1024*1024: note('skipped_big', p, str(sz)); continue
            with open(p,'rb') as f: data = f.read()
            scan_bytes(p, data)
        except Exception as e:
            note('error', p, repr(e))
print('files scanned', total); print(json.dumps(counts, ensure_ascii=False))
open(sys.argv[2],'w',encoding='utf-8').write('\n'.join(out))
