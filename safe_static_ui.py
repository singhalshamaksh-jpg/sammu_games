import os, re, shutil, subprocess

os.makedirs('public', exist_ok=True)
shutil.copy('multi_servers.js', 'multi_servers.bak')
shutil.copy('server.js', 'server.bak')

index_path = 'index.html' if os.path.exists('index.html') else 'public/index.html'
shutil.copy(index_path, index_path + '.bak')

with open(index_path, 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Wire static CSS, HTML modals & JS directly into index.html
with open('public/sammu_widgets.html', 'r', encoding='utf-8') as f:
    static_modals = f.read()

if 'sammu_widgets.css' not in html:
    html = html.replace('</head>', '  <link rel="stylesheet" href="/sammu_widgets.css?v=1">\n</head>')

if 'sammu_widgets.js' not in html:
    html = html.replace('</body>', f"\n{static_modals}\n<script src=\"/sammu_widgets.js?v=1\"></script>\n</body>")

with open(index_path, 'w', encoding='utf-8') as f:
    f.write(html)

# 2. Safely disable all res.send HTML replacements in multi_servers.js & server.js
# Instead of deleting multi-line blocks, we make `body.includes('</body>')` short-circuit immediately!
for fname in ['multi_servers.js', 'server.js']:
    with open(fname, 'r', encoding='utf-8') as f:
        src = f.read()
    # Turn `if (typeof body === 'string' && body.includes('</body>')` into `if (false && typeof body === 'string'`
    patched, n = re.subn(r"if\s*\(\s*typeof\s+body\s*===\s*'string'\s*&&\s*body\.includes\('</body>'\)", "if (false && typeof body === 'string'", src)
    with open(fname, 'w', encoding='utf-8') as f:
        f.write(patched)
    print(f"Neutralized {n} runtime HTML rewriters in {fname}")

# 3. Verify syntax with Node.js
c1 = subprocess.run(['node', '--check', 'multi_servers.js'], capture_output=True, text=True)
c2 = subprocess.run(['node', '--check', 'server.js'], capture_output=True, text=True)

if c1.returncode == 0 and c2.returncode == 0:
    os.remove('multi_servers.bak')
    os.remove('server.bak')
    os.remove(index_path + '.bak')
    print(f"✅ 100% SYNTAX VALID! Static UI now loads directly from {index_path}!")
else:
    print("❌ Error:", c1.stderr, c2.stderr)
    shutil.move('multi_servers.bak', 'multi_servers.js')
    shutil.move('server.bak', 'server.js')
    shutil.move(index_path + '.bak', index_path)
