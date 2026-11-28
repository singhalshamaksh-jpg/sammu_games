import os, time, glob, re, json, subprocess, urllib.request, datetime

WATCH_PATTERNS = ["*.js", "public/*.js", "public/*.css", "index.html", "public/index.html"]
PORT = os.environ.get("PORT", "3000")

# Load .env keys for AI auto-repair
if os.path.exists(".env"):
    with open(".env", "r", encoding="utf-8") as ef:
        for line in ef:
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.strip().split("=", 1)
                os.environ[k.strip()] = v.strip().strip("'\"")

def get_watched_files():
    files = []
    for pat in WATCH_PATTERNS:
        files.extend(glob.glob(pat))
    return sorted(set(f for f in files if os.path.isfile(f) and not f.endswith(".bak")))

def check_syntax(files):
    for f in files:
        if f.endswith(".js"):
            res = subprocess.run(["node", "--check", f], capture_output=True, text=True)
            if res.returncode != 0:
                return f, res.stderr.strip()
    return None, None

def ai_repair_syntax(filepath, error_msg):
    """Extracts the exact broken line window and asks HackClub/Pollinations AI to repair it in place."""
    m = re.search(rf"{re.escape(filepath)}:(\d+)", error_msg)
    err_line = int(m.group(1)) if m else 1

    with open(filepath, "r", encoding="utf-8") as f:
        lines = f.readlines()

    start = max(0, err_line - 25)
    end = min(len(lines), err_line + 25)
    snippet = "".join(f"{i+1}: {lines[i]}" for i in range(start, end))

    prompt = (
        f"Fix ONLY the JavaScript syntax error in `{filepath}` around line {err_line}.\n"
        f"Error:\n{error_msg}\n\n"
        f"Code Window (Lines {start+1}-{end}):\n{snippet}\n\n"
        f"Return ONLY the corrected code for lines {start+1}-{end} without line numbers or markdown fences."
    )

    fixed_block = None
    hc_keys = [v.strip() for k, v in os.environ.items() if re.search(r"HACKCLUB|PARTICLE|HC_AI", k, re.I) and len(v.strip()) > 8]

    for key in hc_keys:
        try:
            req = urllib.request.Request(
                "https://hackclub.com",
                data=json.dumps({
                    "model": "qwen/qwen3-32b",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.1
                }).encode("utf-8"),
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=25) as r:
                d = json.loads(r.read().decode("utf-8"))
                txt = d["choices"][0]["message"]["content"]
                fixed_block = re.sub(r"<think>[\s\(\S\)]*?</think>", "", txt).strip()
                break
        except Exception:
            pass

    if not fixed_block:
        try:
            req = urllib.request.Request(
                "https://pollinations.ai",
                data=json.dumps({"messages": [{"role": "user", "content": prompt}], "model": "openai"}).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=25) as r:
                fixed_block = r.read().decode("utf-8").strip()
        except Exception:
            return False

    # Strip accidental ```js fences if returned
    fixed_block = re.sub(r"^```[a-zA-Z]*\n|\n```$", "", fixed_block).strip()
    if not fixed_block:
        return False

    new_lines = lines[:start] + [fixed_block + "\n"] + lines[end:]
    with open(filepath, "w", encoding="utf-8") as f:
        f.writelines(new_lines)
    return True

def clean_restart_node():
    # Kill any process holding port 3000 cleanly before starting one single instance
    subprocess.run("pkill -9 -f 'node.*server' 2>/dev/null", shell=True)
    time.sleep(1)
    subprocess.run("nohup node --expose-gc --max-old-space-size=350 server.js > server.log 2>&1 &", shell=True)
    time.sleep(2.5)

def push_to_github(changed_files):
    diff_out = subprocess.run(["git", "diff"] + changed_files, capture_output=True, text=True).stdout
    if diff_out.strip():
        with open("LAST_EDIT_DIFF.txt", "w", encoding="utf-8") as df:
            df.write(f"=== Verified Edit at {datetime.datetime.now()} ===\nChanged: {', '.join(changed_files)}\n\n{diff_out}")

    if not subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True).stdout.strip():
        return
    subprocess.run(["git", "add", "."], check=False)
    msg = f"AutoFix & Sync ({', '.join(changed_files[:3])}) [{datetime.datetime.now().strftime('%H:%M:%S')}]"
    subprocess.run(["git", "commit", "-m", msg], capture_output=True)
    push = subprocess.run(["git", "push", "origin", "HEAD"], capture_output=True, text=True)
    if push.returncode == 0:
        print(f"🚀 [GitSyncBot] Pushed to GitHub: {', '.join(changed_files)}", flush=True)
    else:
        print(f"⚠️ [GitSyncBot] Push note: {push.stderr.strip()}", flush=True)

files = get_watched_files()
mtimes = {f: os.path.getmtime(f) for f in files}
print(f"🤖 [AutoFix Swarm Online] Watching {len(files)} files (No Rollbacks — AI Auto-Repair Active)", flush=True)

while True:
    time.sleep(2)
    current_files = get_watched_files()
    changed = [f for f in current_files if os.path.getmtime(f) != mtimes.get(f)]

    if changed:
        time.sleep(1.5)
        print(f"🔍 [AutoFixBot] Edits detected in: {', '.join(changed)}", flush=True)

        # Up to 3 AI self-repair passes if any syntax error exists
        for attempt in range(1, 4):
            bad_file, err = check_syntax(current_files)
            if not bad_file:
                break
            print(f"🛠️ [AutoFixBot] Attempt {attempt}: Repairing syntax error in {bad_file}...", flush=True)
            ai_repair_syntax(bad_file, err)

        bad_file, err = check_syntax(current_files)
        if not bad_file:
            clean_restart_node()
            push_to_github(changed)
        else:
            print(f"⚠️ [AutoFixBot] Needs manual check on {bad_file}:\n{err}", flush=True)

        mtimes = {f: os.path.getmtime(f) for f in get_watched_files()}
