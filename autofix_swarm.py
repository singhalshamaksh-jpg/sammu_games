import os, time, glob, re, json, subprocess, urllib.request, datetime

WATCH_PATTERNS = ["*.js", "public/*.js", "public/*.css", "index.html", "public/index.html"]

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
    m = re.search(rf"{re.escape(filepath)}:(\d+)", error_msg)
    err_line = int(m.group(1)) if m else 1
    with open(filepath, "r", encoding="utf-8") as f:
        lines = f.readlines()

    start, end = max(0, err_line - 25), min(len(lines), err_line + 25)
    snippet = "".join(f"{i+1}: {lines[i]}" for i in range(start, end))
    prompt = f"Fix ONLY the JS syntax error in `{filepath}` around line {err_line}.\nError:\n{error_msg}\n\nCode (Lines {start+1}-{end}):\n{snippet}\n\nReturn ONLY the corrected code without line numbers or markdown fences."

    fixed_block = None
    hc_keys = [v.strip() for k, v in os.environ.items() if re.search(r"HACKCLUB|PARTICLE|HC_AI", k, re.I) and len(v.strip()) > 8]
    for key in hc_keys:
        try:
            req = urllib.request.Request(
                "https://hackclub.com",
                data=json.dumps({"model": "qwen/qwen3-32b", "messages": [{"role": "user", "content": prompt}], "temperature": 0.1}).encode("utf-8"),
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=25) as r:
                txt = json.loads(r.read().decode("utf-8"))["choices"]["message"]["content"]
                fixed_block = re.sub(r"<think>[\s\S]*?</think>", "", txt).strip()
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

    fixed_block = re.sub(r"^```[a-zA-Z]*\n|\n```$", "", fixed_block).strip()
    if not fixed_block:
        return False

    with open(filepath, "w", encoding="utf-8") as f:
        f.writelines(lines[:start] + [fixed_block + "\n"] + lines[end:])
    return True

def clean_restart_node():
    subprocess.run("pkill -9 -f 'node.*server.js' 2>/dev/null", shell=True)
    time.sleep(1)
    log_f = open("server.log", "a", encoding="utf-8")
    subprocess.Popen(
        ["node", "--expose-gc", "--max-old-space-size=350", "server.js"],
        stdout=log_f, stderr=log_f, start_new_session=True
    )
    time.sleep(2)
    print(f"🚀 [LiveReloadBot] Site live & reloaded at {datetime.datetime.now().strftime('%H:%M:%S')}", flush=True)

files = get_watched_files()
mtimes = {f: os.path.getmtime(f) for f in files}
clean_restart_node()
print(f"🤖 [Direct AutoFix Swarm Active] Watching {len(files)} files (Instant Local Reload, Zero GitHub Delay)", flush=True)

while True:
    time.sleep(2)
    current_files = get_watched_files()
    changed = [f for f in current_files if os.path.getmtime(f) != mtimes.get(f)]

    if changed:
        time.sleep(1.5)
        print(f"🔍 [AutoFixBot] Edits detected in: {', '.join(changed)}", flush=True)
        for attempt in range(1, 4):
            bad_file, err = check_syntax(current_files)
            if not bad_file:
                break
            print(f"🛠️ [AutoFixBot] Attempt {attempt}: Auto-repairing {bad_file}...", flush=True)
            ai_repair_syntax(bad_file, err)

        bad_file, err = check_syntax(current_files)
        if not bad_file:
            clean_restart_node()
        else:
            print(f"⚠️ [AutoFixBot] Syntax check warning on {bad_file}:\n{err}", flush=True)
        mtimes = {f: os.path.getmtime(f) for f in get_watched_files()}
