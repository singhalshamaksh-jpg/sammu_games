import os, re, shutil, subprocess

os.makedirs('public', exist_ok=True)
shutil.copy('multi_servers.js', 'multi_servers.pre_extract.js')
shutil.copy('server.js', 'server.pre_extract.js')

with open('multi_servers.js', 'r', encoding='utf-8') as f:
    ms_code = f.read()

with open('server.js', 'r', encoding='utf-8') as f:
    srv_code = f.read()

# Find index.html location
index_path = 'index.html' if os.path.exists('index.html') else ('public/index.html' if os.path.exists('public/index.html') else None)
if not index_path:
    print("❌ Could not find index.html!")
    exit(1)

shutil.copy(index_path, index_path + '.backup')
with open(index_path, 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Extract all widget constants from multi_servers.js & server.js
widget_names = [
    'MULTI_SERVER_UI', 'WORD_IMPOSTER_WIDGET', 'ZORO_ISOLATION_SCRIPT',
    'PHONK_DJ_WIDGET', 'AI_CONSOLE_WIDGET', 'PHONK_PRO_UPGRADE', 'MAFIA_UI',
    'ROYALE_UI', 'ZOMBIE_UI', 'COOP_PARTY_UI', 'BLUFF_UI', 'ISLAND_UI',
    'PARTY_ALL_IN_ONE_UI', 'SOCKET_UI_BOOT', 'SERVER_WP_PACK',
    'GACHA_FLEX_SCRIPT', 'COURT_UI', 'SV_PAGE_BOOT_TAG',
    'WORLD_RAID_HUD_UI', 'GLOBAL_LB_CLIENT_SCRIPT',
    'GLOBAL_CHAT_AND_GAME_AUDIO', 'HK_CREATOR_PANEL_UI',
    'IN_APP_BROWSER_PATCH_UI', 'V5_EXPANSION_UI', 'V6_COMPLETE_CLIENT_BUNDLE',
    'V6_SOCKET_RECEIVER', 'ANTI_LAG_BOOSTER_UI', 'PIECE3_AND_4_HTML',
    'PIECE5_PART1', 'MAKEUP_STUDIO_WIDGET', 'DIDI_PROMO_WIDGET',
    'MASTERCHEF_STUDIO_WIDGET', 'NEW_ARENAS_WIDGET'
]

# Dump all widget HTML/CSS/JS via a tiny temporary Node helper so template literals evaluate cleanly!
helper_js = """
const fs = require('fs');
let ms = fs.readFileSync('multi_servers.js', 'utf8');
let srv = fs.readFileSync('server.js', 'utf8');

// Extract const declarations cleanly by evaluating only string constants in a sandbox
const vm = require('vm');
const sandbox = {
    require: () => new Proxy(() => ({}), { get: () => () => ({}), apply: () => ({}) }),
    process: { env: {}, on: () => {} },
    __dirname: process.cwd(),
    console: { log: () => {}, error: () => {} },
    setInterval: () => 0,
    setTimeout: () => 0,
    Buffer, URL
};
vm.createContext(sandbox);

// Grab all uppercase template string blocks from both files
const combined = ms + '\\n' + srv;
const regex = /const\\s+([A-Z0-9_]+)\\s*=\\s*`([\\s\\S]*?)`;/g;
let match, extractedHtml = [], extractedCss = [], extractedJs = [];

while ((match = regex.exec(combined)) !== null) {
    const name = match[1];
    let content = match[2];
    if (!content.includes('<script') && !content.includes('<style') && !content.includes('<div') && !content.includes('<button') && !content.includes('<canvas')) continue;
    if (name === 'WATERIO_HTML') continue; // Keep standalone /waterio page intact

    // Pull out <style> blocks
    content = content.replace(/<style[^>]*>([\\s\\S]*?)<\\/style>/gi, (_, css) => {
        extractedCss.push(`/* === ${name} === */\\n` + css.trim());
        return '';
    });

    // Pull out <script> blocks
    content = content.replace(/<script[^>]*>([\\s\\S]*?)<\\/script>/gi, (_, js) => {
        extractedJs.push(`// === ${name} ===\\n` + js.trim());
        return '';
    });

    const cleanMarkup = content.trim();
    if (cleanMarkup) extractedHtml.push(`<!-- === ${name} === -->\\n` + cleanMarkup);
}

fs.writeFileSync('public/sammu_widgets.css', extractedCss.join('\\n\\n'));
fs.writeFileSync('public/sammu_widgets.js', extractedJs.join('\\n\\n'));
fs.writeFileSync('public/sammu_widgets.html', extractedHtml.join('\\n\\n'));
console.log(`Extracted ${extractedCss.length} CSS blocks, ${extractedJs.length} JS blocks, ${extractedHtml.length} HTML modals.`);
"""

with open('_dump_widgets.js', 'w', encoding='utf-8') as f:
    f.write(helper_js)

res = subprocess.run(['node', '_dump_widgets.js'], capture_output=True, text=True)
os.remove('_dump_widgets.js')
print(res.stdout.strip())

# 2. Inject static HTML + CSS + JS links directly into index.html
with open('public/sammu_widgets.html', 'r', encoding='utf-8') as f:
    static_modals = f.read()

if 'sammu_widgets.css' not in html:
    html = html.replace('</head>', '  <link rel="stylesheet" href="/sammu_widgets.css?v=1">\n</head>')

if 'sammu_widgets.js' not in html:
    injection = f"\n{static_modals}\n<script src=\"/sammu_widgets.js?v=1\"></script>\n</body>"
    html = html.replace('</body>', injection)

with open(index_path, 'w', encoding='utf-8') as f:
    f.write(html)

# 3. Strip all slow res.send HTML wrappers out of multi_servers.js & server.js
wrapper_pattern = re.compile(
    r"app\.use\(\(req,\s*res,\s*next\)\s*=>\s*\{\s*const\s+(?:origSend|_send)\s*=\s*res\.send;\s*res\.send\s*=\s*function[\s\S]*?next\(\);\s*\}\);",
    re.MULTILINE
)

ms_clean, ms_count = wrapper_pattern.subn("// [Static UI moved to public/sammu_widgets.*]", ms_code)
srv_clean, srv_count = wrapper_pattern.subn("// [Static UI moved to public/sammu_widgets.*]", srv_code)

# Also simplify server.js index route to serve static index.html directly
srv_clean = re.sub(
    r"app\.get\(\['/', '/index\.html'\],\s*\(req, res, next\) => \{[\s\S]*?\}\);",
    "app.get(['/', '/index.html'], (req, res) => res.sendFile(path.join(__dirname, '" + index_path + "')));",
    srv_clean,
    count=1
)

with open('multi_servers.js', 'w', encoding='utf-8') as f:
    f.write(ms_clean)

with open('server.js', 'w', encoding='utf-8') as f:
    f.write(srv_clean)

# 4. Syntax-check both backend files before finishing
c1 = subprocess.run(['node', '--check', 'multi_servers.js'], capture_output=True, text=True)
c2 = subprocess.run(['node', '--check', 'server.js'], capture_output=True, text=True)

if c1.returncode == 0 and c2.returncode == 0:
    print(f"✅ SUCCESS! Removed {ms_count + srv_count} res.send HTML wrappers and loaded UI directly into {index_path}!")
else:
    print("❌ Syntax Error, restoring backups:", c1.stderr, c2.stderr)
    shutil.copy('multi_servers.pre_extract.js', 'multi_servers.js')
    shutil.copy('server.pre_extract.js', 'server.js')
    shutil.copy(index_path + '.backup', index_path)
