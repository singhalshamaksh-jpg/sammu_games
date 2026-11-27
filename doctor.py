import os, glob, json, subprocess

print("🩺 Running SammuGames Codebase Doctor...")
errors = []

# 1. Check every .js file in root, modules/, and public/
js_files = glob.glob("*.js") + glob.glob("modules/*.js") + glob.glob("public/*.js")
for jf in sorted(js_files):
    if os.path.getsize(jf) == 0:
        errors.append(f"EMPTY FILE: {jf} is 0 bytes!")
        continue
    res = subprocess.run(["node", "--check", jf], capture_output=True, text=True)
    if res.returncode != 0:
        errors.append(f"SYNTAX ERROR in {jf}:\n{res.stderr.strip()}")

# 2. Verify all 6 modules export a function
mod_check = subprocess.run(
    ["node", "-e", "['phonk_dj','party_games','sammuverse_rpg','royal_lounge','chaos_ai_fx','water_io'].forEach(m=>{if(typeof require('./modules/'+m)!=='function')throw new Error(m+' is not a function')})"],
    capture_output=True, text=True
)
if mod_check.returncode != 0:
    errors.append(f"MODULE EXPORT ERROR:\n{mod_check.stderr.strip()}")

# 3. Check all .json database files for corruption
for jsn in glob.glob("*.json"):
    try:
        with open(jsn, "r", encoding="utf-8") as f:
            json.load(f)
    except Exception as e:
        errors.append(f"CORRUPT JSON in {jsn}: {e}")

if errors:
    print("❌ ISSUES FOUND:")
    for err in errors:
        print("  •", err)
    exit(1)
else:
    print(f"✅ ALL {len(js_files)} JS FILES & ALL MODULES ARE 100% HEALTHY!")
