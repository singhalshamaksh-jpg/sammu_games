import re, shutil, subprocess

# 1. Backup original files
shutil.copy('multi_servers.js', 'multi_servers.backup.js')
shutil.copy('server.js', 'server.backup.js')

with open('multi_servers.js', 'r', encoding='utf-8') as f:
    code = f.read()

fixes_applied = []

# Bug 1: Fix ECO_DB_FILE undefined variable & save both wallets + cards
old_eco_1 = "fs.writeFileSync(ECO_DB_FILE, JSON.stringify(playerWallet, null, 2));"
new_eco_1 = "fs.writeFileSync(ECONOMY_DB_FILE, JSON.stringify({ wallets: Object.fromEntries(playerWallet), cards: Object.fromEntries(playerCards) }, null, 2));"
if old_eco_1 in code:
    code = code.replace(old_eco_1, new_eco_1)
    fixes_applied.append("Fixed ECO_DB_FILE local save crash")

old_eco_2 = "upstashCmd(['SET', 'sammu_economy', JSON.stringify(playerWallet)]);"
new_eco_2 = "upstashCmd(['SET', 'sammu_economy', JSON.stringify({ wallets: Object.fromEntries(playerWallet), cards: Object.fromEntries(playerCards) })]);"
if old_eco_2 in code:
    code = code.replace(old_eco_2, new_eco_2)
    fixes_applied.append("Fixed Upstash economy serialization (Map -> Object)")

# Bug 2: Fix /ai-song broken JioSaavn mirror URLs
if "https://saavn.dev${encodeURIComponent(q)}" in code:
    code = code.replace("https://saavn.dev${encodeURIComponent(q)}", "https://saavn.dev{encodeURIComponent(q)}")
    code = code.replace("https://vercel.app${encodeURIComponent(q)}", "https://vercel.app{encodeURIComponent(q)}")
    fixes_applied.append("Fixed /ai-song JioSaavn API URLs")

# Bug 3: Fix TopSecret AI Console `const fab` block-scope ReferenceError
old_fab = """const exists = document.getElementById('aiConsoleFab');
          if (window.selectedServerId === 'srv_topsecret') {
            if (!exists) {
              const fab = document.createElement('button');"""
new_fab = """let fab = document.getElementById('aiConsoleFab');
          if (window.selectedServerId === 'srv_topsecret') {
            if (!fab) {
              fab = document.createElement('button');"""
if old_fab in code:
    code = code.replace(old_fab, new_fab).replace("if (exists) exists.style.display = 'none';", "if (fab) fab.style.display = 'none';")
    fixes_applied.append("Fixed TopSecret AI Console fab ReferenceError")

# Bug 4: Fix Castaway Island hoarder array sort & display
old_island = "const rat = Object.entries(st.greedMap).sort((a, b) => b - a);"
new_island = "const rat = Object.entries(st.greedMap).sort((a, b) => b[1] - a[1])[0];"
if old_island in code:
    code = code.replace(old_island, new_island).replace(
        "${rat ? rat : 'Nobody — Pure Teamwork!'}",
        "${rat ? `${rat[0]} (${rat[1]}x)` : 'Nobody — Pure Teamwork!'}"
    )
    fixes_applied.append("Fixed Castaway Island hoarder leaderboard")

# Bug 5: Fix !duelcard array indexing bug
old_duel = """const targetName = parts;
                const bet = Math.max(50, Math.min(500, parseInt(parts, 10) || 100));"""
new_duel = """const targetName = parts[0];
                const bet = Math.max(50, Math.min(500, parseInt(parts[1], 10) || 100));"""
if old_duel in code:
    code = code.replace(old_duel, new_duel)
    fixes_applied.append("Fixed !duelcard bet & targetName parsing")

# Bug 6: Fix W2_CHAPTERS.at(0) missing index in applyV6BattleRewards
if "W2_CHAPTERS.find(c => c.ch === b.w2Chapter) || W2_CHAPTERS;" in code:
    code = code.replace("W2_CHAPTERS.find(c => c.ch === b.w2Chapter) || W2_CHAPTERS;", "W2_CHAPTERS.find(c => c.ch === b.w2Chapter) || W2_CHAPTERS.at(0);")
    fixes_applied.append("Fixed W2_CHAPTERS fallback reference")

# Bug 7: Batch all 14 nested res.send HTML injections into 1 fast pass
widgets = []
pattern = re.compile(
    r"app\.use\(\(req, res, next\) => \{\s*const origSend = res\.send;\s*res\.send = function\s*\(body\) \{\s*if \(typeof body === 'string' && body\.includes\('</body>'\)[^)]*\) \{\s*body = body\.replace\('</body>',\s*([A-Z0-9_]+)\s*\+\s*'\\n</body>'\);\s*\}\s*return origSend\.call\(this, body\);\s*\};\s*next\(\);\s*\}\);",
    re.MULTILINE
)

def collect_widget(match):
    w_name = match.group(1)
    widgets.append(w_name)
    return f"// [Batched into SINGLE_HTML_INJECTOR: {w_name}]"

code = pattern.sub(collect_widget, code)

if widgets:
    single_injector = f"""
    // === ⚡ SINGLE FAST HTML WIDGET INJECTOR (REPLACES {len(widgets)} NESTED WRAPPERS) ===
    app.use((req, res, next) => {{
        const origSend = res.send;
        res.send = function(body) {{
            if (typeof body === 'string' && body.includes('</body>') && !body.includes('_sammuAllWidgetsInjected')) {{
                const bundle = ['<!-- _sammuAllWidgetsInjected -->', {', '.join(widgets)}].join('\\n');
                body = body.replace('</body>', bundle + '\\n</body>');
            }}
            return origSend.call(this, body);
        }};
        next();
    }});
    return OG_HOSTS;"""
    code = code.replace("return OG_HOSTS;", single_injector, 1)
    fixes_applied.append(f"Merged {len(widgets)} nested HTML wrappers into 1 fast pass")

with open('multi_servers.js', 'w', encoding='utf-8') as f:
    f.write(code)

# 8. Verify Node.js syntax check before restarting
check = subprocess.run(['node', '--check', 'multi_servers.js'], capture_output=True, text=True)
if check.returncode == 0:
    print("✅ SYNTAX CHECK PASSED! Applied fixes:")
    for item in fixes_applied:
        print("  •", item)
else:
    print("❌ Syntax Error Detected, restoring backup:\n", check.stderr)
    shutil.copy('multi_servers.backup.js', 'multi_servers.js')
