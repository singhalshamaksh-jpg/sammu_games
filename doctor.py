import os, glob, json, subprocess
print("🩺 Running SammuGames Codebase Doctor...")
errors = []
for jf in sorted(glob.glob("*.js") + glob.glob("public/*.js")):
    if os.path.getsize(jf) == 0:
        errors.append(f"EMPTY FILE: {jf}")
        continue
    res = subprocess.run(["node", "--check", jf], capture_output=True, text=True)
    if res.returncode != 0:
        errors.append(f"SYNTAX ERROR in {jf}:\n{res.stderr.strip()}")
for jsn in glob.glob("*.json"):
    try:
        with open(jsn, "r", encoding="utf-8") as f: json.load(f)
    except Exception as e:
        errors.append(f"CORRUPT JSON in {jsn}: {e}")
if errors:
    print("❌ ISSUES FOUND:\n" + "\n".join(errors))
    exit(1)
print("✅ ALL JS & JSON FILES ARE 100% HEALTHY!")
