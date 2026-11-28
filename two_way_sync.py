import os, time, glob, subprocess, datetime

WATCH_PATTERNS = ["*.js", "public/*.js", "public/*.css", "index.html", "public/index.html", "GEMINI.md"]

def get_watched_files():
    files = []
    for pat in WATCH_PATTERNS:
        files.extend(glob.glob(pat))
    return sorted(set(f for f in files if os.path.isfile(f) and not f.endswith(".bak")))

def syntax_ok():
    for f in glob.glob("*.js") + glob.glob("public/*.js"):
        res = subprocess.run(["node", "--check", f], capture_output=True, text=True)
        if res.returncode != 0:
            print(f"❌ Syntax error in {f} — skipping reload/push:\n{res.stderr}", flush=True)
            return False
    return True

def restart_server():
    subprocess.run("pkill -9 -f 'node.*server.js' 2>/dev/null", shell=True)
    time.sleep(1)
    log_f = open("server.log", "a", encoding="utf-8")
    subprocess.Popen(
        ["node", "--expose-gc", "--max-old-space-size=350", "server.js"],
        stdout=log_f, stderr=log_f, start_new_session=True
    )
    time.sleep(2)
    print(f"🚀 [Server] Live & reloaded at {datetime.datetime.now().strftime('%H:%M:%S')}", flush=True)

def pull_from_github():
    subprocess.run(["git", "fetch", "origin"], capture_output=True)
    behind = subprocess.run(["git", "rev-list", "HEAD..origin/HEAD", "--count"], capture_output=True, text=True).stdout.strip()
    if behind and behind.isdigit() and int(behind) > 0:
        print(f"⬇️ [GitHub -> Termux] Pulling {behind} new commit(s) from GitHub...", flush=True)
        pull = subprocess.run(["git", "pull", "--rebase", "origin", "HEAD"], capture_output=True, text=True)
        if pull.returncode == 0 and syntax_ok():
            restart_server()
            print("✅ [GitHub -> Termux] Synced & live!", flush=True)
            return True
    return False

def push_to_github(changed_files):
    if not syntax_ok():
        return
    status = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True).stdout.strip()
    if not status:
        return
    subprocess.run(["git", "add", "."], check=False)
    msg = f"Termux Sync ({', '.join(changed_files[:3])}) [{datetime.datetime.now().strftime('%H:%M:%S')}]"
    subprocess.run(["git", "commit", "-m", msg], capture_output=True)
    subprocess.run(["git", "pull", "--rebase", "origin", "HEAD"], capture_output=True)
    push = subprocess.run(["git", "push", "origin", "HEAD"], capture_output=True, text=True)
    if push.returncode == 0:
        print(f"⬆️ [Termux -> GitHub] Pushed: {', '.join(changed_files)}", flush=True)
    else:
        print(f"⚠️ [Push Error] {push.stderr.strip()}", flush=True)

files = get_watched_files()
mtimes = {f: os.path.getmtime(f) for f in files}
restart_server()
print(f"🔄 [Two-Way Sync Active] Guarding {len(files)} files (GitHub <-> Termux)", flush=True)

last_pull_check = 0
while True:
    time.sleep(2)

    # 1. Check for local edits in Termux -> Push to GitHub + Reload
    current_files = get_watched_files()
    changed = [f for f in current_files if os.path.getmtime(f) != mtimes.get(f)]
    if changed:
        time.sleep(1.5)
        if syntax_ok():
            restart_server()
            push_to_github(changed)
        mtimes = {f: os.path.getmtime(f) for f in get_watched_files()}

    # 2. Every 15 seconds, check GitHub for remote edits -> Pull to Termux + Reload
    if time.time() - last_pull_check > 15:
        last_pull_check = time.time()
        if pull_from_github():
            mtimes = {f: os.path.getmtime(f) for f in get_watched_files()}
