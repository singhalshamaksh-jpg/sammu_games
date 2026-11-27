import os, time, glob, shutil, subprocess, urllib.request, datetime

SAFE_DIR = ".autopilot_safe"
os.makedirs(SAFE_DIR, exist_ok=True)

WATCH_PATTERNS = ["*.js", "public/*.js", "public/*.css", "index.html", "public/index.html"]
PORT = os.environ.get("PORT", "3000")

def get_watched_files():
    files = []
    for pat in WATCH_PATTERNS:
        files.extend(glob.glob(pat))
    return sorted(set(f for f in files if os.path.isfile(f) and not f.endswith(".bak")))

def snapshot_all(files):
    for f in files:
        dest = os.path.join(SAFE_DIR, f.replace("/", "__"))
        shutil.copy2(f, dest)

def restore_file(f):
    src = os.path.join(SAFE_DIR, f.replace("/", "__"))
    if os.path.exists(src):
        shutil.copy2(src, f)
        return True
    return False

def check_syntax(files):
    for f in files:
        if f.endswith(".js"):
            if os.path.getsize(f) == 0:
                return f, "File is empty (0 bytes)"
            res = subprocess.run(["node", "--check", f], capture_output=True, text=True)
            if res.returncode != 0:
                return f, res.stderr.strip()
    return None, None

def server_alive():
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/", timeout=4) as r:
            return r.status == 200
    except Exception:
        return False

def restart_server():
    subprocess.run("pm2 restart sammu-games 2>/dev/null || (pkill -f 'node.*server.js' && nohup node --expose-gc --max-old-space-size=350 server.js > server.log 2>&1 &)", shell=True)
    time.sleep(3)

def git_sync_with_diff(changed_files):
    # Save human-readable diff for manual inspection
    diff_out = subprocess.run(["git", "diff"] + changed_files, capture_output=True, text=True).stdout
    if diff_out.strip():
        with open("LAST_EDIT_DIFF.txt", "w", encoding="utf-8") as df:
            df.write(f"=== Verified Edit at {datetime.datetime.now()} ===\nChanged: {', '.join(changed_files)}\n\n{diff_out}")

    status = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True).stdout.strip()
    if not status:
        return
    subprocess.run(["git", "add", "."], check=False)
    msg = f"Verified Autopilot Sync ({', '.join(changed_files[:3])}) [{datetime.datetime.now().strftime('%H:%M:%S')}]"
    subprocess.run(["git", "commit", "-m", msg], capture_output=True)
    push = subprocess.run(["git", "push", "origin", "HEAD"], capture_output=True, text=True)
    if push.returncode == 0:
        print(f"🚀 [GitSyncBot] Pushed verified changes to GitHub: {', '.join(changed_files)}", flush=True)
    else:
        print(f"⚠️ [GitSyncBot] Push warning: {push.stderr.strip()}", flush=True)

# Initial baseline snapshot
files = get_watched_files()
bad_f, err = check_syntax(files)
if not bad_f:
    snapshot_all(files)
print(f"🤖 [Autopilot Swarm Online] Guarding {len(files)} files | Port {PORT}", flush=True)

mtimes = {f: os.path.getmtime(f) for f in files}
last_health_check = 0

while True:
    time.sleep(2)
    current_files = get_watched_files()
    changed = [f for f in current_files if os.path.getmtime(f) != mtimes.get(f)]

    if changed:
        time.sleep(1.5)  # Let editor/Gemini finish writing
        print(f"🔍 [GuardianBot] Detected edits in: {', '.join(changed)}", flush=True)
        bad_file, syntax_err = check_syntax(current_files)

        if bad_file:
            print(f"🛡️ [GuardianBot] BLOCKED CRASH! Syntax error in {bad_file}:\n{syntax_err}", flush=True)
            if restore_file(bad_file):
                print(f"♻️ [GuardianBot] Instantly restored last safe version of {bad_file}!", flush=True)
            mtimes = {f: os.path.getmtime(f) for f in get_watched_files()}
            continue

        # Syntax passed -> restart server & verify HTTP 200 before syncing to GitHub
        restart_server()
        if server_alive():
            snapshot_all(current_files)
            git_sync_with_diff(changed)
        else:
            print(f"🚨 [WatchdogBot] Server failed runtime boot after editing {changed}! Rolling back...", flush=True)
            for cf in changed:
                restore_file(cf)
            restart_server()

        mtimes = {f: os.path.getmtime(f) for f in get_watched_files()}

    # Periodic 12-second Watchdog heartbeat
    if time.time() - last_health_check > 12:
        last_health_check = time.time()
        if not server_alive():
            print("🩺 [WatchdogBot] Server unresponsive — auto-restarting...", flush=True)
            restart_server()
